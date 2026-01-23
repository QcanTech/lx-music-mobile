import { createList, setTempList } from '@/core/list'
import { playList } from '@/core/player/player'
import { getListDetail, getListDetailAll } from '@/core/songlist'
import { LIST_IDS } from '@/config/constant'
import listState from '@/store/list/state'
import syncSourceList from '@/core/syncSourceList'
import { confirmDialog, toMD5, toast } from '@/utils/tools'
import { type Source } from '@/store/songlist/state'

const getListId = (id: string, source: LX.OnlineSource | 'local') => {
  // For local playlists, just return the id without prefix
  if (source === 'local') return id
  return `${source}__${id}`
}

export const handlePlay = async(id: string, source: Source, list?: LX.Music.MusicInfoOnline[], index = 0) => {
  const listId = getListId(id, source as LX.OnlineSource | 'local')
  
  // For local source, use the id directly
  const actualListId = source === 'local' ? id : listId
  let isPlayingList = false
  // console.log(list)
  if (!list?.length) list = (await getListDetail(id, source as LX.OnlineSource | 'local', 1)).list
  if (list?.length) {
    await setTempList(actualListId, [...list])
    void playList(LIST_IDS.TEMP, index)
    isPlayingList = true
  }
  const fullList = await getListDetailAll(source as LX.OnlineSource | 'local', id)
  if (!fullList.length) return
  if (isPlayingList) {
    if (listState.tempListMeta.id == actualListId) {
      await setTempList(actualListId, [...fullList])
    }
  } else {
    await setTempList(actualListId, [...fullList])
    void playList(LIST_IDS.TEMP, index)
  }
}

export const handleCollect = async(id: string, source: Source, name: string) => {
  // Don't allow collecting local playlists
  if (source === 'local') {
    toast('Cannot collect local playlists')
    return
  }
  const listId = getListId(id, source as LX.OnlineSource)

  const targetList = listState.userList.find(l => l.sourceListId == listId)
  if (targetList) {
    const confirm = await confirmDialog({
      message: global.i18n.t('duplicate_list_tip', { name: targetList.name }),
      cancelButtonText: global.i18n.t('list_import_part_button_cancel'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    })
    if (!confirm) return
    void syncSourceList(targetList)
    return
  }

  const list = await getListDetailAll(source, id)
  await createList({
    name,
    id: `${source}_${toMD5(listId)}`,
    list,
    source: source as LX.OnlineSource,
    sourceListId: id,
  })
  toast(global.i18n.t('collect_success'))
}
