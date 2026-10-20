import { useMemo, useRef } from 'react'
import { Platform } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import ScriptImportOnline, { type ScriptImportOnlineType } from './ScriptImportOnline'
import { state } from '@/store/userApi'
import { tipDialog } from '@/utils/tools'

import { useTheme } from '@/store/theme/hook'

interface BtnProps {
  btnStyle?: _DorpDownMenuProps<any[]>['btnStyle']
  onImportLocal: () => void
}


export default ({ btnStyle, onImportLocal }: BtnProps) => {
  const t = useI18n()
  const theme = useTheme()
  const scriptImportOnlineRef = useRef<ScriptImportOnlineType>(null)
  const pendingLocalImport = useRef(false)

  const handleMenuDismiss = () => {
    if (!pendingLocalImport.current) return
    pendingLocalImport.current = false
    onImportLocal()
  }

  const importTypes = useMemo(() => {
    return [
      ...(Platform.OS === 'ios' ? [{ action: 'local', label: t('user_api_btn_import_local') } as const] : []),
      { action: 'online', label: t('user_api_btn_import_online') },
    ] as const
  }, [t])

  type DorpDownMenuProps = _DorpDownMenuProps<typeof importTypes>

  const handleAction: DorpDownMenuProps['onPress'] = ({ action }) => {
    if (state.list.length > 20) {
      void tipDialog({
        message: t('user_api_max_tip'),
        btnText: t('ok'),
      })
      return
    }

    if (action == 'local') {
      // Wait for the native iOS modal dismissal before presenting another controller.
      pendingLocalImport.current = true
    } else {
      scriptImportOnlineRef.current?.show()
    }
  }


  return (
    <DorpDownMenu
      btnStyle={btnStyle}
      menus={importTypes}
      center
      onPress={handleAction}
      onDismiss={handleMenuDismiss}
    >
      <Text size={14} color={theme['c-button-font']}>{t('user_api_btn_import')}</Text>
      <ScriptImportOnline ref={scriptImportOnlineRef} />
    </DorpDownMenu>
  )
}
