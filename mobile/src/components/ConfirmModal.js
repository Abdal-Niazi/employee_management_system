import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import Button from "./Button";

// Are-you-sure step. A custom modal rather than Alert.alert, which does nothing on web.
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  danger,
  submitting,
  error,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        <View style={styles.sheet}>
          <Text style={font.title}>{title}</Text>
          <Text style={font.body}>{message}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onCancel} disabled={submitting} style={styles.action} />
            <Button
              title={confirmLabel}
              variant={danger ? "dangerSolid" : "primary"}
              loading={submitting}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1 },
});
