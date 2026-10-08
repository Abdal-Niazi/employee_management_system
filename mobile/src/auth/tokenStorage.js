import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "auth_token";

// expo-secure-store has no web support, so on web the token only lives in memory
// (a page reload signs you out). Native keeps it in the Keychain/Keystore.
const isWeb = Platform.OS === "web";
let memoryToken = null;

export async function loadToken() {
  if (isWeb) return memoryToken;
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token) {
  if (isWeb) {
    memoryToken = token;
    return;
  }
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken() {
  if (isWeb) {
    memoryToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}
