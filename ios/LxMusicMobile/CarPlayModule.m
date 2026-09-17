#import "CarPlayModule.h"
#import <React/RCTLog.h>
#import <UIKit/UIKit.h>

static NSString *const LOAD_MORE_ID = @"__load_more__";

// Safely convert dictionary value to NSString (handles NSNull from JS)
static NSString * _Nonnull SafeStr(id _Nullable value) {
    if ([value isKindOfClass:[NSString class]]) return value;
    return @"";
}

@implementation CarPlayModule
{
    BOOL _hasListeners;
    BOOL _isCarPlayConnected;

    // Tab bar
    CPTabBarTemplate *_tabBarTemplate;

    // Recommend (推荐) tab - songlist state
    CPListTemplate *_recommendTemplate;
    NSMutableArray *_allSonglistItems;
    NSInteger _songlistCurrentPage;
    NSInteger _songlistTotal;
    BOOL _isLoadingSonglists;

    // My (我的) tab - user list state
    CPListTemplate *_myListTemplate;
    NSMutableArray *_myListItems;
    // Reused across updates so the 我的 tab can be refreshed in place (see
    // updateMyLists) even while setupTabBarTemplate is guarded by _songTemplate.
    CPListSection *_myListSection;

    // Song list state (shared between recommend detail & my list detail)
    CPListTemplate *_songTemplate;
    NSMutableArray *_allSongItems;
    NSInteger _songCurrentPage;
    NSInteger _songTotal;
    BOOL _isLoadingSongs;
    NSString *_currentSonglistId;
    NSString *_currentSonglistSource;
    NSString *_currentSonglistTitle;
    NSString *_currentSonglistName;  // Name of the online songlist being viewed (used by the collect button)
    BOOL _isMyListSongs;  // YES when loading songs from "我的" tab
    NSString *_currentMyListId;
    // The songlist detail page's top-right collect button, kept so its heart
    // icon can toggle between outline/filled as the collect state changes.
    CPBarButton *_songlistCollectButton;

    // Stable load-more button instances reused across updates to preserve focus
    CPListItem *_songlistsLoadMoreItem;
    CPListItem *_songsLoadMoreItem;

    // Reuse the same CPListSection instance across updates so CarPlay's diff
    // can keep focus on the load-more item instead of jumping to the top.
    CPListSection *_songlistSection;
    CPListSection *_songSection;

    // Now Playing template state
    BOOL _isCollected;
    NSString *_playMode;
}

RCT_EXPORT_MODULE(CarPlayModule);

static CarPlayModule *_sharedInstance = nil;

// Connection that arrived before the bridge instantiated the module (cold
// launch straight into the CarPlay app). Adopted in -init.
static CPTemplateApplicationScene *_pendingScene = nil;
static CPInterfaceController *_pendingInterfaceController = nil;

+ (instancetype)sharedInstance {
    return _sharedInstance;
}

+ (void)setPendingConnectionWithScene:(CPTemplateApplicationScene *)scene interfaceController:(CPInterfaceController *)interfaceController {
    _pendingScene = scene;
    _pendingInterfaceController = interfaceController;
}

+ (void)clearPendingConnection {
    _pendingScene = nil;
    _pendingInterfaceController = nil;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _sharedInstance = self;
        _allSonglistItems = [NSMutableArray array];
        _songlistCurrentPage = 1;
        _songlistTotal = 0;
        _isLoadingSonglists = NO;

        _myListItems = [NSMutableArray array];

        _allSongItems = [NSMutableArray array];
        _songCurrentPage = 1;
        _songTotal = 0;
        _isLoadingSongs = NO;
        _isMyListSongs = NO;

        _isCollected = NO;
        _playMode = @"listLoop";

        // CarPlay connected before the bridge created this module (cold
        // launch). Adopt the pending connection so the UI gets set up.
        if (_pendingInterfaceController) {
            CPTemplateApplicationScene *pendingScene = _pendingScene;
            CPInterfaceController *pendingController = _pendingInterfaceController;
            _pendingScene = nil;
            _pendingInterfaceController = nil;
            dispatch_async(dispatch_get_main_queue(), ^{
                [self templateApplicationScene:pendingScene didConnectInterfaceController:pendingController];
            });
        }
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"carplay:connected",
        @"carplay:disconnected",
        @"carplay:request-songlists",
        @"carplay:request-songs",
        @"carplay:song-selected",
        @"carplay:load-more-songlists",
        @"carplay:load-more-songs",
        @"carplay:open-play-detail",
        @"carplay:request-my-lists",
        @"carplay:my-list-selected",
        @"carplay:load-more-my-list-songs",
        @"carplay:toggle-collect",
        @"carplay:toggle-play-mode",
        @"carplay:collect-songlist",
    ];
}

- (void)startObserving {
    _hasListeners = YES;

    // Cold-launch race: when the CarPlay app is opened before the phone app,
    // the scene connects while the JS bridge is still loading, so the initial
    // requests in didConnectInterfaceController are skipped (no listeners yet).
    // Re-send them now that JS is observing.
    if (_isCarPlayConnected) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [self sendEventWithName:@"carplay:connected" body:@{}];
            [self sendEventWithName:@"carplay:request-songlists" body:@{
                @"page": @(1),
            }];
            [self sendEventWithName:@"carplay:request-my-lists" body:@{}];
        });
    }
}

- (void)stopObserving {
    _hasListeners = NO;
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
    [super addListener:eventName];
}

RCT_EXPORT_METHOD(removeListeners:(NSInteger)count) {
    [super removeListeners:count];
}

#pragma mark - CPTemplateApplicationSceneDelegate

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didConnectInterfaceController:(CPInterfaceController *)interfaceController {
    dispatch_async(dispatch_get_main_queue(), ^{
        self.carPlayScene = templateApplicationScene;
        self.interfaceController = interfaceController;
        _isCarPlayConnected = YES;

        [self setupTabBarTemplate];
        [self setupNowPlayingButton];

        if (_hasListeners) {
            [self sendEventWithName:@"carplay:connected" body:@{}];
            [self sendEventWithName:@"carplay:request-songlists" body:@{
                @"page": @(1),
            }];
            [self sendEventWithName:@"carplay:request-my-lists" body:@{}];
        }
    });
}

- (void)templateApplicationScene:(CPTemplateApplicationScene *)templateApplicationScene
    didDisconnectInterfaceController:(CPInterfaceController *)interfaceController {
    dispatch_async(dispatch_get_main_queue(), ^{
        _isCarPlayConnected = NO;
        self.interfaceController = nil;
        self.carPlayScene = nil;
        _tabBarTemplate = nil;
        _recommendTemplate = nil;
        _myListTemplate = nil;
        _songTemplate = nil;
        _songlistCollectButton = nil;
        [_allSonglistItems removeAllObjects];
        [_myListItems removeAllObjects];
        [_allSongItems removeAllObjects];

        if (_hasListeners) {
            [self sendEventWithName:@"carplay:disconnected" body:@{}];
        }
    });
}

#pragma mark - Template Setup

- (void)setupTabBarTemplate {
    if (!_interfaceController) return;

    // Don't recreate tab bar while viewing song detail pages
    if (_songTemplate) return;

    // 推荐 (Recommend) tab - songlist list
    CPListSection *recommendSection = [[CPListSection alloc] initWithItems:_allSonglistItems];
    CPListTemplate *recommendTemplate = [[CPListTemplate alloc] initWithTitle:@"\u63a8\u8350" sections:@[recommendSection]];
    recommendTemplate.tabTitle = @"\u63a8\u8350";
    recommendTemplate.tabImage = [UIImage systemImageNamed:@"music.note.list"];
    recommendTemplate.emptyViewTitleVariants = @[@"Loading songlists..."];
    recommendTemplate.delegate = self;
    _recommendTemplate = recommendTemplate;

    // 我的 (My) tab - user lists
    CPListSection *myListSection = [[CPListSection alloc] initWithItems:_myListItems];
    CPListTemplate *myListTemplate = [[CPListTemplate alloc] initWithTitle:@"\u6211\u7684" sections:@[myListSection]];
    myListTemplate.tabTitle = @"\u6211\u7684";
    myListTemplate.tabImage = [UIImage systemImageNamed:@"person.circle"];
    myListTemplate.emptyViewTitleVariants = @[@"Loading lists..."];
    myListTemplate.delegate = self;
    _myListTemplate = myListTemplate;

    if (!_tabBarTemplate) {
        // First time: create the tab bar and set as root
        CPTabBarTemplate *tabBar = [[CPTabBarTemplate alloc] initWithTemplates:@[recommendTemplate, myListTemplate]];
        _tabBarTemplate = tabBar;
        [self.interfaceController setRootTemplate:tabBar animated:YES completion:nil];
    } else {
        // Subsequent updates: just update the templates within the existing tab bar
        [_tabBarTemplate updateTemplates:@[recommendTemplate, myListTemplate]];
    }
}

- (void)setupNowPlayingButton {
    if (@available(iOS 14.0, *)) {
        [self refreshNowPlayingButtons];
    }
}

// Recreate and apply the Now Playing buttons from current state
// (CPNowPlayingImageButton.image is readonly, so buttons must be recreated to change icons)
- (void)refreshNowPlayingButtons API_AVAILABLE(ios(14.0)) {
    BOOL collected = _isCollected;
    NSString *mode = [_playMode copy] ?: @"listLoop";

    __weak typeof(self) weakSelf = self;

    // Collect (favorite) button
    CPNowPlayingImageButton *collectButton = [[CPNowPlayingImageButton alloc]
        initWithImage:[UIImage systemImageNamed:collected ? @"heart.fill" : @"heart"]
        handler:^(__kindof CPNowPlayingButton * _Nonnull button) {
            dispatch_async(dispatch_get_main_queue(), ^{
                __strong typeof(weakSelf) strongSelf = weakSelf;
                if (strongSelf && strongSelf->_hasListeners) {
                    [strongSelf sendEventWithName:@"carplay:toggle-collect" body:@{}];
                }
            });
        }];
    collectButton.selected = collected;

    // Play mode button
    CPNowPlayingImageButton *playModeButton = [[CPNowPlayingImageButton alloc]
        initWithImage:[UIImage systemImageNamed:[self playModeIconName:mode]]
        handler:^(__kindof CPNowPlayingButton * _Nonnull button) {
            dispatch_async(dispatch_get_main_queue(), ^{
                __strong typeof(weakSelf) strongSelf = weakSelf;
                if (strongSelf && strongSelf->_hasListeners) {
                    [strongSelf sendEventWithName:@"carplay:toggle-play-mode" body:@{}];
                }
            });
        }];

    [[CPNowPlayingTemplate sharedTemplate] updateNowPlayingButtons:@[collectButton, playModeButton]];
}

- (NSString *)playModeIconName:(NSString *)mode {
    if ([mode isEqualToString:@"random"]) return @"shuffle";
    if ([mode isEqualToString:@"list"]) return @"arrow.right.to.line";
    if ([mode isEqualToString:@"singleLoop"]) return @"repeat.1";
    if ([mode isEqualToString:@"none"]) return @"nosign";
    return @"repeat"; // listLoop
}

#pragma mark - CPListTemplateDelegate

- (void)listTemplate:(CPListTemplate *)listTemplate
    didSelectListItem:(CPListItem *)item
    completionHandler:(void (^)(void))completionHandler {

    if (listTemplate == _recommendTemplate) {
        NSDictionary *userInfo = item.userInfo;
        NSString *itemId = userInfo[@"id"];

        // Handle "Load More" button for songlists
        if ([itemId isEqualToString:LOAD_MORE_ID]) {
            if (!_isLoadingSonglists && _songlistTotal > 0) {
                _isLoadingSonglists = YES;
                NSInteger nextPage = _songlistCurrentPage + 1;
                if (_hasListeners) {
                    [self sendEventWithName:@"carplay:load-more-songlists" body:@{
                        @"page": @(nextPage),
                    }];
                }
            }
            if (completionHandler) completionHandler();
            return;
        }

        // User selected a songlist from 推荐 tab
        NSString *songlistId = userInfo[@"id"];
        NSString *source = userInfo[@"source"];

        _currentSonglistId = songlistId;
        _currentSonglistSource = source;
        _songCurrentPage = 1;
        _songTotal = 0;
        _isMyListSongs = NO;
        [_allSongItems removeAllObjects];

        if (_hasListeners) {
            [self sendEventWithName:@"carplay:request-songs" body:@{
                @"id": songlistId ?: @"",
                @"source": source ?: @"",
                @"page": @(1),
            }];
        }

        // Push a loading template for songs
        NSString *songTitle = _currentSonglistTitle ?: (userInfo[@"name"] ?: @"Songs");
        _currentSonglistName = SafeStr(userInfo[@"name"]);
        CPListTemplate *songTemplate = [[CPListTemplate alloc] initWithTitle:songTitle sections:@[]];
        songTemplate.emptyViewTitleVariants = @[@"Loading songs..."];
        // iOS 14+ drives song selection from per-item handler blocks (attached
        // in updateSongs); only wire the deprecated list delegate on iOS 13 so
        // selection isn't handled twice.
        if (@available(iOS 14.0, *)) {
            // Top-right "collect songlist" button: favorites this online songlist
            // into the user's lists, same action as the phone's 收藏歌单 button.
            CPBarButton *collectButton = [self makeSonglistCollectButtonCollected:NO];
            songTemplate.trailingNavigationBarButtons = @[collectButton];
            _songlistCollectButton = collectButton;
        } else {
            songTemplate.delegate = self;
        }
        _songTemplate = songTemplate;

        [self.interfaceController pushTemplate:songTemplate animated:YES completion:nil];

    } else if (listTemplate == _myListTemplate) {
        NSDictionary *userInfo = item.userInfo;
        NSString *itemId = userInfo[@"id"];

        // No pagination for user lists, but handle load more if needed
        if ([itemId isEqualToString:LOAD_MORE_ID]) {
            if (completionHandler) completionHandler();
            return;
        }

        // User selected a list from 我的 tab
        NSString *listId = itemId;
        NSString *listName = userInfo[@"name"] ?: @"List";

        _currentMyListId = listId;
        _currentSonglistTitle = listName;
        _songCurrentPage = 1;
        _songTotal = 0;
        _isMyListSongs = YES;
        _songlistCollectButton = nil;  // no collect button on 我的 list detail
        [_allSongItems removeAllObjects];

        if (_hasListeners) {
            [self sendEventWithName:@"carplay:my-list-selected" body:@{
                @"id": listId ?: @"",
            }];
        }

        // Push a loading template for songs
        CPListTemplate *songTemplate = [[CPListTemplate alloc] initWithTitle:listName sections:@[]];
        songTemplate.emptyViewTitleVariants = @[@"Loading songs..."];
        // iOS 14+ drives song selection from per-item handler blocks (attached
        // in updateMyListSongs); only wire the deprecated list delegate on iOS 13.
        if (@available(iOS 14.0, *)) {
        } else {
            songTemplate.delegate = self;
        }
        _songTemplate = songTemplate;

        [self.interfaceController pushTemplate:songTemplate animated:YES completion:nil];

    } else if (listTemplate == _songTemplate) {
        // iOS 13 fallback path. On iOS 14+ song rows use per-item handler
        // blocks (attached in updateSongs/updateMyListSongs) instead.
        NSString *itemId = item.userInfo[@"id"];
        if ([itemId isEqualToString:LOAD_MORE_ID]) {
            [self handleSongsLoadMore];
        } else {
            [self selectSongItem:item];
        }
    }

    if (completionHandler) {
        completionHandler();
    }
}

#pragma mark - Song Selection

// Shared song-selection logic used by both the iOS 14+ per-item handler blocks
// and the iOS 13 CPListTemplateDelegate fallback above.
- (void)selectSongItem:(CPListItem *)item {
    NSNumber *index = item.userInfo[@"index"];

    // Show the tapped row as the now-playing item and clear the indicator from
    // every other row so only one song renders as active. Without an explicit
    // playing item CarPlay keeps its default highlight on the first row while
    // the tapped row is also marked, so two rows appear selected at once.
    if (@available(iOS 14.0, *)) {
        for (CPListItem *songItem in _allSongItems) {
            songItem.playing = NO;
        }
        item.playing = YES;
    }

    if (_hasListeners) {
        if (_isMyListSongs) {
            [self sendEventWithName:@"carplay:song-selected" body:@{
                @"index": index ?: @(0),
                @"listId": _currentMyListId ?: @"",
                @"type": @"mylist",
            }];
        } else {
            [self sendEventWithName:@"carplay:song-selected" body:@{
                @"index": index ?: @(0),
                @"id": _currentSonglistId ?: @"",
                @"source": _currentSonglistSource ?: @"",
                @"type": @"songlist",
            }];
        }
    }
}

- (void)handleSongsLoadMore {
    if (!_isLoadingSongs && _songTotal > 0) {
        _isLoadingSongs = YES;
        NSInteger nextPage = _songCurrentPage + 1;
        if (_isMyListSongs) {
            if (_hasListeners) {
                [self sendEventWithName:@"carplay:load-more-my-list-songs" body:@{
                    @"id": _currentMyListId ?: @"",
                    @"page": @(nextPage),
                }];
            }
        } else {
            if (_hasListeners) {
                [self sendEventWithName:@"carplay:load-more-songs" body:@{
                    @"id": _currentSonglistId ?: @"",
                    @"source": _currentSonglistSource ?: @"",
                    @"page": @(nextPage),
                }];
            }
        }
    }
}

// Mark the row whose song id matches as now-playing and clear the rest. Driven
// from JS (updateNowPlayingState) so the indicator stays correct when the track
// changes from the phone or the Now Playing controls.
- (void)markPlayingSongWithId:(NSString *)songId {
    if (@available(iOS 14.0, *)) {
        BOOL hasId = [songId length] > 0;
        for (CPListItem *songItem in _allSongItems) {
            songItem.playing = hasId && [SafeStr(songItem.userInfo[@"id"]) isEqualToString:songId];
        }
    }
}

// Attach the iOS 14+ per-item selection handler to a song row.
- (void)attachSongSelectionHandlerToListItem:(CPListItem *)listItem {
    if (@available(iOS 14.0, *)) {
        __weak typeof(self) weakSelf = self;
        listItem.handler = ^(id<CPSelectableListItem> item, dispatch_block_t completionBlock) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (strongSelf) {
                [strongSelf selectSongItem:(CPListItem *)item];
            }
            if (completionBlock) completionBlock();
        };
    }
}

#pragma mark - JS Callable Methods

RCT_EXPORT_METHOD(updateSonglists:(NSDictionary *)data) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSArray *list = data[@"list"];
        NSInteger total = [data[@"total"] integerValue];
        NSInteger page = [data[@"page"] integerValue];

        self->_songlistTotal = total;
        self->_songlistCurrentPage = page;
        self->_isLoadingSonglists = NO;

        if (page == 1) {
            [self->_allSonglistItems removeAllObjects];
            self->_songlistsLoadMoreItem = nil;
            self->_songlistSection = nil;
        }

        for (NSDictionary *item in list) {
            NSString *name = SafeStr(item[@"name"]);
            NSString *author = SafeStr(item[@"author"]);
            CPListItem *listItem = [[CPListItem alloc]
                initWithText:name
                detailText:author];

            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"id"] = SafeStr(item[@"id"]);
            userInfo[@"source"] = SafeStr(item[@"source"]);
            userInfo[@"name"] = name;
            listItem.userInfo = userInfo;

            NSString *imgUrl = SafeStr(item[@"img"]);
            if ([imgUrl length] > 0) {
                [self loadImageForItem:listItem urlString:imgUrl];
            }

            [self->_allSonglistItems addObject:listItem];
        }

        [self appendLoadMoreIfNeededForSonglists];

        // Update the recommend template in place so the refresh is visible even when
        // the user is viewing a songlist detail page (they'll see the new category when they pop back).
        if (self->_recommendTemplate) {
            [self updateListTemplate:self->_recommendTemplate
                             section:self->_songlistSection
                              items:self->_allSonglistItems
                         sectionRef:&(self->_songlistSection)];
        }

        // Recreate tab bar template with updated songlist data
        [self setupTabBarTemplate];
    });
}

RCT_EXPORT_METHOD(updateSongs:(NSDictionary *)data) {
    dispatch_async(dispatch_get_main_queue(), ^{
        // Guard: ignore stale responses if user has navigated away
        if (self->_isMyListSongs || !self->_songTemplate) return;

        NSArray *list = data[@"list"];
        NSInteger total = [data[@"total"] integerValue];
        NSInteger page = [data[@"page"] integerValue];

        self->_songTotal = total;
        self->_songCurrentPage = page;
        self->_isLoadingSongs = NO;

        if (page == 1) {
            [self->_allSongItems removeAllObjects];
            self->_songsLoadMoreItem = nil;
            self->_songSection = nil;
        }

        // Build the list of new items without disturbing the existing "load more" item,
        // which is reused below so CarPlay can keep focus on it.
        NSInteger startIndex = [self realSongItemCount:self->_allSongItems];
        for (NSUInteger i = 0; i < list.count; i++) {
            NSDictionary *item = list[i];
            NSString *title = SafeStr(item[@"name"]);
            NSString *artist = SafeStr(item[@"singer"]);

            CPListItem *listItem = [[CPListItem alloc]
                initWithText:title
                detailText:artist];

            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"index"] = @(startIndex + i);
            userInfo[@"id"] = SafeStr(item[@"id"]);
            listItem.userInfo = userInfo;

            [self attachSongSelectionHandlerToListItem:listItem];

            [self->_allSongItems addObject:listItem];
        }

        [self appendLoadMoreIfNeededForSongs];

        // Update the song template in place to preserve scroll position/focus
        if (self->_songTemplate) {
            [self updateListTemplate:self->_songTemplate
                             section:self->_songSection
                              items:self->_allSongItems
                         sectionRef:&(self->_songSection)];
        }
    });
}

RCT_EXPORT_METHOD(updateSonglistTitle:(NSString *)title) {
    dispatch_async(dispatch_get_main_queue(), ^{
        // Title is set during template creation, cannot be changed after
        // Store title for when we recreate the template
        self->_currentSonglistTitle = title;
    });
}

RCT_EXPORT_METHOD(updateMyLists:(NSArray *)lists) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [self->_myListItems removeAllObjects];
        // Items are fully rebuilt each time, so start from a fresh section.
        self->_myListSection = nil;

        for (NSDictionary *item in lists) {
            NSString *name = SafeStr(item[@"name"]);
            NSString *desc = SafeStr(item[@"desc"]);
            CPListItem *listItem = [[CPListItem alloc]
                initWithText:name
                detailText:desc];

            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"id"] = SafeStr(item[@"id"]);
            userInfo[@"name"] = name;
            listItem.userInfo = userInfo;

            // Load cover image from first song's image URL
            NSString *imgUrl = SafeStr(item[@"img"]);
            if ([imgUrl length] > 0) {
                [self loadImageForItem:listItem urlString:imgUrl];
            }

            [self->_myListItems addObject:listItem];
        }

        // Update the 我的 tab in place so the refresh is visible even when the
        // user has drilled into a song detail page: setupTabBarTemplate bails out
        // while _songTemplate is set (and _songTemplate is never cleared on pop),
        // so without this in-place update newly collected lists never show up.
        // Mirrors how updateSonglists refreshes _recommendTemplate.
        if (self->_myListTemplate) {
            [self updateListTemplate:self->_myListTemplate
                             section:self->_myListSection
                              items:self->_myListItems
                         sectionRef:&(self->_myListSection)];
        }

        // Recreate tab bar to update the 我的 tab
        [self setupTabBarTemplate];
    });
}

RCT_EXPORT_METHOD(updateMyListSongs:(NSDictionary *)data) {
    dispatch_async(dispatch_get_main_queue(), ^{
        // Guard: ignore stale responses if user has navigated away
        if (!self->_isMyListSongs || !self->_songTemplate) return;

        NSArray *list = data[@"list"];
        NSInteger total = [data[@"total"] integerValue];
        NSInteger page = [data[@"page"] integerValue];

        self->_songTotal = total;
        self->_songCurrentPage = page;
        self->_isLoadingSongs = NO;

        if (page == 1) {
            [self->_allSongItems removeAllObjects];
            self->_songsLoadMoreItem = nil;
            self->_songSection = nil;
        }

        // Build the list of new items without disturbing the existing "load more" item,
        // which is reused below so CarPlay can keep focus on it.
        NSInteger startIndex = [self realSongItemCount:self->_allSongItems];
        for (NSUInteger i = 0; i < list.count; i++) {
            NSDictionary *item = list[i];
            NSString *title = SafeStr(item[@"name"]);
            NSString *artist = SafeStr(item[@"singer"]);

            CPListItem *listItem = [[CPListItem alloc]
                initWithText:title
                detailText:artist];

            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"index"] = @(startIndex + i);
            userInfo[@"id"] = SafeStr(item[@"id"]);
            listItem.userInfo = userInfo;

            [self attachSongSelectionHandlerToListItem:listItem];

            [self->_allSongItems addObject:listItem];
        }

        [self appendLoadMoreIfNeededForSongs];

        // Update the song template in place to preserve scroll position/focus
        if (self->_songTemplate) {
            [self updateListTemplate:self->_songTemplate
                             section:self->_songSection
                              items:self->_allSongItems
                         sectionRef:&(self->_songSection)];
        }
    });
}

RCT_EXPORT_METHOD(popTemplate) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (self.interfaceController) {
            [self.interfaceController popTemplateAnimated:YES completion:nil];
        }
    });
}

RCT_EXPORT_METHOD(playSong:(nonnull NSNumber *)index) {
    // Playback is triggered via the song-selected event
}

RCT_EXPORT_METHOD(onPlayStateChanged:(NSDictionary *)info) {
    // react-native-track-player handles CarPlay Now Playing metadata automatically
}

RCT_EXPORT_METHOD(updateNowPlayingState:(NSDictionary *)state) {
    dispatch_async(dispatch_get_main_queue(), ^{
        id collected = state[@"collected"];
        if ([collected isKindOfClass:[NSNumber class]]) {
            self->_isCollected = [collected boolValue];
        }
        id playMode = state[@"playMode"];
        if ([playMode isKindOfClass:[NSString class]] && [playMode length] > 0) {
            self->_playMode = playMode;
        }
        id songId = state[@"songId"];
        if ([songId isKindOfClass:[NSString class]]) {
            [self markPlayingSongWithId:songId];
        }
        if (@available(iOS 14.0, *)) {
            [self refreshNowPlayingButtons];
        }
    });
}

// Builds the songlist detail page's top-right collect (heart) button. Extracted so
// updateSonglistCollectState can rebuild it: mutating CPBarButton.image on an
// already-displayed button does NOT reliably re-render in CarPlay (the icon only
// refreshes when the template is re-pushed), so state changes recreate the button
// and reassign trailingNavigationBarButtons to force a live update.
- (CPBarButton *)makeSonglistCollectButtonCollected:(BOOL)collected API_AVAILABLE(ios(14.0)) {
    __weak typeof(self) weakSelf = self;
    return [[CPBarButton alloc]
        initWithImage:[UIImage systemImageNamed:collected ? @"heart.fill" : @"heart"]
        handler:^(CPBarButton * _Nonnull button) {
            // Disable immediately on tap so a rapid double-tap can't fire a second
            // collect during the JS round-trip; updateSonglistCollectState rebuilds
            // an enabled button once the toggle settles.
            button.enabled = NO;
            dispatch_async(dispatch_get_main_queue(), ^{
                __strong typeof(weakSelf) strongSelf = weakSelf;
                if (strongSelf && strongSelf->_hasListeners) {
                    [strongSelf sendEventWithName:@"carplay:collect-songlist" body:@{
                        @"id": strongSelf->_currentSonglistId ?: @"",
                        @"source": strongSelf->_currentSonglistSource ?: @"",
                        @"name": strongSelf->_currentSonglistName ?: @"",
                    }];
                }
            });
        }];
}

RCT_EXPORT_METHOD(updateSonglistCollectState:(NSDictionary *)data) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (@available(iOS 14.0, *)) {
            BOOL collected = [data[@"collected"] boolValue];
            // Rebuild the heart button (filled/outline) instead of mutating .image,
            // which CarPlay does not re-render live on a displayed button.
            CPBarButton *newButton = [self makeSonglistCollectButtonCollected:collected];
            // Re-enable (or keep disabled) as the toggle settles: the tap handler
            // disables the old button, JS re-enables once collect/uncollect completes.
            // Absent key leaves the freshly built (enabled) button untouched.
            if (data[@"enabled"] != nil) {
                newButton.enabled = [data[@"enabled"] boolValue];
            }
            self->_songlistCollectButton = newButton;
            // Reassigning the array forces the live template to re-render its bar
            // buttons. Safe no-op when no songlist detail template is displayed.
            if (self->_songTemplate) {
                self->_songTemplate.trailingNavigationBarButtons = @[newButton];
            }
        }
    });
}

RCT_EXPORT_METHOD(openMainApp) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] openURL:[NSURL URLWithString:@"lxmusic://carplay-open"] options:@{} completionHandler:nil];
    });
}

RCT_EXPORT_METHOD(isCarPlayConnected:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@(_isCarPlayConnected));
}

#pragma mark - Load More Button

- (NSInteger)realSongItemCount:(NSArray *)items {
    NSInteger count = 0;
    for (CPListItem *item in items) {
        if (![item.userInfo[@"id"] isEqualToString:LOAD_MORE_ID]) {
            count++;
        }
    }
    return count;
}

- (void)updateListTemplate:(CPListTemplate *)listTemplate
                   section:(CPListSection *)section
                     items:(NSArray *)items
                sectionRef:(CPListSection *__strong *)sectionRef {
    CPListSection *targetSection = section;
    BOOL sectionCreated = NO;

    if (!targetSection) {
        targetSection = [[CPListSection alloc] initWithItems:items];
        sectionCreated = YES;
    }

    @try {
        [targetSection setValue:items forKey:@"items"];
    } @catch (NSException *exception) {
        // Private ivar mutation is not available; fall back to a brand-new section.
        targetSection = [[CPListSection alloc] initWithItems:items];
        sectionCreated = YES;
    }

    [listTemplate updateSections:@[targetSection]];

    if (sectionRef) {
        *sectionRef = sectionCreated ? targetSection : section;
    }
}

- (void)appendLoadMoreIfNeededForSonglists {
    // Remove existing load more item from the array but keep the stable instance
    // so CarPlay can preserve focus when we add it back.
    NSMutableArray *cleaned = [NSMutableArray array];
    for (CPListItem *item in _allSonglistItems) {
        if (![item.userInfo[@"id"] isEqualToString:LOAD_MORE_ID]) {
            [cleaned addObject:item];
        }
    }
    [_allSonglistItems setArray:cleaned];

    // Add load more button if there are more items
    if (_songlistTotal > 0 && _allSonglistItems.count < (NSUInteger)_songlistTotal) {
        if (!_songlistsLoadMoreItem) {
            _songlistsLoadMoreItem = [[CPListItem alloc]
                initWithText:@"加载更多..."
                detailText:@""];
            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"id"] = LOAD_MORE_ID;
            _songlistsLoadMoreItem.userInfo = userInfo;
        }
        _songlistsLoadMoreItem.detailText = [NSString stringWithFormat:@"%lu / %ld", (unsigned long)_allSonglistItems.count, (long)_songlistTotal];
        [_allSonglistItems addObject:_songlistsLoadMoreItem];
    }
}

- (void)appendLoadMoreIfNeededForSongs {
    // Remove existing load more item from the array but keep the stable instance
    // so CarPlay can preserve focus when we add it back.
    NSMutableArray *cleaned = [NSMutableArray array];
    for (CPListItem *item in _allSongItems) {
        if (![item.userInfo[@"id"] isEqualToString:LOAD_MORE_ID]) {
            [cleaned addObject:item];
        }
    }
    [_allSongItems setArray:cleaned];

    // Add load more button if there are more items
    if (_songTotal > 0 && _allSongItems.count < (NSUInteger)_songTotal) {
        if (!_songsLoadMoreItem) {
            _songsLoadMoreItem = [[CPListItem alloc]
                initWithText:@"加载更多..."
                detailText:@""];
            NSMutableDictionary *userInfo = [NSMutableDictionary dictionary];
            userInfo[@"id"] = LOAD_MORE_ID;
            _songsLoadMoreItem.userInfo = userInfo;

            if (@available(iOS 14.0, *)) {
                __weak typeof(self) weakSelf = self;
                _songsLoadMoreItem.handler = ^(id<CPSelectableListItem> item, dispatch_block_t completionBlock) {
                    __strong typeof(weakSelf) strongSelf = weakSelf;
                    if (strongSelf) {
                        [strongSelf handleSongsLoadMore];
                    }
                    if (completionBlock) completionBlock();
                };
            }
        }
        _songsLoadMoreItem.detailText = [NSString stringWithFormat:@"%lu / %ld", (unsigned long)_allSongItems.count, (long)_songTotal];
        [_allSongItems addObject:_songsLoadMoreItem];
    }
}

#pragma mark - Image Loading

- (void)loadImageForItem:(CPListItem *)item urlString:(NSString *)urlString {
    NSURL *url = [NSURL URLWithString:urlString];
    if (!url) return;

    NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error || !data) return;
        UIImage *image = [UIImage imageWithData:data];
        if (image) {
            dispatch_async(dispatch_get_main_queue(), ^{
                [item setImage:image];
            });
        }
    }];
    [task resume];
}

@end
