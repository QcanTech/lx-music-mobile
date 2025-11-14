#import "UserApiModule.h"
#import <React/RCTLog.h>
#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <CommonCrypto/CommonCrypto.h>
#import <CommonCrypto/CommonDigest.h>

// Define constants to match Android HandlerWhat.java
#define ACTION 1
#define LOG 2
#define INIT_FAILED 3

@implementation UserApiModule
{
    JSContext *_jsContext;
    BOOL _isJavaScriptThreadRunning;
    NSString *_currentScript;
    NSDictionary *_scriptInfo;
    dispatch_queue_t _jsQueue;
    NSString *_key;
    BOOL _inited;
    NSInteger _listenerCount; // Add this line to track listener count
}

RCT_EXPORT_MODULE(UserApiModule);

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"api-action", @"log"];
}

- (void)startObserving {
    // No need to do anything here
}

- (void)stopObserving {
    // No need to do anything here
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    [super addListener:eventName];
    _listenerCount += 1;
}

RCT_EXPORT_METHOD(removeListeners:(NSInteger)count) {
    [super removeListeners:count];
    _listenerCount -= count; // Decrement listener count
    if (_listenerCount < 0) {
        _listenerCount = 0;
    }
}

// Helper method to generate UUID
- (NSString *)generateUUID {
    NSUUID *uuid = [[NSUUID alloc] init];
    NSString *result = [uuid UUIDString];
    return result ? result : [[NSString alloc] initWithString:@""];
}

// Helper method for Base64 encoding
- (NSString *)base64Encode:(NSData *)data {
    return [[NSString alloc] initWithString:[data base64EncodedStringWithOptions:0]];
}

// Helper method for Base64 decoding
- (NSData *)base64Decode:(NSString *)string {
    return [[NSData alloc] initWithBase64EncodedString:string options:0];
}

// Helper method for MD5 hashing
- (NSString *)md5Hash:(NSString *)input {
    const char *cStr = [input UTF8String];
    unsigned char digest[CC_MD5_DIGEST_LENGTH];
    CC_MD5(cStr, (CC_LONG)strlen(cStr), digest);
    
    NSMutableString *output = [NSMutableString stringWithCapacity:CC_MD5_DIGEST_LENGTH * 2];
    
    for (int i = 0; i < CC_MD5_DIGEST_LENGTH; i++) {
        [output appendFormat:@"%02x", digest[i]];
    }
    
    return [output copy]; // Return immutable copy
}

// Helper method for AES encryption
- (NSString *)aesEncrypt:(NSString *)data key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode {
    @try {
        NSData *dataToEncrypt = [self base64Decode:data];
        NSData *keyData = [self base64Decode:key];
        NSData *ivData = [iv length] > 0 ? [self base64Decode:iv] : nil;
        
        NSUInteger dataLength = [dataToEncrypt length];
        NSMutableData *encryptedData = [NSMutableData dataWithLength:dataLength + kCCBlockSizeAES128];
        size_t encryptedLength = 0;
        
        // Determine options based on mode
        CCOptions options = kCCOptionPKCS7Padding;
        if ([mode isEqualToString:@"AES"]) {
            options = 0; // No padding for ECB
        }
        
        // Determine IV
        const void *ivBytes = ivData ? [ivData bytes] : NULL;
        
        CCCryptorStatus cryptStatus = CCCrypt(kCCEncrypt,
                                               kCCAlgorithmAES,
                                               options,
                                               [keyData bytes],
                                               [keyData length],
                                               ivBytes,
                                               [dataToEncrypt bytes],
                                               [dataToEncrypt length],
                                               [encryptedData mutableBytes],
                                               [encryptedData length],
                                               &encryptedLength);
        
        if (cryptStatus == kCCSuccess) {
            [encryptedData setLength:encryptedLength];
            return [self base64Encode:encryptedData];
        }
        
        RCTLogError(@"AES encryption failed with status: %d", (int)cryptStatus);
        return [[NSString alloc] initWithString:@""];
    } @catch (NSException *exception) {
        RCTLogError(@"AES encryption error: %@", exception.reason);
        return [[NSString alloc] initWithString:@""];
    }
}

// Helper method for RSA encryption (placeholder implementation)
- (NSString *)rsaEncrypt:(NSString *)data key:(NSString *)key padding:(NSString *)padding {
    // For now, we'll return an empty string as a placeholder
    // A full implementation would require the Security framework
    RCTLogInfo(@"RSA encryption called but not fully implemented - returning empty string");
    return [[NSString alloc] initWithString:@""];
}

// Create environment objects in JavaScript context
- (void)createEnvObj:(JSContext *)jsContext {
    // __lx_native_call__ function
    jsContext[@"__lx_native_call__"] = ^(JSValue *key, JSValue *action, JSValue *data) {
        if ([key toString] && [_key isEqualToString:[key toString]]) {
            [self callNative:[action toString] data:[data toString]];
        }
        return [JSValue valueWithUndefinedInContext:jsContext];
    };
    
    // __lx_native_call__utils_str2b64 function
    jsContext[@"__lx_native_call__utils_str2b64"] = ^(JSValue *str) {
        @try {
            NSData *data = [str toString] ? [[str toString] dataUsingEncoding:NSUTF8StringEncoding] : nil;
            if (data) {
                NSString *result = [self base64Encode:data];
                return result ? result : [[NSString alloc] initWithString:@""];
            }
            return [[NSString alloc] initWithString:@""];
        } @catch (NSException *exception) {
            RCTLogError(@"utils_str2b64 error: %@", exception.reason);
            return [[NSString alloc] initWithString:@""];
        }
    };
    
    // __lx_native_call__utils_b642buf function
    jsContext[@"__lx_native_call__utils_b642buf"] = ^(JSValue *str) {
        @try {
            NSData *data = [self base64Decode:[str toString]];
            if (data) {
                NSMutableString *jsonArrayString = [NSMutableString stringWithString:@"["];
                const unsigned char *bytes = (const unsigned char *)[data bytes];
                NSUInteger length = [data length];
                
                for (int i = 0; i < length; i++) {
                    [jsonArrayString appendFormat:@"%d", bytes[i]];
                    if (i < length - 1) {
                        [jsonArrayString appendString:@","];
                    }
                }
                [jsonArrayString appendString:@"]"];
                NSString *result = [jsonArrayString copy];
                return result ? result : [[NSString alloc] initWithString:@""];
            }
            return [[NSString alloc] initWithString:@""];
        } @catch (NSException *exception) {
            RCTLogError(@"utils_b642buf error: %@", exception.reason);
            return [[NSString alloc] initWithString:@""];
        }
    };
    
    // __lx_native_call__utils_str2md5 function
    jsContext[@"__lx_native_call__utils_str2md5"] = ^(JSValue *str) {
        @try {
            NSString *inputStr = [str toString];
            if (inputStr) {
                // URL decode the string (similar to Android implementation)
                NSString *decodedStr = [inputStr stringByRemovingPercentEncoding];
                if (decodedStr) {
                    NSString *result = [self md5Hash:decodedStr];
                    return result ? result : [[NSString alloc] initWithString:@""];
                }
            }
            return [[NSString alloc] initWithString:@""];
        } @catch (NSException *exception) {
            RCTLogError(@"utils_str2md5 error: %@", exception.reason);
            return [[NSString alloc] initWithString:@""];
        }
    };
    
    // __lx_native_call__utils_aes_encrypt function
    jsContext[@"__lx_native_call__utils_aes_encrypt"] = ^(JSValue *data, JSValue *key, JSValue *iv, JSValue *mode) {
        @try {
            NSString *dataStr = [data toString];
            NSString *keyStr = [key toString];
            NSString *ivStr = [iv toString];
            NSString *modeStr = [mode toString];
            
            if (dataStr && keyStr && modeStr) {
                NSString *result = [self aesEncrypt:dataStr key:keyStr iv:ivStr mode:modeStr];
                return result ? result : [[NSString alloc] initWithString:@""];
            }
            return [[NSString alloc] initWithString:@""];
        } @catch (NSException *exception) {
            RCTLogError(@"utils_aes_encrypt error: %@", exception.reason);
            return [[NSString alloc] initWithString:@""];
        }
    };
    
    // __lx_native_call__utils_rsa_encrypt function
    jsContext[@"__lx_native_call__utils_rsa_encrypt"] = ^(JSValue *data, JSValue *key, JSValue *padding) {
        @try {
            NSString *dataStr = [data toString];
            NSString *keyStr = [key toString];
            NSString *paddingStr = [padding toString];
            
            if (dataStr && keyStr && paddingStr) {
                NSString *result = [self rsaEncrypt:dataStr key:keyStr padding:paddingStr];
                return result ? result : [[NSString alloc] initWithString:@""];
            }
            return [[NSString alloc] initWithString:@""];
        } @catch (NSException *exception) {
            RCTLogError(@"utils_rsa_encrypt error: %@", exception.reason);
            return [[NSString alloc] initWithString:@""];
        }
    };
    
    // __lx_native_call__set_timeout function
    jsContext[@"__lx_native_call__set_timeout"] = ^(JSValue *id, JSValue *timeout) {
        @try {
            // We'll implement a simple setTimeout using GCD
            NSNumber *timeoutNumber = [timeout toNumber];
            double timeoutValue = timeoutNumber.doubleValue;
            NSNumber *idNumber = [id toNumber];
            int timeoutId = (int)idNumber.intValue;
            
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(timeoutValue * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
                if (_jsContext) {
                    JSValue *func = _jsContext[@"__lx_native__"];
                    if (func) {
                        [func callWithArguments:@[[JSValue valueWithObject:_key inContext:_jsContext], 
                                                  [JSValue valueWithObject:@"__set_timeout__" inContext:_jsContext],
                                                  [JSValue valueWithObject:@(timeoutId) inContext:_jsContext]]];
                    }
                }
            });
            
            return [JSValue valueWithUndefinedInContext:jsContext];
        } @catch (NSException *exception) {
            RCTLogError(@"set_timeout error: %@", exception.reason);
            return [JSValue valueWithUndefinedInContext:jsContext];
        }
    };
}

// Create JavaScript environment
- (BOOL)createJSEnv:(NSString *)id name:(NSString *)name desc:(NSString *)desc version:(NSString *)version author:(NSString *)author homepage:(NSString *)homepage rawScript:(NSString *)rawScript {
    // Initialize if needed
    if (!_key) {
        _key = [self generateUUID];
    }
    
    // Clean up existing context if needed
    if (_jsContext) {
        _jsContext = nil;
    }
    
    // Create new JavaScript context
    _jsContext = [[JSContext alloc] init];
    
    // Set exception handler
    _jsContext.exceptionHandler = ^(JSContext *context, JSValue *exception) {
        NSString *errorMessage = exception.toString ? exception.toString : @"Unknown JavaScript error";
        RCTLogError(@"JavaScript error in UserApi: %@", errorMessage);
        
        // Send error to JavaScript side if context is still valid
        dispatch_async(dispatch_get_main_queue(), ^{
            if (_jsContext && _isJavaScriptThreadRunning) {
                [self sendEventWithName:@"api-action" body:@{
                    @"action": @"log",
                    @"data": [NSString stringWithFormat:@"JavaScript error: %@", errorMessage]
                }];
            }
        });
    };
    
    // Load preload script from main bundle (try multiple approaches)
    NSString *preloadScript = nil;
    NSString *preloadScriptPath = nil;
    
    // First try to load from Assets directory in bundle
    preloadScriptPath = [[NSBundle mainBundle] pathForResource:@"user-api-preload" ofType:@"js" inDirectory:@"Assets"];
    
    // If that fails, try to load directly from main bundle
    if (!preloadScriptPath) {
        preloadScriptPath = [[NSBundle mainBundle] pathForResource:@"user-api-preload" ofType:@"js"];
    }
    
    // If we found a path, try to load the script
    if (preloadScriptPath) {
        preloadScript = [NSString stringWithContentsOfFile:preloadScriptPath encoding:NSUTF8StringEncoding error:nil];
    }
    
    // If that still fails, try to load from the app's resources
    if (!preloadScript) {
        preloadScriptPath = [[NSBundle mainBundle] pathForResource:@"user-api-preload" ofType:@"js" inDirectory:nil];
        if (preloadScriptPath) {
            preloadScript = [NSString stringWithContentsOfFile:preloadScriptPath encoding:NSUTF8StringEncoding error:nil];
        }
    }
    
    // If we still can't load the script, try to read it from the app bundle directly
    if (!preloadScript) {
        NSString *bundlePath = [[NSBundle mainBundle] bundlePath];
        NSString *scriptPath = [bundlePath stringByAppendingPathComponent:@"Assets/user-api-preload.js"];
        if ([[NSFileManager defaultManager] fileExistsAtPath:scriptPath]) {
            preloadScript = [NSString stringWithContentsOfFile:scriptPath encoding:NSUTF8StringEncoding error:nil];
        }
    }
    
    if (!preloadScript) {
        RCTLogError(@"Failed to find preload script");
        return NO;
    }
    
    // Create environment objects
    [self createEnvObj:_jsContext];
    
    // Evaluate preload script
    [_jsContext evaluateScript:preloadScript];
    
    // Call lx_setup function
    JSValue *setupFunc = _jsContext[@"lx_setup"];
    if (setupFunc && setupFunc.isObject) {
        JSValue *setupResult = [setupFunc callWithArguments:@[
            [JSValue valueWithObject:_key inContext:_jsContext],
            [JSValue valueWithObject:(id ? id : @"") inContext:_jsContext],
            [JSValue valueWithObject:(name ? name : @"") inContext:_jsContext],
            [JSValue valueWithObject:(desc ? desc : @"") inContext:_jsContext],
            [JSValue valueWithObject:(version ? version : @"") inContext:_jsContext],
            [JSValue valueWithObject:(author ? author : @"") inContext:_jsContext],
            [JSValue valueWithObject:(homepage ? homepage : @"") inContext:_jsContext],
            [JSValue valueWithObject:(rawScript ? rawScript : @"") inContext:_jsContext]
        ]];
        
        // Check if setup returned an error
        if (setupResult && [setupResult isObject] && [setupResult hasProperty:@"message"]) {
            JSValue *message = [setupResult valueForProperty:@"message"];
            if (message && ![message isUndefined] && ![message isNull]) {
                NSString *errorMessage = [message toString];
                RCTLogError(@"lx_setup error: %@", errorMessage);
            }
        }
    } else {
        RCTLogError(@"lx_setup function not found in preload script");
    }
    
    return YES;
}

// Call native function
- (void)callNative:(NSString *)action data:(NSString *)data {
    // Handle init action specially
    if ([@"init" isEqualToString:action]) {
        if (_inited) return;
        _inited = YES;
    }
    
    RCTLogInfo(@"UserApi [script call] action: %@ data: %@", action, data);
    
    // Send event to JavaScript
    dispatch_async(dispatch_get_main_queue(), ^{
        NSMutableDictionary *eventBody = [NSMutableDictionary dictionary];
        eventBody[@"action"] = action ? action : @"";
        if (data) {
            eventBody[@"data"] = data;
        }
        
        [self sendEventWithName:@"api-action" body:eventBody ? eventBody : @{}];
    });
}

// Call JavaScript function
- (id)callJS:(NSString *)action args:(NSArray *)args {
    @try {
        if (!_jsContext) {
            RCTLogError(@"JavaScript context not available");
            return nil;
        }
        
        JSValue *func = _jsContext[@"__lx_native__"];
        if (!func) {
            RCTLogError(@"__lx_native__ function not found");
            return nil;
        }
        
        // Prepare arguments
        NSMutableArray *jsArgs = [NSMutableArray array];
        [jsArgs addObject:[JSValue valueWithObject:_key inContext:_jsContext]];
        [jsArgs addObject:[JSValue valueWithObject:action inContext:_jsContext]];
        
        if (args) {
            for (id arg in args) {
                [jsArgs addObject:[JSValue valueWithObject:arg inContext:_jsContext]];
            }
        }
        
        JSValue *result = [func callWithArguments:jsArgs];
        
        // Handle Promise results
        if (result && [result isObject]) {
            // Check if it's a Promise
            JSValue *constructor = [result valueForProperty:@"constructor"];
            if (constructor && [constructor isObject]) {
                JSValue *name = [constructor valueForProperty:@"name"];
                if (name && [[name toString] isEqualToString:@"Promise"]) {
                    // For Promises, we don't return the result directly
                    // The Promise will handle its own resolution
                    RCTLogInfo(@"JavaScript function returned a Promise");
                    return @"PROMISE"; // Special indicator for Promise
                }
            }
        }
        
        return result ? [result toObject] : nil;
    } @catch (NSException *exception) {
        RCTLogError(@"Call script error: %@", exception.reason);
        
        // Handle initialization failure
        if (!_inited) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [self sendEventWithName:@"api-action" body:@{
                    @"action": @"init",
                    @"errorMessage": exception.reason ?: @"Unknown error"
                }];
            });
            _inited = YES;
        }
        
        return nil;
    }
}

RCT_EXPORT_METHOD(loadScript:(NSDictionary *)data) {
    RCTLogInfo(@"UserApiModule loadScript called");
    
    // Store script info
    _scriptInfo = data;
    _currentScript = data[@"script"];
    
    // Create a serial queue for JavaScript execution
    _jsQueue = dispatch_queue_create("com.lxmusic.userapi.jsqueue", DISPATCH_QUEUE_SERIAL);
    
    // Execute script on background queue
    dispatch_async(_jsQueue, ^{
        NSString *scriptId = data[@"id"] ? data[@"id"] : @"";
        NSString *scriptName = data[@"name"] ? data[@"name"] : @"Unknown";
        NSString *scriptDesc = data[@"description"] ? data[@"description"] : @"";
        NSString *scriptVersion = data[@"version"] ? data[@"version"] : @"";
        NSString *scriptAuthor = data[@"author"] ? data[@"author"] : @"";
        NSString *scriptHomepage = data[@"homepage"] ? data[@"homepage"] : @"";
        NSString *rawScript = data[@"script"] ? data[@"script"] : @"";
        
        if ([self createJSEnv:scriptId name:scriptName desc:scriptDesc version:scriptVersion author:scriptAuthor homepage:scriptHomepage rawScript:rawScript]) {
            @try {
                // Evaluate the script
                JSValue *result = [_jsContext evaluateScript:rawScript];
                
                // Check if result is a Promise or error
                if (result) {
                    // Check if it's a JavaScript error
                    if ([result isObject] && [result hasProperty:@"message"]) {
                        JSValue *message = [result valueForProperty:@"message"];
                        if (message && ![message isUndefined] && ![message isNull]) {
                            NSString *errorMessage = [message toString];
                            if (errorMessage && [errorMessage length] > 0) {
                                // Script loading failed with error
                                dispatch_async(dispatch_get_main_queue(), ^{
                                    [self sendEventWithName:@"api-action" body:@{
                                        @"action": @"init",
                                        @"errorMessage": errorMessage,
                                        @"data": @"{ \"info\": null, \"status\": false, \"errorMessage\": \"Script load failed\" }"
                                    }];
                                });
                                return;
                            }
                        }
                    }
                    // If it's a Promise, we don't treat it as an error
                    // Promises are asynchronous and will be handled by the script itself
                }
                
                // Script loaded successfully
                dispatch_async(dispatch_get_main_queue(), ^{
                    [self sendEventWithName:@"api-action" body:@{
                        @"action": @"init",
                        @"data": @"{ \"status\": true, \"errorMessage\": \"\", \"info\": {} }"
                    }];
                });
                
                _isJavaScriptThreadRunning = YES;
            } @catch (NSException *exception) {
                RCTLogError(@"JavaScript execution error: %@", exception.reason);
                
                dispatch_async(dispatch_get_main_queue(), ^{
                    [self sendEventWithName:@"api-action" body:@{
                        @"action": @"init",
                        @"errorMessage": exception.reason ?: @"Unknown JavaScript error",
                        @"data": @"{ \"info\": null, \"status\": false, \"errorMessage\": \"JavaScript execution error\" }"
                    }];
                });
                
                if (!_inited) {
                    _inited = YES;
                }
            }
        } else {
            // Failed to create JavaScript environment
            dispatch_async(dispatch_get_main_queue(), ^{
                [self sendEventWithName:@"api-action" body:@{
                    @"action": @"init",
                    @"errorMessage": @"Failed to create JavaScript environment",
                    @"data": @"{ \"info\": null, \"status\": false, \"errorMessage\": \"Failed to create JavaScript environment\" }"
                }];
            });
        }
    });
}

RCT_EXPORT_METHOD(sendAction:(NSString *)action info:(NSString *)info) {
    RCTLogInfo(@"UserApiModule sendAction called with action: %@, info: %@", action, info);
    
    if (!_isJavaScriptThreadRunning || !_jsContext) {
        RCTLogWarn(@"UserApiModule: JavaScript context not available");
        return;
    }
    
    // Process action on JS queue
    dispatch_async(_jsQueue, ^{
        // Call JavaScript function
        [self callJS:action args:@[info]];
    });
}

RCT_EXPORT_METHOD(destroy) {
    RCTLogInfo(@"UserApiModule destroy called");
    
    // Reset state
    _isJavaScriptThreadRunning = NO;
    _currentScript = nil;
    _scriptInfo = nil;
    _key = nil;
    _inited = NO;
    
    // Release JavaScript context
    if (_jsContext) {
        _jsContext = nil;
    }
    
    // Release queue
    _jsQueue = nil;
}

@end
