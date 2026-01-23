import { useEffect, useRef, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { useTheme } from '@/store/theme/hook'
import { createStyle } from '@/utils/tools'
import ListMenu, { type ListMenuType } from './ListMenu'
import ListNameEdit, { type ListNameEditType } from './ListNameEdit'
import List from './List'
import ListImportExport, { type ListImportExportType } from './ListImportExport'
import { handleRemove, handleSync } from './listAction'
import ListMusicSort, { type ListMusicSortType } from './ListMusicSort'
import DuplicateMusic, { type DuplicateMusicType } from './DuplicateMusic'
import { setActiveList, createUserList } from '@/core/list'
import { useI18n } from '@/lang'
import Input, { type InputType } from '@/components/common/Input'
import { confirmDialog, toast } from '@/utils/tools'
import listState from '@/store/list/state'
import { useMyList } from '@/store/list/hook'
import Text from '@/components/common/Text'

export default () => {
  const [styles, setStyles] = useState<any>(null)
  const [visible, setVisible] = useState(false)
  const [showInputDialog, setShowInputDialog] = useState(false)
  const [playlistName, setPlaylistName] = useState('')
  const inputRef = useRef<InputType>(null)
  const listMenuRef = useRef<ListMenuType>(null)
  const listNameEditRef = useRef<ListNameEditType>(null)
  const listMusicSortRef = useRef<ListMusicSortType>(null)
  const duplicateMusicRef = useRef<DuplicateMusicType>(null)
  const listImportExportRef = useRef<ListImportExportType>(null)
  
  const theme = useTheme()
  const t = useI18n()
  const allList = useMyList()
  
  useEffect(() => {
    setStyles(createStyle({
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 5,
      },
      plusButton: {
        padding: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: theme['c-primary-font'],
        borderRadius: 4,
      },
      inputContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 999,
      },
      inputWrapper: {
        width: '80%',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 15,
        alignSelf: 'center',
      },
      inputField: {
        alignSelf: 'stretch',
        marginBottom: 15,
      },
    }))
  }, [theme])

  const handlePlusButtonClick = () => {
    setPlaylistName('')
    setShowInputDialog(true)
    setTimeout(() => {
      inputRef.current?.focus()
    }, 100)
  }

  const handleCreatePlaylist = async () => {
    const name = playlistName.trim()
    if (!name) {
      toast(t('list_create_input_placeholder'))
      return
    }
    
    // Check if a playlist with this name already exists
    if (allList.some(list => list.name === name)) {
      const confirmed = await confirmDialog({
        message: t('list_duplicate_tip'),
        confirmButtonText: t('confirm'),
        cancelButtonText: t('cancel'),
      })
      if (!confirmed) return
    }
    
    try {
      // Create the new playlist
      const newPlaylistId = `userlist_${Date.now()}`
      await createUserList(allList.length, [{
        id: newPlaylistId,
        name: name,
        locationUpdateTime: null,
      }])
      
      // Switch to the newly created playlist
      setActiveList(newPlaylistId)
      
      setShowInputDialog(false)
      toast(`Successfully created playlist: ${name}`)
    } catch (error) {
      console.error('Failed to create playlist:', error)
      toast('Failed to create playlist')
    }
  }

  const handleCancelCreate = () => {
    setShowInputDialog(false)
  }

  useEffect(() => {
    let isInited = false
    const changeVisible = (visibleList: boolean) => {
      if (visibleList && !isInited) {
        requestAnimationFrame(() => {
          setVisible(true)
        })
        isInited = true
      }
    }
    global.app_event.on('changeLoveListVisible', changeVisible)

    return () => {
      global.app_event.off('changeLoveListVisible', changeVisible)
    }
  }, [])

  return (
    visible && styles ? (
      <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.plusButton} onPress={handlePlusButtonClick}>
              <Text color={theme['c-primary-font']}>{t('list_create')}</Text>
            </TouchableOpacity>
          </View>
          <List onShowMenu={(info, position) => listMenuRef.current?.show(info, position)} />
          <ListNameEdit ref={listNameEditRef} />
          <ListMusicSort ref={listMusicSortRef} />
          <DuplicateMusic ref={duplicateMusicRef} />
          <ListImportExport ref={listImportExportRef} />
          <ListMenu
            ref={listMenuRef}
            onNew={index => listNameEditRef.current?.showCreate(index)}
            onRename={info => listNameEditRef.current?.show(info)}
            onSort={info => listMusicSortRef.current?.show(info)}
            onDuplicateMusic={info => duplicateMusicRef.current?.show(info)}
            onImport={(info, position) => listImportExportRef.current?.import(info, position)}
            onExport={(info, position) => listImportExportRef.current?.export(info, position)}
            onRemove={info => { handleRemove(info) }}
            onSync={info => { handleSync(info) }}
            onSelectLocalFile={(info, position) => listImportExportRef.current?.selectFile(info, position)}
          />
          {/* Input Dialog */}
          {showInputDialog && (
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Input
                  ref={inputRef}
                  placeholder={t('list_create_input_placeholder')}
                  value={playlistName}
                  onChangeText={setPlaylistName}
                  onSubmitEditing={handleCreatePlaylist}
                  onBlur={handleCancelCreate}
                  autoFocus={true}
                  style={styles.inputField}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                  <TouchableOpacity onPress={handleCancelCreate} style={{ padding: 5, marginRight: 10 }}>
                    <Text color={theme['c-font']}>{t('cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreatePlaylist} style={{ padding: 5 }}>
                    <Text color={theme['c-primary-font']}>{t('confirm')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
          {/* <ImportExport actionType={actionType} visible={isShowChoosePath} hide={() => setShowChoosePath(false)} selectedListRef={selectedListRef} /> */}
        </>
    ) : null
  )
}
