import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { fullName } from "../utils/status";
import Button from "./Button";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Pop-up for writing or correcting one employee's check-in / check-out for a day.
// A custom modal rather than Alert.prompt, which doesn't exist on Android or web.
export default function AttendanceSheet({ row, dateLabel, saving, error, onCancel, onSave, onRemove }) {
  return (
    <Modal visible={Boolean(row)} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={saving ? undefined : onCancel} />
        {row && (
          // Keyed by person and day, so the fields start from that record every time.
          <Sheet
            key={`${row.employee.id}:${dateLabel}`}
            row={row}
            dateLabel={dateLabel}
            saving={saving}
            error={error}
            onCancel={onCancel}
            onSave={onSave}
            onRemove={onRemove}
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Sheet({ row, dateLabel, saving, error, onCancel, onSave, onRemove }) {
  const saved = Boolean(row.record.checkIn);
  const [checkIn, setCheckIn] = useState(row.record.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(row.record.checkOut ?? "");
  const [problem, setProblem] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const handleSave = () => {
    const inTime = checkIn.trim();
    const outTime = checkOut.trim();

    if (!TIME.test(inTime)) return setProblem("Check-in must be a time like 09:00 (24-hour).");
    if (outTime && !TIME.test(outTime)) return setProblem("Check-out must be a time like 17:30 (24-hour).");
    if (outTime && outTime <= inTime) return setProblem("Check-out must be after check-in.");

    setProblem("");
    onSave({ checkIn: inTime, checkOut: outTime || null });
  };

  const shown = problem || error;

  return (
    <View style={styles.sheet}>
      <Text style={font.title}>{fullName(row.employee)}</Text>
      <Text style={font.small}>{dateLabel}</Text>

      {confirmingRemove ? (
        <>
          <Text style={[font.body, styles.confirmText]}>
            Remove this day&apos;s check-in? The day will count as absent again.
          </Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              title="Keep it"
              variant="outline"
              onPress={() => setConfirmingRemove(false)}
              disabled={saving}
              style={styles.action}
            />
            <Button title="Remove" variant="dangerSolid" loading={saving} onPress={onRemove} style={styles.action} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>Check-in</Text>
          <TextInput
            value={checkIn}
            onChangeText={(text) => {
              setCheckIn(text);
              setProblem("");
            }}
            placeholder="09:00"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            editable={!saving}
            style={styles.input}
          />

          <Text style={styles.label}>Check-out (optional)</Text>
          <TextInput
            value={checkOut}
            onChangeText={(text) => {
              setCheckOut(text);
              setProblem("");
            }}
            placeholder="17:00"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            editable={!saving}
            style={styles.input}
          />

          {shown ? <Text style={styles.error}>{shown}</Text> : null}

          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onCancel} disabled={saving} style={styles.action} />
            <Button title="Save" loading={saving} onPress={handleSave} style={styles.action} />
          </View>

          {saved ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setConfirmingRemove(true)}
              disabled={saving}
              style={({ pressed }) => [styles.remove, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.removeText}>Remove record</Text>
            </Pressable>
          ) : null}
        </>
      )}
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
  confirmText: { marginTop: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  remove: { alignItems: "center", paddingVertical: spacing.md, marginTop: spacing.xs },
  removeText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
});
