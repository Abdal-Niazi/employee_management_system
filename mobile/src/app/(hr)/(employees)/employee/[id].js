import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { deleteEmployee, getEmployee } from "../../../../api/hr";
import Avatar from "../../../../components/Avatar";
import Button from "../../../../components/Button";
import Card from "../../../../components/Card";
import ConfirmModal from "../../../../components/ConfirmModal";
import { ErrorState, LoadingState } from "../../../../components/States";
import StatusPill from "../../../../components/StatusPill";
import { useAsync } from "../../../../hooks/useAsync";
import { colors, font, spacing } from "../../../../theme";
import { formatIsoDate } from "../../../../utils/date";
import { fullName } from "../../../../utils/status";

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={font.small}>{label}</Text>
      <Text style={styles.detailValue}>{value || "—"}</Text>
    </View>
  );
}

export default function EmployeeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const load = useCallback(async () => {
    const employee = await getEmployee(id);
    const manager = employee.managerId ? await getEmployee(employee.managerId) : null;
    return { employee, manager };
  }, [id]);
  const { status, data, error, reload } = useAsync(load);

  const title = data ? fullName(data.employee) : "Employee";

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteEmployee(id);
      setConfirmingDelete(false);
      router.back();
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  };

  let body;
  if (status === "loading") body = <LoadingState />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else {
    const { employee, manager } = data;
    body = (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.profile}>
            <Avatar firstName={employee.firstName} lastName={employee.lastName} size={64} />
            <View style={styles.flex}>
              <Text style={font.title}>{fullName(employee)}</Text>
              <Text style={font.small}>
                {[employee.position, employee.department].filter(Boolean).join(" · ") || "No position set"}
              </Text>
              <View style={styles.pill}>
                <StatusPill status={employee.status} />
              </View>
            </View>
          </View>
        </Card>

        <Card title="Details">
          <DetailRow label="Employee ID" value={employee.employeeId} />
          <DetailRow label="Email" value={employee.email} />
          <DetailRow label="Phone" value={employee.phone} />
          <DetailRow label="Department" value={employee.department} />
          <DetailRow label="Position" value={employee.position} />
          <DetailRow label="Hire date" value={formatIsoDate(employee.hireDate)} />
          <DetailRow label="Manager" value={manager ? fullName(manager) : null} />
        </Card>

        <Button title="Edit employee" icon="create-outline" onPress={() => router.push(`/employee/edit/${employee.id}`)} />
        <Button
          title="Delete employee"
          icon="trash-outline"
          variant="danger"
          onPress={() => {
            setDeleteError("");
            setConfirmingDelete(true);
          }}
        />

        <ConfirmModal
          visible={confirmingDelete}
          title="Delete employee?"
          message={`${fullName(employee)} will be removed for good, together with their leave requests. This can't be undone.`}
          confirmLabel="Delete"
          danger
          submitting={deleting}
          error={deleteError}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      </ScrollView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {body}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  pill: { marginTop: spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailValue: { flex: 1, textAlign: "right", fontSize: 15, color: colors.text },
});
