import { memo } from 'react'
import { View } from 'react-native'

import CheckBoxItem from '../../components/CheckBoxItem'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

export default memo(() => {
  const t = useI18n()
  const isPlayWhileCache = useSettingValue('player.playWhileCache')
  const setPlayWhileCache = (isPlayWhileCache: boolean) => {
    updateSetting({ 'player.playWhileCache': isPlayWhileCache })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isPlayWhileCache} onChange={setPlayWhileCache} label={t('setting_play_while_cache')} />
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
