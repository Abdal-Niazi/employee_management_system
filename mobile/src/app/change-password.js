import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import Card from "../components/Card";
import { colors, font, radius, spacing } from "../theme";

const MIN_LENGTH = 8;
// bcrypt only uses the first 72 bytes, so the server refuses longer passwords.
const MAX_BYTES = 72;
// The text's size in UTF-8, as the server counts it (accented letters and emoji take 2 to 4 bytes).
const byteLength = (text) => new TextEncoder().encode(text).length;

// A password box with a show/hide eye.
function PasswordField({ label, value, onChangeText, autoComplete, onSubmitEditing, returnKeyType }) {
  const [shown, setShown] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          secureTextEntry={!shown}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          accessibilityLabel={label}
          style={styles.input}
        />
        <Pressable
          onPress={() => setShown((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          hitSlop={8}
          style={styles.eye}
        >
          <Ionicons name={shown ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

// Any signed-in account changes its own password. The server signs out the account's other
// logins (other phones and browsers); this one stays signed in with the new login it gets back.
export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // null until the change worked, then whether this phone could save its new sign-in.
  const [done, setDone] = useState(null);
  // Set at once (state only after the next render), so a double tap, or Enter and a tap, sends
  // the change only once.
  const sending = useRef(false);

  // Typing again clears the last message.
  const typing = (setter) => (text) => {
    setter(text);
    setError("");
  };

  const handleSave = async () => {
    if (sending.current) return;
    if (!current) return setError("Enter your current password.");
    if (next.length < MIN_LENGTH) return setError(`The new password needs at least ${MIN_LENGTH} characters.`);
    if (byteLength(next) > MAX_BYTES) return setError("The new password is too long.");
    if (next === current) return setError("The new password must be different from the current one.");
    if (next !== repeat) return setError("The two new passwords don't match.");

    sending.current = true;
    setSaving(true);
    try {
      const { saved } = await changePassword(current, next);
      // The passwords aren't needed any more.
      setCurrent("");
      setNext("");
      setRepeat("");
      setDone({ saved });
    } catch (err) {
      setError(err.message);
    } finally {
      sending.current = false;
      setSaving(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Card>
          <View style={styles.success}>
            <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            <Text style={[font.body, styles.flex]}>
              {done.saved
                ? "Password changed. You were signed out on your other phones and browsers; this one stays signed in."
                : "Password changed, and you were signed out on your other phones and browsers. This phone couldn't save the new sign-in, so you'll need to sign in again the next time you open the app."}
            </Text>
          </View>
        </Card>
        <Button title="Done" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <PasswordField
            label="Current password"
            value={current}
            onChangeText={typing(setCurrent)}
            autoComplete="current-password"
            returnKeyType="next"
          />
          <PasswordField
            label="New password"
            value={next}
            onChangeText={typing(setNext)}
            autoComplete="new-password"
            returnKeyType="next"
          />
          <Text style={styles.hint}>At least {MIN_LENGTH} characters.</Text>
          <PasswordField
            label="Repeat the new password"
            value={repeat}
            onChangeText={typing(setRepeat)}
            autoComplete="new-password"
            onSubmitEditing={handleSave}
            returnKeyType="done"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.hint}>Your other phones and browsers will be signed out.</Text>
          <Button title="Change password" icon="key-outline" loading={saving} onPress={handleSave} style={styles.submit} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, paddingHorizontal: spacing.md, minHeight: 46, fontSize: 15, color: colors.text },
  eye: { paddingHorizontal: spacing.md },
  hint: { fontSize: 13, color: colors.muted, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  submit: { marginTop: spacing.lg },
  success: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
