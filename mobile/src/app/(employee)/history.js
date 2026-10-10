import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getMyAttendance } from "../../api/me";
import CorrectionTag from "../../components/CorrectionTag";
import SegmentedControl from "../../components/SegmentedControl";
import { ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { relativeDayLabel, timeRange } from "../../utils/date";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

const SUMMARY = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

export default function MyAttendanceScreen() {
  const [days, setDays] = useState(7);
  const load = useCallback(() => getMyAttendance(days), [days]);
  const { status, data, error, reload, refresh, refreshing } = useAsync(load);

  let body;
  if (status === "loading") body = <LoadingState label="Loading attendance…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else {
    const { today, records } = data;
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={records}
        keyExtractor={(record) => record.date}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.summary}>
            {SUMMARY.map((key) => (
              <View key={key} style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{records.filter((r) => r.status === key).length}</Text>
                <StatusPill status={key} />
              </View>
            ))}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text style={font.body}>{relativeDayLabel(item.date, today)}</Text>
              <CorrectionTag correction={item.correction} />
            </View>
            <Text style={font.small}>{timeRange(item.checkIn, item.checkOut)}</Text>
            <StatusPill status={item.status} />
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <SegmentedControl options={RANGES} value={days} onChange={setDays} />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  toolbar: {
    padding: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: { padding: spacing.lg, flexGrow: 1 },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
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
});
