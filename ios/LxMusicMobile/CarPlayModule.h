#import <React/RCTEventEmitter.h>
#import <React/RCTBridgeModule.h>
#import <CarPlay/CarPlay.h>

API_AVAILABLE(ios(12.0))
@interface CarPlayModule : RCTEventEmitter <RCTBridgeModule, CPTemplateApplicationSceneDelegate, CPListTemplateDelegate>

+ (instancetype)sharedInstance;

// Called by SceneDelegate when CarPlay connects before the bridge has
// instantiated this module (cold launch straight into the CarPlay app).
+ (void)setPendingConnectionWithScene:(CPTemplateApplicationScene *)scene interfaceController:(CPInterfaceController *)interfaceController;
+ (void)clearPendingConnection;

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
- (void)updateSonglistCollectState:(NSDictionary *)data;

@end
