import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createEmployeeAccount,
  getEmployeeAccount,
  resetEmployeePassword,
  updateEmployeeAccount,
} from "../api/hr";
import { useAsync } from "../hooks/useAsync";
import { colors, font, radius, spacing } from "../theme";
import Button from "./Button";
import Card from "./Card";
import ConfirmModal from "./ConfirmModal";
import SegmentedControl from "./SegmentedControl";

const ROLES = [
  { value: "EMPLOYEE", label: "Employee" },
  { value: "MANAGER", label: "Manager" },
];
const ROLE_NAME = { EMPLOYEE: "Employee", MANAGER: "Manager" };

// What each confirmation says. Every one of them signs the person out of their phones.
const CONFIRM = {
  reset: {
    title: "Reset the password?",
    message: (name) =>
      `${name}'s password stops working and they are signed out of every phone. You get a temporary password to give them; they choose their own when they sign in.`,
    label: "Reset password",
    danger: true,
  },
  off: {
    title: "Turn this login off?",
    message: (name) => `${name} is signed out now and can't sign in until you turn it on again. Their records stay as they are.`,
    label: "Turn off",
    danger: true,
  },
  on: {
    title: "Turn this login on?",
    message: (name) => `${name} can sign in again with their password.`,
    label: "Turn on",
    danger: false,
  },
  manager: {
    title: "Make a manager?",
    message: (name) =>
      `${name} gets the team screens and decides their team's leave. They are signed out now and see the new screens when they sign in again.`,
    label: "Make manager",
    danger: false,
  },
  employee: {
    title: "Make an employee?",
    message: (name) =>
      `${name} loses the team screens. People who report to them keep them as their manager, but only you can decide that team's leave until you change it. They are signed out now.`,
    label: "Make employee",
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

// HR, on an employee's page: their login to the app. HR creates it with a temporary password (shown
// once), resets a forgotten password the same way, turns the login off or on, and switches it between
// employee and manager.
export default function LoginCard({ employeeId, name, email }) {
  const load = useCallback(() => getEmployeeAccount(employeeId), [employeeId]);
  const { status, data: account, error, reload, revalidate } = useAsync(load);
  const [creating, setCreating] = useState(false);
  const [asking, setAsking] = useState(null); // "reset" | "off" | "on" | "manager" | "employee"
  const [secret, setSecret] = useState(null); // { password, headline } shown once
  const [busy, setBusy] = useState(false);
  const [cardError, setCardError] = useState("");

  // Runs one change. A refusal closes the dialog and shows on the card, which reloads.
  const run = async (work) => {
    setBusy(true);
    setCardError("");
    try {
      await work();
    } catch (err) {
      setCardError(err.message);
    } finally {
      setAsking(null);
      setBusy(false);
      revalidate();
    }
  };

  const handleConfirm = () =>
    run(async () => {
      if (asking === "reset") {
        const { temporaryPassword } = await resetEmployeePassword(employeeId);
        setSecret({ password: temporaryPassword, headline: "Password reset" });
      } else if (asking === "off" || asking === "on") {
        await updateEmployeeAccount(employeeId, { disabled: asking === "off" });
      } else {
        await updateEmployeeAccount(employeeId, { role: asking.toUpperCase() });
      }
    });

  const confirm = asking && CONFIRM[asking];

  let body;
  if (status === "loading") body = <ActivityIndicator color={colors.primary} />;
  else if (status === "error")
    body = (
      <>
        <Text style={styles.error}>{error.message}</Text>
        <Button title="Retry" icon="refresh" variant="outline" onPress={reload} />
      </>
    );
  else if (!account)
    body = (
      <>
        <Text style={font.body}>No login yet, so {name} can&apos;t use the app. Create one and give them the temporary password.</Text>
        <Button
          title="Create login"
          icon="key-outline"
          onPress={() => {
            setCardError("");
            setCreating(true);
          }}
        />
      </>
    );
  else {
    const off = account.status === "DISABLED";
    body = (
      <>
        {off ? (
          <View style={[styles.banner, styles.off]}>
            <Ionicons name="ban-outline" size={18} color={colors.danger} />
            <Text style={[font.body, styles.flex]}>Turned off: {name} can&apos;t sign in</Text>
          </View>
        ) : account.mustChangePassword ? (
          <View style={[styles.banner, styles.waiting]}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={[font.body, styles.flex]}>Waiting for {name} to sign in and choose their own password</Text>
          </View>
        ) : (
          <View style={[styles.banner, styles.on]}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={[font.body, styles.flex]}>{name} can sign in</Text>
          </View>
        )}
        <Line label="Email" value={account.email} />
        <Line label="Role" value={ROLE_NAME[account.role] ?? account.role} />

        <Button title="Reset password" icon="refresh" variant="outline" onPress={() => setAsking("reset")} />
        <Button
          title={account.role === "MANAGER" ? "Make employee" : "Make manager"}
          icon="swap-horizontal"
          variant="outline"
          onPress={() => setAsking(account.role === "MANAGER" ? "employee" : "manager")}
        />
        <Button
          title={off ? "Turn login on" : "Turn login off"}
          icon={off ? "checkmark" : "ban-outline"}
          variant={off ? "outline" : "danger"}
          onPress={() => setAsking(off ? "on" : "off")}
        />
      </>
    );
  }

  return (
    <Card title="App login">
      <View style={styles.body}>
        {cardError ? <Text style={styles.error}>{cardError}</Text> : null}
        {body}
      </View>

      <CreateLoginModal
        visible={creating}
        name={name}
        defaultEmail={email}
        onCancel={() => setCreating(false)}
        onCreate={async ({ role, email: chosen }) => {
          const { temporaryPassword } = await createEmployeeAccount(employeeId, { role, email: chosen });
          setCreating(false);
          setSecret({ password: temporaryPassword, headline: "Login created" });
          revalidate();
        }}
      />
      <ConfirmModal
        visible={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm ? confirm.message(name) : ""}
        confirmLabel={confirm?.label ?? ""}
        danger={confirm?.danger}
        submitting={busy}
        onCancel={() => setAsking(null)}
        onConfirm={handleConfirm}
      />
      <TemporaryPasswordModal secret={secret} name={name} onClose={() => setSecret(null)} />
    </Card>
  );
}

// The email and role of a new login. The email starts as the employee's own.
function CreateLoginModal({ visible, name, defaultEmail, onCancel, onCreate }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        {/* Keyed so the fields start over each time it opens */}
        {visible && <CreateForm name={name} defaultEmail={defaultEmail} onCancel={onCancel} onCreate={onCreate} />}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CreateForm({ name, defaultEmail, onCancel, onCreate }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [role, setRole] = useState("EMPLOYEE");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter a valid email address.");

    setSaving(true);
    setProblem("");
    try {
      await onCreate({ role, email: email.trim() });
    } catch (err) {
      setProblem(err.message);
      setSaving(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <Text style={font.title}>Create login for {name}</Text>
      <Text style={font.small}>They sign in with this email and a temporary password that you give them.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setProblem("");
        }}
        placeholder="name@company.com"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!saving}
        style={styles.input}
      />

      <Text style={styles.label}>Role</Text>
      <SegmentedControl options={ROLES} value={role} onChange={setRole} />

      {problem ? <Text style={styles.error}>{problem}</Text> : null}
      <View style={styles.actions}>
        <Button title="Cancel" variant="outline" onPress={onCancel} disabled={saving} style={styles.action} />
        <Button title="Create login" loading={saving} onPress={submit} style={styles.action} />
      </View>
    </View>
  );
}

// The temporary password, shown once. It can be selected and copied; the server keeps only a hash.
function TemporaryPasswordModal({ secret, name, onClose }) {
  return (
    <Modal visible={Boolean(secret)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={font.title}>{secret?.headline}</Text>
          <Text style={font.body}>Temporary password for {name}:</Text>
          <Text selectable style={styles.password}>
            {secret?.password}
          </Text>
          <Text style={font.small}>
            This is the only time it is shown. Give it to {name} (press and hold the password to copy it). When they
            sign in with it, the app asks them to choose their own password.
          </Text>
          <Button title="Done" onPress={onClose} style={styles.done} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm },
  flex: { flex: 1 },
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md },
  on: { backgroundColor: colors.successSoft },
  waiting: { backgroundColor: colors.warningSoft },
  off: { backgroundColor: colors.dangerSoft },
  line: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  value: { flex: 1, textAlign: "right", fontSize: 15, color: colors.text },
  error: { color: colors.danger, fontSize: 13 },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  action: { flex: 1 },
  password: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginVertical: spacing.sm,
  },
  done: { marginTop: spacing.md },
});
