import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { decideLeave, getLeaveRequests } from "../../api/manager";
import DecisionModal from "../../components/DecisionModal";
import LeaveCard from "../../components/LeaveCard";
import SampleDataBadge from "../../components/SampleDataBadge";
import SegmentedControl from "../../components/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { colors, radius, spacing } from "../../theme";
import { statusInfo } from "../../utils/status";

const FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const EMPTY = {
  PENDING: { icon: "checkmark-done-outline", title: "You're all caught up", message: "No leave requests are waiting for you." },
  APPROVED: { icon: "airplane-outline", title: "No approved requests", message: "Approved leave will show up here." },
  REJECTED: { icon: "close-circle-outline", title: "No rejected requests", message: "Rejected leave will show up here." },
};

export default function LeaveScreen() {
  const [filter, setFilter] = useState("PENDING");
  const load = useCallback(() => getLeaveRequests(filter), [filter]);
  const { status, data, error, reload, refresh, revalidate, refreshing } = useAsync(load);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openDecision = (request, decision) => {
    setDecisionError(null);
    setPendingDecision({ request, decision });
  };

  const confirmDecision = async (note) => {
    setSubmitting(true);
    setDecisionError(null);
    try {
      const updated = await decideLeave(pendingDecision.request.id, pendingDecision.decision, note);
      setPendingDecision(null);
      setToast({ status: updated.status, text: `${statusInfo(updated.status).label} leave for ${updated.employeeName}` });
      revalidate();
    } catch (e) {
      setDecisionError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  let body;
  if (status === "loading") body = <LoadingState label="Loading requests…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(r) => r.id}
        refreshing={refreshing}
        onRefresh={refresh}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={<EmptyState {...EMPTY[filter]} />}
        renderItem={({ item }) => (
          <LeaveCard
            request={item}
            onApprove={(r) => openDecision(r, "APPROVED")}
            onReject={(r) => openDecision(r, "REJECTED")}
          />
        )}
      />
    );

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
        <SampleDataBadge />
        {toast && (
          <View style={[styles.toast, toast.status === "REJECTED" && styles.toastDanger]} accessibilityLiveRegion="polite">
            <Ionicons
              name={toast.status === "REJECTED" ? "close-circle" : "checkmark-circle"}
              size={18}
              color={toast.status === "REJECTED" ? colors.danger : colors.success}
            />
            <Text style={[styles.toastText, toast.status === "REJECTED" && { color: colors.danger }]}>{toast.text}</Text>
          </View>
        )}
      </View>
      {body}

      <DecisionModal
        request={pendingDecision?.request}
        decision={pendingDecision?.decision}
        submitting={submitting}
        error={decisionError}
        onCancel={() => setPendingDecision(null)}
        onConfirm={confirmDecision}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  toolbar: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  content: { padding: spacing.lg, flexGrow: 1 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  toastDanger: { backgroundColor: colors.dangerSoft },
  toastText: { flex: 1, color: colors.success, fontWeight: "600" },
});
