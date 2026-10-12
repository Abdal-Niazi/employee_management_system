import { FlatList, StyleSheet, Text, View } from "react-native";
import { getMyAttendance } from "../../api/me";
import { ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { ATTENDANCE_SUMMARY, describeRecord } from "../../utils/attendance";
import { relativeDayLabel } from "../../utils/date";

const loadAttendance = () => getMyAttendance(14);

export default function MyAttendanceScreen() {
  const { status, data, error, reload, refresh, refreshing } = useAsync(loadAttendance);

  if (status === "loading") return <LoadingState label="Loading attendance…" />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  const counts = Object.fromEntries(ATTENDANCE_SUMMARY.map((key) => [key, data.filter((r) => r.status === key).length]));

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(record) => record.date}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.summary}>
            {ATTENDANCE_SUMMARY.map((key) => (
              <View key={key} style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{counts[key]}</Text>
                <StatusPill status={key} />
              </View>
            ))}
          </View>
          <Text style={font.small}>The last 14 days. HR records your check-in and check-out.</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.day}>{relativeDayLabel(item.date)}</Text>
            <Text style={font.small}>{describeRecord(item)}</Text>
          </View>
          <StatusPill status={item.status} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  flex: { flex: 1 },
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
  day: { fontSize: 15, fontWeight: "600", color: colors.text },
});
