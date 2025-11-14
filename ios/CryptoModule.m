#import "CryptoModule.h"
#import <React/RCTLog.h>
#import <Foundation/Foundation.h>
#import <CommonCrypto/CommonCrypto.h>
#import <CommonCrypto/CommonDigest.h>
#import <Security/Security.h>

@implementation CryptoModule

RCT_EXPORT_MODULE();

// Helper method for Base64 encoding
- (NSString *)base64Encode:(NSData *)data {
    if (!data) {
        return @"";
    }
    NSString *result = [data base64EncodedStringWithOptions:0];
    return result ? result : @"";
}

// Helper method for Base64 decoding
- (NSData *)base64Decode:(NSString *)string {
    if (!string || [string length] == 0) {
        return nil;
    }
    NSData *result = [[NSData alloc] initWithBase64EncodedString:string options:0];
    return result;
}

// Generate RSA key pair
- (NSDictionary *)generateRSAKeyPair {
    // Generate key pair
    SecKeyRef privateKeyRef, publicKeyRef;
    NSMutableDictionary *keys = [[NSMutableDictionary alloc] init];
    
    // Set key generation parameters
    [keys setObject:(__bridge id)kSecAttrKeyTypeRSA forKey:(__bridge id)kSecAttrKeyType];
    [keys setObject:[NSNumber numberWithInt:2048] forKey:(__bridge id)kSecAttrKeySizeInBits];
    
    // Generate key pair
    OSStatus status = SecKeyGeneratePair((__bridge CFDictionaryRef)keys, &publicKeyRef, &privateKeyRef);
    
    if (status != errSecSuccess) {
        RCTLogError(@"Failed to generate RSA key pair: %d", (int)status);
        return nil;
    }
    
    // Export public key
    CFErrorRef publicError = NULL;
    NSData *publicKeyData = (__bridge_transfer NSData *)SecKeyCopyExternalRepresentation(publicKeyRef, &publicError);
    if (publicError != NULL) {
        RCTLogError(@"Failed to export public key: %@", (__bridge NSString *)CFErrorCopyDescription(publicError));
        CFRelease(publicKeyRef);
        CFRelease(privateKeyRef);
        return nil;
    }
    
    // Export private key
    CFErrorRef privateError = NULL;
    NSData *privateKeyData = (__bridge_transfer NSData *)SecKeyCopyExternalRepresentation(privateKeyRef, &privateError);
    if (privateError != NULL) {
        RCTLogError(@"Failed to export private key: %@", (__bridge NSString *)CFErrorCopyDescription(privateError));
        CFRelease(publicKeyRef);
        CFRelease(privateKeyRef);
        return nil;
    }
    
    // Encode to Base64
    NSString *publicKeyBase64 = [self base64Encode:publicKeyData];
    NSString *privateKeyBase64 = [self base64Encode:privateKeyData];
    
    // Clean up
    CFRelease(publicKeyRef);
    CFRelease(privateKeyRef);
    
    // Return keys
    return @{
        @"publicKey": publicKeyBase64,
        @"privateKey": privateKeyBase64
    };
}

// RSA Encryption
- (NSString *)rsaEncrypt:(NSString *)text key:(NSString *)key padding:(NSString *)padding {
    @try {
        NSData *textData = [self base64Decode:text];
        NSData *keyData = [self base64Decode:key];
        
        if (!textData || !keyData) {
            RCTLogError(@"Failed to decode text or key data");
            return @"";
        }
        
        // Create SecKey from key data
        NSMutableDictionary *keyAttributes = [[NSMutableDictionary alloc] init];
        [keyAttributes setObject:(__bridge id)kSecAttrKeyTypeRSA forKey:(__bridge id)kSecAttrKeyType];
        [keyAttributes setObject:[NSNumber numberWithInt:2048] forKey:(__bridge id)kSecAttrKeySizeInBits];
        
        SecKeyRef publicKeyRef = SecKeyCreateWithData((__bridge CFDataRef)keyData, 
                                                     (__bridge CFDictionaryRef)keyAttributes, 
                                                     NULL);
        
        if (!publicKeyRef) {
            RCTLogError(@"Failed to create public key from data");
            return @"";
        }
        
        // Set encryption parameters based on padding
        SecPadding secPadding = kSecPaddingPKCS1;
        if ([padding isEqualToString:@"RSA/ECB/NoPadding"]) {
            secPadding = kSecPaddingNone;
        }
        
        // Encrypt data
        size_t cipherTextLength = SecKeyGetBlockSize(publicKeyRef);
        uint8_t *cipherText = malloc(cipherTextLength);
        OSStatus status = SecKeyEncrypt(publicKeyRef, secPadding, 
                                       (const uint8_t *)[textData bytes], [textData length],
                                       cipherText, &cipherTextLength);
        
        if (status != errSecSuccess) {
            RCTLogError(@"RSA encryption failed: %d", (int)status);
            free(cipherText);
            CFRelease(publicKeyRef);
            return @"";
        }
        
        // Convert to NSData and encode to Base64
        NSData *encryptedData = [NSData dataWithBytes:cipherText length:cipherTextLength];
        NSString *result = [self base64Encode:encryptedData];
        
        // Clean up
        free(cipherText);
        CFRelease(publicKeyRef);
        
        return result;
    } @catch (NSException *exception) {
        RCTLogError(@"RSA encryption error: %@", exception.reason);
        return @"";
    }
}

// RSA Decryption
- (NSString *)rsaDecrypt:(NSString *)text key:(NSString *)key padding:(NSString *)padding {
    @try {
        NSData *textData = [self base64Decode:text];
        NSData *keyData = [self base64Decode:key];
        
        if (!textData || !keyData) {
            RCTLogError(@"Failed to decode text or key data");
            return @"";
        }
        
        // Create SecKey from key data
        NSMutableDictionary *keyAttributes = [[NSMutableDictionary alloc] init];
        [keyAttributes setObject:(__bridge id)kSecAttrKeyTypeRSA forKey:(__bridge id)kSecAttrKeyType];
        [keyAttributes setObject:[NSNumber numberWithInt:2048] forKey:(__bridge id)kSecAttrKeySizeInBits];
        
        SecKeyRef privateKeyRef = SecKeyCreateWithData((__bridge CFDataRef)keyData, 
                                                     (__bridge CFDictionaryRef)keyAttributes, 
                                                     NULL);
        
        if (!privateKeyRef) {
            RCTLogError(@"Failed to create private key from data");
            return @"";
        }
        
        // Set decryption parameters based on padding
        SecPadding secPadding = kSecPaddingPKCS1;
        if ([padding isEqualToString:@"RSA/ECB/NoPadding"]) {
            secPadding = kSecPaddingNone;
        }
        
        // Decrypt data
        size_t plainTextLength = SecKeyGetBlockSize(privateKeyRef);
        uint8_t *plainText = malloc(plainTextLength);
        OSStatus status = SecKeyDecrypt(privateKeyRef, secPadding, 
                                       (const uint8_t *)[textData bytes], [textData length],
                                       plainText, &plainTextLength);
        
        if (status != errSecSuccess) {
            RCTLogError(@"RSA decryption failed: %d", (int)status);
            free(plainText);
            CFRelease(privateKeyRef);
            return @"";
        }
        
        // Convert to NSData and encode to Base64
        NSData *decryptedData = [NSData dataWithBytes:plainText length:plainTextLength];
        NSString *result = [self base64Encode:decryptedData];
        
        // Clean up
        free(plainText);
        CFRelease(privateKeyRef);
        
        return result;
    } @catch (NSException *exception) {
        RCTLogError(@"RSA decryption error: %@", exception.reason);
        return @"";
    }
}

// AES Encryption
- (NSString *)aesEncrypt:(NSString *)data key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode {
    @try {
        NSData *dataToEncrypt = [self base64Decode:data];
        NSData *keyData = [self base64Decode:key];
        NSData *ivData = [iv length] > 0 ? [self base64Decode:iv] : nil;
        
        if (!dataToEncrypt || !keyData) {
            RCTLogError(@"Failed to decode data or key");
            return @"";
        }
        
        // Validate key size
        size_t keyLength = [keyData length];
        if (keyLength != kCCKeySizeAES128 && keyLength != kCCKeySizeAES192 && keyLength != kCCKeySizeAES256) {
            RCTLogError(@"Invalid AES key size: %zu", keyLength);
            return @"";
        }
        
        // Determine options based on mode
        CCOptions options = kCCOptionPKCS7Padding;
        BOOL isECB = [mode isEqualToString:@"AES/ECB/PKCS5Padding"] || [mode isEqualToString:@"AES"];
        
        if (isECB) {
            options = kCCOptionPKCS7Padding;
        }
        
        // For CBC mode, IV is required
        BOOL isCBC = [mode isEqualToString:@"AES/CBC/PKCS5Padding"] || (!isECB && ![mode isEqualToString:@"AES"]);
        const void *ivBytes = NULL;
        
        if (isCBC) {
            if (!ivData || [ivData length] != kCCBlockSizeAES128) {
                RCTLogError(@"Invalid IV size for CBC mode: %zu", ivData ? [ivData length] : 0);
                return @"";
            }
            ivBytes = [ivData bytes];
        }
        
        // Calculate output buffer size
        size_t dataLength = [dataToEncrypt length];
        size_t bufferSize = dataLength + kCCBlockSizeAES128;
        void *buffer = malloc(bufferSize);
        size_t encryptedLength = 0;
        
        CCCryptorStatus cryptStatus = CCCrypt(kCCEncrypt,
                                               kCCAlgorithmAES,
                                               options,
                                               [keyData bytes],
                                               [keyData length],
                                               ivBytes,
                                               [dataToEncrypt bytes],
                                               [dataToEncrypt length],
                                               buffer,
                                               bufferSize,
                                               &encryptedLength);
        
        if (cryptStatus == kCCSuccess) {
            NSData *encryptedData = [NSData dataWithBytes:buffer length:encryptedLength];
            free(buffer);
            NSString *result = [self base64Encode:encryptedData];
            // Ensure we always return a string
            return result ? result : @"";
        } else {
            RCTLogError(@"AES encryption failed with status: %d", (int)cryptStatus);
            free(buffer);
            return @"";
        }
    } @catch (NSException *exception) {
        RCTLogError(@"AES encryption error: %@", exception.reason);
        return @"";
    }
}

// AES Decryption
- (NSString *)aesDecrypt:(NSString *)data key:(NSString *)key iv:(NSString *)iv mode:(NSString *)mode {
    @try {
        NSData *dataToDecrypt = [self base64Decode:data];
        NSData *keyData = [self base64Decode:key];
        NSData *ivData = [iv length] > 0 ? [self base64Decode:iv] : nil;
        
        if (!dataToDecrypt || !keyData) {
            RCTLogError(@"Failed to decode data or key");
            return @"";
        }
        
        // Validate key size
        size_t keyLength = [keyData length];
        if (keyLength != kCCKeySizeAES128 && keyLength != kCCKeySizeAES192 && keyLength != kCCKeySizeAES256) {
            RCTLogError(@"Invalid AES key size: %zu", keyLength);
            return @"";
        }
        
        // Determine options based on mode
        CCOptions options = kCCOptionPKCS7Padding;
        BOOL isECB = [mode isEqualToString:@"AES/ECB/PKCS5Padding"] || [mode isEqualToString:@"AES"];
        
        if (isECB) {
            options = kCCOptionPKCS7Padding;
        }
        
        // For CBC mode, IV is required
        BOOL isCBC = [mode isEqualToString:@"AES/CBC/PKCS5Padding"] || (!isECB && ![mode isEqualToString:@"AES"]);
        const void *ivBytes = NULL;
        
        if (isCBC) {
            if (!ivData || [ivData length] != kCCBlockSizeAES128) {
                RCTLogError(@"Invalid IV size for CBC mode: %zu", ivData ? [ivData length] : 0);
                return @"";
            }
            ivBytes = [ivData bytes];
        }
        
        // Calculate output buffer size
        size_t dataLength = [dataToDecrypt length];
        size_t bufferSize = dataLength + kCCBlockSizeAES128;
        void *buffer = malloc(bufferSize);
        size_t decryptedLength = 0;
        
        CCCryptorStatus cryptStatus = CCCrypt(kCCDecrypt,
                                               kCCAlgorithmAES,
                                               options,
                                               [keyData bytes],
                                               [keyData length],
                                               ivBytes,
                                               [dataToDecrypt bytes],
                                               [dataToDecrypt length],
                                               buffer,
                                               bufferSize,
                                               &decryptedLength);
        
        if (cryptStatus == kCCSuccess) {
            NSData *decryptedData = [NSData dataWithBytes:buffer length:decryptedLength];
            free(buffer);
            NSString *result = [self base64Encode:decryptedData];
            // Ensure we always return a string
            return result ? result : @"";
        } else {
            RCTLogError(@"AES decryption failed with status: %d", (int)cryptStatus);
            free(buffer);
            return @"";
        }
    } @catch (NSException *exception) {
        RCTLogError(@"AES decryption error: %@", exception.reason);
        return @"";
    }
}

// MARK: - Exported Methods

RCT_EXPORT_METHOD(generateRsaKey:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSDictionary *keys = [self generateRSAKeyPair];
    if (keys) {
        resolve(keys);
    } else {
        reject(@"-1", @"Failed to generate RSA key pair", nil);
    }
}

RCT_EXPORT_METHOD(rsaEncrypt:(NSString *)text
                  key:(NSString *)key
                  padding:(NSString *)padding
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *result = [self rsaEncrypt:text key:key padding:padding];
    // Ensure we always return a string, even if the encryption fails
    resolve(result ? result : @"");
}

RCT_EXPORT_METHOD(rsaDecrypt:(NSString *)text
                  key:(NSString *)key
                  padding:(NSString *)padding
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *result = [self rsaDecrypt:text key:key padding:padding];
    // Ensure we always return a string, even if the decryption fails
    resolve(result ? result : @"");
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaEncryptSync:(NSString *)text
                  key:(NSString *)key
                  padding:(NSString *)padding) {
    NSString *result = [self rsaEncrypt:text key:key padding:padding];
    // Ensure we always return a string, even if the encryption fails
    return result ? result : @"";
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(rsaDecryptSync:(NSString *)text
                  key:(NSString *)key
                  padding:(NSString *)padding) {
    NSString *result = [self rsaDecrypt:text key:key padding:padding];
    // Ensure we always return a string, even if the decryption fails
    return result ? result : @"";
}

RCT_EXPORT_METHOD(aesEncrypt:(NSString *)text
                  key:(NSString *)key
                  iv:(NSString *)iv
                  mode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *result = [self aesEncrypt:text key:key iv:iv mode:mode];
    // Ensure we always return a string, even if the encryption fails
    resolve(result ? result : @"");
}

RCT_EXPORT_METHOD(aesDecrypt:(NSString *)text
                  key:(NSString *)key
                  iv:(NSString *)iv
                  mode:(NSString *)mode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *result = [self aesDecrypt:text key:key iv:iv mode:mode];
    // Ensure we always return a string, even if the decryption fails
    resolve(result ? result : @"");
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesEncryptSync:(NSString *)text
                  key:(NSString *)key
                  iv:(NSString *)iv
                  mode:(NSString *)mode) {
    NSString *result = [self aesEncrypt:text key:key iv:iv mode:mode];
    // Ensure we always return a string, even if the encryption fails
    return result ? result : @"";
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(aesDecryptSync:(NSString *)text
                  key:(NSString *)key
                  iv:(NSString *)iv
                  mode:(NSString *)mode) {
    NSString *result = [self aesDecrypt:text key:key iv:iv mode:mode];
    // Ensure we always return a string, even if the decryption fails
    return result ? result : @"";
}

@end
