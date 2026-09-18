import { NativeModules, Platform } from 'react-native'
import { BG_IMAGES } from '@/theme/themes'
import commonState from '@/store/common/state'

interface ThemeBackgroundModuleType {
  setThemeBackground: (image: string, veilColor: string) => void
}

const themeBackgroundModule = NativeModules.ThemeBackgroundModule as ThemeBackgroundModuleType | undefined

export const isNativeThemeBgSupported = Platform.OS === 'ios' && !!themeBackgroundModule

const shouldUseNativeThemeBg = (theme: LX.ActiveTheme) => isNativeThemeBgSupported && !!theme['bg-image'] && !commonState.bgPic

export const updateNativeThemeBackground = (theme: LX.ActiveTheme) => {
  if (!themeBackgroundModule) return
  if (!shouldUseNativeThemeBg(theme)) {
    themeBackgroundModule.setThemeBackground('', '')
    return
  }
  const imageName = (Object.keys(BG_IMAGES) as Array<keyof typeof BG_IMAGES>).find(key => BG_IMAGES[key] === theme['bg-image'])
  themeBackgroundModule.setThemeBackground(imageName ?? '', theme['c-main-background'])
}

export const getComponentBackgroundColor = (theme: LX.ActiveTheme) =>
  shouldUseNativeThemeBg(theme) ? 'transparent' : theme['c-main-background']
