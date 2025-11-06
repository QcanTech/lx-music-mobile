#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>

// 必须遵循 RCTBridgeModule 协议
@interface RCT_EXTERN_MODULE(UserApiModule, NSObject)


@interface UserApiModule : RCTEventEmitter <RCTBridgeModule>

@end