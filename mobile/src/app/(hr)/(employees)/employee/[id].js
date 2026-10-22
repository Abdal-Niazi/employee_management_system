import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { deleteEmployee, getEmployee, removeEmployeePhoto, saveEmployeePhoto } from "../../../../api/hr";
import Avatar from "../../../../components/Avatar";
import Button from "../../../../components/Button";
import Card from "../../../../components/Card";
import ConfirmModal from "../../../../components/ConfirmModal";
import LoginCard from "../../../../components/LoginCard";
import PhoneCard from "../../../../components/PhoneCard";
import { ErrorState, LoadingState } from "../../../../components/States";
import StatusPill from "../../../../components/StatusPill";
import { useAsync } from "../../../../hooks/useAsync";
import { colors, font, spacing } from "../../../../theme";
import { formatIsoDate } from "../../../../utils/date";
import { pickPhoto } from "../../../../utils/pickPhoto";
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
  const { status, data, error, reload, revalidate } = useAsync(load);

  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  // Choose a photo, cut and shrink it, send it, and show the employee again with it
  const handlePhoto = async () => {
    setPhotoError("");
    try {
      const image = await pickPhoto();
      if (!image) return;

      setPhotoBusy(true);
      await saveEmployeePhoto(id, image);
      await revalidate();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError("");
    try {
      await removeEmployeePhoto(id);
      await revalidate();
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  };

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
            <Avatar firstName={employee.firstName} lastName={employee.lastName} size={64} photoFor={employee} />
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
          <View style={styles.photoRow}>
            <Button
              title={employee.photoUpdatedAt ? "Change photo" : "Add photo"}
              icon="camera-outline"
              variant="outline"
              loading={photoBusy}
              onPress={handlePhoto}
              style={styles.flex}
            />
            {employee.photoUpdatedAt ? (
              <Button title="Remove" icon="trash-outline" variant="outline" disabled={photoBusy} onPress={handleRemovePhoto} />
            ) : null}
          </View>
          {photoError ? <Text style={styles.photoError}>{photoError}</Text> : null}
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

        <LoginCard employeeId={employee.id} name={employee.firstName} email={employee.email} />

        <PhoneCard employeeId={employee.id} name={employee.firstName} />

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
          message={`${fullName(employee)} will be removed for good, together with their leave requests and attendance. Their past attendance changes stay on record. This can't be undone.`}
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
  photoRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  photoError: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailValue: { flex: 1, textAlign: "right", fontSize: 15, color: colors.text },
});
