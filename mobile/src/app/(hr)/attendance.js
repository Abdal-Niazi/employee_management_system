import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getAttendanceDay, removeAttendance, saveAttendance } from "../../api/hr";
import AttendanceSheet from "../../components/AttendanceSheet";
import Avatar from "../../components/Avatar";
import DayNav from "../../components/DayNav";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { ATTENDANCE_SUMMARY, describeRecord } from "../../utils/attendance";
import { formatDay, todayKey } from "../../utils/date";
import { fullName } from "../../utils/status";

export default function HrAttendanceScreen() {
  const [date, setDate] = useState(todayKey);
  const load = useCallback(() => getAttendanceDay(date), [date]);
  const { status, data, error, reload, refresh, refreshing, revalidate } = useAsync(load);

  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const close = () => {
    setSelected(null);
    setSaveError("");
  };

  // Runs a save or a remove, then closes the sheet and reloads the day.
  const run = async (action) => {
    setSaving(true);
    setSaveError("");
    try {
      await action();
      close();
      revalidate();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = ({ checkIn, checkOut }) =>
    run(() => saveAttendance({ employeeId: selected.employee.id, date, checkIn, checkOut }));
  const handleRemove = () => run(() => removeAttendance(selected.employee.id, date));

  let body;
  if (status === "loading") body = <LoadingState label="Loading attendance…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={data.rows}
        keyExtractor={(row) => String(row.employee.id)}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.summary}>
              {ATTENDANCE_SUMMARY.map((key) => (
                <View key={key} style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{data.counts[key]}</Text>
                  <StatusPill status={key} />
                </View>
              ))}
            </View>
            <Text style={font.small}>Tap a person to write or correct their check-in.</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="No employees yet" message="Add employees first, then record their attendance." />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setSelected(item)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
            <Avatar firstName={item.employee.firstName} lastName={item.employee.lastName} size={36} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName(item.employee)}
              </Text>
              <Text style={font.small}>{describeRecord(item.record)}</Text>
            </View>
            <StatusPill status={item.record.status} />
            <Ionicons name="create-outline" size={18} color={colors.muted} />
          </Pressable>
        )}
      />
    );

  return (
    <View style={styles.screen}>
      <DayNav date={date} shift={data?.shift} onChange={setDate} />
      {body}
      <AttendanceSheet
        row={selected}
        dateLabel={formatDay(date)}
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
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  summaryItem: { alignItems: "center", gap: spacing.xs },
  summaryValue: { fontSize: 20, fontWeight: "700", color: colors.text },
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
