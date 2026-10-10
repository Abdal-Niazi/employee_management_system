import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { checkIn, checkOut, getMyDay } from "../api/me";
import { useAsync } from "../hooks/useAsync";
import { colors, font, radius, spacing } from "../theme";
import { formatDay } from "../utils/date";
import Button from "./Button";
import Card from "./Card";
import CorrectionTag from "./CorrectionTag";
import StatusPill from "./StatusPill";

// The signed-in person's own day: check in, check out, or why neither is possible. Shown on the
// employee's Today tab and on the manager's Overview. The server's clock sets the times, and the
// server decides what is allowed, so the buttons only follow canCheckIn / canCheckOut.
export default function CheckInCard({ title = "Your attendance today" }) {
  const { status, data, error, reload, revalidate } = useAsync(getMyDay);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState(null);

  // After an action (or a refusal, e.g. already checked in on another phone) reload the day,
  // so the card always shows what the server has.
  const act = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
      setConfirming(false);
    } catch (e) {
      setActionError(e.message);
    }
    await revalidate();
    setBusy(false);
  };

  if (status === "loading") {
    return (
      <Card title={title}>
        <ActivityIndicator color={colors.primary} />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card title={title}>
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Retry" icon="refresh" variant="outline" onPress={reload} style={styles.action} />
      </Card>
    );
  }

  const { today, workday, shift, record, canCheckIn, canCheckOut, notice } = data;
  const done = Boolean(record.checkIn && record.checkOut);

  return (
    <Card title={title} right={<StatusPill status={record.status} />}>
      <Text style={font.small}>
        {formatDay(today)}
        {workday ? ` · Shift ${shift.start}–${shift.end}` : ""}
      </Text>

      {record.checkIn && (
        <Text style={styles.times}>
          In {record.checkIn} · {record.checkOut ? `Out ${record.checkOut}` : "not checked out yet"}
        </Text>
      )}
      <CorrectionTag correction={record.correction} />

      {notice && !record.checkIn && (
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.muted} />
          <Text style={[font.body, styles.flex]}>{notice}</Text>
        </View>
      )}

      {canCheckIn && (
        <Button
          title="Check in"
          icon="log-in-outline"
          loading={busy}
          onPress={() => act(checkIn)}
          style={styles.action}
        />
      )}

      {canCheckOut && !confirming && (
        <Button
          title="Check out"
          icon="log-out-outline"
          variant="outline"
          disabled={busy}
          onPress={() => setConfirming(true)}
          style={styles.action}
        />
      )}

      {/* A check-out can't be undone (only HR can fix it), so it asks once more. */}
      {canCheckOut && confirming && (
        <View style={styles.confirm}>
          <Text style={font.body}>Check out now? This ends your day.</Text>
          <View style={styles.row}>
            <Button
              title="Cancel"
              variant="outline"
              disabled={busy}
              onPress={() => setConfirming(false)}
              style={styles.flex}
            />
            <Button
              title="Check out"
              icon="log-out-outline"
              loading={busy}
              onPress={() => act(checkOut)}
              style={styles.flex}
            />
          </View>
        </View>
      )}

      {done && (
        <View style={styles.notice}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[styles.doneText, styles.flex]}>Done for today</Text>
        </View>
      )}

      {actionError && <Text style={styles.error}>{actionError}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  times: { fontSize: 17, fontWeight: "600", color: colors.text, marginTop: spacing.sm },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  doneText: { color: colors.success, fontWeight: "600" },
  action: { marginTop: spacing.md },
  confirm: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
