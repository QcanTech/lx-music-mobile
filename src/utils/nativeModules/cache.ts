import { NativeModules, Platform } from 'react-native'
import { Dirs, FileSystem } from 'react-native-file-access'

const { CacheModule } = NativeModules

const getDirSizeRecursive = async (path: string): Promise<number> => {
  let size = 0
  try {
    const stat = await FileSystem.stat(path)
    if (stat.type === 'directory') {
      const children = await FileSystem.ls(path)
      for (const child of children) {
        size += await getDirSizeRecursive(path + '/' + child)
      }
    } else {
      size += stat.size
    }
  } catch {}
  return size
}

const clearDirContents = async (path: string): Promise<void> => {
  try {
    const children = await FileSystem.ls(path)
    await Promise.all(
      children.map(child =>
        FileSystem.unlink(path + '/' + child).catch(() => {}),
      ),
    )
  } catch {}
}

export const getAppCacheSize = async (): Promise<number> => {
  if (Platform.OS === 'ios') {
    return getDirSizeRecursive(Dirs.CacheDir)
  }
  return CacheModule.getAppCacheSize().then((size: number) => Math.trunc(size))
}

export const clearAppCache = async (): Promise<void> => {
  if (Platform.OS === 'ios') {
    return clearDirContents(Dirs.CacheDir)
  }
  // Android: no-op in JS, native handles it
}

/** TrackPlayer stores its ExoPlayer/AVPlayer cache in DocumentDir/TrackPlayer */
const trackPlayerCachePath = Dirs.DocumentDir + '/TrackPlayer'

export const getTrackPlayerCacheSize = async (): Promise<number> =>
  getDirSizeRecursive(trackPlayerCachePath)

export const clearTrackPlayerCache = async (): Promise<void> => {
  try {
    const exists = await FileSystem.exists(trackPlayerCachePath)
    if (exists) {
      await clearDirContents(trackPlayerCachePath)
    }
  } catch {}
}
