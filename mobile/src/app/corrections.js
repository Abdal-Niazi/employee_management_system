import { FlatList, StyleSheet, Text, View } from "react-native";
import { getCorrections } from "../api/manager";
import CorrectionCard from "../components/CorrectionCard";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAsync } from "../hooks/useAsync";
import { colors, font, spacing } from "../theme";

// No status: every request, waiting ones first.
const loadAll = () => getCorrections();

export default function CorrectionsScreen() {
  const { status, data, error, reload, refresh, refreshing } = useAsync(loadAll);

  if (status === "loading") return <LoadingState label="Loading requests…" />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(c) => String(c.id)}
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={
        <Text style={[font.small, styles.intro]}>
          Corrections you asked HR for. Attendance only changes when HR approves.
        </Text>
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      ListEmptyComponent={
        <EmptyState
          icon="document-text-outline"
          title="No requests yet"
          message="On the Attendance tab, tap a person to ask HR to correct a day."
        />
      }
      renderItem={({ item }) => <CorrectionCard correction={item} />}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  intro: { marginBottom: spacing.md },
});
