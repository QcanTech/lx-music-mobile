import { memo, useCallback, useRef, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, StatusBar, Dimensions, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import commonState from '@/store/common/state'
import settingState from '@/store/setting/state'
import { setStatusbarHeight } from '@/core/common'
import { windowSizeTools, getWindowSize } from '@/utils/windowSizeTools'
import { SafeAreaView } from 'react-native-safe-area-context'

const getStatusbarHeight = (winHeight: number, layoutHeight: number, safeAreaTop: number) => {
  // For iOS, we use the safe area top inset
  // console.log('getStatusbarHeight', winHeight, layoutHeight, safeAreaTop)
  let height = 0
  if (Platform.OS === 'ios') {
    // height = safeAreaTop / 3
  } else {
    // On Android, we use the actual StatusBar height
    height = (!settingState.setting['common.alwaysKeepStatusbarHeight'] &&
            parseFloat(winHeight.toFixed(2)) >= parseFloat(layoutHeight.toFixed(2)))
      ? 0
      : (StatusBar.currentHeight ?? 0)
  }
  
  return height
}

export default memo(() => {
  const currentHeightRef = useRef(commonState.statusbarHeight)
  const sizeRef = useRef([0, 0])
  const dimensionsChangedRef = useRef(true)
  const safeAreaInsets = useSafeAreaInsets()
  
  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent | { nativeEvent: { layout: { width: number, height: number } } }) => {
    if (!dimensionsChangedRef.current) return
    void getWindowSize().then(size => {
      dimensionsChangedRef.current = false
      sizeRef.current = [size.height, layout.height]
      const height = getStatusbarHeight(size.height, layout.height, safeAreaInsets.top)
      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
      const currentSize = windowSizeTools.getSize()
      if (currentSize.width != layout.width || currentSize.height != layout.height) {
        windowSizeTools.setWindowSize(currentSize.width, currentSize.height)
      }
    })
  }, [safeAreaInsets.top])
  
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      dimensionsChangedRef.current = true
    })

    const handleSettingUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.alwaysKeepStatusbarHeight') || !sizeRef.current[1]) return
      const height = getStatusbarHeight(sizeRef.current[0], sizeRef.current[1], safeAreaInsets.top)

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
    }
    global.state_event.on('configUpdated', handleSettingUpdate)

    return () => {
      subscription.remove()
      global.state_event.off('configUpdated', handleSettingUpdate)
    }
  }, [safeAreaInsets.top])
  
  return (<SafeAreaView edges={['top']}><View style={StyleSheet.absoluteFill} onLayout={handleLayout} /></SafeAreaView>)
}, () => true)