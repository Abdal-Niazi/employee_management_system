import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getTeamAttendance } from "../../api/manager";
import Avatar from "../../components/Avatar";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { addDays, formatDay, isWeekend, relativeDayLabel, todayKey } from "../../utils/date";
import { fullName } from "../../utils/status";

const SUMMARY = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

function describe(record) {
  switch (record.status) {
    case "PRESENT":
    case "LATE":
      return `In ${record.checkIn} · Out ${record.checkOut ?? "—"}`;
    case "ON_LEAVE":
      return "Approved leave";
    case "ABSENT":
      return "No check-in";
    case "NOT_IN":
      return `Shift starts ${record.shift.start}`;
    default:
      return "No shift";
  }
}

function DateNav({ date, shift, onChange }) {
  const isToday = date === todayKey();
  const label = relativeDayLabel(date);
  const subtitle = label === formatDay(date) ? "" : `${formatDay(date)} · `;
  return (
    <View style={styles.dateNav}>
      <Pressable
        accessibilityLabel="Previous day"
        onPress={() => onChange(addDays(date, -1))}
        style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.dateLabel}>
        <Text style={font.heading}>{label}</Text>
        <Text style={font.small}>
          {subtitle}
          {shift ? `Shift ${shift.start}–${shift.end}` : ""}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Next day"
        disabled={isToday}
        onPress={() => onChange(addDays(date, 1))}
        style={({ pressed }) => [styles.navButton, (pressed || isToday) && { opacity: 0.35 }]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

export default function AttendanceScreen() {
  const [date, setDate] = useState(todayKey);
  const load = useCallback(() => getTeamAttendance(date), [date]);
  const { status, data, error, reload, refresh, refreshing } = useAsync(load);

  let body;
  if (status === "loading") body = <LoadingState label="Loading attendance…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={isWeekend(date) ? [] : data.rows}
        keyExtractor={(row) => row.employee.employeeId}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          <View style={styles.header}>
            {!isWeekend(date) && (
              <View style={styles.summary}>
                {SUMMARY.map((key) => (
                  <View key={key} style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{data.counts[key]}</Text>
                    <StatusPill status={key} />
                  </View>
                ))}
              </View>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          isWeekend(date) ? (
            <EmptyState icon="cafe-outline" title="Weekend" message="No shift is scheduled on this day." />
          ) : (
            <EmptyState icon="people-outline" title="No team members yet" />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar firstName={item.employee.firstName} lastName={item.employee.lastName} size={36} />
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName(item.employee)}
              </Text>
              <Text style={font.small}>{describe(item.record)}</Text>
            </View>
            <StatusPill status={item.record.status} />
          </View>
        )}
      />
    );

  return (
    <View style={styles.screen}>
      <DateNav date={date} shift={data?.shift} onChange={setDate} />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: { flex: 1, alignItems: "center" },
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
