import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/AuthContext";
import Button from "../components/Button";
import { colors, font, spacing } from "../theme";

// Shown only if the server sends a role this version of the app doesn't know.
export default function UnsupportedRoleScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={44} color={colors.primary} />
        <Text style={font.title}>Not available yet</Text>
        <Text style={[font.body, styles.text]}>
          This app doesn&apos;t have screens for your account&apos;s role yet. Try updating the app, or ask HR.
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
});
