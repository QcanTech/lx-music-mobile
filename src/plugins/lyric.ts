import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import BackgroundTimer from 'react-native-background-timer'
import Lyric, { type Lines } from 'lrc-file-parser'

import { getPosition, updateNowPlayingTitles } from '@/plugins/player/utils'
import { setLastLyric } from '@/core/player/playInfo'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'

// import { getStore, subscribe } from '@/store'
export type Line = Lines[number]
type PlayHook = (line: number, text: string) => void
type SetLyricHook = (lines: Lines) => void

const lrcTools = {
  isInited: false,
  lrc: null as Lyric | null,
  currentLineData: { line: 0, text: '' },
  currentLines: [] as Lines,
  playHooks: [] as PlayHook[],
  setLyricHooks: [] as SetLyricHook[],
  isPlay: false,
  isShowTranslation: false,
  isShowRoma: false,
  lyricText: '',
  translationText: '' as string | null | undefined,
  romaText: '' as string | null | undefined,
  init() {
    if (this.isInited) return
    this.isInited = true
    this.lrc = new Lyric({
      onPlay: this.onPlay.bind(this),
      onSetLyric: this.onSetLyric.bind(this),
      offset: 100, // offset time(ms), default is 150 ms
    })
  },
  onPlay(line: number, text: string) {
    this.currentLineData.line = line
    this.currentLineData.text = text
    for (const hook of this.playHooks) hook(line, text)
  },
  onSetLyric(lines: Lines) {
    // console.log('onSetLyric', lines)
    this.currentLines = lines
    this.currentLineData.line = 0
    this.currentLineData.text = ''
    for (const hook of this.playHooks) hook(-1, '')
    for (const hook of this.setLyricHooks) hook(lines)
  },
  addPlayHook(hook: PlayHook) {
    this.playHooks.push(hook)
    hook(this.currentLineData.line, this.currentLineData.text)
  },
  removePlayHook(hook: PlayHook) {
    this.playHooks.splice(this.playHooks.indexOf(hook), 1)
  },
  addSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.push(hook)
    hook(this.currentLines)
  },
  removeSetLyricHook(hook: SetLyricHook) {
    this.setLyricHooks.splice(this.setLyricHooks.indexOf(hook), 1)
  },
  setLyric() {
    const extendedLyrics = [] as string[]
    if (this.isShowTranslation && this.translationText) extendedLyrics.push(this.translationText)
    if (this.isShowRoma && this.romaText) extendedLyrics.push(this.romaText)
    this.lrc!.setLyric(this.lyricText, extendedLyrics)
  },
}


export const init = async() => {
  lrcTools.init()
  lrcTools.addPlayHook(updateRemoteLyric)
  global.state_event.on('configUpdated', handleConfigUpdated)
}

// The remote (CarPlay / Bluetooth) lyric is written into the Now Playing title
// and is normally driven by lrc-file-parser's play hook, which schedules each
// line with requestAnimationFrame. On iOS requestAnimationFrame is backed by a
// CADisplayLink tied to the phone display, so it stops firing once the screen
// turns off. The audio keeps playing (and the CarPlay scene keeps the app
// active) but the lyric freezes. Drive the remote lyric with a BackgroundTimer
// while playing so it keeps updating regardless of screen / app state.
let lastRemoteLyricLine = Number.MIN_SAFE_INTEGER
let lastRemoteLyricText: string | null = null

const remoteLyricSync = {
  timer: null as number | null,
  // Mirrors lrc-file-parser's own line lookup so the emitted line matches the
  // requestAnimationFrame-driven path exactly (no flicker between the two).
  findCurLineNum(lines: Lines, curTime: number): number {
    if (curTime <= 0) return 0
    const length = lines.length
    for (let index = 0; index < length; index++) {
      if (curTime <= lines[index].time) return index === 0 ? 0 : index - 1
    }
    return length - 1
  },
  sync() {
    if (!settingState.setting['player.isShowBluetoothLyric']) return
    if (!lrcTools.isPlay) return
    const lines = lrcTools.currentLines
    if (!lines.length) return
    const offset = Math.trunc((lrcTools.lrc?.tags.offset ?? 0) + (lrcTools.lrc?.offset ?? 0))
    void getPosition().then((position) => {
      if (!lrcTools.isPlay) return
      const lineNum = this.findCurLineNum(lines, position * 1000 + offset)
      const line = lines[lineNum]
      if (line == null) return
      void updateRemoteLyric(lineNum, line.text)
    }).catch(() => {})
  },
  start() {
    if (this.timer != null) return
    // Only iOS needs this: Android drives the remote lyric from a native module
    // that keeps running in the background.
    if (Platform.OS !== 'ios') return
    if (!settingState.setting['player.isShowBluetoothLyric']) return
    this.timer = BackgroundTimer.setInterval(() => { this.sync() }, 500)
  },
  stop() {
    if (this.timer == null) return
    BackgroundTimer.clearInterval(this.timer)
    this.timer = null
  },
}

const handleConfigUpdated: typeof global.state_event.configUpdated = (keys) => {
  if (!keys.includes('player.isShowBluetoothLyric')) return
  if (settingState.setting['player.isShowBluetoothLyric']) {
    if (lrcTools.isPlay) remoteLyricSync.start()
  } else {
    remoteLyricSync.stop()
  }
}

const updateRemoteLyric = async(line: number, lrc: string) => {
  // console.log('updateRemoteLyric', line, lrc)
  const isShowBluetoothLyric = settingState.setting['player.isShowBluetoothLyric']
  if (!isShowBluetoothLyric) {
    return
  }
  // The play hook and the background sync timer can both reach the same line
  // near a boundary; skip duplicate emits for a real lyric line. Resets
  // (line < 0) always emit so the title refreshes correctly on track change.
  if (line >= 0 && line === lastRemoteLyricLine && lrc === lastRemoteLyricText) return
  lastRemoteLyricLine = line
  lastRemoteLyricText = lrc
  setLastLyric(lrc)
  if (lrc == null) {
    void updateNowPlayingTitles(playerState.musicInfo.name, playerState.musicInfo.singer ?? '')
  } else {
    void updateNowPlayingTitles(lrc, `${playerState.musicInfo.name}${playerState.musicInfo.singer ? ` - ${playerState.musicInfo.singer}` : ''}`)
  }
}

export const setLyric = (lyric: string, translation?: string, romalrc?: string) => {
  lrcTools.isPlay = false
  remoteLyricSync.stop()
  lrcTools.lyricText = lyric
  lrcTools.translationText = translation
  lrcTools.romaText = romalrc
  lrcTools.setLyric()
}
export const setPlaybackRate = (playbackRate: number) => {
  lrcTools.lrc!.setPlaybackRate(playbackRate)
}
export const toggleTranslation = (isShow: boolean) => {
  lrcTools.isShowTranslation = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const toggleRoma = (isShow: boolean) => {
  lrcTools.isShowRoma = isShow
  if (!lrcTools.lyricText) return
  lrcTools.setLyric()
}
export const play = (time: number) => {
  // console.log(time)
  lrcTools.isPlay = true
  lrcTools.lrc!.play(time)
  remoteLyricSync.start()
}
export const pause = () => {
  // console.log('pause')
  lrcTools.isPlay = false
  lrcTools.lrc!.pause()
  remoteLyricSync.stop()
}

// on lyric play hook
export const useLrcPlay = (autoUpdate = true) => {
  const [lrcInfo, setLrcInfo] = useState(lrcTools.currentLineData)
  useEffect(() => {
    if (!autoUpdate) return
    const setLrcCallback: SetLyricHook = () => {
      setLrcInfo({ line: 0, text: '' })
    }
    const playCallback: PlayHook = (line, text) => {
      setLrcInfo({ line, text })
    }
    lrcTools.addSetLyricHook(setLrcCallback)
    lrcTools.addPlayHook(playCallback)
    setLrcInfo(lrcTools.currentLineData)
    return () => {
      lrcTools.removeSetLyricHook(setLrcCallback)
      lrcTools.removePlayHook(playCallback)
    }
  }, [autoUpdate])

  return lrcInfo
}

// on lyric set hook
export const useLrcSet = () => {
  const [lines, setLines] = useState<Lines>(lrcTools.currentLines)
  useEffect(() => {
    const callback = (lines: Lines) => {
      setLines(lines)
    }
    lrcTools.addSetLyricHook(callback)
    return () => { lrcTools.removeSetLyricHook(callback) }
  }, [])

  return lines
}

