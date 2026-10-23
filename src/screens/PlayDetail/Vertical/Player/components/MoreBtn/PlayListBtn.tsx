import { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import Popup, { type PopupType } from '@/components/common/Popup'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { play, playListById } from '@/core/player/player'
import { usePlayInfo, usePlayMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import { getListMusicSync } from '@/utils/listManage'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { BTN_WIDTH } from './Btn'

const ITEM_HEIGHT = 64

export default () => {
  const popupRef = useRef<PopupType>(null)
  const listRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const [positioned, setPositioned] = useState(false)
  const [opening, setOpening] = useState({ id: 0, offset: 0 })
  const { playerListId } = usePlayInfo()
  const current = usePlayMusicInfo()
  const [list, setList] = useState<LX.Music.MusicInfo[]>([])
  const theme = useTheme()
  const t = useI18n()
  const { height } = useWindowDimensions()

  const currentIndex = useMemo(() => Math.max(0, list.findIndex(item =>
    current.listId == playerListId && current.musicInfo?.id == item.id,
  )), [list, playerListId, current.listId, current.musicInfo?.id])

  useEffect(() => {
    const update = (ids: string[]) => {
      if (playerListId && ids.includes(playerListId)) setList([...getListMusicSync(playerListId)])
    }
    setList([...getListMusicSync(playerListId)])
    global.app_event.on('myListMusicUpdate', update)
    return () => { global.app_event.off('myListMusicUpdate', update) }
  }, [playerListId])

  const show = () => {
    setPositioned(false)
    // Freeze the initial position for this opening. Playback updates must not
    // change contentOffset while the user is browsing the list.
    setOpening(previous => ({
      id: previous.id + 1,
      offset: Math.min(currentIndex * ITEM_HEIGHT, Math.max(0, list.length * ITEM_HEIGHT - height * 0.5)),
    }))
    popupRef.current?.setVisible(true)
  }
  const select = (music: LX.Music.MusicInfo) => {
    if (!playerListId) return
    if (current.listId == playerListId && current.musicInfo?.id == music.id) play()
    else void playListById(playerListId, music.id)
    popupRef.current?.setVisible(false)
  }

  const renderMusic = (item: LX.Music.MusicInfo, index: number) => {
    const active = current.listId == playerListId && current.musicInfo?.id == item.id
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => { select(item) }}
        style={{ ...styles.item, backgroundColor: active ? theme['c-primary-background-hover'] : 'transparent' }}
      >
        <View style={styles.index}>
          {active ? <Icon name="play" size={16} /> : <Text size={13} color={theme['c-font-label']}>{index + 1}</Text>}
        </View>
        <View style={styles.info}>
          <Text numberOfLines={1}>{item.name}</Text>
          <Text numberOfLines={1} size={12} color={theme['c-font-label']}>{item.singer}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  const initialOffset = useMemo(() => ({ x: 0, y: opening.offset }), [opening.offset])
  const firstVisibleIndex = Math.floor(opening.offset / ITEM_HEIGHT)
  const previewCount = Math.ceil(height * 0.5 / ITEM_HEIGHT) + 1
  const positionList = () => {
    if (positioned) return
    if (!opening.offset) setPositioned(true)
    else listRef.current?.scrollToOffset({ offset: opening.offset, animated: false })
  }

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={t('play_detail_playlist_title')}
        activeOpacity={0.5}
        onPress={show}
        style={styles.playlistButton}
      >
        <View style={styles.playlistIcon}>
          <View style={styles.playlistLines}>
            {[0, 1, 2].map(line => <View key={line} style={{ ...styles.playlistLine, backgroundColor: theme['c-font-label'] }} />)}
          </View>
        </View>
      </TouchableOpacity>
      <Popup ref={popupRef} title={`${t('play_detail_playlist_title')} (${list.length})`}>
        <View style={{ height: height * 0.5 }}>
          <FlatList
            key={opening.id}
            ref={listRef}
            data={list}
            style={styles.list}
            initialScrollIndex={firstVisibleIndex}
            contentOffset={initialOffset}
            bounces={false}
            onContentSizeChange={positionList}
            onScrollBeginDrag={() => { setPositioned(true) }}
            scrollEventThrottle={16}
            onScroll={({ nativeEvent }) => {
              if (positioned) return
              const { contentOffset, contentSize, layoutMeasurement } = nativeEvent
              if (layoutMeasurement.height <= 0 || contentSize.height < list.length * ITEM_HEIGHT - 1) return
              const target = Math.min(opening.offset, Math.max(0, contentSize.height - layoutMeasurement.height))
              if (Math.abs(contentOffset.y - target) < 1) setPositioned(true)
            }}
            contentInsetAdjustmentBehavior="never"
            automaticallyAdjustContentInsets={false}
            initialNumToRender={Math.ceil(height * 0.5 / ITEM_HEIGHT) + 2}
            maxToRenderPerBatch={8}
            windowSize={5}
            getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
            keyExtractor={item => item.id}
            extraData={current}
            ListEmptyComponent={<Text style={styles.empty} color={theme['c-font-label']}>{t('play_detail_playlist_empty')}</Text>}
            renderItem={({ item, index }) => renderMusic(item, index)}
          />
          {/* Keep real song rows visible while native mounting adjusts the offset.
              This layer never blocks taps/scrolls and cannot leave an empty list
              when the platform omits an initial scroll event. */}
          {!positioned && list.length > 0 && (
            <View pointerEvents="none" accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants" style={{ ...styles.initialViewport, backgroundColor: theme['c-content-background'] }}>
              <View style={{ transform: [{ translateY: -(opening.offset % ITEM_HEIGHT) }] }}>
                {list.slice(firstVisibleIndex, firstVisibleIndex + previewCount).map((item, index) => (
                  <View key={item.id}>{renderMusic(item, firstVisibleIndex + index)}</View>
                ))}
              </View>
            </View>
          )}
        </View>
      </Popup>
    </>
  )
}

const styles = createStyle({
  playlistButton: { width: BTN_WIDTH, height: BTN_WIDTH, marginLeft: 5, alignItems: 'center', justifyContent: 'center' },
  playlistIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  playlistLines: { width: 22, gap: 5 },
  playlistLine: { height: 2, borderRadius: 1 },
  item: { flexDirection: 'row', alignItems: 'center', height: ITEM_HEIGHT, paddingRight: 16 },
  index: { width: 48, alignItems: 'center' },
  info: { flex: 1, paddingVertical: 10, gap: 4 },
  list: { flex: 1 },
  initialViewport: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  empty: { padding: 24, textAlign: 'center' },
})
