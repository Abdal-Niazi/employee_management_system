import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";
import Button from "./Button";

export function LoadingState({ label = "Loading…" }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.danger} />
      <Text style={font.heading}>Couldn&apos;t load data</Text>
      <Text style={[font.small, styles.message]}>{error?.message ?? "Something went wrong."}</Text>
      {onRetry && <Button title="Retry" icon="refresh" variant="outline" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, message }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={36} color={colors.muted} />
      <Text style={font.heading}>{title}</Text>
      {message && <Text style={[font.small, styles.message]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  message: { textAlign: "center", maxWidth: 320 },
});
