import { Platform } from 'react-native'
import {
  getActivationFirstLaunchTime,
  getActivationInfo,
  saveActivationFirstLaunchTime,
} from '@/utils/data'
import { getDeviceId, getDeviceModel } from '@/utils/nativeModules/device'
import { showActivationModal } from '@/navigation'
import { httpFetch } from '@/utils/request'
import { bootLog } from '@/utils/bootLog'

const ACTIVATION_API_URL = 'https://tfapps.store/api/activation/verify'

/** 免费试用期时长，导出便于测试时临时调整 */
export const ACTIVATION_GRACE_MS = 7 * 24 * 60 * 60 * 1000

interface VerifyResponseBody {
  success?: boolean
  message?: string
  userId?: string
  email?: string
}

export interface ActivationVerifyResult {
  success: boolean
  message: string
  userId?: string
  email?: string
}

/**
 * 记录应用首次打开的时间，需在每次启动时调用，内部保证只写入一次
 */
export const recordFirstLaunchTime = async() => {
  if (Platform.OS !== 'ios') return
  if (await getActivationFirstLaunchTime() != null) return
  saveActivationFirstLaunchTime(Date.now())
}

/**
 * 检查是否需要激活，返回 true 表示已弹出激活弹窗
 */
export const checkActivation = async(): Promise<boolean> => {
  if (Platform.OS !== 'ios') return false
  if (await getActivationInfo() != null) return false

  const firstLaunchTime = await getActivationFirstLaunchTime()
  console.log('checkActivation', firstLaunchTime, Date.now())
  // 试用起点未知时放行，避免误把用户锁在激活弹窗外
  if (firstLaunchTime == null) return false
  if (Date.now() - firstLaunchTime <= ACTIVATION_GRACE_MS) return false

  bootLog('Activation modal shown.')
  showActivationModal()
  return true
}

export const verifyActivationCode = async(code: string): Promise<ActivationVerifyResult> => {
  const [deviceId, deviceModel] = await Promise.all([getDeviceId(), getDeviceModel()])
  const resp = await httpFetch(ACTIVATION_API_URL, {
    method: 'POST',
    body: { code, deviceId, deviceModel },
  }).promise
  // request.js 会吞掉 JSON 解析异常，代理或 CDN 返回 HTML 时 body 仍是字符串
  const body = resp.body as VerifyResponseBody | string | null
  console.log('verifyActivationCode', body, resp)
  if (body == null || typeof body !== 'object') {
    return { success: false, message: `服务器响应异常（${resp.statusCode}）` }
  }
  if (body.success !== true) {
    return { success: false, message: body.message?.length ? body.message : '激活失败' }
  }
  return {
    success: body.success === true,
    message: body.message?.length ? body.message : '激活失败',
    userId: body.userId,
    email: body.email,
  }
}
