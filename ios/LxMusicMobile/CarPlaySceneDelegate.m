#import "CarPlaySceneDelegate.h"
#import "CarPlayModule.h"

@implementation CarPlaySceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    if (@available(iOS 13.0, *)) {
        if ([scene isKindOfClass:[UIWindowScene class]]) {
            self.windowScene = (UIWindowScene *)scene;
        }
    }
}

- (void)sceneDidDisconnect:(UIScene *)scene {
    self.windowScene = nil;
}

#pragma mark - CPTemplateApplicationSceneDelegate

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didConnectInterfaceController:(CPInterfaceController *)interfaceController {
    CarPlayModule *module = [CarPlayModule sharedInstance];
    if (module) {
        [module templateApplicationScene:templateApplicationScene
             didConnectInterfaceController:interfaceController];
    }
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didDisconnectInterfaceController:(CPInterfaceController *)interfaceController {
    CarPlayModule *module = [CarPlayModule sharedInstance];
    if (module) {
        [module templateApplicationScene:templateApplicationScene
             didDisconnectInterfaceController:interfaceController];
    }
}

@end
