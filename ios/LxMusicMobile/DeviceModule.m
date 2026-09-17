#import "DeviceModule.h"
#import <Security/Security.h>
#import <TargetConditionals.h>
#import <sys/utsname.h>

static NSString *const kDeviceIdService = @"cn.toside.music.mobile";
static NSString *const kDeviceIdAccount = @"activation_device_id";

@implementation DeviceModule

RCT_EXPORT_MODULE(DeviceModule);

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(getDeviceId:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *deviceId = [self loadOrCreateDeviceId];
    if (deviceId.length > 0) {
        resolve(deviceId);
    } else {
        reject(@"ERR_DEVICE_ID", @"Failed to read or create the keychain device id", nil);
    }
}

// Apple 没有公开 API 返回营销名称（如 "iPhone 17 Pro"），只能按硬件标识符映射。
// 未收录的机型回退为原始标识符，新机型上市时在此表补充即可。
static NSDictionary<NSString *, NSString *> *kDeviceModelNames(void) {
    static NSDictionary<NSString *, NSString *> *names = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        names = @{
            @"iPhone8,1": @"iPhone 6s",
            @"iPhone8,2": @"iPhone 6s Plus",
            @"iPhone8,4": @"iPhone SE",
            @"iPhone9,1": @"iPhone 7",
            @"iPhone9,3": @"iPhone 7",
            @"iPhone9,2": @"iPhone 7 Plus",
            @"iPhone9,4": @"iPhone 7 Plus",
            @"iPhone10,1": @"iPhone 8",
            @"iPhone10,4": @"iPhone 8",
            @"iPhone10,2": @"iPhone 8 Plus",
            @"iPhone10,5": @"iPhone 8 Plus",
            @"iPhone10,3": @"iPhone X",
            @"iPhone10,6": @"iPhone X",
            @"iPhone11,8": @"iPhone XR",
            @"iPhone11,2": @"iPhone XS",
            @"iPhone11,4": @"iPhone XS Max",
            @"iPhone11,6": @"iPhone XS Max",
            @"iPhone12,1": @"iPhone 11",
            @"iPhone12,3": @"iPhone 11 Pro",
            @"iPhone12,5": @"iPhone 11 Pro Max",
            @"iPhone12,8": @"iPhone SE (2nd generation)",
            @"iPhone13,1": @"iPhone 12 mini",
            @"iPhone13,2": @"iPhone 12",
            @"iPhone13,3": @"iPhone 12 Pro",
            @"iPhone13,4": @"iPhone 12 Pro Max",
            @"iPhone14,4": @"iPhone 13 mini",
            @"iPhone14,5": @"iPhone 13",
            @"iPhone14,2": @"iPhone 13 Pro",
            @"iPhone14,3": @"iPhone 13 Pro Max",
            @"iPhone14,6": @"iPhone SE (3rd generation)",
            @"iPhone14,7": @"iPhone 14",
            @"iPhone14,8": @"iPhone 14 Plus",
            @"iPhone15,2": @"iPhone 14 Pro",
            @"iPhone15,3": @"iPhone 14 Pro Max",
            @"iPhone15,4": @"iPhone 15",
            @"iPhone15,5": @"iPhone 15 Plus",
            @"iPhone16,1": @"iPhone 15 Pro",
            @"iPhone16,2": @"iPhone 15 Pro Max",
            @"iPhone17,3": @"iPhone 16",
            @"iPhone17,4": @"iPhone 16 Plus",
            @"iPhone17,1": @"iPhone 16 Pro",
            @"iPhone17,2": @"iPhone 16 Pro Max",
            @"iPhone17,5": @"iPhone 16e",
            @"iPhone18,3": @"iPhone 17",
            @"iPhone18,1": @"iPhone 17 Pro",
            @"iPhone18,2": @"iPhone 17 Pro Max",
            @"iPhone18,4": @"iPhone Air",
            @"iPod9,1": @"iPod touch (7th generation)",
            @"iPad8,1": @"iPad Pro 11-inch (1st generation)",
            @"iPad8,2": @"iPad Pro 11-inch (1st generation)",
            @"iPad8,3": @"iPad Pro 11-inch (1st generation)",
            @"iPad8,4": @"iPad Pro 11-inch (1st generation)",
            @"iPad8,5": @"iPad Pro 12.9-inch (3rd generation)",
            @"iPad8,6": @"iPad Pro 12.9-inch (3rd generation)",
            @"iPad8,7": @"iPad Pro 12.9-inch (3rd generation)",
            @"iPad8,8": @"iPad Pro 12.9-inch (3rd generation)",
            @"iPad8,9": @"iPad Pro 11-inch (2nd generation)",
            @"iPad8,10": @"iPad Pro 11-inch (2nd generation)",
            @"iPad8,11": @"iPad Pro 12.9-inch (4th generation)",
            @"iPad8,12": @"iPad Pro 12.9-inch (4th generation)",
            @"iPad11,1": @"iPad mini (5th generation)",
            @"iPad11,2": @"iPad mini (5th generation)",
            @"iPad11,3": @"iPad Air (3rd generation)",
            @"iPad11,4": @"iPad Air (3rd generation)",
            @"iPad11,6": @"iPad (8th generation)",
            @"iPad11,7": @"iPad (8th generation)",
            @"iPad12,1": @"iPad (9th generation)",
            @"iPad12,2": @"iPad (9th generation)",
            @"iPad13,1": @"iPad Air (4th generation)",
            @"iPad13,2": @"iPad Air (4th generation)",
            @"iPad13,4": @"iPad Pro 11-inch (3rd generation)",
            @"iPad13,5": @"iPad Pro 11-inch (3rd generation)",
            @"iPad13,6": @"iPad Pro 11-inch (3rd generation)",
            @"iPad13,7": @"iPad Pro 11-inch (3rd generation)",
            @"iPad13,8": @"iPad Pro 12.9-inch (5th generation)",
            @"iPad13,9": @"iPad Pro 12.9-inch (5th generation)",
            @"iPad13,10": @"iPad Pro 12.9-inch (5th generation)",
            @"iPad13,11": @"iPad Pro 12.9-inch (5th generation)",
            @"iPad13,16": @"iPad Air (5th generation)",
            @"iPad13,17": @"iPad Air (5th generation)",
            @"iPad13,18": @"iPad (10th generation)",
            @"iPad13,19": @"iPad (10th generation)",
            @"iPad14,1": @"iPad mini (6th generation)",
            @"iPad14,2": @"iPad mini (6th generation)",
            @"iPad14,3": @"iPad Pro 11-inch (4th generation)",
            @"iPad14,4": @"iPad Pro 11-inch (4th generation)",
            @"iPad14,5": @"iPad Pro 12.9-inch (6th generation)",
            @"iPad14,6": @"iPad Pro 12.9-inch (6th generation)",
            @"iPad14,8": @"iPad Air 11-inch (M2)",
            @"iPad14,9": @"iPad Air 11-inch (M2)",
            @"iPad14,10": @"iPad Air 13-inch (M2)",
            @"iPad14,11": @"iPad Air 13-inch (M2)",
            @"iPad16,3": @"iPad Pro 11-inch (M4)",
            @"iPad16,4": @"iPad Pro 11-inch (M4)",
            @"iPad16,5": @"iPad Pro 13-inch (M4)",
            @"iPad16,6": @"iPad Pro 13-inch (M4)",
            @"iPad15,1": @"iPad mini (A17 Pro)",
            @"iPad15,2": @"iPad mini (A17 Pro)",
            @"iPad15,3": @"iPad Air 11-inch (M3)",
            @"iPad15,4": @"iPad Air 11-inch (M3)",
            @"iPad15,5": @"iPad Air 13-inch (M3)",
            @"iPad15,6": @"iPad Air 13-inch (M3)",
        };
    });
    return names;
}

RCT_EXPORT_METHOD(getDeviceModel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve([self deviceModelName]);
}

- (NSString *)deviceModelName {
#if TARGET_OS_SIMULATOR
    // 模拟器进程自带被模拟机型的营销名称，如 "iPhone 17 Pro"
    const char *simulatorName = getenv("SIMULATOR_DEVICE_NAME");
    if (simulatorName != NULL) {
        return [NSString stringWithCString:simulatorName encoding:NSUTF8StringEncoding];
    }
#endif

    struct utsname systemInfo;
    uname(&systemInfo);
    NSString *identifier = [NSString stringWithCString:systemInfo.machine encoding:NSUTF8StringEncoding];
    return kDeviceModelNames()[identifier] ?: identifier;
}

- (NSDictionary *)baseQuery {
    return @{
        (__bridge id)kSecClass: (__bridge id)kSecClassGenericPassword,
        (__bridge id)kSecAttrService: kDeviceIdService,
        (__bridge id)kSecAttrAccount: kDeviceIdAccount,
    };
}

- (NSString *)readDeviceId {
    NSMutableDictionary *query = [[self baseQuery] mutableCopy];
    query[(__bridge id)kSecReturnData] = @YES;
    query[(__bridge id)kSecMatchLimit] = (__bridge id)kSecMatchLimitOne;

    CFTypeRef dataRef = NULL;
    OSStatus status = SecItemCopyMatching((__bridge CFDictionaryRef)query, &dataRef);
    if (status != errSecSuccess) {
        if (dataRef != NULL) CFRelease(dataRef);
        return nil;
    }

    NSData *data = (__bridge_transfer NSData *)dataRef;
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

// The id lives in the keychain rather than NSUserDefaults so that it survives an
// uninstall/reinstall cycle, which the activation backend keys devices on.
- (NSString *)loadOrCreateDeviceId {
    NSString *existing = [self readDeviceId];
    if (existing.length > 0) return existing;

    NSString *newId = [[NSUUID UUID] UUIDString];
    NSMutableDictionary *addQuery = [[self baseQuery] mutableCopy];
    addQuery[(__bridge id)kSecValueData] = [newId dataUsingEncoding:NSUTF8StringEncoding];
    // AfterFirstUnlock, not ThisUnlockOnly: a background relaunch before the first
    // unlock would otherwise fail to read the item.
    addQuery[(__bridge id)kSecAttrAccessible] = (__bridge id)kSecAttrAccessibleAfterFirstUnlock;

    OSStatus status = SecItemAdd((__bridge CFDictionaryRef)addQuery, NULL);
    if (status == errSecSuccess) return newId;
    // Lost a concurrent first-read race; the winner's value is authoritative.
    if (status == errSecDuplicateItem) return [self readDeviceId];
    return nil;
}

@end
