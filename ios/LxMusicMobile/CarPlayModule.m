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

    // Song list state (shared between recommend detail & my list detail)
    CPListTemplate *_songTemplate;
    NSMutableArray *_allSongItems;
    NSInteger _songCurrentPage;
    NSInteger _songTotal;
    BOOL _isLoadingSongs;
    NSString *_currentSonglistId;
    NSString *_currentSonglistSource;
    NSString *_currentSonglistTitle;
    BOOL _isMyListSongs;  // YES when loading songs from "我的" tab
    NSString *_currentMyListId;

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

+ (instancetype)sharedInstance {
    return _sharedInstance;
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
    ];
}

- (void)startObserving {
    _hasListeners = YES;
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
        CPListTemplate *songTemplate = [[CPListTemplate alloc] initWithTitle:songTitle sections:@[]];
        songTemplate.emptyViewTitleVariants = @[@"Loading songs..."];
        songTemplate.delegate = self;
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
        [_allSongItems removeAllObjects];

        if (_hasListeners) {
            [self sendEventWithName:@"carplay:my-list-selected" body:@{
                @"id": listId ?: @"",
            }];
        }

        // Push a loading template for songs
        CPListTemplate *songTemplate = [[CPListTemplate alloc] initWithTitle:listName sections:@[]];
        songTemplate.emptyViewTitleVariants = @[@"Loading songs..."];
        songTemplate.delegate = self;
        _songTemplate = songTemplate;

        [self.interfaceController pushTemplate:songTemplate animated:YES completion:nil];

    } else if (listTemplate == _songTemplate) {
        NSDictionary *userInfo = item.userInfo;
        NSString *itemId = userInfo[@"id"];

        // Handle "Load More" button for songs
        if ([itemId isEqualToString:LOAD_MORE_ID]) {
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
            if (completionHandler) completionHandler();
            return;
        }

        // User selected a song
        NSNumber *index = userInfo[@"index"];

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

    if (completionHandler) {
        completionHandler();
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
        if (@available(iOS 14.0, *)) {
            [self refreshNowPlayingButtons];
        }
    });
}

RCT_EXPORT_METHOD(openMainApp) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[UIApplication sharedApplication] openURL:[NSURL URLWithString:@"lxmusic://carplay-open"] options:@{} completionHandler:nil];
    });
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
