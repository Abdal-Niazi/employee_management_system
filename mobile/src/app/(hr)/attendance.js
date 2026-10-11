import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getAttendanceDay, getCorrectionRequests, removeAttendance, saveAttendance } from "../../api/hr";
import AttendanceSheet from "../../components/AttendanceSheet";
import AttendanceSummary from "../../components/AttendanceSummary";
import Avatar from "../../components/Avatar";
import CorrectionTag from "../../components/CorrectionTag";
import DayNav from "../../components/DayNav";
import LinkRow from "../../components/LinkRow";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { describeRecord } from "../../utils/attendance";
import { formatDay } from "../../utils/date";
import { fullName } from "../../utils/status";

// Everyone's attendance for one day. HR writes, fixes or removes a day directly (kept in the
// history), and decides the corrections managers ask for.
export default function HrAttendanceScreen() {
  const router = useRouter();
  // Starts empty: the first load sends no date, so the server answers with its own today.
  const [date, setDate] = useState(null);
  const load = useCallback(async () => {
    const [day, waiting] = await Promise.all([getAttendanceDay(date), getCorrectionRequests("PENDING")]);
    return { ...day, waiting: waiting.length };
  }, [date]);
  const { status, data, error, reload, refresh, refreshing, revalidate } = useAsync(load);
  // While a new day loads, keep showing the day that was picked.
  const shown = date ?? data?.date ?? null;
  const today = data?.today ?? null;

  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const close = () => {
    setSelected(null);
    setSaveError("");
  };

  // Runs a save or a remove, then closes the sheet and reloads the day.
  const run = async (action, done) => {
    setSaving(true);
    setSaveError("");
    try {
      await action();
      setToast(`${done}: ${fullName(selected.employee)}, ${formatDay(shown)}`);
      close();
      revalidate();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = ({ checkIn, checkOut, note }) =>
    run(() => saveAttendance({ employeeId: selected.employee.id, date: shown, checkIn, checkOut, note }), "Saved");
  const handleRemove = (note) => run(() => removeAttendance(selected.employee.id, shown, note), "Check-in removed");

  let body;
  if (status === "loading") body = <LoadingState label="Loading attendance…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={data.workday ? data.rows : []}
        keyExtractor={(row) => String(row.employee.id)}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.header}>
            {toast && (
              <View style={styles.toast} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={styles.toastText}>{toast}</Text>
              </View>
            )}
            {data.workday && <AttendanceSummary counts={data.counts} />}
            <LinkRow
              icon="document-text-outline"
              label="Requests from managers"
              count={data.waiting}
              onPress={() => router.push("/attendance-requests")}
            />
            {data.workday && data.rows.length > 0 && (
              <Text style={font.small}>Tap a person to write, fix or remove their check-in.</Text>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          data.workday ? (
            <EmptyState icon="people-outline" title="No employees yet" message="Add employees on the Employees tab." />
          ) : (
            <EmptyState icon="cafe-outline" title="Weekend" message="No shift is scheduled on this day." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={!item.record.editable}
            onPress={() => {
              setSaveError("");
              setSelected(item);
            }}
            accessibilityRole={item.record.editable ? "button" : undefined}
            accessibilityHint={item.record.editable ? "Write or fix this day's check-in" : undefined}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
          >
            <Avatar firstName={item.employee.firstName} lastName={item.employee.lastName} size={36} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName(item.employee)}
              </Text>
              <Text style={font.small}>{describeRecord(item.record, data.shift)}</Text>
              <CorrectionTag correction={item.record.correction} />
            </View>
            <StatusPill status={item.record.status} />
            {item.record.editable && <Ionicons name="create-outline" size={18} color={colors.muted} />}
          </Pressable>
        )}
      />
    );

  return (
    <View style={styles.screen}>
      {shown && <DayNav date={shown} today={today} shift={data?.shift} onChange={setDate} />}
      {body}
      <AttendanceSheet
        row={selected}
        dateLabel={shown ? formatDay(shown) : ""}
        saving={saving}
        error={saveError}
        onCancel={close}
        onSave={handleSave}
        onRemove={handleRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.md },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toastText: { flex: 1, color: colors.success, fontWeight: "600" },
  separator: { height: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
});
