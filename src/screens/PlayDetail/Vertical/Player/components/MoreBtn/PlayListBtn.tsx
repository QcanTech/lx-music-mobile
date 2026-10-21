import { useEffect, useRef, useState } from 'react'
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
  const { playerListId } = usePlayInfo()
  const current = usePlayMusicInfo()
  const [list, setList] = useState<LX.Music.MusicInfo[]>([])
  const [listKey, setListKey] = useState(0)
  const theme = useTheme()
  const t = useI18n()
  const { height } = useWindowDimensions()

  useEffect(() => {
    const update = () => { setList([...getListMusicSync(playerListId)]) }
    update()
    global.app_event.on('myListMusicUpdate', update)
    return () => { global.app_event.off('myListMusicUpdate', update) }
  }, [playerListId])

  const show = () => {
    setList([...getListMusicSync(playerListId)])
    setListKey(key => key + 1)
    popupRef.current?.setVisible(true)
  }
  const select = (music: LX.Music.MusicInfo) => {
    if (!playerListId) return
    if (current.listId == playerListId && current.musicInfo?.id == music.id) play()
    else void playListById(playerListId, music.id)
    popupRef.current?.setVisible(false)
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
            key={listKey}
            data={list}
            initialScrollIndex={Math.max(0, list.findIndex(item => current.listId == playerListId && current.musicInfo?.id == item.id))}
            getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
            keyExtractor={item => item.id}
            extraData={current}
            ListEmptyComponent={<Text style={styles.empty} color={theme['c-font-label']}>{t('play_detail_playlist_empty')}</Text>}
            renderItem={({ item, index }) => {
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
            }}
          />
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
  empty: { padding: 24, textAlign: 'center' },
})
