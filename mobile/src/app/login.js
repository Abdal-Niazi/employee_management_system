import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ROLES, useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import SegmentedControl from "../components/SegmentedControl";
import { colors, font, radius, spacing } from "../theme";

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, label]) => ({ value, label }));

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("manager");
  const [error, setError] = useState("");

  const handleSignIn = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    // The password is intentionally unused until POST /api/auth/login exists.
    login({ email: email.trim(), role });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="people" size={28} color="#fff" />
            </View>
            <Text style={font.title}>Employee Management</Text>
            <Text style={font.small}>Sign in to continue</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={18} color={colors.info} />
              <Text style={styles.noticeText}>
                Demo sign-in: the backend has no login yet, so the password isn&apos;t checked or sent anywhere.
              </Text>
            </View>

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
              onChangeText={setPassword}
              placeholder="Not checked yet"
              placeholderTextColor={colors.muted}
              secureTextEntry
              style={styles.input}
            />

            <Text style={styles.label}>Sign in as</Text>
            <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button title="Sign in" onPress={handleSignIn} style={styles.submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  brand: { alignItems: "center", gap: spacing.xs, marginBottom: spacing.xl },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  notice: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  noticeText: { flex: 1, fontSize: 13, color: colors.text },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
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
