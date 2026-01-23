import searchSonglistState, { type Source, type ListInfoItem } from '@/store/search/songlist/state'
import searchSonglistActions, { type SearchResult } from '@/store/search/songlist/action'
import musicSdk from '@/utils/musicSdk'
import { searchSonglists as searchLocalSonglists } from './local'
import { type LocalSonglistSearchResult } from './local'

export const setSource: typeof searchSonglistActions['setSource'] = (source) => {
  searchSonglistActions.setSource(source)
}
export const setSearchText: typeof searchSonglistActions['setSearchText'] = (text) => {
  searchSonglistActions.setSearchText(text)
}
const setListInfo: typeof searchSonglistActions.setListInfo = (result, page, text) => {
  return searchSonglistActions.setListInfo(result, page, text)
}

export const clearListInfo: typeof searchSonglistActions.clearListInfo = (source) => {
  searchSonglistActions.clearListInfo(source)
}


export const search = async(text: string, page: number, sourceId: Source): Promise<ListInfoItem[]> => {
  const listInfo = searchSonglistState.listInfos[sourceId]!
  // if (!text) return []
  const key = `${page}__${sourceId}__${text}`
  
  // Handle local search
  if (sourceId === 'local') {
    if (listInfo.key == key && listInfo.list.length) return listInfo.list
    listInfo.key = key
    
    try {
      const result = await searchLocalSonglists(text, page, listInfo.limit)
      if (key != listInfo.key) return []
      
      // Convert local results to the expected format
      const convertedList = result.list.map(item => ({
        play_count: '',
        id: item.id,
        author: item.author,
        name: item.name,
        img: '',
        total: 0,
        source: 'local' as const,
        info: '',
      }))
      
      const compatibleResult: SearchResult = {
        list: convertedList,
        limit: result.limit,
        total: result.total,
        source: result.source as LX.OnlineSource,
      }
      
      return setListInfo(compatibleResult, page, text)
    } catch (err: any) {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    }
  }
  
  if (listInfo.key == key && listInfo.list.length) return listInfo.list
  if (sourceId == 'all') {
    listInfo.key = key
    let task: Array<Promise<SearchResult>> = []
    for (const source of searchSonglistState.sources) {
      if (source == 'all' || source === 'local' || (page > 1 && page > (searchSonglistState.maxPages[source]!))) continue
      task.push(((musicSdk[source]?.songList.search(text, page, searchSonglistState.listInfos.all.limit) as Promise<SearchResult>) ?? Promise.reject(new Error('source not found: ' + source))).catch((error: any) => {
        console.log(error)
        return {
          list: [],
          total: 0,
          limit: searchSonglistState.listInfos.all.limit,
          source: source as LX.OnlineSource,
        }
      }))
    }
    
    // Add local search to 'all' search
    task.push(searchLocalSonglists(text, page, searchSonglistState.listInfos.all.limit).then(localResult => {
      const convertedList = localResult.list.map(item => ({
        play_count: '',
        id: item.id,
        author: item.author,
        name: item.name,
        img: '',
        total: 0,
        source: 'local' as const,
        info: '',
      }))
      
      return {
        list: convertedList,
        limit: localResult.limit,
        total: localResult.total,
        source: localResult.source as LX.OnlineSource,
      }
    }).catch((error: any) => {
      console.log(error)
      return {
        list: [],
        total: 0,
        limit: searchSonglistState.listInfos.all.limit,
        source: 'local' as unknown as LX.OnlineSource,
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
    return ((musicSdk[sourceId]?.songList.search(text, page, listInfo.limit) as Promise<SearchResult>).then((data: SearchResult) => {
      if (key != listInfo.key) return []
      return setListInfo(data, page, text)
    }) ?? Promise.reject(new Error('source not found: ' + sourceId))).catch((err: any) => {
      if (listInfo.list.length && page == 1) clearListInfo(sourceId)
      throw err
    })
  }
}