import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getMyAttendance, getMyProfile } from "../../api/me";
import Avatar from "../../components/Avatar";
import Card from "../../components/Card";
import { ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import TodayCard from "../../components/TodayCard";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, spacing } from "../../theme";
import { formatIsoDate } from "../../utils/date";
import { fullName } from "../../utils/status";

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={font.small}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

// The profile and today's attendance, which the Today card needs.
async function loadHome() {
  const [employee, [today]] = await Promise.all([getMyProfile(), getMyAttendance(1)]);
  return { employee, today };
}

export default function ProfileScreen() {
  const { status, data, error, reload, refresh, revalidate, refreshing } = useAsync(loadHome);

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  const { employee, today } = data;
  const { manager } = employee;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <TodayCard today={today} onChange={revalidate} />

      <Card>
        <View style={styles.profile}>
          <Avatar firstName={employee.firstName} lastName={employee.lastName} size={64} />
          <View style={styles.flex}>
            <Text style={font.title}>{fullName(employee)}</Text>
            <Text style={font.small}>
              {[employee.position, employee.department].filter(Boolean).join(" · ") || "No position set"}
            </Text>
            <View style={styles.pill}>
              <StatusPill status={employee.status} />
            </View>
          </View>
        </View>
      </Card>

      <Card title="Details">
        <DetailRow label="Employee ID" value={employee.employeeId} />
        <DetailRow label="Email" value={employee.email} />
        <DetailRow label="Phone" value={employee.phone} />
        <DetailRow label="Department" value={employee.department} />
        <DetailRow label="Position" value={employee.position} />
        <DetailRow label="Hire date" value={formatIsoDate(employee.hireDate)} />
      </Card>

      <Card title="Reports to">
        {manager ? (
          <View style={styles.profile}>
            <Avatar firstName={manager.firstName} lastName={manager.lastName} size={40} />
            <View style={styles.flex}>
              <Text style={font.body}>{fullName(manager)}</Text>
              <Text style={font.small}>{manager.position || manager.employeeId}</Text>
            </View>
          </View>
        ) : (
          <Text style={font.small}>No manager assigned yet. Ask HR, since your leave requests go to your manager.</Text>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  pill: { marginTop: spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailValue: { flex: 1, textAlign: "right", fontSize: 15, color: colors.text },
});
