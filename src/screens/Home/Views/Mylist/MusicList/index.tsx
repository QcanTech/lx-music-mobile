import { useCallback, useRef, useState, useEffect, useMemo } from 'react'

import listState from '@/store/list/state'
import { useActiveListId } from '@/store/list/hook'
import ListMenu, { type ListMenuType, type Position, type SelectInfo } from './ListMenu'
import { handleDislikeMusic, handlePlay, handlePlayLater, handleRemove, handleShare, handleShowMusicSourceDetail, handleUpdateMusicInfo, handleUpdateMusicPosition } from './listAction'
import List, { type ListType } from './List'
import ListMusicAdd, { type MusicAddModalType as ListMusicAddType } from '@/components/MusicAddModal'
import ListMusicMultiAdd, { type MusicMultiAddModalType as ListAddMultiType } from '@/components/MusicMultiAddModal'
import { createStyle } from '@/utils/tools'
import { type LayoutChangeEvent, View } from 'react-native'
import ActiveList, { type ActiveListType } from './ActiveList'
import MultipleModeBar, { type SelectMode, type MultipleModeBarType } from './MultipleModeBar'
import ListSearchBar, { type ListSearchBarType } from './ListSearchBar'
import ListMusicSearch, { type ListMusicSearchType } from './ListMusicSearch'
import MusicPositionModal, { type MusicPositionModalType } from './MusicPositionModal'
import MetadataEditModal, { type MetadataEditType, type MetadataEditProps } from '@/components/MetadataEditModal'
import MusicToggleModal, { type MusicToggleModalType } from './MusicToggleModal'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { confirmDialog, toast } from '@/utils/tools'
import { setActiveList, addListMusics } from '@/core/list'
import { useSettingValue } from '@/store/setting/hook'
import settingState from '@/store/setting/state'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { TouchableOpacity } from 'react-native'
import { downloadFile, temporaryDirectoryPath, writeFile, stat } from '@/utils/fs'
import Loading from '@/components/common/Loading'
import { saveMusicUrl } from '@/utils/data'


export default () => {
  const t = useI18n()
  const theme = useTheme()
  const currentListId = useActiveListId()
  const activeListRef = useRef<ActiveListType>(null)
  const listMusicSearchRef = useRef<ListMusicSearchType>(null)
  const listRef = useRef<ListType>(null)
  const multipleModeBarRef = useRef<MultipleModeBarType>(null)
  const listSearchBarRef = useRef<ListSearchBarType>(null)
  const listMusicAddRef = useRef<ListMusicAddType>(null)
  const listMusicMultiAddRef = useRef<ListAddMultiType>(null)
  const musicPositionModalRef = useRef<MusicPositionModalType>(null)
  const metadataEditTypeRef = useRef<MetadataEditType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const musicToggleModalRef = useRef<MusicToggleModalType>(null)
  const layoutHeightRef = useRef<number>(0)
  const isShowMultipleModeBar = useRef(false)
  const isShowSearchBarModeBar = useRef(false)
  const selectedInfoRef = useRef<SelectInfo>()
  // console.log('render index list')

  const hancelMultiSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    } else activeListRef.current?.setVisibleBar(false)
    isShowMultipleModeBar.current = true
    multipleModeBarRef.current?.show()
    listRef.current?.setIsMultiSelectMode(true)
  }, [])
  const hancelExitSelect = useCallback(() => {
    if (isShowSearchBarModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    } else activeListRef.current?.setVisibleBar(true)
    // console.log('hancelExitSelect', isShowSearchBarModeBar.current)
    multipleModeBarRef.current?.exitSelectMode()
    listRef.current?.setIsMultiSelectMode(false)
    isShowMultipleModeBar.current = false
  }, [])
  const hancelSwitchSelectMode = useCallback((mode: SelectMode) => {
    multipleModeBarRef.current?.setSwitchMode(mode)
    listRef.current?.setSelectMode(mode)
  }, [])
  const hancelScrollToTop = useCallback(() => {
    listRef.current?.scrollToTop()
  }, [])

  const showMenu = useCallback((musicInfo: LX.Music.MusicInfo, index: number, position: Position) => {
    listMenuRef.current?.show({
      musicInfo,
      index,
      listId: listState.activeListId,
      single: false,
      selectedList: listRef.current!.getSelectedList(),
    }, position)
  }, [])
  const handleShowSearch = useCallback(() => {
    isShowSearchBarModeBar.current = true
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(false)
    } else activeListRef.current?.setVisibleBar(false)
    listSearchBarRef.current?.show()
  }, [])
  const handleExitSearch = useCallback(() => {
    isShowSearchBarModeBar.current = false
    listMusicSearchRef.current?.hide()
    listSearchBarRef.current?.hide()
    // console.log('handleExitSearch', isShowMultipleModeBar.current)
    if (isShowMultipleModeBar.current) {
      multipleModeBarRef.current?.setVisibleBar(true)
    } else activeListRef.current?.setVisibleBar(true)
  }, [])
  const handleScrollToInfo = useCallback((info: LX.Music.MusicInfo) => {
    listRef.current?.scrollToInfo(info)
    handleExitSearch()
  }, [handleExitSearch])
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    layoutHeightRef.current = e.nativeEvent.layout.height
  }, [])

  const handleAddMusic = useCallback((info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: info.listId, isMove: false })
    } else {
      listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: info.listId, isMove: false })
    }
  }, [])
  const handleMoveMusic = useCallback((info: SelectInfo) => {
    if (info.selectedList.length) {
      listMusicMultiAddRef.current?.show({ selectedList: info.selectedList, listId: info.listId, isMove: true })
    } else {
      listMusicAddRef.current?.show({ musicInfo: info.musicInfo, listId: info.listId, isMove: true })
    }
  }, [])
  const handleEditMetadata = useCallback((info: SelectInfo) => {
    if (info.musicInfo.source != 'local') return
    console.log("handleEditMetadata", info)
    selectedInfoRef.current = info
    metadataEditTypeRef.current?.show(info.musicInfo.meta.filePath, info.musicInfo)
  }, [])
  const handleUpdateMetadata = useCallback<MetadataEditProps['onUpdate']>((info) => {
    if (!selectedInfoRef.current || selectedInfoRef.current.musicInfo.source != 'local') return
    handleUpdateMusicInfo(selectedInfoRef.current.listId, selectedInfoRef.current.musicInfo, info)
  }, [])

  // State for import song functionality
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [singerInput, setSingerInput] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const downloadJobIdRef = useRef<number | null>(null)

   // Handle import button press
  const handleImportPress = () => {
    // Show import song dialog
    setUrlInput('');
    setNameInput('');
    setSingerInput('');
    setShowImportDialog(true);
  }

  // Handle adding the song
  const handleAddSong = async () => {
    if (!urlInput.trim()) {
      toast(t('input_error'))
      return
    }
    
    // Validate URL
    try {
      new URL(urlInput.trim());
    } catch (e) {
      toast('Invalid URL format')
      return
    }
    
    setIsDownloading(true)
    setDownloadProgress(0)
    
    try {
      // Generate filename
      const fileName = `song_${Date.now()}.mp3`
      const filePath = `${temporaryDirectoryPath}/${fileName}`
      console.log('Starting download to:', filePath)
      
      // Download the file
      const download = downloadFile(urlInput, filePath, {
        progressInterval: 500, // Update progress every 500ms
        progressDivider: 10, // Update progress every 10% or so
        progress: (res) => {
          const progress = res.bytesWritten / res.contentLength
          console.log('download progress...', progress, res.bytesWritten, '/', res.contentLength)
          setDownloadProgress(progress)
        }
      })
      
      downloadJobIdRef.current = download.jobId
      console.log('Download job started with ID:', download.jobId)
      
      // Wait for download to complete
      console.log('Waiting for download to complete...')
      await download.promise
      console.log('Download completed successfully')
      
      // Verify file exists and get size
      const fileInfo = await stat(filePath)
      console.log('download complete', fileInfo)
      
      // Create a local music info object
      const musicInfo: LX.Music.MusicInfoLocal = {
        id: `local_${Date.now()}`, // Generate a unique ID
        name: nameInput.trim() || 'Unknown', // Use default if empty
        singer: singerInput.trim() || '', // Use default if empty
        source: "local",
        interval: null,
        meta: {
          songId: `local_${Date.now()}`,
          albumName: '',
          filePath: filePath, // Use the downloaded file path
          ext: 'mp3',
          picUrl: null,
        },
      }

      saveMusicUrl(musicInfo, '320k', urlInput)
      
      // Add the music to the current list
      await addListMusics(currentListId, [musicInfo], settingState.setting['list.addMusicLocationType'])
      
      toast(`Successfully added song: ${musicInfo.name}`)
      setShowImportDialog(false)
    } catch (error) {
      console.error('Failed to download/add song:', error)
      toast('Failed to download song')
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
      downloadJobIdRef.current = null
    }
  }
  
  // Handle cancel import
  const handleCancelImport = () => {
    setShowImportDialog(false)
  }

  const styles = useMemo(() => createStyle({
    container: {
      flex: 1,
      flexDirection: 'column',
    },
    dialogOverlay: {
      position: 'absolute',
      top: 50,
      left: 50,
      right: 50,
      bottom: 50,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      elevation: 9999,
    },
    dialogContainer: {
      backgroundColor: 'white',
      padding: 20,
      borderRadius: 8,
      width: '80%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme['c-font'],
    },
    dialogTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 15,
      textAlign: 'center',
      color: theme['c-font'],
    },
    dialogInput: {
      marginBottom: 10,
      backgroundColor: theme['c-primary-input-background'],
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    dialogButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 15,
    },
    dialogButton: {
      marginLeft: 10,
      padding: 8,
    },
    downloadProgressContainer: {
      alignItems: 'center',
      padding: 20,
    },
    downloadProgressText: {
      marginTop: 10,
      marginBottom: 15,
      fontSize: 16,
      color: theme['c-font'],
    },
    progressBarBackground: {
      height: 6,
      width: '100%',
      backgroundColor: theme['c-primary-alpha-300'],
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme['c-primary'],
      borderRadius: 3,
    },
  }), [theme])

  return (
    <View style={styles.container}>
      <View style={{ zIndex: 2 }}>
        <ActiveList ref={activeListRef} onShowSearchBar={handleShowSearch} onShowImportPress={handleImportPress} onScrollToTop={hancelScrollToTop} />
        <MultipleModeBar
          ref={multipleModeBarRef}
          onSwitchMode={hancelSwitchSelectMode}
          onSelectAll={isAll => listRef.current?.selectAll(isAll)}
          onExitSelectMode={hancelExitSelect}
        />
        <ListSearchBar
          ref={listSearchBarRef}
          onSearch={keyword => listMusicSearchRef.current?.search(keyword, layoutHeightRef.current)}
          onExitSearch={handleExitSearch}
        />
      </View>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        <List
          ref={listRef}
          onShowMenu={showMenu}
          onMuiltSelectMode={hancelMultiSelect}
          onSelectAll={isAll => multipleModeBarRef.current?.setIsSelectAll(isAll)}
        />
        <ListMusicSearch
          ref={listMusicSearchRef}
          onScrollToInfo={handleScrollToInfo}
        />
      </View>
      <ListMusicAdd ref={listMusicAddRef} onAdded={hancelExitSelect} />
      <ListMusicMultiAdd ref={listMusicMultiAddRef} onAdded={hancelExitSelect} />
      <MusicPositionModal ref={musicPositionModalRef}
        onUpdatePosition={(info, postion) => { handleUpdateMusicPosition(postion, info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }} />
      <ListMenu
        ref={listMenuRef}
        onPlay={info => { handlePlay(info.listId, info.index) }}
        onPlayLater={info => { hancelExitSelect(); handlePlayLater(info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }}
        onRemove={info => { hancelExitSelect(); handleRemove(info.listId, info.musicInfo, info.selectedList, hancelExitSelect) }}
        onDislikeMusic={info => { void handleDislikeMusic(info.musicInfo) }}
        onCopyName={info => { handleShare(info.musicInfo) }}
        onMusicSourceDetail={info => { void handleShowMusicSourceDetail(info.musicInfo) }}
        onAdd={handleAddMusic}
        onMove={handleMoveMusic}
        onEditMetadata={handleEditMetadata}
        onChangePosition={info => musicPositionModalRef.current?.show(info)}
        onToggleSource={info => musicToggleModalRef.current?.show(info)}
      />
      <MetadataEditModal
        ref={metadataEditTypeRef}
        onUpdate={handleUpdateMetadata}
      />
      <MusicToggleModal ref={musicToggleModalRef} />

      {/* Import Song Dialog */}
      {showImportDialog && (
        (() => {
          // Render import song dialog
          return (
            <View style={styles.dialogOverlay}>
              <View style={styles.dialogContainer}>
                <Text style={styles.dialogTitle}>{t('import_song')}</Text>
                
                {isDownloading ? (
                  <View style={styles.downloadProgressContainer}>
                    <Loading size={20} />
                    <Text style={styles.downloadProgressText}>
                      {/* 下载中... {(downloadProgress * 100).toFixed(1)}% */}
                      {t('download_ing')}
                    </Text>
                    <View style={styles.progressBarBackground}>
                      <View style={[styles.progressBarFill, { width: `${downloadProgress * 100}%` }]} />
                    </View>
                  </View>
                ) : (
                  <>
                    <Input
                      placeholder={t('song_name')}
                      value={nameInput}
                      onChangeText={setNameInput}
                      style={styles.dialogInput}
                    />
                    
                    <Input
                      placeholder={t('singer_name')}
                      value={singerInput}
                      onChangeText={setSingerInput}
                      style={styles.dialogInput}
                    />
                    
                    <Input
                      placeholder={t('song_url')}
                      value={urlInput}
                      onChangeText={setUrlInput}
                      style={styles.dialogInput}
                    />
                    
                    <View style={styles.dialogButtons}>
                      <TouchableOpacity style={styles.dialogButton} onPress={handleCancelImport}>
                        <Text color={theme['c-font']}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.dialogButton} onPress={handleAddSong}>
                        <Text color={theme['c-primary-font']}>{t('confirm')}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })()
      )}
    </View>
  )
}
