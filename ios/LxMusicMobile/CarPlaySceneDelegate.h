#import <UIKit/UIKit.h>
#import <CarPlay/CarPlay.h>

API_AVAILABLE(ios(13.0))
@interface CarPlaySceneDelegate : UIResponder <UIWindowSceneDelegate, CPTemplateApplicationSceneDelegate>

@property (nonatomic, strong) UIWindowScene *windowScene;

@end
