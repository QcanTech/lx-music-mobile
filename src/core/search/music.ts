import searchMusicState, { type Source } from '@/store/search/music/state'
import searchMusicActions, { type SearchResult } from '@/store/search/music/action'
import musicSdk from '@/utils/musicSdk'
import { searchMusic as searchLocalMusic } from './local'
import { type LocalMusicSearchResult } from './local'

export const setSource: typeof searchMusicActions['setSource'] = (source) => {
  searchMusicActions.setSource(source)
}
export const setSearchText: typeof searchMusicActions['setSearchText'] = (text) => {
  searchMusicActions.setSearchText(text)
}
export const setListInfo: typeof searchMusicActions.setListInfo = (result, id, page) => {
  return searchMusicActions.setListInfo(result, id, page)
}

export const clearListInfo: typeof searchMusicActions.clearListInfo = (source) => {
  searchMusicActions.clearListInfo(source)
}


export const search = async(text: string, page: number, sourceId: Source): Promise<LX.Music.MusicInfoOnline[]> => {
  const listInfo = searchMusicState.listInfos[sourceId]!
  if (!text) return []
  const key = `${page}__${text}`
  
  // Handle local search
  if (sourceId === 'local') {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list as LX.Music.MusicInfoOnline[]
    listInfo.key = key
    
    try {
      const result = await searchLocalMusic(text, page, listInfo.limit)
      if (key != listInfo.key) return []
      
      // Convert local music to online music format (they share the same base interface)
      const onlineList = result.list as unknown as LX.Music.MusicInfoOnline[]
      
      // Create a compatible result object
      const compatibleResult: SearchResult = {
        allPage: 1,
        limit: result.limit,
        list: onlineList,
        source: result.source as LX.OnlineSource, // This will be 'local'
        total: result.total,
      }
      
      return setListInfo(compatibleResult, page, text)
    } catch (err: any) {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    }
  }
  
  if (sourceId == 'all') {
    listInfo.key = key
    let task: Array<Promise<SearchResult>> = []
    for (const source of searchMusicState.sources) {
      if (source == 'all' || source === 'local') continue
      task.push(((musicSdk[source]?.musicSearch.search(text, page, searchMusicState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          allPage: 1,
          limit: 30,
          list: [],
          source: source as LX.OnlineSource,
          total: 0,
        }
      }))
    }
    
    // Add local search to 'all' search
    task.push(searchLocalMusic(text, page, searchMusicState.listInfos.all.limit).then(localResult => {
      const onlineList = localResult.list as unknown as LX.Music.MusicInfoOnline[]
      return {
        allPage: 1,
        limit: localResult.limit,
        list: onlineList,
        source: localResult.source as LX.OnlineSource,
        total: localResult.total,
      }
    }).catch((error: any) => {
      console.log(error)
      return {
        allPage: 1,
        limit: 30,
        list: [],
        source: 'local' as unknown as LX.OnlineSource,
        total: 0,
      }
    }))
    
    return Promise.all(task).then((results: SearchResult[]) => {
      if (key != listInfo.key) return []
      setSearchText(text)
      setSource(sourceId)
      return setListInfo(results, page, text)
    })
  } else {
    if (listInfo?.key == key && listInfo?.list.length) return listInfo?.list
    listInfo.key = key
    return (musicSdk[sourceId]?.musicSearch.search(text, page, listInfo.limit).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}