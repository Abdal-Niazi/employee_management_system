import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import Button from "./Button";
import { leaveSummary } from "./LeaveCard";

// Confirm step for approving/rejecting leave. A custom modal rather than
// Alert.alert, which does nothing on web.
export default function DecisionModal({ request, decision, submitting, error, onCancel, onConfirm }) {
  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        {request && (
          // Keyed by request so the note starts empty for every new decision.
          <DecisionSheet
            key={`${request.id}:${decision}`}
            request={request}
            approving={decision === "APPROVED"}
            submitting={submitting}
            error={error}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function DecisionSheet({ request, approving, submitting, error, onCancel, onConfirm }) {
  const [note, setNote] = useState("");

  return (
    <View style={styles.sheet}>
      <Text style={font.title}>{approving ? "Approve leave?" : "Reject leave?"}</Text>
      <Text style={font.body}>
        {request.employeeName} · {request.type} leave
      </Text>
      <Text style={font.small}>{leaveSummary(request)}</Text>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={approving ? "Add a note (optional)" : "Reason for rejecting (optional)"}
        placeholderTextColor={colors.muted}
        multiline
        style={styles.input}
        editable={!submitting}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        <Button title="Cancel" variant="outline" onPress={onCancel} disabled={submitting} style={styles.action} />
        <Button
          title={approving ? "Approve" : "Reject"}
          variant={approving ? "success" : "dangerSolid"}
          loading={submitting}
          onPress={() => onConfirm(note)}
          style={styles.action}
        />
      </View>
    </View>
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
    maxWidth: 440,
    alignSelf: "center",
  },
  input: {
    minHeight: 80,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.text,
    textAlignVertical: "top",
  },
  error: { color: colors.danger, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1 },
});
