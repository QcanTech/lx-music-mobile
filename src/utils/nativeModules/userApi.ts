import { NativeEventEmitter, NativeModules } from 'react-native'

const { UserApiModule } = NativeModules

let loadScriptInfo: LX.UserApi.UserApiInfo | null = null
export const loadScript = (info: LX.UserApi.UserApiInfo & { script: string }) => {
  loadScriptInfo = info
  UserApiModule.loadScript({
    id: info.id,
    name: info.name,
    description: info.description,
    version: info.version ?? '',
    author: info.author ?? '',
    homepage: info.homepage ?? '',
    script: info.script,
  })
}

export interface SendResponseParams {
  requestKey: string
  error: string | null
  response: {
    statusCode: number
    statusMessage: string
    headers: Record<string, string>
    body: any
  } | null
}
export interface SendActions {
  request: LX.UserApi.UserApiRequestParams
  response: SendResponseParams
}
export const sendAction = <T extends keyof SendActions>(action: T, data: SendActions[T]) => {
  console.log('sendAction', action, data)
  UserApiModule.sendAction(action, JSON.stringify(data))
}

// export const clearAppCache = CacheModule.clearAppCache as () => Promise<void>

export interface InitParams {
  status: boolean
  errorMessage: string
  info: LX.UserApi.UserApiInfo
}

export interface ResponseParams {
  status: boolean
  errorMessage?: string
  requestKey: string
  result: any
}
export interface UpdateInfoParams {
  name: string
  log: string
  updateUrl: string
}
export interface RequestParams {
  requestKey: string
  url: string
  options: {
    method: string
    data: any
    timeout: number
    headers: any
    binary: boolean
  }
}
export type CancelRequestParams = string

export interface Actions {
  init: InitParams
  request: RequestParams
  cancelRequest: CancelRequestParams
  response: ResponseParams
  showUpdateAlert: UpdateInfoParams
  log: string
}
export type ActionsEvent = { [K in keyof Actions]: { action: K, data: Actions[K] } }[keyof Actions]

export const onScriptAction = (handler: (event: ActionsEvent) => void): () => void => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const eventEmitter = new NativeEventEmitter(UserApiModule)
  const eventListener = eventEmitter.addListener('api-action', event => {
    console.log('onScriptAction api-action event:', event)
    try {
      if (event.data) {
        // Safely parse the data
        if (typeof event.data === 'string') {
          try {
            event.data = JSON.parse(event.data as string)
          } catch (parseError) {
            console.warn('Failed to parse event data:', parseError)
            // If parsing fails, keep the original data
          }
        }
      }
      
      if (event.action == 'init') {
        // Safely handle the info object
        if (event.data && typeof event.data === 'object') {
          if (event.data.info) {
            event.data.info = { ...loadScriptInfo, ...event.data.info }
          } else {
            event.data.info = { ...loadScriptInfo }
          }
        }
      } else if (event.action == 'showUpdateAlert') {
        if (!loadScriptInfo?.allowShowUpdateAlert) return
      }
      handler(event as ActionsEvent)
    } catch (error) {
      console.error('Error processing UserApi event:', error)
    }
  })

  return () => {
    eventListener.remove()
  }
}

export const destroy = () => {
  UserApiModule.destroy()
}
