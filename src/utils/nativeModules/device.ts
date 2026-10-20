import { NativeModules, Platform } from 'react-native'

const { DeviceModule } = NativeModules

const isDeviceModuleAvailable = DeviceModule != null && Platform.OS === 'ios'

/** 打开 iOS 文件选择器并读取音源脚本；取消时返回 null。 */
export const pickUserApiScript = async(): Promise<string | null> => {
  if (typeof DeviceModule?.pickUserApiScript !== 'function') {
    throw new Error('本地导入功能尚未加载，请使用 Xcode 重新编译并运行应用')
  }
  return DeviceModule.pickUserApiScript() as Promise<string | null>
}

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
