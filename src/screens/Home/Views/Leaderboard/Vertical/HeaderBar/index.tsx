import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { View } from 'react-native'

// import { useGetter, useDispatch } from '@/store'
// import Tag from './Tag'
// import OpenList from './OpenList'
import { createStyle } from '@/utils/tools'
// import { BorderWidths } from '@/theme'
import SourceSelector, {
  type SourceSelectorType,
} from './SourceSelector'
import { useTheme } from '@/store/theme/hook'
// import { BorderWidths } from '@/theme'
import ActiveListName, { type ActiveListNameType } from './ActiveListName'
import { BorderWidths } from '@/theme'

export interface HeaderBarProps {
  onShowBound: () => void
  onSourceChange: (source: LX.OnlineSource) => void
}

export interface HeaderBarType {
  setBound: (source: LX.OnlineSource, id: string, name: string) => void
}

export default forwardRef<HeaderBarType, HeaderBarProps>(({ onShowBound, onSourceChange }, ref) => {
  const activeListNameRef = useRef<ActiveListNameType>(null)
  const sourceSelectorRef = useRef<SourceSelectorType>(null)
  const theme = useTheme()

  useImperativeHandle(ref, () => ({
    setBound(source, id, name) {      
      if (sourceSelectorRef.current) {
        sourceSelectorRef.current.setSource(source)
      } else {
        console.warn('sourceSelectorRef is not initialized')
      }
      
      if (activeListNameRef.current) {
        activeListNameRef.current.setBound(id, name)
      } else {
        console.warn('activeListNameRef is not initialized')
      }
    },
  }), [])

  useEffect(() => {
    console.log('HeaderBar mounted')
    return () => console.log('HeaderBar unmounted')
  }, [])

  return (
    <View style={{ ...styles.currentList, borderBottomColor: theme['c-border-background'] }}>
      <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} />
      <ActiveListName ref={activeListNameRef} onShowBound={onShowBound} />
    </View>
  )
})

const styles = createStyle({
  currentList: {
    flexDirection: 'row',
    height: 38,
    zIndex: 2,
    // paddingRight: 10,
    borderBottomWidth: BorderWidths.normal,
  },
  selector: {
    width: 86,
  },
})
