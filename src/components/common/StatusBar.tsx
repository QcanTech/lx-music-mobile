import { useTheme } from '@/store/theme/hook'
import { StatusBar as RNStatusBar, View } from 'react-native'
import { useStatusbarHeight } from '@/store/common/hook'

const StatusBar = function() {
  const theme = useTheme()
  const statusBarHeight = useStatusbarHeight()
  const statusBarStyle = theme.isDark ? 'light-content' : 'dark-content'
  
  return (
    <View style={{ height: statusBarHeight, backgroundColor: theme['c-content-background'] }}>
      <RNStatusBar backgroundColor="rgba(0,0,0,0)" barStyle={statusBarStyle} translucent={true} />
    </View>
  )
}

StatusBar.currentHeight = RNStatusBar.currentHeight ?? 0
StatusBar.setBarStyle = RNStatusBar.setBarStyle

export default StatusBar