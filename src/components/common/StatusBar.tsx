import { useTheme } from '@/store/theme/hook'
import { StatusBar as RNStatusBar, View } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'
import { useEffect } from 'react'

const StatusBar = function() {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const statusBarStyle = theme.isDark ? 'light-content' : 'dark-content'

  useEffect(() => {
    RNStatusBar.setBarStyle(statusBarStyle, true)
  }, [statusBarStyle])

  return (
    <View style={{ height: statusBarHeight, backgroundColor: theme['c-main-background'] }}>
      <RNStatusBar backgroundColor="rgba(0,0,0,0)" barStyle={statusBarStyle} animated translucent={true} />
    </View>
  )
}

StatusBar.currentHeight = RNStatusBar.currentHeight ?? 0
StatusBar.setBarStyle = RNStatusBar.setBarStyle

export default StatusBar