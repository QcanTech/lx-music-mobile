import QuickCrypto from 'react-native-quick-crypto'
import { Buffer } from '@craftzdog/react-native-buffer'

enum KEY_PREFIX {
  publicKeyStart = '-----BEGIN PUBLIC KEY-----',
  publicKeyEnd = '-----END PUBLIC KEY-----',
  privateKeyStart = '-----BEGIN PRIVATE KEY-----',
  privateKeyEnd = '-----END PRIVATE KEY-----',
}

export enum RSA_PADDING {
  OAEPWithSHA1AndMGF1Padding = 'RSA/ECB/OAEPWithSHA1AndMGF1Padding',
  NoPadding = 'RSA/ECB/NoPadding',
}

export enum AES_MODE {
  CBC_128_PKCS7Padding = 'AES/CBC/PKCS7Padding',
  ECB_128_NoPadding = 'AES',
}

// Helper function to convert padding strings to QuickCrypto format
const convertRsaPadding = (padding: RSA_PADDING) => {
  switch (padding) {
    case RSA_PADDING.OAEPWithSHA1AndMGF1Padding:
      return {
        padding: QuickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      }
    case RSA_PADDING.NoPadding:
      return {
        padding: QuickCrypto.constants.RSA_NO_PADDING
      }
    default:
      return {
        padding: QuickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1'
      }
  }
}

// Helper function to convert AES mode strings to QuickCrypto format
const convertAesMode = (mode: AES_MODE) => {
  switch (mode) {
    case AES_MODE.CBC_128_PKCS7Padding:
      return 'aes-128-cbc'
    case AES_MODE.ECB_128_NoPadding:
      return 'aes-128-ecb'
    default:
      return 'aes-128-ecb'
  }
}

export const generateRsaKey = async() => {
  // Generate RSA key pair using QuickCrypto
  const keyPair = QuickCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  })
  
  const publicKey = keyPair.publicKey as unknown as string
  const privateKey = keyPair.privateKey as unknown as string
  
  // Extract the base64 parts from the PEM format
  const publicKeyBase64 = publicKey
    .replace(KEY_PREFIX.publicKeyStart, '')
    .replace(KEY_PREFIX.publicKeyEnd, '')
    .replace(/\n/g, '')
    
  const privateKeyBase64 = privateKey
    .replace(KEY_PREFIX.privateKeyStart, '')
    .replace(KEY_PREFIX.privateKeyEnd, '')
    .replace(/\n/g, '')
  
  return {
    publicKey: `${KEY_PREFIX.publicKeyStart}\n${publicKeyBase64}${KEY_PREFIX.publicKeyEnd}`,
    privateKey: `${KEY_PREFIX.privateKeyStart}\n${privateKeyBase64}${KEY_PREFIX.privateKeyEnd}`,
  }
}

export const rsaEncrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> => {
  const paddingConfig = convertRsaPadding(padding)
  const keyWithPrefix = `${KEY_PREFIX.publicKeyStart}\n${key.replace(KEY_PREFIX.publicKeyStart, '').replace(KEY_PREFIX.publicKeyEnd, '')}\n${KEY_PREFIX.publicKeyEnd}`
  
  const encrypted = QuickCrypto.publicEncrypt(
    {
      key: keyWithPrefix,
      ...paddingConfig
    },
    Buffer.from(text, 'base64')
  )
  
  return encrypted.toString('base64')
}

export const rsaDecrypt = async(text: string, key: string, padding: RSA_PADDING): Promise<string> => {
  const paddingConfig = convertRsaPadding(padding)
  const keyWithPrefix = `${KEY_PREFIX.privateKeyStart}\n${key.replace(KEY_PREFIX.privateKeyStart, '').replace(KEY_PREFIX.privateKeyEnd, '')}\n${KEY_PREFIX.privateKeyEnd}`
  
  const decrypted = QuickCrypto.privateDecrypt(
    {
      key: keyWithPrefix,
      ...paddingConfig
    },
    Buffer.from(text, 'base64')
  )
  
  return decrypted.toString()
}

export const rsaEncryptSync = (text: string, key: string, padding: RSA_PADDING): string => {
  const paddingConfig = convertRsaPadding(padding)
  // const keyWithPrefix = `${KEY_PREFIX.publicKeyStart}\n${key.replace(KEY_PREFIX.publicKeyStart, '').replace(KEY_PREFIX.publicKeyEnd, '')}\n${KEY_PREFIX.publicKeyEnd}`
  
  const encrypted = QuickCrypto.publicEncrypt(
    {
      key: key,
      ...paddingConfig
    },
    Buffer.from(text, 'base64')
  )  
  return encrypted.toString('base64')
}

export const rsaDecryptSync = (text: string, key: string, padding: RSA_PADDING): string => {
  const paddingConfig = convertRsaPadding(padding)
  // const keyWithPrefix = `${KEY_PREFIX.privateKeyStart}\n${key.replace(KEY_PREFIX.privateKeyStart, '').replace(KEY_PREFIX.privateKeyEnd, '')}\n${KEY_PREFIX.privateKeyEnd}`
  
  const decrypted = QuickCrypto.privateDecrypt(
    {
      key: key,
      ...paddingConfig
    },
    Buffer.from(text, 'base64')
  )
  
  return decrypted.toString()
}

export const aesEncrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> => {
  const algorithm = convertAesMode(mode)
  const keyBuffer = Buffer.from(key, 'base64')
  const ivBuffer = vi ? Buffer.from(vi, 'base64') : Buffer.alloc(0)
  
  const cipher = QuickCrypto.createCipheriv(algorithm, keyBuffer, ivBuffer)
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text, 'base64')) as Uint8Array, cipher.final() as Uint8Array])
  
  return encrypted.toString('base64')
}

export const aesDecrypt = async(text: string, key: string, vi: string, mode: AES_MODE): Promise<string> => {
  const algorithm = convertAesMode(mode)
  const keyBuffer = Buffer.from(key, 'base64')
  const ivBuffer = vi ? Buffer.from(vi, 'base64') : Buffer.alloc(0)
  
  const decipher = QuickCrypto.createDecipheriv(algorithm, keyBuffer, ivBuffer)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(text, 'base64')) as Uint8Array, decipher.final() as Uint8Array])
  
  return decrypted.toString()
}

export const aesEncryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string => {
  const algorithm = convertAesMode(mode)
  const keyBuffer = Buffer.from(key, 'base64')
  const ivBuffer = vi ? Buffer.from(vi, 'base64') : Buffer.alloc(0)
  const cipher = QuickCrypto.createCipheriv(algorithm, keyBuffer, ivBuffer)
  const encrypted = Buffer.concat([cipher.update(Buffer.from(text, 'base64')) as Uint8Array, cipher.final() as Uint8Array])
  
  return encrypted.toString('base64')
}

export const aesDecryptSync = (text: string, key: string, vi: string, mode: AES_MODE): string => {
  const algorithm = convertAesMode(mode)
  const keyBuffer = Buffer.from(key, 'base64')
  const ivBuffer = vi ? Buffer.from(vi, 'base64') : Buffer.alloc(0)
  
  const decipher = QuickCrypto.createDecipheriv(algorithm, keyBuffer, ivBuffer)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(text, 'base64')) as Uint8Array, decipher.final() as Uint8Array])
  
  return decrypted.toString()
}