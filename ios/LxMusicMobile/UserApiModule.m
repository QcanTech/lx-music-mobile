#import "UserApiModule.h"
#import <React/RCTLog.h>
#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>

@implementation UserApiModule
{
    JSContext *_jsContext;
    BOOL _isJavaScriptThreadRunning;
    NSString *_currentScript;
    NSDictionary *_scriptInfo;
    dispatch_queue_t _jsQueue;
}

RCT_EXPORT_MODULE(UserApiModule);

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"api-action"];
}

- (void)startObserving {
    // No need to do anything here
}

- (void)stopObserving {
    // No need to do anything here
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    // No need to do anything here
}

RCT_EXPORT_METHOD(removeListeners:(NSInteger)count) {
    // No need to do anything here
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
        [self executeScript];
    });
}

- (void)executeScript {
    // Create JavaScript context
    _jsContext = [[JSContext alloc] init];
    
    // Set exception handler
    _jsContext.exceptionHandler = ^(JSContext *context, JSValue *exception) {
        NSString *errorMessage = exception.toString ? exception.toString : @"Unknown JavaScript error";
        RCTLogError(@"JavaScript error in UserApi: %@", errorMessage);
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"api-action" body:@{
                @"action": @"init",
                @"errorMessage": errorMessage,
                @"data": @"{ \"info\": null, \"status\": false, \"errorMessage\": \"JavaScript execution error\" }"
            }];
        });
    };
    
    // Evaluate the script
    JSValue *result = [_jsContext evaluateScript:_currentScript];
    
    if (result && !result.isUndefined && !result.isNull) {
        NSString *errorResult = [result toString];
        if (errorResult && [errorResult length] > 0) {
            // Script loading failed
            dispatch_async(dispatch_get_main_queue(), ^{
                [self sendEventWithName:@"api-action" body:@{
                    @"action": @"init",
                    @"errorMessage": errorResult,
                    @"data": @"{ \"info\": null, \"status\": false, \"errorMessage\": \"Script load failed\" }"
                }];
            });
            return;
        }
    }
    
    // Script loaded successfully
    dispatch_async(dispatch_get_main_queue(), ^{
        [self sendEventWithName:@"api-action" body:@{
            @"action": @"init",
            @"data": @"{ \"status\": true, \"errorMessage\": \"\", \"info\": {} }"
        }];
    });
    
    _isJavaScriptThreadRunning = YES;
}

RCT_EXPORT_METHOD(sendAction:(NSString *)action info:(NSString *)info) {
    RCTLogInfo(@"UserApiModule sendAction called with action: %@, info: %@", action, info);
    
    if (!_isJavaScriptThreadRunning || !_jsContext) {
        RCTLogWarn(@"UserApiModule: JavaScript context not available");
        return;
    }
    
    // Process action on JS queue
    dispatch_async(_jsQueue, ^{
        // In a real implementation, we would call the JavaScript function here
        // For now, we'll just send the action back as an event
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"api-action" body:@{
                @"action": action,
                @"data": info
            }];
        });
    });
}

RCT_EXPORT_METHOD(destroy) {
    RCTLogInfo(@"UserApiModule destroy called");
    
    // Reset state
    _isJavaScriptThreadRunning = NO;
    _currentScript = nil;
    _scriptInfo = nil;
    
    // Release JavaScript context
    if (_jsContext) {
        _jsContext = nil;
    }
    
    // Release queue
    _jsQueue = nil;
}

@end