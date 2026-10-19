import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { getAttendanceReport, getAttendanceReportCsv } from "../api/hr";
import AttendanceSummary from "../components/AttendanceSummary";
import Avatar from "../components/Avatar";
import Button from "../components/Button";
import MonthNav from "../components/MonthNav";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { colors, font, radius, spacing } from "../theme";
import { formatDay, formatHours } from "../utils/date";
import { exportCsv } from "../utils/exportCsv";
import { fullName } from "../utils/status";

function Stat({ label, value, color }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </View>
  );
}

// HR: one month of everyone's attendance, counted per person (the same days the day screen shows),
// and the same table as a CSV file to open in a spreadsheet.
export default function AttendanceReportScreen() {
  // Starts empty: the first load sends no month, so the server answers with its own current month.
  const [month, setMonth] = useState(null);
  const load = useCallback(() => getAttendanceReport(month), [month]);
  const { status, data, error, reload, refresh, refreshing } = useAsync(load);
  // While a new month loads, keep showing the month that was picked.
  const shown = month ?? data?.month ?? null;
  const current = data?.today?.slice(0, 7) ?? null;

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      await exportCsv(`attendance-${shown}.csv`, await getAttendanceReportCsv(shown));
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  let body;
  if (status === "loading") body = <LoadingState label="Loading the report…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else {
    const { totals, rows } = data;
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(row) => String(row.employee.id)}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={font.small}>
              {data.partial ? `${formatDay(data.from)} to ${formatDay(data.to)}, so far` : "The whole month"} ·{" "}
              {data.workdays} working days
            </Text>
            <AttendanceSummary counts={totals.counts} />
            <Text style={font.small}>
              The counts above are person-days, everyone together. Hours worked: {formatHours(totals.workedMinutes)}
              {totals.openDays > 0 ? `. Days without a check-out: ${totals.openDays}` : ""}.
            </Text>
            <Button title="Export as CSV" icon="download-outline" variant="outline" loading={exporting} onPress={handleExport} />
            {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="No employees" message="Nobody was employed in this month." />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar firstName={item.employee.firstName} lastName={item.employee.lastName} size={36} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName(item.employee)}
              </Text>
              <Text style={font.small} numberOfLines={1}>
                {[item.employee.employeeId, item.employee.department].filter(Boolean).join(" · ")}
              </Text>
              <View style={styles.stats}>
                <Stat label="Present" value={item.counts.PRESENT} color={colors.success} />
                <Stat label="Late" value={item.counts.LATE} color={colors.warning} />
                <Stat label="Absent" value={item.counts.ABSENT} color={colors.danger} />
                <Stat label="Leave" value={item.counts.ON_LEAVE} color={colors.info} />
                <Stat label="Hours" value={(item.workedMinutes / 60).toFixed(1)} />
              </View>
              {item.openDays > 0 ? (
                <Text style={styles.warning}>
                  {item.openDays} {item.openDays === 1 ? "day" : "days"} without a check-out
                </Text>
              ) : null}
            </View>
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {shown && <MonthNav month={shown} current={current} onChange={setMonth} />}
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: spacing.md, marginBottom: spacing.md },
  separator: { height: spacing.sm },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  stats: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  stat: { alignItems: "flex-start" },
  statValue: { fontSize: 16, fontWeight: "700", color: colors.text },
  warning: { fontSize: 12, fontWeight: "600", color: colors.warning, marginTop: spacing.xs },
  error: { color: colors.danger, fontSize: 13 },
});
