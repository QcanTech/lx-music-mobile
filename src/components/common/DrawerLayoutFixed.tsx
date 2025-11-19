import { forwardRef, useCallback, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { View, type LayoutChangeEvent, Platform, Dimensions } from 'react-native'
import { Drawer } from 'react-native-drawer-layout'
// import { getWindowSise } from '@/utils/tools'
import { usePageVisible } from '@/store/common/hook'
import { type COMPONENT_IDS } from '@/config/constant'

interface Props {
  visibleNavNames: COMPONENT_IDS[]
  widthPercentage: number
  widthPercentageMax?: number
  renderNavigationView: () => React.ReactNode
  drawerPosition?: 'left' | 'right'
  drawerType?: 'front' | 'back' | 'slide' | 'permanent'
  drawerStyle?: any
  overlayStyle?: any
  children: React.ReactNode
}

export interface DrawerLayoutFixedType {
  openDrawer: () => void
  closeDrawer: () => void
  fixWidth: () => void
}

const DrawerLayoutFixed = forwardRef<DrawerLayoutFixedType, Props>(({
  visibleNavNames,
  widthPercentage,
  widthPercentageMax,
  renderNavigationView,
  drawerPosition,
  drawerType = 'front',
  drawerStyle,
  overlayStyle,
  children,
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false)
  const [w, setW] = useState<number | `${number}%`>('100%')
  const [drawerWidth, setDrawerWidth] = useState(0)
  const changedRef = useRef({ width: 0, changed: false })
  const [isReady, setIsReady] = useState(false)

  const openDrawer = useCallback(() => {
    if (isReady) {
      setIsOpen(true)
    }
  }, [isReady])

  const closeDrawer = useCallback(() => {
    setIsOpen(false)
  }, [])

  const fixDrawerWidth = useCallback(() => {
    if (!changedRef.current.width) return
    changedRef.current.changed = true
    setW(changedRef.current.width)
  }, [])

  // 修复 Drawer 在导航到其他屏幕再返回后无法打开的问题
  usePageVisible(visibleNavNames, useCallback((visible) => {
    if (!visible || !changedRef.current.width) return
    fixDrawerWidth()
  }, [fixDrawerWidth]))

  useImperativeHandle(ref, () => ({
    openDrawer,
    closeDrawer,
    fixWidth: fixDrawerWidth,
  }), [openDrawer, closeDrawer, fixDrawerWidth])


  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    if (changedRef.current.changed) {
      setW('100%')
      changedRef.current.changed = false
    } else {
      const width = e.nativeEvent.layout.width
      if (changedRef.current.width == width) return
      changedRef.current.width = width

      // 重新设置面板宽度
      const wp = Math.floor(width * widthPercentage)
      setDrawerWidth(widthPercentageMax ? Math.min(wp, widthPercentageMax) : wp)

      // Keep the full width
      setW('100%')
    }
  }, [widthPercentage, widthPercentageMax])

  const drawerStyleWithWidth = {
    ...drawerStyle,
    width: drawerWidth,
  }

  // Ensure drawer is closed on initial render and set ready state
  useEffect(() => {
    setIsOpen(false)
    // Small delay to ensure gesture handler is ready
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  // Adding key to force remount when isOpen changes to avoid gesture handler issues
  return (
    <View
      onLayout={handleLayout}
      style={{ width: w, flex: 1 }}
    >
      {isReady && (
        <Drawer
          open={isOpen}
          onOpen={openDrawer}
          onClose={closeDrawer}
          renderDrawerContent={renderNavigationView}
          drawerPosition={drawerPosition}
          drawerType={drawerType}
          drawerStyle={drawerStyleWithWidth}
          overlayStyle={overlayStyle}
          {...props}
        >
          <View style={{ width: '100%', flex: 1 }}>
            {children}
          </View>
        </Drawer>
      )}
    </View>
  )
})

export default DrawerLayoutFixed