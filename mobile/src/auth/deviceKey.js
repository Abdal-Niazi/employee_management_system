import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// The key this phone checks in with, one per account (two people could share a phone). The phone
// makes it itself and keeps it in its secure storage (Keychain / Keystore) BEFORE registering it,
// so a lost answer from the server can't leave the phone registered without its key. The web app
// can't check in, so nothing is stored there.
const isWeb = Platform.OS === "web";
const keyName = (accountId) => `device_key_${accountId}`;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Bytes as base64url without padding (32 bytes give 43 characters).
function base64url(bytes) {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.ceil((Math.min(bytes.length - i, 3) * 4) / 3);
    for (let c = 0; c < chars; c++) out += ALPHABET[(n >> (18 - 6 * c)) & 63];
  }
  return out;
}

// A new random key: 32 bytes from the phone's secure random generator.
export function makeDeviceKey() {
  return base64url(getRandomBytes(32));
}

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
