import { isAvailable, onCarPlayEvent, updateSonglists, updateSongs, updateSonglistTitle, updateMyLists, updateMyListSongs, updateNowPlayingState, type SonglistItem, type SongItem, type MyListItem, type MyListSongItem } from '@/utils/nativeModules/carplay'
import { getList, getListDetail, setListDetail } from '@/core/songlist'
import { playList, collectMusic, uncollectMusic } from '@/core/player/player'
import { setTempList } from '@/core/list'
import { LIST_IDS, MUSIC_TOGGLE_MODE_LIST } from '@/config/constant'
import { getSongListSetting } from '@/utils/data'
import listState from '@/store/list/state'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { getListMusics, getListMusicSync, allMusicList } from '@/utils/listManage'
import { getPicUrl } from '@/core/music/online'
import { updateSetting } from '@/core/common'

let unsubscribes: Array<() => void> = []

const myListSongsPageSize = 50

const getListId = (id: string, source: LX.OnlineSource) => `${source}__${id}`

/**
 * Fetch and send songlist data to CarPlay (推荐 tab)
 */
const handleRequestSonglists = async(page: number) => {
  if (!isAvailable) return
  try {
    const setting = await getSongListSetting()
    const source = setting.source as LX.OnlineSource
    const sortId = setting.sortId
    const tagId = setting.tagId
    const result = await getList(source, tagId, sortId, page)
    const list: SonglistItem[] = result.list.map(item => ({
      id: item.id,
      name: item.name,
      author: item.author,
      source: item.source,
      img: item.img,
      desc: item.desc,
      play_count: item.play_count,
    }))
    updateSonglists({ list, total: result.total, page })
  } catch (err) {
    console.error('CarPlay: failed to load songlists', err)
  }
}

/**
 * Fetch and send song data for a specific songlist to CarPlay
 */
const handleRequestSongs = async(songlistId: string, source: string, page: number) => {
  if (!isAvailable) return
  try {
    const listDetail = await getListDetail(songlistId, source as LX.OnlineSource, page)
    setListDetail(listDetail, songlistId, page)

    // Update the title with the songlist name
    if (page === 1 && listDetail.info.name) {
      updateSonglistTitle(listDetail.info.name)
    }

    const list: SongItem[] = listDetail.list.map(m => ({
      id: m.id,
      name: m.name,
      singer: m.singer,
      album: m.meta.albumName,
    }))
    updateSongs({ list, total: listDetail.total, page })
  } catch (err) {
    console.error('CarPlay: failed to load songs', err)
  }
}

/**
 * Handle song selection from CarPlay - trigger playback
 */
const handleSongSelected = async(data: { index: number, type?: string, id?: string, source?: string, listId?: string }) => {
  if (!isAvailable) return
  try {
    if (data.type === 'mylist') {
      // Song from 我的 tab - play from user's list directly
      const listId = data.listId
      if (!listId) return
      playList(listId, data.index)
    } else {
      // Song from 推荐 tab - use temp list with online songlist songs
      const songlistId = data.id
      const source = data.source
      if (!songlistId || !source) return
      const listId = getListId(songlistId, source as LX.OnlineSource)
      const songlistState = (await import('@/store/songlist/state')).default
      const listDetailInfo = songlistState.listDetailInfo

      if (listDetailInfo.list.length > data.index) {
        await setTempList(listId, [...listDetailInfo.list])
        playList(LIST_IDS.TEMP, data.index)
      }
    }
  } catch (err) {
    console.error('CarPlay: failed to play song', err)
  }
}

/**
 * Send user's lists to CarPlay (我的 tab)
 */
const handleRequestMyLists = async() => {
  if (!isAvailable) return
  try {
    const allList = listState.allList.filter(l => l.id !== LIST_IDS.TEMP)

    // Load music for each list to get first song's image as cover
    const lists: MyListItem[] = await Promise.all(allList.map(async(l) => {
      // Try cached data first, fall back to loading from DB
      let musicList = allMusicList.get(l.id)
      if (!musicList) {
        musicList = await getListMusics(l.id)
      }
      const firstSong = musicList[0]
      let img: string | undefined

      if (firstSong) {
        if (firstSong.meta?.picUrl) {
          img = firstSong.meta.picUrl
        } else if (firstSong.source !== 'local') {
          // Lazily fetch the image URL from the API
          try {
            img = await getPicUrl({
              musicInfo: firstSong as LX.Music.MusicInfoOnline,
              listId: l.id,
              isRefresh: false,
            })
          } catch {
            // Ignore fetch errors, just skip the image
          }
        }
      }

      return {
        id: l.id,
        name: l.name,
        img,
      }
    }))

    updateMyLists(lists)
  } catch (err) {
    console.error('CarPlay: failed to load my lists', err)
  }
}

/**
 * Handle user selecting a list from 我的 tab - send songs
 */
const handleMyListSelected = async(listId: string) => {
  if (!isAvailable) return
  try {
    const allMusics = await getListMusics(listId)
    const total = allMusics.length
    const page = 1
    const slice = allMusics.slice(0, myListSongsPageSize)

    // Set title for the song template
    const listInfo = listState.allList.find(l => l.id === listId)
    if (listInfo) {
      updateSonglistTitle(listInfo.name)
    }

    const list: MyListSongItem[] = slice.map(m => ({
      id: m.id,
      name: m.name,
      singer: m.singer,
      album: m.meta.albumName,
    }))
    updateMyListSongs({ list, total, page })
  } catch (err) {
    console.error('CarPlay: failed to load my list songs', err)
  }
}

/**
 * Handle loading more songs from 我的 tab
 */
const handleLoadMoreMyListSongs = async(listId: string, page: number) => {
  if (!isAvailable) return
  try {
    const allMusics = await getListMusics(listId)
    const total = allMusics.length
    const start = (page - 1) * myListSongsPageSize
    const slice = allMusics.slice(start, start + myListSongsPageSize)

    const list: MyListSongItem[] = slice.map(m => ({
      id: m.id,
      name: m.name,
      singer: m.singer,
      album: m.meta.albumName,
    }))
    updateMyListSongs({ list, total, page })
  } catch (err) {
    console.error('CarPlay: failed to load more my list songs', err)
  }
}

/**
 * Handle opening the play detail page from CarPlay
 */
const handleOpenPlayDetail = () => {
  // The main app should be brought to foreground via the URL scheme
  // The deep link handler will navigate to the play detail page
  // This is handled by the native side opening lxmusic://play-detail
}

/**
 * Check whether the current playing song is in the love (收藏) list
 */
const getIsCollected = () => {
  const musicInfo = playerState.playMusicInfo.musicInfo
  if (!musicInfo) return false
  const id = 'progress' in musicInfo ? musicInfo.metadata.musicInfo.id : musicInfo.id
  return getListMusicSync(LIST_IDS.LOVE).some(m => m.id === id)
}

/**
 * Sync collect state + play mode to CarPlay Now Playing buttons
 */
const syncNowPlayingState = () => {
  if (!isAvailable) return
  updateNowPlayingState({
    collected: getIsCollected(),
    playMode: settingState.setting['player.togglePlayMethod'],
  })
}

/**
 * Handle collect button tap on CarPlay Now Playing page
 */
const handleToggleCollect = () => {
  if (!playerState.playMusicInfo.musicInfo) return
  if (getIsCollected()) {
    uncollectMusic()
  } else {
    collectMusic()
  }
  // State sync is triggered by the list_music_* events
}

/**
 * Handle play mode button tap on CarPlay Now Playing page - cycle to next mode
 */
const handleTogglePlayMode = () => {
  const current = settingState.setting['player.togglePlayMethod']
  let index = MUSIC_TOGGLE_MODE_LIST.indexOf(current as typeof MUSIC_TOGGLE_MODE_LIST[number])
  if (++index >= MUSIC_TOGGLE_MODE_LIST.length) index = 0
  updateSetting({ 'player.togglePlayMethod': MUSIC_TOGGLE_MODE_LIST[index] })
  // State sync is triggered by the configUpdated event
}

/**
 * Sync Now Playing buttons when the love list content changes
 */
const handleLoveListChanged = async(listId: string) => {
  if (!isAvailable || listId !== LIST_IDS.LOVE) return
  syncNowPlayingState()
}

/**
 * Sync Now Playing buttons when settings change (e.g. play mode changed on phone)
 */
const handleConfigUpdated: typeof global.state_event.configUpdated = (keys) => {
  if (!isAvailable) return
  if (keys.includes('player.togglePlayMethod')) syncNowPlayingState()
}

/**
 * Sync songlist data when category changes on the phone
 */
const handleSonglistCategoryChange = () => {
  if (!isAvailable) return
  // Re-fetch songlists with the new category settings
  void handleRequestSonglists(1)
}

/**
 * Update 我的 tab when user's list structure changes (create/remove/update lists)
 */
const handleListStructureChanged = async() => {
  if (!isAvailable) return
  void handleRequestMyLists()
}

/**
 * Initialize the CarPlay service
 */
export const init = () => {
  if (!isAvailable) return

  // Clean up previous subscriptions
  unsubscribes.forEach(unsub => unsub())
  unsubscribes = []

  // Listen for CarPlay events
  unsubscribes.push(
    onCarPlayEvent('carplay:request-songlists', (data: { page: number }) => {
      void handleRequestSonglists(data.page ?? 1)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:request-songs', (data: { id: string, source: string, page: number }) => {
      void handleRequestSongs(data.id, data.source, data.page ?? 1)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:load-more-songlists', (data: { page: number }) => {
      void handleRequestSonglists(data.page)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:load-more-songs', (data: { id: string, source: string, page: number }) => {
      void handleRequestSongs(data.id, data.source, data.page)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:song-selected', (data: { index: number, type?: string, id?: string, source?: string, listId?: string }) => {
      void handleSongSelected(data)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:open-play-detail', () => {
      handleOpenPlayDetail()
    }),
  )

  // 我的 tab events
  unsubscribes.push(
    onCarPlayEvent('carplay:request-my-lists', () => {
      void handleRequestMyLists()
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:my-list-selected', (data: { id: string }) => {
      void handleMyListSelected(data.id)
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:load-more-my-list-songs', (data: { id: string, page: number }) => {
      void handleLoadMoreMyListSongs(data.id, data.page)
    }),
  )

  // Now Playing button events
  unsubscribes.push(
    onCarPlayEvent('carplay:toggle-collect', () => {
      handleToggleCollect()
    }),
  )

  unsubscribes.push(
    onCarPlayEvent('carplay:toggle-play-mode', () => {
      handleTogglePlayMode()
    }),
  )

  // Initial sync when CarPlay connects
  unsubscribes.push(
    onCarPlayEvent('carplay:connected', () => {
      syncNowPlayingState()
    }),
  )

  // Sync: update Now Playing collect button when current song changes
  global.app_event.on('musicToggled', syncNowPlayingState)
  unsubscribes.push(() => {
    global.app_event.off('musicToggled', syncNowPlayingState)
  })

  // Sync: update Now Playing collect button when the love list changes
  global.list_event.on('list_music_add', handleLoveListChanged)
  global.list_event.on('list_music_remove', handleLoveListChanged)
  global.list_event.on('list_music_overwrite', handleLoveListChanged)
  unsubscribes.push(
    () => { global.list_event.off('list_music_add', handleLoveListChanged) },
    () => { global.list_event.off('list_music_remove', handleLoveListChanged) },
    () => { global.list_event.off('list_music_overwrite', handleLoveListChanged) },
  )

  // Sync: update Now Playing play mode button when setting changes on phone
  global.state_event.on('configUpdated', handleConfigUpdated)
  unsubscribes.push(() => {
    global.state_event.off('configUpdated', handleConfigUpdated)
  })

  // Sync: when songlist source/sort/tag changes on phone, update CarPlay 推荐 tab
  global.app_event.on('songlistInfoChange', handleSonglistCategoryChange)
  unsubscribes.push(() => {
    global.app_event.off('songlistInfoChange', handleSonglistCategoryChange)
  })

  // Sync: when user's list structure changes, update CarPlay 我的 tab
  global.list_event.on('list_create', handleListStructureChanged)
  global.list_event.on('list_remove', handleListStructureChanged)
  global.list_event.on('list_update', handleListStructureChanged)
  global.list_event.on('list_update_position', handleListStructureChanged)
  global.list_event.on('list_data_overwrite', handleListStructureChanged)
  unsubscribes.push(
    () => { global.list_event.off('list_create', handleListStructureChanged) },
    () => { global.list_event.off('list_remove', handleListStructureChanged) },
    () => { global.list_event.off('list_update', handleListStructureChanged) },
    () => { global.list_event.off('list_update_position', handleListStructureChanged) },
    () => { global.list_event.off('list_data_overwrite', handleListStructureChanged) },
  )

  console.log('CarPlay service initialized')
}

/**
 * Destroy the CarPlay service
 */
export const destroy = () => {
  unsubscribes.forEach(unsub => unsub())
  unsubscribes = []
}
