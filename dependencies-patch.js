// 修补依赖源码以使构建的依赖恢复正常工作

const fs = require('node:fs')
const path = require('node:path')

const rootPath = path.join(__dirname, './')

const patchs = [
  // 让 updateNowPlayingMetadata 支持设置播放状态（playbackRate），以修复 CarPlay/锁屏播放状态不同步
  [
    path.join(rootPath, 'node_modules/react-native-track-player/ios/RNTrackPlayer/Utils/Metadata.swift'),
    `        if let isLiveStream = metadata["isLiveStream"] as? Bool {
            ret.append(NowPlayingInfoProperty.isLiveStream(isLiveStream))
        }
        
        player.nowPlayingInfoController.set(keyValues: ret)`,
    `        if let isLiveStream = metadata["isLiveStream"] as? Bool {
            ret.append(NowPlayingInfoProperty.isLiveStream(isLiveStream))
        }

        if let rate = metadata["rate"] as? Double {
            ret.append(NowPlayingInfoProperty.playbackRate(rate))
        }

        player.nowPlayingInfoController.set(keyValues: ret)`,
  ],
  // autoUpdateMetadata 关闭时，在原生层同步 CarPlay/锁屏播放状态（playbackRate + MPNowPlayingInfoCenter.playbackState）
  [
    path.join(rootPath, 'node_modules/react-native-track-player/ios/RNTrackPlayer/RNTrackPlayer.swift'),
    `    // MARK: - QueuedAudioPlayer Event Handlers

    func handleAudioPlayerStateChange(state: AVPlayerWrapperState) {
        emit(event: EventType.PlaybackState, body: getPlaybackStateBodyKeyValues(state: state))
        if (state == .ended) {`,
    `    // MARK: - QueuedAudioPlayer Event Handlers

    // PATCH: sync now playing playback rate with the player's play/pause state,
    // even when automatic metadata updates are disabled (autoUpdateMetadata: false),
    // otherwise CarPlay / lock screen play-pause state will be stale.
    // Also update MPNowPlayingInfoCenter.playbackState so CarPlay Now Playing matches the app.
    private func syncNowPlayingPlaybackRate() {
        if (!player.automaticallyUpdateNowPlayingInfo) {
            let isPlaying = player.playWhenReady
            let rate = isPlaying ? Double(player.rate) : 0
            player.nowPlayingInfoController.set(keyValue: NowPlayingInfoProperty.playbackRate(rate))

            // CarPlay Now Playing uses MPNowPlayingInfoCenter.playbackState for the play/pause icon.
            DispatchQueue.main.async {
                if #available(iOS 13.0, *) {
                    MPNowPlayingInfoCenter.default().playbackState = isPlaying ? .playing : .paused
                }
            }
        }
    }

    func handleAudioPlayerStateChange(state: AVPlayerWrapperState) {
        emit(event: EventType.PlaybackState, body: getPlaybackStateBodyKeyValues(state: state))
        syncNowPlayingPlaybackRate()
        if (state == .ended) {`,
  ],
  // 在 playWhenReady 变化时也同步播放状态
  [
    path.join(rootPath, 'node_modules/react-native-track-player/ios/RNTrackPlayer/RNTrackPlayer.swift'),
    `    func handlePlayWhenReadyChange(playWhenReady: Bool) {
        configureAudioSession();
        emit(`,
    `    func handlePlayWhenReadyChange(playWhenReady: Bool) {
        configureAudioSession();
        syncNowPlayingPlaybackRate()
        emit(`,
  ],
  // 让 RNN 的 overlay 窗口绑定 windowScene，否则在采用 UIScene 生命周期的本 app 中弹窗完全不可见
  // （SceneDelegate.m 已为主窗口做了同样的事，但 overlay 窗口是在 scene 连接之后才创建的）
  [
    path.join(rootPath, 'node_modules/react-native-navigation/lib/ios/RNNOverlayManager.m'),
    `#import "RNNOverlayManager.h"
#import "RNNOverlayWindow.h"

@implementation RNNOverlayManager`,
    `#import "RNNOverlayManager.h"
#import "RNNOverlayWindow.h"

// PATCH: On iOS 13+ a UIWindow whose windowScene is nil is never displayed. RNN creates
// overlay windows with a bare initWithFrame: (RNNCommandsHandler.m), which makes them
// invisible in apps that adopt the UIScene lifecycle. Prefer the scene owning RNN's
// "previous" window (the app's own key window), otherwise fall back to the foreground
// UIWindowScene. Non-UIWindowScene entries are skipped, e.g. the CarPlay scene.
static UIWindowScene *RNNActiveWindowScene(UIWindow *window) {
    if ([window.windowScene isKindOfClass:[UIWindowScene class]]) {
        return window.windowScene;
    }

    UIWindowScene *firstWindowScene = nil;
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
        if (![scene isKindOfClass:[UIWindowScene class]]) continue;
        if (scene.activationState == UISceneActivationStateForegroundActive) {
            return (UIWindowScene *)scene;
        }
        if (firstWindowScene == nil) firstWindowScene = (UIWindowScene *)scene;
    }

    return firstWindowScene;
}

@implementation RNNOverlayManager`,
  ],
  [
    path.join(rootPath, 'node_modules/react-native-navigation/lib/ios/RNNOverlayManager.m'),
    `    overlayWindow.previousWindow = [UIApplication sharedApplication].keyWindow;
    [_overlayWindows addObject:overlayWindow];`,
    `    overlayWindow.previousWindow = [UIApplication sharedApplication].keyWindow;
    // PATCH: attach the scene before unhiding, otherwise the window is never displayed
    overlayWindow.windowScene = RNNActiveWindowScene(overlayWindow.previousWindow);
    [_overlayWindows addObject:overlayWindow];`,
  ],
]

;(async() => {
  for (const [filePath, fromStr, toStr] of patchs) {
    console.log(`Patching ${filePath.replace(rootPath, '')}`)
    try {
      const file = (await fs.promises.readFile(filePath)).toString()
      await fs.promises.writeFile(filePath, file.replace(fromStr, toStr))
    } catch (err) {
      console.error(`Patch ${filePath.replace(rootPath, '')} failed: ${err.message}`)
    }
  }
  console.log('\nDependencies patch finished.\n')
})()
