import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { getOverview } from "../../api/manager";
import { useAuth } from "../../auth/AuthContext";
import Button from "../../components/Button";
import Card from "../../components/Card";
import CheckInCard from "../../components/CheckInCard";
import { leaveSummary } from "../../components/LeaveCard";
import { ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { formatDay } from "../../utils/date";

const BREAKDOWN = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE", "NOT_IN"];

function Stat({ icon, label, value, onPress, hint }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      // Screen readers say "Team members, 4, button" and where a tap goes.
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.stat, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={font.small}>{label}</Text>
    </Pressable>
  );
}

export default function OverviewScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { status, data, error, reload, refresh, refreshing } = useAsync(getOverview);

  if (status === "loading") return <LoadingState />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  const { date, teamSize, workday, counts, pending } = data;
  const checkedIn = counts.PRESENT + counts.LATE;
  // People expected at work today: not those on leave, inactive, or not hired yet.
  const expected = checkedIn + counts.ABSENT + counts.NOT_IN;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View>
        <Text style={font.small}>{formatDay(date)}</Text>
        <Text style={font.title}>Welcome back, {user.name || user.email.split("@")[0]}</Text>
      </View>

      {/* Managers are employees too: they check themselves in here. */}
      <CheckInCard />

      <View style={styles.stats}>
        <Stat
          icon="people-outline"
          label="Team members"
          value={teamSize}
          onPress={() => router.navigate("/team")}
          hint="Opens your team"
        />
        <Stat
          icon="checkmark-circle-outline"
          label="Checked in today"
          value={workday ? `${checkedIn}/${expected}` : String(checkedIn)}
          onPress={() => router.navigate("/attendance")}
          hint="Opens attendance"
        />
        <Stat
          icon="alarm-outline"
          label="Late today"
          value={workday ? counts.LATE : "—"}
          onPress={() => router.navigate("/attendance")}
          hint="Opens attendance"
        />
        <Stat
          icon="hourglass-outline"
          label="Pending leave"
          value={pending.length}
          onPress={() => router.navigate("/leave")}
          hint="Opens leave requests"
        />
      </View>

      <Card title="Today's attendance">
        {!workday ? (
          <Text style={font.small}>
            No shift scheduled today.
            {checkedIn > 0 ? ` ${checkedIn} of your team worked anyway.` : ""}
          </Text>
        ) : (
          <View style={styles.breakdown}>
            {BREAKDOWN.map((key) => (
              <View key={key} style={styles.breakdownItem}>
                <Text style={styles.breakdownValue}>{counts[key]}</Text>
                <StatusPill status={key} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card title="Needs your attention">
        {pending.length === 0 ? (
          <Text style={font.small}>No pending leave requests — you&apos;re all caught up.</Text>
        ) : (
          <View style={styles.list}>
            {pending.slice(0, 3).map((request) => (
              <Pressable
                key={request.id}
                onPress={() => router.navigate("/leave")}
                accessibilityRole="button"
                accessibilityHint="Opens leave requests"
                style={({ pressed }) => [styles.pendingRow, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.flex}>
                  <Text style={styles.pendingName}>{request.employeeName}</Text>
                  <Text style={font.small}>
                    {request.type} · {leaveSummary(request)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            <Button
              title={pending.length > 3 ? `Review all ${pending.length} requests` : "Review requests"}
              variant="outline"
              onPress={() => router.navigate("/leave")}
            />
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  stat: {
    flexGrow: 1,
    flexBasis: "45%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 2,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: colors.text },
  breakdown: { flexDirection: "row", flexWrap: "wrap", gap: spacing.lg },
  breakdownItem: { alignItems: "flex-start", gap: spacing.xs },
  breakdownValue: { fontSize: 20, fontWeight: "700", color: colors.text },
  list: { gap: spacing.md },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pendingName: { fontSize: 15, fontWeight: "600", color: colors.text },
  flex: { flex: 1 },
});
