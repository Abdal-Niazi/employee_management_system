import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { approveEmployeeDevice, getEmployeeDevice, resetEmployeeDevice } from "../api/hr";
import { useAsync } from "../hooks/useAsync";
import { colors, font, radius, spacing } from "../theme";
import { formatMoment } from "../utils/date";
import Button from "./Button";
import Card from "./Card";
import ConfirmModal from "./ConfirmModal";

const PLATFORM = { android: "Android phone", ios: "iPhone" };

// What each confirmation says. Approving lets that phone check in for the person, so HR should
// only approve a phone the person showed them.
const CONFIRM = {
  approve: {
    title: "Approve this phone?",
    message: (name) =>
      `${name} can then check in from it. Approve it only if ${name} showed you this phone, so nobody else registered it for them.`,
    label: "Approve",
    danger: false,
  },
  reject: {
    title: "Reject this phone?",
    message: (name) => `The waiting phone is removed. ${name} can register a phone again.`,
    label: "Reject",
    danger: true,
  },
  reset: {
    title: "Reset this phone?",
    message: (name) => `${name} can't check in from it any more, and registers their new phone, which you approve again.`,
    label: "Reset phone",
    danger: true,
  },
};

function Line({ label, value }) {
  return (
    <View style={styles.line}>
      <Text style={font.small}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// HR, on an employee's page: the phone they check in from. A new phone waits here until HR approves
// it; HR rejects a phone that isn't theirs, and resets a lost or replaced one.
export default function PhoneCard({ employeeId, name }) {
  const load = useCallback(() => getEmployeeDevice(employeeId), [employeeId]);
  const { status, data: device, error, reload, revalidate } = useAsync(load);
  const [asking, setAsking] = useState(null); // "approve" | "reject" | "reset"
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const open = (what) => {
    setActionError("");
    setAsking(what);
  };

  const handleConfirm = async () => {
    setBusy(true);
    setActionError("");
    try {
      if (asking === "approve") await approveEmployeeDevice(employeeId, device.registeredAt);
      else await resetEmployeeDevice(employeeId);
      setAsking(null);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
      // Also after a refusal (say the phone changed meanwhile), so the card shows what is there now
      revalidate();
    }
  };

  let body;
  if (status === "loading") body = <ActivityIndicator color={colors.primary} />;
  else if (status === "error")
    body = (
      <>
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Retry" icon="refresh" variant="outline" onPress={reload} />
      </>
    );
  else if (!device)
    body = <Text style={font.body}>No phone registered. {name} registers one from the Today tab on their phone.</Text>;
  else {
    const kind = PLATFORM[device.platform] ?? "Phone";
    body = (
      <>
        {device.status === "PENDING" ? (
          <View style={[styles.banner, styles.waiting]}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={[font.body, styles.flex]}>Waiting for your approval</Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.approved]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[font.body, styles.flex]}>Approved: {name} checks in from this phone</Text>
          </View>
        )}
        <Line label="Phone" value={kind} />
        <Line label="Registered" value={formatMoment(device.registeredAt)} />
        {device.approvedAt && (
          <Line label="Approved" value={`${formatMoment(device.approvedAt)}${device.approvedBy ? ` by ${device.approvedBy}` : ""}`} />
        )}
        {device.status === "APPROVED" && (
          <Line label="Last check-in or out" value={device.lastUsedAt ? formatMoment(device.lastUsedAt) : "Not used yet"} />
        )}

        {device.status === "PENDING" ? (
          <View style={styles.row}>
            <Button title="Reject" icon="close" variant="outline" onPress={() => open("reject")} style={styles.flex} />
            <Button title="Approve" icon="checkmark" onPress={() => open("approve")} style={styles.flex} />
          </View>
        ) : (
          <Button title="Reset phone" icon="refresh" variant="outline" onPress={() => open("reset")} />
        )}
      </>
    );
  }

  const confirm = asking && CONFIRM[asking];

  return (
    <Card title="Check-in phone">
      <View style={styles.body}>{body}</View>
      <ConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm ? confirm.message(name) : ""}
        confirmLabel={confirm?.label ?? ""}
        danger={confirm?.danger}
        submitting={busy}
        error={actionError}
        onCancel={() => setAsking(null)}
        onConfirm={handleConfirm}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  flex: { flex: 1 },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  waiting: { backgroundColor: colors.warningSoft },
  approved: { backgroundColor: colors.successSoft },
  line: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  value: { flex: 1, textAlign: "right", fontSize: 15, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
});
