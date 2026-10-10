import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { getAllEmployees } from "../../api/hr";
import Avatar from "../../components/Avatar";
import SegmentedControl from "../../components/SegmentedControl";
import { EmptyState, ErrorState, LoadingState } from "../../components/States";
import StatusPill from "../../components/StatusPill";
import { useAsync } from "../../hooks/useAsync";
import { colors, font, radius, spacing } from "../../theme";
import { fullName } from "../../utils/status";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "terminated", label: "Left" },
];

function matches(employee, query) {
  const haystack = [fullName(employee), employee.employeeId, employee.email, employee.department, employee.position]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

function EmployeeRow({ employee, onPress }) {
  const role = [employee.position, employee.department].filter(Boolean).join(" · ");

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
      <Avatar firstName={employee.firstName} lastName={employee.lastName} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {fullName(employee)}
        </Text>
        <Text style={font.small} numberOfLines={1}>
          {role || "No position set"}
        </Text>
        <Text style={styles.id}>{employee.employeeId}</Text>
      </View>
      <StatusPill status={employee.status} />
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function EmployeesScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { status, data, error, reload, refresh, refreshing } = useAsync(getAllEmployees);
  const employees = useMemo(
    () => (data ?? []).filter((e) => (filter === "all" || e.status === filter) && matches(e, query)),
    [data, filter, query]
  );

  if (status === "loading") return <LoadingState label="Loading employees…" />;
  if (status === "error") return <ErrorState error={error} onRetry={reload} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={employees}
      keyExtractor={(e) => String(e.id)}
      keyboardShouldPersistTaps="handled"
      refreshing={refreshing}
      onRefresh={refresh}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, ID, department…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.searchInput}
            />
          </View>
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} />
          <Text style={font.small}>
            {employees.length} of {data.length} employees
          </Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListEmptyComponent={
        data.length === 0 ? (
          <EmptyState icon="people-outline" title="No employees yet" message="Employees you add will appear here." />
        ) : (
          <EmptyState icon="search" title="No matches" message="No employee matches this search or filter." />
        )
      }
      renderItem={({ item }) => (
        <EmployeeRow employee={item} onPress={() => router.push(`/employee/${item.id}`)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, flexGrow: 1 },
  header: { gap: spacing.md, marginBottom: spacing.md },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: colors.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  rowText: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: "600", color: colors.text },
  id: { fontSize: 12, color: colors.muted, fontWeight: "600" },
});
