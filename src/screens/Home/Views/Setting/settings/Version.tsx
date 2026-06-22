import { memo } from 'react'
import { StyleSheet, View } from 'react-native'

import Section from '../components/Section'
import SubTitle from '../components/SubTitle'
import Button from '../components/Button'

import { useI18n } from '@/lang'
import Text from '@/components/common/Text'
import { openUrl } from '@/utils/tools'

const currentVer = process.versions.app
export default memo(() => {
  const t = useI18n()

  const handleGoToUpdate = () => {
    void openUrl('https://tfapps.store/?ref=TJA7AHHQ')
  }

  return (
    <Section title={t('setting_version')}>
      <SubTitle title={''}>
        <View style={styles.desc}>
          <Text size={14}>{t('version_label_current_ver')}{currentVer}</Text>
        </View>
        <View style={styles.btn}>
          <Button onPress={handleGoToUpdate}>{t('setting_version_go_to_update')}</Button>
        </View>
      </SubTitle>
    </Section>
  )
})

const styles = StyleSheet.create({
  desc: {
    marginBottom: 8,
  },
  btn: {
    flexDirection: 'row',
  },
})
