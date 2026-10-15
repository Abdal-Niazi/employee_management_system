import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";
import Button from "./Button";

// Shown at app start when the saved session couldn't be checked because the server didn't answer.
// The session is kept, so Retry signs straight back in once the connection is back.
export default function OfflineScreen({ onRetry, onSignOut }) {
  return (
    <View style={styles.screen}>
      <Ionicons name="cloud-offline-outline" size={44} color={colors.muted} />
      <Text style={[font.title, styles.center]}>Can&apos;t connect to the server</Text>
      <Text style={[font.body, styles.center, styles.muted]}>
        Check your internet connection, then try again. You&apos;re still signed in.
      </Text>
      <View style={styles.buttons}>
        <Button title="Retry" icon="refresh" onPress={onRetry} />
        <Button title="Sign in with another account" variant="outline" onPress={onSignOut} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  center: { textAlign: "center", maxWidth: 360 },
  muted: { color: colors.muted },
  buttons: { gap: spacing.sm, width: "100%", maxWidth: 360, marginTop: spacing.sm },
});
