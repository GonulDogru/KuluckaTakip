import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const deviceIdKey = 'kuluckatakip.sms.device-id';
const deviceSecretKey = 'kuluckatakip.sms.device-secret';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SmsDeviceIdentity = {
  deviceId: string;
  deviceSecret: string;
};

export type SmsDeviceProvisioningInfo = {
  deviceId: string;
  secretHash: string;
};

let identityPromise: Promise<SmsDeviceIdentity> | null = null;

function randomSecret() {
  return Crypto.getRandomBytesAsync(32).then((bytes) =>
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''),
  );
}

async function loadOrCreateIdentity(): Promise<SmsDeviceIdentity> {
  if (Platform.OS === 'web') {
    throw new Error('SMS gönderici cihaz kimliği yalnızca Android veya iOS cihazında kullanılabilir.');
  }

  const [storedDeviceId, storedSecret] = await Promise.all([
    AsyncStorage.getItem(deviceIdKey),
    SecureStore.getItemAsync(deviceSecretKey),
  ]);

  if (storedDeviceId && uuidPattern.test(storedDeviceId) && storedSecret && /^[0-9a-f]{64}$/i.test(storedSecret)) {
    return { deviceId: storedDeviceId, deviceSecret: storedSecret };
  }

  const deviceId = Crypto.randomUUID();
  const deviceSecret = await randomSecret();
  await SecureStore.setItemAsync(deviceSecretKey, deviceSecret);
  await AsyncStorage.setItem(deviceIdKey, deviceId);
  return { deviceId, deviceSecret };
}

export async function getSmsDeviceIdentity(): Promise<SmsDeviceIdentity> {
  if (!identityPromise) {
    identityPromise = loadOrCreateIdentity().catch((error: unknown) => {
      identityPromise = null;
      throw error;
    });
  }
  return identityPromise;
}

export async function getSmsDeviceProvisioningInfo(): Promise<SmsDeviceProvisioningInfo> {
  const identity = await getSmsDeviceIdentity();
  const secretHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, identity.deviceSecret);
  return { deviceId: identity.deviceId, secretHash };
}
