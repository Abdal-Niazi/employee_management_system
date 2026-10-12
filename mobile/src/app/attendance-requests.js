import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { decideCorrection, getCorrectionRequests } from "../api/hr";
import CorrectionCard, { correctionChange } from "../components/CorrectionCard";
import DecisionModal from "../components/DecisionModal";
import SegmentedControl from "../components/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { colors, radius, spacing } from "../theme";
import { formatDay } from "../utils/date";

const FILTERS = [
  { value: "PENDING", label: "Waiting" },
  { value: "ALL", label: "All" },
];

// The popup's two lines for a correction: whose day, and what changes.
const correctionLines = (correction) => {
  const { from, to } = correctionChange(correction);
  return [`${correction.employeeName} · ${formatDay(correction.date)}`, `${from} → ${to}`];
};

// HR admins decide the attendance corrections managers ask for. Approving changes the record.
export default function AttendanceRequestsScreen() {
  const [filter, setFilter] = useState("PENDING");
  const load = useCallback(() => getCorrectionRequests(filter === "ALL" ? undefined : filter), [filter]);
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

  const openDecision = (correction, decision) => {
    setDecisionError(null);
    setPendingDecision({ correction, decision });
  };

  const confirmDecision = async (note) => {
    setSubmitting(true);
    setDecisionError(null);
    try {
      const updated = await decideCorrection(pendingDecision.correction.id, pendingDecision.decision, note);
      setPendingDecision(null);
      setToast(`${updated.status === "APPROVED" ? "Approved" : "Rejected"}: ${updated.employeeName}, ${formatDay(updated.date)}`);
      revalidate();
    } catch (e) {
      setDecisionError(e.message);
      // Someone else decided it meanwhile: show the list as it is now.
      if (e.status === 409) revalidate();
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
        keyExtractor={(c) => String(c.id)}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={
          toast ? (
            <View style={styles.toast} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          filter === "PENDING" ? (
            <EmptyState
              icon="checkmark-done-outline"
              title="Nothing waiting"
              message="Managers' correction requests show up here."
            />
          ) : (
            <EmptyState icon="document-text-outline" title="No requests yet" />
          )
        }
        renderItem={({ item }) => (
          <CorrectionCard
            correction={item}
            showRequester
            onApprove={(c) => openDecision(c, "APPROVED")}
            onReject={(c) => openDecision(c, "REJECTED")}
          />
        )}
      />
    );

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      {body}

      <DecisionModal
        request={pendingDecision?.correction}
        decision={pendingDecision?.decision}
        what="correction"
        lines={correctionLines}
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.md,
  },
  content: { padding: spacing.lg, flexGrow: 1 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  toastText: { flex: 1, color: colors.success, fontWeight: "600" },
});
