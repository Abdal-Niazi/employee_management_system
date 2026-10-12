import * as LocalAuthentication from "expo-local-authentication";

const NO_SCREEN_LOCK = "Set up a screen lock (fingerprint, face or PIN) on this phone to check in.";

// Problems worth telling the person about. Cancelling the prompt is not one of them.
const MESSAGES = {
  not_enrolled: NO_SCREEN_LOCK,
  passcode_not_set: NO_SCREEN_LOCK,
  not_available: NO_SCREEN_LOCK,
  lockout: "Too many tries. Unlock your phone with its PIN, then try again.",
};
const CANCELLED = ["user_cancel", "app_cancel", "system_cancel"];

export class IdentityError extends Error {
  constructor(message, cancelled = false) {
    super(message);
    this.cancelled = cancelled;
  }
}

// Asks for the phone's fingerprint or face (or its PIN if those aren't set up). The phone does the
// check itself: the app only learns yes or no, and nothing biometric is stored or sent anywhere.
export async function confirmIdentity(promptMessage) {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Cancel" });
  if (result.success) return;

  if (CANCELLED.includes(result.error)) throw new IdentityError("Cancelled", true);
  throw new IdentityError(MESSAGES[result.error] ?? "Couldn't confirm it's you. Please try again.");
}
