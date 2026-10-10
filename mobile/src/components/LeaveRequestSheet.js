import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { todayKey } from "../utils/date";
import Button from "./Button";
import SegmentedControl from "./SegmentedControl";

const TYPES = [
  { value: "Annual", label: "Annual" },
  { value: "Sick", label: "Sick" },
  { value: "Casual", label: "Casual" },
];

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// Pop-up form to ask for leave. A custom modal because Alert.prompt only exists on iOS.
export default function LeaveRequestSheet({ visible, saving, error, onCancel, onSubmit }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={saving ? undefined : onCancel} />
        {/* Mounted only while open, so the form starts fresh every time. */}
        {visible && <Form saving={saving} error={error} onCancel={onCancel} onSubmit={onSubmit} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Form({ saving, error, onCancel, onSubmit }) {
  const [type, setType] = useState("Annual");
  const [startDate, setStartDate] = useState(todayKey());
  const [endDate, setEndDate] = useState(todayKey());
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState("");

  const handleSubmit = () => {
    const start = startDate.trim();
    const end = endDate.trim();

    if (!isRealDate(start) || !isRealDate(end)) return setProblem("Use the date format YYYY-MM-DD, e.g. 2026-11-02.");
    if (end < start) return setProblem("The last day can't be before the first day.");

    setProblem("");
    onSubmit({ type, startDate: start, endDate: end, reason: reason.trim() || null });
  };

  const shown = problem || error;

  return (
    <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
      <View style={styles.sheet}>
        <Text style={font.title}>Request leave</Text>
        <Text style={font.small}>Your manager will approve or reject it. Weekends are not counted.</Text>

        <Text style={styles.label}>Type</Text>
        <SegmentedControl options={TYPES} value={type} onChange={setType} />

        <Text style={styles.label}>First day</Text>
        <TextInput
          value={startDate}
          onChangeText={(text) => {
            setStartDate(text);
            setProblem("");
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          editable={!saving}
          style={styles.input}
        />

        <Text style={styles.label}>Last day</Text>
        <TextInput
          value={endDate}
          onChangeText={(text) => {
            setEndDate(text);
            setProblem("");
          }}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          editable={!saving}
          style={styles.input}
        />

        <Text style={styles.label}>Reason (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Why do you need leave?"
          placeholderTextColor={colors.muted}
          multiline
          maxLength={500}
          editable={!saving}
          style={[styles.input, styles.reason]}
        />

        {shown ? <Text style={styles.error}>{shown}</Text> : null}

        <View style={styles.actions}>
          <Button title="Cancel" variant="outline" onPress={onCancel} disabled={saving} style={styles.action} />
          <Button title="Send request" loading={saving} onPress={handleSubmit} style={styles.action} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
  },
  sheetScroll: { flexGrow: 0, maxHeight: "100%" },
  sheetContent: { flexGrow: 1, justifyContent: "center" },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.xs,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md },
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
  reason: { minHeight: 76, paddingTop: spacing.md, textAlignVertical: "top" },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
});
