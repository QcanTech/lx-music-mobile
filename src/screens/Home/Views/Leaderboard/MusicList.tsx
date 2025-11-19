import { forwardRef, useEffect, useImperativeHandle, useRef, memo } from 'react'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { clearListDetail, getListDetail, setListDetail, setListDetailInfo } from '@/core/leaderboard'
import boardState from '@/store/leaderboard/state'
import { handlePlay } from './listAction'

// export type MusicListProps = Pick<OnlineListProps,
// 'onLoadMore'
// | 'onPlayList'
// | 'onRefresh'
// >

export interface MusicListType {
  loadList: (source: LX.OnlineSource, listId: string) => void
}

const MusicList = forwardRef<MusicListType, {}>((props, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const isUnmountedRef = useRef(false)
  useImperativeHandle(ref, () => ({
    async loadList(source, id) {
      // Add null check and logging for debugging
      console.log('loadList called, listRef.current:', listRef.current)
      if (!listRef.current) {
        console.warn('listRef.current is null in loadList')
        return
      }
      
      const listDetailInfo = boardState.listDetailInfo
      listRef.current.setList([])
      console.log('loadList', listDetailInfo.id == id, listDetailInfo.source == source, listDetailInfo.list.length)
      if (listDetailInfo.id == id && listDetailInfo.source == source && listDetailInfo.list.length) {
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.setList(listDetailInfo.list)
          } else {
            console.warn('listRef.current is null when setting list from cache')
          }
        })
      } else {
        listRef.current.setStatus('loading')
        const page = 1
        setListDetailInfo(id)
        return getListDetail(id, page).then((listDetail) => {
          // console.log('getListDetail', listDetail)
          const result = setListDetail(listDetail, id, page)
          // console.log('getListDetail result', result)

          // if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            // console.log('loadList result', result, listRef.current)
            if (listRef.current) {
              listRef.current.setList(result.list)
              listRef.current.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
            } else {
              console.warn('listRef.current is null when setting list from API')
            }
          })
        }).catch((err) => {
          console.log('getListDetail err', err)
          if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
          if (listRef.current) {
            listRef.current.setStatus('error')
          } else {
            console.warn('listRef.current is null when setting error status')
          }
        })
      }
    },
  }), [])

  useEffect(() => {
    isUnmountedRef.current = false
    // Log when component is mounted
    console.log('MusicList component mounted, listRef.current:', listRef.current)
    
    return () => {
      isUnmountedRef.current = true
      console.log('MusicList component unmounted')
    }
  }, [])


  const handlePlayList: OnlineListProps['onPlayList'] = (index) => {
    // Add null check
    if (!listRef.current) {
      console.warn('listRef.current is null in handlePlayList')
      return
    }
    
    const listDetailInfo = boardState.listDetailInfo
    // console.log(boardState.listDetailInfo)
    void handlePlay(listDetailInfo.id, listDetailInfo.list, index)
  }
  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    // Add null check
    if (!listRef.current) {
      console.warn('listRef.current is null in handleRefresh')
      return
    }
    
    const page = 1
    listRef.current.setStatus('refreshing')
    getListDetail(boardState.listDetailInfo.id, page, true).then((listDetail) => {
      const result = setListDetail(listDetail, boardState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      if (listRef.current) {
        listRef.current.setList(result.list)
        listRef.current.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
      } else {
        console.warn('listRef.current is null when setting refreshed list')
      }
    }).catch(() => {
      if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
      if (listRef.current) {
        listRef.current.setStatus('error')
      } else {
        console.warn('listRef.current is null when setting error status in refresh')
      }
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    // Add null check
    if (!listRef.current) {
      console.warn('listRef.current is null in handleLoadMore')
      return
    }
    
    listRef.current.setStatus('loading')
    const page = boardState.listDetailInfo.list.length ? boardState.listDetailInfo.page + 1 : 1
    getListDetail(boardState.listDetailInfo.id, page).then((listDetail) => {
      const result = setListDetail(listDetail, boardState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      if (listRef.current) {
        listRef.current.setList(result.list, true)
        listRef.current.setStatus(boardState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
      } else {
        console.warn('listRef.current is null when setting load more list')
      }
    }).catch(() => {
      if (boardState.listDetailInfo.list.length && page == 1) clearListDetail()
      if (listRef.current) {
        listRef.current.setStatus('error')
      } else {
        console.warn('listRef.current is null when setting error status in load more')
      }
    })
  }

  return <OnlineList
    ref={listRef}
    onPlayList={handlePlayList}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    checkHomePagerIdle
    rowType='medium'
   />
})

// Wrap the component with React.memo to prevent unnecessary re-renders
export default memo(MusicList)