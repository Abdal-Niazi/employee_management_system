import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { cancelLeave, getMyLeave, requestLeave } from "../../api/me";
import Button from "../../components/Button";
import ConfirmModal from "../../components/ConfirmModal";
import LeaveCard from "../../components/LeaveCard";
import LeaveRequestSheet from "../../components/LeaveRequestSheet";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import { useAsync } from "../../hooks/useAsync";
import { colors, spacing } from "../../theme";

export default function MyLeaveScreen() {
  const { status, data, error, reload, refresh, revalidate, refreshing } = useAsync(getMyLeave);

  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [cancelling, setCancelling] = useState(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const openForm = () => {
    setFormError("");
    setAsking(true);
  };

  const handleSubmit = async (request) => {
    setSaving(true);
    setFormError("");
    try {
      await requestLeave(request);
      setAsking(false);
      revalidate();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    setCancelBusy(true);
    setCancelError("");
    try {
      await cancelLeave(cancelling.id);
      setCancelling(null);
      revalidate();
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelBusy(false);
    }
  };

  let body;
  if (status === "loading") body = <LoadingState label="Loading your leave…" />;
  else if (status === "error") body = <ErrorState error={error} onRetry={reload} />;
  else
    body = (
      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.content}
        data={data}
        keyExtractor={(request) => String(request.id)}
        refreshing={refreshing}
        onRefresh={refresh}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <EmptyState
            icon="airplane-outline"
            title="No leave requests yet"
            message="Tap “Request leave” to ask your manager for time off."
          />
        }
        renderItem={({ item }) => (
          <LeaveCard
            request={item}
            showName={false}
            onCancel={(request) => {
              setCancelError("");
              setCancelling(request);
            }}
          />
        )}
      />
    );

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <Button title="Request leave" icon="add" onPress={openForm} />
      </View>
      {body}

      <LeaveRequestSheet
        visible={asking}
        saving={saving}
        error={formError}
        onCancel={() => setAsking(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmModal
        visible={Boolean(cancelling)}
        title="Cancel this request?"
        message="Your manager won't see it any more. You can send a new request later."
        confirmLabel="Cancel request"
        danger
        submitting={cancelBusy}
        error={cancelError}
        onCancel={() => setCancelling(null)}
        onConfirm={handleCancel}
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
});
