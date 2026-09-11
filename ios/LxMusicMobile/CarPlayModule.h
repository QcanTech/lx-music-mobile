#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>
#import <CarPlay/CarPlay.h>

API_AVAILABLE(ios(12.0))
@interface CarPlayModule : RCTEventEmitter <RCTBridgeModule, CPTemplateApplicationSceneDelegate, CPListTemplateDelegate>

+ (instancetype)sharedInstance;

@property (nonatomic, strong) CPInterfaceController *interfaceController;
@property (nonatomic, strong) CPTemplateApplicationScene *carPlayScene;

// Methods callable from JS
- (void)updateSonglists:(NSDictionary *)data;
- (void)updateSongs:(NSDictionary *)data;
- (void)updateSonglistTitle:(NSString *)title;
- (void)updateMyLists:(NSArray *)lists;
- (void)updateMyListSongs:(NSDictionary *)data;
- (void)popTemplate;
- (void)playSong:(NSNumber *)index;
- (void)onPlayStateChanged:(NSDictionary *)info;
- (void)updateNowPlayingState:(NSDictionary *)state;

@end
