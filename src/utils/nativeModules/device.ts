import { NativeModules, Platform } from 'react-native'

const { DeviceModule } = NativeModules

const isDeviceModuleAvailable = DeviceModule != null && Platform.OS === 'ios'

/**
 * Keychain 中持久化的设备唯一 ID，卸载重装后保持不变
 */
export const getDeviceId = async(): Promise<string> => {
  if (!isDeviceModuleAvailable) return ''
  return DeviceModule.getDeviceId() as Promise<string>
}

/**
 * 设备型号营销名称，如 iPhone 17 Pro；未收录机型回退为硬件标识符
 */
export const getDeviceModel = async(): Promise<string> => {
  if (!isDeviceModuleAvailable) return 'unknown'
  return DeviceModule.getDeviceModel() as Promise<string>
}
