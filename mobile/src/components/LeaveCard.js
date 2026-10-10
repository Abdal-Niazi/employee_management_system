import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../theme";
import { formatRange, timeAgo } from "../utils/date";
import { statusInfo } from "../utils/status";
import Button from "./Button";
import Card from "./Card";
import StatusPill from "./StatusPill";

export function leaveSummary(request) {
  const days = `${request.days} day${request.days === 1 ? "" : "s"}`;
  return `${formatRange(request.startDate, request.endDate)} · ${days}`;
}

export default function LeaveCard({ request, onApprove, onReject, onCancel, showName = true, showManager = false }) {
  const pending = request.status === "PENDING";

  return (
    <Card>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          {showName && <Text style={font.heading}>{request.employeeName}</Text>}
          <Text style={showName ? font.small : font.heading}>
            {request.type} leave{showName && request.department ? ` · ${request.department}` : ""}
          </Text>
        </View>
        <StatusPill status={request.status} />
      </View>

      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color={colors.muted} />
        <Text style={font.body}>{leaveSummary(request)}</Text>
      </View>
      {request.reason ? <Text style={[font.body, styles.reason]}>“{request.reason}”</Text> : <View style={styles.noReason} />}

      {showManager && (
        <Text style={[font.small, !request.managerName && styles.noManager]}>
          {request.managerName ? `Manager: ${request.managerName}` : "No manager assigned, so HR decides"}
        </Text>
      )}

      <Text style={font.small}>
        Requested {timeAgo(request.requestedAt)}
        {!pending && ` · ${statusInfo(request.status).label} ${timeAgo(request.decidedAt)}`}
        {!pending && request.decidedBy ? ` by ${request.decidedBy}` : ""}
      </Text>
      {request.decisionNote && <Text style={[font.small, styles.note]}>Note: {request.decisionNote}</Text>}

      {pending && onCancel && (
        <View style={styles.actions}>
          <Button title="Cancel request" icon="close" variant="danger" onPress={() => onCancel(request)} style={styles.action} />
        </View>
      )}

      {pending && onApprove && onReject && (
        <View style={styles.actions}>
          <Button title="Reject" icon="close" variant="danger" onPress={() => onReject(request)} style={styles.action} />
          <Button title="Approve" icon="checkmark" variant="success" onPress={() => onApprove(request)} style={styles.action} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  titleBlock: { flex: 1, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  reason: { color: colors.muted, fontStyle: "italic", marginVertical: spacing.sm },
  noReason: { height: spacing.sm },
  noManager: { color: colors.warning, fontWeight: "600" },
  note: { marginTop: spacing.xs, color: colors.text },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
});
