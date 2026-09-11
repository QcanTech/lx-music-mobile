#import "SceneDelegate.h"
#import "AppDelegate.h"
#import "CarPlayModule.h"

@implementation SceneDelegate

- (void)scene:(UIScene *)scene willConnectToSession:(UISceneSession *)session options:(UISceneConnectionOptions *)connectionOptions {
    // CarPlay scene - skip window creation, handled by CPTemplateApplicationSceneDelegate
    if ([scene isKindOfClass:[CPTemplateApplicationScene class]]) {
        return;
    }
    
    // Main app scene - reuse RNN's existing window and associate it with the scene
    AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
    UIWindow *existingWindow = appDelegate.window;
    
    if (existingWindow) {
        // RNN already created a window during bootstrap - reuse it
        existingWindow.windowScene = (UIWindowScene *)scene;
        self.window = existingWindow;
        [existingWindow makeKeyAndVisible];
    } else {
        // Fallback: create a new window if RNN hasn't created one yet
        UIWindow *window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
        self.window = window;
        appDelegate.window = window;
        [window makeKeyAndVisible];
    }
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

#pragma mark - UIScene lifecycle

- (void)sceneDidDisconnect:(UIScene *)scene {}
- (void)sceneDidBecomeActive:(UIScene *)scene {}
- (void)sceneWillResignActive:(UIScene *)scene {}
- (void)sceneWillEnterForeground:(UIScene *)scene {}
- (void)sceneDidEnterBackground:(UIScene *)scene {}

@end
