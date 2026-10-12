import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getTeamAttendance, requestCorrection } from "../../api/manager";
import AttendanceSummary from "../../components/AttendanceSummary";
import Avatar from "../../components/Avatar";
import CorrectionModal from "../../components/CorrectionModal";
import CorrectionTag from "../../components/CorrectionTag";
import DayNav from "../../components/DayNav";
import LinkRow from "../../components/LinkRow";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { describeRecord } from "../../utils/attendance";
import { fullName } from "../../utils/status";

export default function AttendanceScreen() {
  const router = useRouter();
  // Starts empty: the first load sends no date, so the server answers with its own today.
  const [date, setDate] = useState(null);
  const load = useCallback(() => getTeamAttendance(date), [date]);
  const { status, data, error, reload, refresh, revalidate, refreshing } = useAsync(load);
  // While a new day loads, keep showing the day that was picked.
  const shown = date ?? data?.date ?? null;
  const today = data?.today ?? null;
  const [target, setTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openCorrection = (row) => {
    setSendError(null);
    setTarget(row);
  };

  const sendCorrection = async (body) => {
    setSubmitting(true);
    setSendError(null);
    try {
      await requestCorrection(body);
      setToast(`Sent to HR: correction for ${fullName(target.employee)}`);
      setTarget(null);
      revalidate();
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (status === "loading") body = <LoadingState label="Loading attendance…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else {
    const canCorrect = data.rows.some((row) => row.record.correctable);
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
              label="My correction requests"
              onPress={() => router.push("/corrections")}
            />
            {data.workday && canCorrect && (
              <Text style={font.small}>Wrong time? Tap a person to ask HR for a correction.</Text>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          data.workday ? (
            <EmptyState icon="people-outline" title="No team members yet" />
          ) : (
            <EmptyState icon="cafe-outline" title="Weekend" message="No shift is scheduled on this day." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            disabled={!item.record.correctable}
            onPress={() => openCorrection(item)}
            accessibilityRole={item.record.correctable ? "button" : undefined}
            accessibilityHint={item.record.correctable ? "Ask HR to correct this day" : undefined}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
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
          </Pressable>
        )}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {shown && <DayNav date={shown} today={today} shift={data?.shift} onChange={setDate} />}
      {body}

      <CorrectionModal
        target={target}
        date={shown}
        today={today}
        submitting={submitting}
        error={sendError}
        onCancel={() => setTarget(null)}
        onSubmit={sendCorrection}
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
