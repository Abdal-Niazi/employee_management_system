import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ROLES, useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import { colors, font, spacing } from "../theme";

// HR Admin screens are built on another branch; this build has the Manager and Employee screens.
const OWNER_BRANCH = {
  hr_admin: "feature/hr-admin",
};

export default function ComingSoonScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={44} color={colors.primary} />
        <Text style={font.title}>{ROLES[user.role]} screens</Text>
        <Text style={[font.body, styles.text]}>
          The {ROLES[user.role]} part of the app is being built on{" "}
          <Text style={styles.code}>{OWNER_BRANCH[user.role]}</Text>. This build contains the Manager and Employee
          screens.
        </Text>
        <Button title="Sign out" icon="log-out-outline" variant="outline" onPress={logout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl },
  text: { textAlign: "center", color: colors.muted, maxWidth: 360 },
  code: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), color: colors.text },
});
