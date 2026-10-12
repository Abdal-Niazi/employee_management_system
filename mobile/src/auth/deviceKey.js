import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The key this phone got when it was registered for check-in, one per account (two people
// could share a phone). It lives in the phone's secure storage (Keychain / Keystore). The web app
// can't check in, so nothing is stored there.
const isWeb = Platform.OS === "web";
const keyName = (accountId) => `device_key_${accountId}`;

export async function loadDeviceKey(accountId) {
  if (isWeb) return null;
  return SecureStore.getItemAsync(keyName(accountId));
}

export async function saveDeviceKey(accountId, key) {
  if (isWeb) return;
  await SecureStore.setItemAsync(keyName(accountId), key);
}

export async function clearDeviceKey(accountId) {
  if (isWeb) return;
  await SecureStore.deleteItemAsync(keyName(accountId));
}
