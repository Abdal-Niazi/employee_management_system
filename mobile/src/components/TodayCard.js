import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { checkIn, checkOut } from "../api/me";
import { colors, font, spacing } from "../theme";
import { formatDay, todayKey } from "../utils/date";
import Button from "./Button";
import Card from "./Card";
import ConfirmModal from "./ConfirmModal";
import StatusPill from "./StatusPill";

// Today's check-in / check-out for the signed-in employee. The times come from the server's clock.
export default function TodayCard({ today, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingOut, setConfirmingOut] = useState(false);

  const checkedIn = Boolean(today.checkIn);
  const done = checkedIn && Boolean(today.checkOut);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setConfirmingOut(false);
      onChange();
    } catch (err) {
      setError(err.message);
      setConfirmingOut(false);
    } finally {
      setBusy(false);
    }
  };

  let message;
  if (done) message = `You're done for today. In ${today.checkIn} · Out ${today.checkOut}.`;
  else if (checkedIn) message = `You checked in at ${today.checkIn}. Don't forget to check out.`;
  else if (today.status === "ON_LEAVE") message = "You're on approved leave today.";
  else if (today.status === "OFF") message = "Today is a day off.";
  else message = `Your shift starts at ${today.shift.start}. You haven't checked in yet.`;

  return (
    <Card title="Today" right={<StatusPill status={today.status} />}>
      <Text style={font.small}>{formatDay(todayKey())}</Text>
      <Text style={[font.body, styles.message]}>{message}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!done && (
        <View style={styles.actions}>
          {checkedIn ? (
            <Button title="Check out" icon="log-out-outline" variant="outline" onPress={() => setConfirmingOut(true)} />
          ) : (
            <Button title="Check in" icon="log-in-outline" loading={busy} onPress={() => run(checkIn)} />
          )}
        </View>
      )}

      <ConfirmModal
        visible={confirmingOut}
        title="Check out now?"
        message="This ends your day. You can't check in again today."
        confirmLabel="Check out"
        submitting={busy}
        onCancel={() => setConfirmingOut(false)}
        onConfirm={() => run(checkOut)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  message: { marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.md },
  actions: { marginTop: spacing.lg },
});
