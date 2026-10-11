import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { formatDay, timeAgo, timeRange } from "../utils/date";
import Button from "./Button";
import StatusPill from "./StatusPill";

// What a correction changes: "09:40 – 17:30 → 09:00 – 17:00". Without a requested check-out
// the recorded one is kept.
export function correctionChange({ before, requested }) {
  const from = before ? timeRange(before.checkIn, before.checkOut) : "No check-in";
  return { from, to: timeRange(requested.checkIn, requested.checkOut ?? before?.checkOut) };
}

// One correction request. Managers see their own; HR also sees who asked, and decides pending ones.
export default function CorrectionCard({ correction, showRequester = false, onApprove, onReject }) {
  const pending = correction.status === "PENDING";
  const { from, to } = correctionChange(correction);

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.name}>{correction.employeeName}</Text>
          <Text style={font.small}>
            {formatDay(correction.date)} · asked {timeAgo(correction.requestedAt)}
            {showRequester && correction.requestedBy ? ` by ${correction.requestedBy}` : ""}
          </Text>
        </View>
        <StatusPill status={correction.status} />
      </View>

      <Text style={font.body}>
        {from} → <Text style={styles.strong}>{to}</Text>
      </Text>
      <Text style={font.small}>“{correction.reason}”</Text>

      {!pending && (
        <Text style={font.small}>
          {correction.status === "APPROVED" ? "Approved" : "Rejected"}
          {correction.decidedBy ? ` by ${correction.decidedBy}` : ""}
          {correction.decisionNote ? `: ${correction.decisionNote}` : ""}
        </Text>
      )}

      {pending && onApprove && onReject && (
        <View style={styles.actions}>
          <Button title="Reject" icon="close" variant="danger" onPress={() => onReject(correction)} style={styles.flex} />
          <Button
            title="Approve"
            icon="checkmark"
            variant="success"
            onPress={() => onApprove(correction)}
            style={styles.flex}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  top: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  strong: { fontWeight: "700" },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
