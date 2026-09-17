import { createContext, useCallback, useContext, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'


interface Props {
  title: string
  children: React.ReactNode | React.ReactNode[]
}

interface CollapseValue {
  activeTitle: string | null
  toggle: (title: string) => void
}

// 未被 Provider 包裹时（横屏布局）section 保持常开，行为与折叠功能引入前一致
const CollapseContext = createContext<CollapseValue | null>(null)

export const SectionCollapseProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeTitle, setActiveTitle] = useState<string | null>(null)

  const toggle = useCallback((title: string) => {
    setActiveTitle(prev => prev == title ? null : title)
  }, [])

  return (
    <CollapseContext.Provider value={{ activeTitle, toggle }}>
      {children}
    </CollapseContext.Provider>
  )
}

export default ({ title, children }: Props) => {
  const theme = useTheme()
  const collapse = useContext(CollapseContext)
  const expanded = collapse == null || collapse.activeTitle == title

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.5}
        disabled={collapse == null}
        onPress={() => { collapse?.toggle(title) }}
      >
        <Text style={{ ...styles.title, borderLeftColor: theme['c-primary'] }} size={16} >{title}</Text>
        {
          collapse != null
            ? <Icon name="chevron-right" color={theme['c-font']} style={expanded ? styles.arrowExpanded : undefined} />
            : null
        }
      </TouchableOpacity>
      {
        expanded
          ? <View>
              {children}
            </View>
          : null
      }
    </View>
  )
}


const styles = createStyle({
  container: {
    // paddingLeft: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 5,
    marginBottom: 10,
  },
  title: {
    borderLeftWidth: 5,
    paddingLeft: 12,
    flexShrink: 1,
    // lineHeight: 16,
  },
  arrowExpanded: {
    transform: [{ rotate: '90deg' }],
  },
})
