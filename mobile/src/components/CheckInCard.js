import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { checkIn, checkOut, getMyDay, registerDevice } from "../api/me";
import { useAuth } from "../auth/AuthContext";
import { confirmIdentity } from "../auth/confirmIdentity";
import { clearDeviceKey, loadDeviceKey, makeDeviceKey, saveDeviceKey } from "../auth/deviceKey";
import { useAsync } from "../hooks/useAsync";
import { colors, font, radius, spacing } from "../theme";
import { formatDay } from "../utils/date";
import Button from "./Button";
import Card from "./Card";
import CorrectionTag from "./CorrectionTag";
import StatusPill from "./StatusPill";

const isWeb = Platform.OS === "web";

function Notice({ icon = "information-circle-outline", color = colors.muted, children }) {
  return (
    <View style={styles.notice}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[font.body, styles.flex]}>{children}</Text>
    </View>
  );
}

// The signed-in person's own day: check in, check out, or why neither is possible. Shown on the
// employee's Today tab and on the manager's Overview. Check-in only works from the person's one
// registered phone, once HR has approved it, after its fingerprint/face (or PIN) prompt; the
// server's clock sets the times, and the server decides what is allowed, so the buttons only
// follow its answers.
export default function CheckInCard({ title = "Your attendance today" }) {
  const { user } = useAuth();
  const accountId = user.id;

  // Counts registrations, so a load that was already on its way when one started can't forget the
  // key that registration just saved.
  const registrations = useRef(0);

  const load = useCallback(async () => {
    const started = registrations.current;
    const deviceKey = await loadDeviceKey(accountId);
    const day = await getMyDay(deviceKey);
    // No phone is registered (HR reset or rejected it): the old key is useless, so forget it here
    // as well, and registering again makes a fresh one.
    if (!day.device && deviceKey && registrations.current === started) {
      await clearDeviceKey(accountId);
      return { ...day, deviceKey: null };
    }
    return { ...day, deviceKey };
  }, [accountId]);

  const { status, data, error, reload, revalidate, replace } = useAsync(load);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState(null);

  // An action returns the card's new state from the server's answer, so nothing is fetched again.
  // After a refusal (e.g. already checked in on another phone) the day is reloaded, so the card
  // shows what the server has. Cancelling the fingerprint prompt says nothing.
  const act = async (action) => {
    setBusy(true);
    setActionError(null);
    try {
      replace(await action());
      setConfirming(false);
    } catch (e) {
      if (!e.cancelled) {
        setActionError(e.message);
        await revalidate();
      }
    }
    setBusy(false);
  };

  // The day check-in or check-out answered, with this phone's state, which they don't change.
  const withDay = (day) => ({ ...data, ...day, device: data.device, deviceKey: data.deviceKey });

  const registerThisPhone = () =>
    act(async () => {
      await confirmIdentity("Confirm it's you to register this phone");
      registrations.current += 1;
      // Saved before it is sent: if the answer gets lost, a retry sends the same key.
      const key = data.deviceKey ?? makeDeviceKey();
      await saveDeviceKey(accountId, key);
      const device = await registerDevice(Platform.OS, key);
      return { ...data, device: { status: device.status, platform: device.platform, thisPhone: true }, deviceKey: key };
    });

  const doCheckIn = () =>
    act(async () => {
      await confirmIdentity("Confirm it's you to check in");
      return withDay(await checkIn(data.deviceKey));
    });

  const doCheckOut = () =>
    act(async () => {
      await confirmIdentity("Confirm it's you to check out");
      return withDay(await checkOut(data.deviceKey));
    });

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

  const { today, workday, shift, record, canCheckIn, canCheckOut, notice, device } = data;
  const done = Boolean(record.checkIn && record.checkOut);
  // The day allows an action; whether this phone may do it is checked separately.
  const wantsAction = canCheckIn || canCheckOut;
  const thisPhone = Boolean(device?.thisPhone);
  const onRegisteredPhone = !isWeb && device?.status === "APPROVED" && thisPhone;
  const registerButton = (label) => (
    <Button title={label} icon="finger-print" loading={busy} onPress={registerThisPhone} style={styles.action} />
  );

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

      {notice && !record.checkIn && <Notice>{notice}</Notice>}

      {/* Where check-in is allowed from */}
      {isWeb && wantsAction && (
        <Notice icon="phone-portrait-outline">Check-in works only in the EMS app on your registered phone.</Notice>
      )}
      {!isWeb && !device && (
        <>
          <Notice icon="phone-portrait-outline">
            You check in from one registered phone. Register this one to start; it asks for your fingerprint or
            face, and then HR approves it.
          </Notice>
          {registerButton("Register this phone")}
        </>
      )}
      {!isWeb && device?.status === "PENDING" && thisPhone && (
        <Notice icon="time-outline" color={colors.warning}>
          This phone is waiting for HR to approve it. Once they do, you can check in here.
        </Notice>
      )}
      {!isWeb && device?.status === "PENDING" && !thisPhone && (
        <>
          <Notice icon="alert-circle-outline" color={colors.warning}>
            Another phone is waiting for HR to approve it for your account. If that isn&apos;t yours, tell HR. To use
            this phone instead, register it.
          </Notice>
          {registerButton("Register this phone instead")}
        </>
      )}
      {!isWeb && device?.status === "APPROVED" && !thisPhone && (
        <Notice icon="alert-circle-outline" color={colors.warning}>
          This isn&apos;t your registered phone. If you changed phones, ask HR to reset it.
        </Notice>
      )}

      {onRegisteredPhone && canCheckIn && (
        <Button title="Check in" icon="finger-print" loading={busy} onPress={doCheckIn} style={styles.action} />
      )}

      {onRegisteredPhone && canCheckOut && !confirming && (
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
      {onRegisteredPhone && canCheckOut && confirming && (
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
            <Button title="Check out" icon="finger-print" loading={busy} onPress={doCheckOut} style={styles.flex} />
          </View>
        </View>
      )}

      {done && (
        <Notice icon="checkmark-circle" color={colors.success}>
          Done for today
        </Notice>
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
  action: { marginTop: spacing.md },
  confirm: { gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: "row", gap: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
});
