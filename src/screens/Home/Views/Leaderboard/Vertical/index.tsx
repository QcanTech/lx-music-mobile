import { useEffect, useRef, useLayoutEffect, memo } from 'react'
import { View } from 'react-native'
import { createStyle } from '@/utils/tools'

import MusicList, { type MusicListType } from '../MusicList'
import { getLeaderboardSetting, saveLeaderboardSetting } from '@/utils/data'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import HeaderBar, { type HeaderBarType, type HeaderBarProps } from './HeaderBar'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
// import { BorderWidths } from '@/theme'
// import { useTheme } from '@/store/theme/hook'
import BoardsList, { type BoardsListType, type BoardsListProps } from '../BoardsList'
import type { InitState as CommonState } from '@/store/common/state'
import settingState from '@/store/setting/state'
import { getBoardsList } from '@/core/leaderboard'
import { COMPONENT_IDS } from '@/config/constant'
import { handleCollect, handlePlay } from '../listAction'
import boardState from '@/store/leaderboard/state'


const MAX_WIDTH = scaleSizeW(200)

const LeaderboardView = () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const theme = useTheme()
  const musicListRef = useRef<MusicListType>(null)
  const isUnmountedRef = useRef(false)
  const boardsListRef = useRef<BoardsListType>(null)
  const headerBarRef = useRef<HeaderBarType>(null)
  const boundInfo = useRef<{ source: LX.OnlineSource, id: string | null }>({ source: 'kw', id: null })
  // const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    console.log('Components mounted, refs initialized:', {
      boardsListRef: boardsListRef.current,
      headerBarRef: headerBarRef.current
    })
  }, [])

  const handleBoundChange = (source: LX.OnlineSource, id: string) => {
    console.log('handleBoundChange called', id)
    if (musicListRef.current) {
      musicListRef.current.loadList(source, id)
    } else {
      console.warn('musicListRef.current is null in handleBoundChange')
    }
    void saveLeaderboardSetting({
      source,
      boardId: id,
    })
  }
  const onBoundChange: BoardsListProps['onBoundChange'] = (id) => {
    console.log('onBoundChange called, id:', id)
    boundInfo.current.id = id
    void getBoardsList(boundInfo.current.source).then(list => {
      requestAnimationFrame(() => {
        const bound = list.find(l => l.id == id)
        if (headerBarRef.current) {
          headerBarRef.current.setBound(boundInfo.current.source, id, bound?.name ?? 'Unknown')
        } else {
          console.warn('headerBarRef.current is null in onBoundChange')
        }
      })
    })
    handleBoundChange(boundInfo.current.source, id)
    requestAnimationFrame(() => {
      // console.warn('onShowBound')
      if (drawer.current) {
        drawer.current.openDrawer()
      } else {
        console.warn('Drawer ref not initialized')
      }
    })
  }
  const onPlay: BoardsListProps['onPlay'] = (id) => {
    boundInfo.current.id = id
    void handlePlay(id, boardState.listDetailInfo.list)
  }
  const onCollect: BoardsListProps['onCollect'] = (id, name) => {
    boundInfo.current.id = id
    void handleCollect(id, name, boundInfo.current.source)
  }
  const onShowBound = () => {
    // Always ensure the list is populated before opening the drawer
    void getBoardsList(boundInfo.current.source).then(list => {
      const id = boundInfo.current.id
      const name = list.find(l => l.id == id)?.name
      requestAnimationFrame(() => {
        if (boardsListRef.current && headerBarRef.current) {
          boardsListRef.current.setList(list, id || '')
          headerBarRef.current.setBound(boundInfo.current.source, id || '', name || 'Unknown')
          requestAnimationFrame(() => {
            if (drawer.current) {
              drawer.current.openDrawer()
            } else {
              console.warn('Drawer ref not initialized when trying to show bound')
            }
          })
        } else {
          console.warn('Refs not initialized when trying to show bound')
        }
      })
    })
  }
  const onSourceChange: HeaderBarProps['onSourceChange'] = (source) => {
    boundInfo.current.source = source
    void getBoardsList(source).then(list => {
      const id = list[0].id
      const name = list[0].name
      requestAnimationFrame(() => {
        if (boardsListRef.current && headerBarRef.current) {
          boardsListRef.current.setList(list, id)
          headerBarRef.current.setBound(source, id, name ?? 'Unknown')
          requestAnimationFrame(() => {
            handleBoundChange(source, id)
          })
        } else {
          console.warn('Refs not initialized when changing source')
        }
      })
    })
  }

  const navigationView = () => {
    const content = (
      <BoardsList
        ref={boardsListRef}
        onBoundChange={onBoundChange}
        onCollect={onCollect}
        onPlay={onPlay}
      />
    )
    return content
  }

  // const theme = useTheme()


  useEffect(() => {
    const handleFixDrawer = (id: CommonState['navActiveId']) => {
      if (id == 'nav_top') {
        if (drawer.current) {
          drawer.current.fixWidth()
        } else {
          console.warn('Drawer ref not initialized in handleFixDrawer')
        }
      }
    }
    global.state_event.on('navActiveIdUpdated', handleFixDrawer)


    isUnmountedRef.current = false
    void getLeaderboardSetting().then(({ source, boardId }) => {  
      // source = 'kw'  
      //   void saveLeaderboardSetting({
      //   source,
      //   boardId: "kw__16",
      // })
      console.log('getLeaderboardSetting', source, boardId)
      boundInfo.current.source = source
      boundInfo.current.id = boardId
      
      // Add a small delay to ensure components are mounted
      setTimeout(() => {
        void getBoardsList(source).then(list => {
          const bound = list.find(l => l.id == boardId)
          // console.log('getBoardsList', source, bound?.name, list)
          
          if (boardsListRef.current && headerBarRef.current) {
            boardsListRef.current.setList(list, boardId)
            headerBarRef.current.setBound(source, boardId, bound?.name ?? 'Unknown')
          } else {
            console.warn('Refs not initialized in useEffect, retrying...')
            // Retry after a short delay
            setTimeout(() => {
              if (boardsListRef.current && headerBarRef.current) {
                boardsListRef.current.setList(list, boardId)
                headerBarRef.current.setBound(source, boardId, bound?.name ?? 'Unknown')
              } else {
                console.error('Refs still not initialized after retry')
              }
            }, 100)
          }
        })
        console.log('loadList', source, boardId)
        if (musicListRef.current) {
          musicListRef.current.loadList(source, boardId)
        } else {
          console.warn('musicListRef.current is null in useEffect')
        }
      }, 100)
    })

    return () => {
      global.state_event.off('navActiveIdUpdated', handleFixDrawer)
      isUnmountedRef.current = true
    }
  }, [])


  return (
    <DrawerLayoutFixed
      ref={drawer}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      widthPercentage={0.82}
      widthPercentageMax={MAX_WIDTH}
      drawerPosition={settingState.setting['common.drawerLayoutPosition']}
      renderNavigationView={navigationView}
      drawerStyle={{ backgroundColor: theme['c-content-background'] }}
      // style={{ elevation: 1 }}
    >
      <View style={styles.container}>
        <HeaderBar ref={headerBarRef} onShowBound={onShowBound} onSourceChange={onSourceChange} />
        <MusicList ref={musicListRef} />
      </View>
    </DrawerLayoutFixed>
    // <View style={styles.container}>
    //   <LeftBar
    //     ref={leftBarRef}
    //     onChangeList={handleChangeBound}
    //   />
    //   <MusicList
    //     ref={musicListRef}
    //   />
    // </View>
  )
}

const styles = createStyle({
  container: {
    width: '100%',
    flex: 1,
    flexDirection: 'column',
    // borderTopWidth: BorderWidths.normal,
  },
  // content: {
  //   flex: 1,
  // },
})

export default memo(LeaderboardView)