import { NativeEventEmitter, NativeModules, Platform } from 'react-native'

const { CarPlayModule } = NativeModules

const isCarPlayAvailable = CarPlayModule != null && Platform.OS === 'ios'

let eventEmitter: NativeEventEmitter | null = null

const getEventEmitter = (): NativeEventEmitter | null => {
  if (!isCarPlayAvailable) return null
  if (!eventEmitter) {
    eventEmitter = new NativeEventEmitter(CarPlayModule)
  }
  return eventEmitter
}

export interface SonglistItem {
  id: string
  name: string
  author: string
  source: string
  img?: string
  desc?: string
  play_count?: string
}

export interface SongItem {
  id: string
  name: string
  singer: string
  album?: string
}

export interface MyListItem {
  id: string
  name: string
  desc?: string
  img?: string
}

export interface MyListSongItem {
  id: string
  name: string
  singer: string
  album?: string
}

/**
 * Send songlist data to CarPlay native module
 */
export const updateSonglists = (data: { list: SonglistItem[], total: number, page: number }) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateSonglists(data)
}

/**
 * Send song data to CarPlay native module
 */
export const updateSongs = (data: { list: SongItem[], total: number, page: number }) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateSongs(data)
}

/**
 * Update the songlist title on CarPlay
 */
export const updateSonglistTitle = (title: string) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateSonglistTitle(title)
}

/**
 * Send user's list data to CarPlay native module (我的 tab)
 */
export const updateMyLists = (lists: MyListItem[]) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateMyLists(lists)
}

/**
 * Send user's list songs to CarPlay native module
 */
export const updateMyListSongs = (data: { list: MyListSongItem[], total: number, page: number }) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateMyListSongs(data)
}

/**
 * Pop the current template (go back)
 */
export const popTemplate = () => {
  if (!isCarPlayAvailable) return
  CarPlayModule.popTemplate()
}

/**
 * Notify native module about play state change
 */
export const onPlayStateChanged = (info: { isPlay: boolean, name?: string, singer?: string }) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.onPlayStateChanged(info)
}

/**
 * Update the Now Playing template buttons state (collect + play mode)
 */
export const updateNowPlayingState = (state: { collected?: boolean, playMode?: string }) => {
  if (!isCarPlayAvailable) return
  CarPlayModule.updateNowPlayingState(state)
}

/**
 * Open the main app from CarPlay
 */
export const openMainApp = () => {
  if (!isCarPlayAvailable) return
  CarPlayModule.openMainApp()
}

/**
 * Subscribe to CarPlay events
 */
export const onCarPlayEvent = (event: string, handler: (...args: any[]) => void): (() => void) => {
  const emitter = getEventEmitter()
  if (!emitter) return () => {}

  const subscription = emitter.addListener(event, handler)
  return () => {
    subscription.remove()
  }
}

export const CarPlayEvents = {
  CONNECTED: 'carplay:connected',
  DISCONNECTED: 'carplay:disconnected',
  REQUEST_SONGLISTS: 'carplay:request-songlists',
  REQUEST_SONGS: 'carplay:request-songs',
  SONG_SELECTED: 'carplay:song-selected',
  LOAD_MORE_SONGLISTS: 'carplay:load-more-songlists',
  LOAD_MORE_SONGS: 'carplay:load-more-songs',
  OPEN_PLAY_DETAIL: 'carplay:open-play-detail',
  REQUEST_MY_LISTS: 'carplay:request-my-lists',
  MY_LIST_SELECTED: 'carplay:my-list-selected',
  LOAD_MORE_MY_LIST_SONGS: 'carplay:load-more-my-list-songs',
  TOGGLE_COLLECT: 'carplay:toggle-collect',
  TOGGLE_PLAY_MODE: 'carplay:toggle-play-mode',
} as const

export const isAvailable = isCarPlayAvailable
