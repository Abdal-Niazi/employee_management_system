import Ionicons from "@expo/vector-icons/Ionicons";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import { colors, radius, spacing } from "../theme";

// How far the card rises over the blue header.
const CARD_OVERLAP = 40;

export default function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Set at once (state only after the next render), so Enter and a tap send one sign-in.
  const sending = useRef(false);

  const handleSignIn = async () => {
    // Enter on the keyboard can fire again while a sign-in is already on its way.
    if (sending.current) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    sending.current = true;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    } finally {
      sending.current = false;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.header, { paddingTop: insets.top + spacing.xl * 2 }]}>
            <View style={styles.logo}>
              <Ionicons name="people" size={30} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Welcome back</Text>
            <Text style={styles.headerSubtitle}>Sign in to Employee Management</Text>
          </View>

          <View style={styles.cardWrap}>
            <View style={styles.card}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError("");
                }}
                placeholder="you@company.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                style={styles.input}
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError("");
                }}
                onSubmitEditing={handleSignIn}
                placeholder="Your password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Sign in" onPress={handleSignIn} loading={submitting} style={styles.submit} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: spacing.xl },
  header: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl + CARD_OVERLAP,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  headerTitle: { fontSize: 26, fontWeight: "700", color: colors.surface },
  headerSubtitle: { fontSize: 14, color: colors.surface, opacity: 0.85, marginTop: spacing.xs },
  cardWrap: { paddingHorizontal: spacing.lg, marginTop: -CARD_OVERLAP },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    // One style for iOS, Android and web (the shadow* props are deprecated)
    boxShadow: "0px 6px 16px rgba(28, 34, 48, 0.08)",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  submit: { marginTop: spacing.xl },
});
