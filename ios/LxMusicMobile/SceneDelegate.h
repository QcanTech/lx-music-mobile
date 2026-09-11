#import <UIKit/UIKit.h>
#import <CarPlay/CarPlay.h>

/// SceneDelegate for the main app window and CarPlay scene.
/// Handles window creation for the main app and forwards CarPlay events to CarPlayModule.
/// Both roles are handled here because CPTemplateApplicationScene is a subclass of UIWindowScene,
/// and iOS may match the UIWindowSceneSessionRoleApplication configuration for CarPlay scenes.
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate, CPTemplateApplicationSceneDelegate>

@property (nonatomic, strong) UIWindow *window;

@end
