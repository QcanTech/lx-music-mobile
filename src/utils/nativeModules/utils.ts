import { AppState, NativeEventEmitter, NativeModules, Platform, Dimensions } from 'react-native'
import { NetworkInfo } from 'react-native-network-info';

const { UtilsModule } = NativeModules

// Check if the module exists and we're on Android (iOS is not supported)
const isUtilsModuleAvailable = UtilsModule != null && Platform.OS === 'android'

// export const exitApp = UtilsModule.exitApp
export const exitApp = () => {console.log('exitApp')}

export const getSupportedAbis = () => {
  if (Platform.OS == "android") {
    return UtilsModule.getSupportedAbis()
  } else{
    return [];
  }
}

export const installApk = (filePath: string, fileProviderAuthority: string) => {
  if (!isUtilsModuleAvailable) return
  UtilsModule.installApk(filePath, fileProviderAuthority)
}


export const screenkeepAwake = () => {
  if (global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = true
  if (!isUtilsModuleAvailable) return
  UtilsModule.screenkeepAwake()
}
export const screenUnkeepAwake = () => {
  // console.log('screenUnkeepAwake')
  if (!global.lx.isScreenKeepAwake) return
  global.lx.isScreenKeepAwake = false
  if (!isUtilsModuleAvailable) return
  UtilsModule.screenUnkeepAwake()
}

// export const getWIFIIPV4Address = UtilsModule.getWIFIIPV4Address as () => Promise<string>
export const getWIFIIPV4Address = async(): Promise<string> => {
  return NetworkInfo.getIPV4Address().then((ipv4: string | null) => ipv4 || 'UnKnown');
}

export const getDeviceName = async(): Promise<string> => {
  if (!isUtilsModuleAvailable) return 'Unknown'
  return UtilsModule.getDeviceName().then((deviceName: string) => deviceName || 'Unknown')
}

// export const isNotificationsEnabled = UtilsModule.isNotificationsEnabled as () => Promise<boolean>
export const isNotificationsEnabled = async(): Promise<boolean> => {
  if (Platform.OS == "android") {
    if (!isUtilsModuleAvailable) return true
    return UtilsModule.isNotificationsEnabled()
  }
  return true
}

export const requestNotificationPermission = async() => new Promise<boolean>((resolve) => {
  if (!isUtilsModuleAvailable) {
    resolve(true)
    return
  }
  
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isNotificationsEnabled().then(resolve)
    }, 1000)
  })
  UtilsModule.openNotificationPermissionActivity().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})

export const shareText = async(shareTitle: string, title: string, text: string): Promise<void> => {
  if (!isUtilsModuleAvailable) return Promise.resolve()
  return UtilsModule.shareText(shareTitle, title, text)
}

export const getSystemLocales = async(): Promise<string> => {
  if (!isUtilsModuleAvailable) return 'en-US'
  return UtilsModule.getSystemLocales()
}

export const onScreenStateChange = (handler: (state: 'ON' | 'OFF') => void): () => void => {
  // If module is not available, return a no-op function
  if (!isUtilsModuleAvailable) {
    return () => {}
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UtilsModule)
  const eventListener = eventEmitter.addListener('screen-state', event => {
    handler(event.state as 'ON' | 'OFF')
  })

  return () => {
    eventListener.remove()
  }
}

export const getWindowSize = async(): Promise<{ width: number, height: number }> => {
  // return UtilsModule.getWindowSize()
  const windowWidth = Dimensions.get('window').width;
  const windowHeight = Dimensions.get('window').height;
  // console.log('getWindowSize', windowWidth, windowHeight)
  return { width: windowWidth, height: windowHeight }
}

// export const onWindowSizeChange = (handler: (size: { width: number, height: number }) => void): () => void => {
//   UtilsModule.listenWindowSizeChanged()
//   // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
//   const eventEmitter = new NativeEventEmitter(UtilsModule)
//   const eventListener = eventEmitter.addListener('screen-size-changed', event => {
//     handler(event as { width: number, height: number })
//   })

//   return () => {
//     eventListener.remove()
//   }
// }

export const isIgnoringBatteryOptimization = async(): Promise<boolean> => {
  if (!isUtilsModuleAvailable) return true
  return UtilsModule.isIgnoringBatteryOptimization()
}

export const requestIgnoreBatteryOptimization = async() => new Promise<boolean>((resolve) => {
  if (!isUtilsModuleAvailable) {
    resolve(true)
    return
  }
  
  let subscription = AppState.addEventListener('change', (state) => {
    if (state != 'active') return
    subscription.remove()
    setTimeout(() => {
      void isIgnoringBatteryOptimization().then(resolve)
    }, 1000)
  })
  UtilsModule.requestIgnoreBatteryOptimization().then((result: boolean) => {
    if (result) return
    subscription.remove()
    resolve(false)
  })
})