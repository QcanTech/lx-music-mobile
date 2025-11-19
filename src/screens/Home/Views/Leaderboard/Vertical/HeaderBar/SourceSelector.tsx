import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { createStyle } from '@/utils/tools'
import SourceSelector, {
  type SourceSelectorType as _SourceSelectorType,
  type SourceSelectorProps as _SourceSelectorProps,
} from '@/components/SourceSelector'
import leaderboardState, { type Source, type InitState } from '@/store/leaderboard/state'

type Sources = Readonly<InitState['sources']>
type SourceSelectorCommonProps = _SourceSelectorProps<Sources>
type SourceSelectorCommonType = _SourceSelectorType<Sources>

export interface SourceSelectorProps {
  onSourceChange: SourceSelectorCommonProps['onSourceChange']
  style?: ViewStyle
}

export interface SourceSelectorType {
  setSource: (source: Source) => void
}

export default forwardRef<SourceSelectorType, SourceSelectorProps>(({ style, onSourceChange }, ref) => {
  const sourceSelectorRef = useRef<SourceSelectorCommonType>(null)

  useEffect(() => {
    // sourceSelectorRef.current?.setSourceList(leaderboardState.sources, leaderboardState.sources[0])
  }, [])
  useImperativeHandle(ref, () => ({
    setSource(source) {      
      if (sourceSelectorRef.current) {
        sourceSelectorRef.current.setSourceList(leaderboardState.sources, source)
      } else {
        console.warn('sourceSelectorRef is not initialized in setSource')
      }
    },
  }), [])


  return (
    <View style={StyleSheet.compose<ViewStyle, ViewStyle, ViewStyle>(styles.selector, style)}>
      <SourceSelector ref={sourceSelectorRef} onSourceChange={onSourceChange} center />
    </View>
  )
})

const styles = createStyle({
  selector: {
    // width: 86,
  },
})