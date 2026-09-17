import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, View } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import Input, { type InputType } from '@/components/common/Input'
import Loading from '@/components/common/Loading'
import Text from '@/components/common/Text'
import { createStyle, openUrl, tipDialog, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { saveActivationInfo } from '@/utils/data'
import { verifyActivationCode } from '@/core/activation'

const ACTIVATION_CODE_URL = 'https://tfapps.store?active-code'
const HEADER_HEIGHT = 20

const ActivationModal = ({ componentId }: { componentId: string }) => {
  const theme = useTheme()
  const inputRef = useRef<InputType>(null)
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const handleGetCode = () => {
    void openUrl(ACTIVATION_CODE_URL)
  }

  const handleActivate = async() => {
    if (verifying) return
    const activationCode = code.trim()
    if (!activationCode.length) {
      toast('请输入激活码')
      return
    }

    setVerifying(true)
    try {
      const result = await verifyActivationCode(activationCode)
      if (result.success) {
        saveActivationInfo({
          userId: result.userId ?? '',
          email: result.email ?? '',
          activatedAt: Date.now(),
        })
        toast('激活成功')
        void Navigation.dismissOverlay(componentId)
        return
      }
      // 激活失败时保持弹窗打开，便于用户重新输入
      await tipDialog({ title: '激活失败', message: result.message, bgClose: false })
    } catch (err: any) {
      await tipDialog({
        title: '激活失败',
        message: (err.message ?? '未知错误') as string,
        bgClose: false,
      })
    } finally {
      setVerifying(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ ...styles.centeredView, backgroundColor: 'rgba(50,50,50,.3)' }} behavior="padding">
      <View style={{ ...styles.modalView, backgroundColor: theme['c-content-background'] }}>
        <View style={{ ...styles.header, backgroundColor: theme['c-primary-light-100-alpha-100'] }}></View>
        <View style={styles.main}>
          <Text style={styles.title} size={18}>应用激活</Text>
          <Text style={styles.tip} size={14}>请输入激活码以继续使用本应用</Text>
          <Input
            ref={inputRef}
            value={code}
            onChangeText={setCode}
            placeholder="请输入激活码"
            returnKeyType="done"
            onSubmitEditing={() => { void handleActivate() }}
            style={{ ...styles.input, backgroundColor: theme['c-primary-input-background'] }}
          />
        </View>
        {
          verifying
            ? (
                <View style={styles.loading}>
                  <Loading label="正在验证..." />
                </View>
              )
            : null
        }
        <View style={styles.btns}>
          <Button style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={handleGetCode}>
            <Text color={theme['c-button-font']}>获取激活码</Text>
          </Button>
          <Button disabled={verifying} style={{ ...styles.btn, backgroundColor: theme['c-button-background'] }} onPress={() => { void handleActivate() }}>
            <Text color={theme['c-button-font']}>激活应用</Text>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '82%',
    maxWidth: 340,
    maxHeight: '86%',
    borderRadius: 4,
    elevation: 3,
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    height: HEADER_HEIGHT,
  },
  main: {
    paddingTop: 20,
    paddingLeft: 15,
    paddingRight: 15,
    paddingBottom: 15,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  tip: {
    textAlign: 'center',
    marginBottom: 15,
  },
  input: {
    height: 38,
    borderRadius: 4,
    paddingLeft: 10,
    paddingRight: 10,
  },
  loading: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 10,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 15,
    paddingLeft: 15,
  },
  btn: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 10,
    paddingRight: 10,
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 15,
  },
})

export default ActivationModal
