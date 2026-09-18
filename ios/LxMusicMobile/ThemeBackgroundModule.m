#import "ThemeBackgroundModule.h"
#import <UIKit/UIKit.h>
#import <React/RCTConvert.h>
#import "AppDelegate.h"

// Renders the theme background image + translucent veil at window level so it
// also shows through the status bar area, which the RNN root view never covers.
@implementation ThemeBackgroundModule

RCT_EXPORT_MODULE(ThemeBackgroundModule)

static UIImageView *sImageView = nil;
static UIView *sVeilView = nil;

+ (UIWindow *)mainWindow
{
  AppDelegate *appDelegate = (AppDelegate *)UIApplication.sharedApplication.delegate;
  return appDelegate.window;
}

+ (void)ensureViewsInWindow:(UIWindow *)window
{
  if (!sImageView) {
    sImageView = [[UIImageView alloc] init];
    sImageView.contentMode = UIViewContentModeScaleAspectFill;
    sImageView.clipsToBounds = YES;
    sImageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  }
  if (!sVeilView) {
    sVeilView = [[UIView alloc] init];
    sVeilView.backgroundColor = UIColor.clearColor;
    sVeilView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  }
  if (sImageView.superview != window) {
    [window insertSubview:sImageView atIndex:0];
  }
  if (sVeilView.superview != window) {
    [window insertSubview:sVeilView atIndex:1];
  }
  sImageView.frame = window.bounds;
  sVeilView.frame = window.bounds;
}

RCT_EXPORT_METHOD(setThemeBackground:(NSString *)image veilColor:(NSString *)color)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    UIWindow *window = [ThemeBackgroundModule mainWindow];
    if (!window) return;
    [ThemeBackgroundModule ensureViewsInWindow:window];

    UIImage *img = nil;
    if (image.length) {
      if ([NSFileManager.defaultManager fileExistsAtPath:image]) {
        img = [UIImage imageWithContentsOfFile:image];
      } else {
        NSString *path = [[NSBundle mainBundle] pathForResource:[image stringByDeletingPathExtension] ofType:[image pathExtension]];
        if (path) img = [UIImage imageWithContentsOfFile:path];
      }
    }
    sImageView.image = img;
    sImageView.hidden = (img == nil);
    sVeilView.backgroundColor = color.length ? [RCTConvert UIColor:color] : UIColor.clearColor;
  });
}

@end
