import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { summaryKeys } from "../utils/attendance";
import StatusPill from "./StatusPill";

// The day's counts above an attendance list. Wraps onto a second line on narrow phones.
export default function AttendanceSummary({ counts }) {
  return (
    <View style={styles.summary}>
      {summaryKeys(counts).map((key) => (
        <View key={key} style={styles.item}>
          <Text style={styles.value}>{counts[key]}</Text>
          <StatusPill status={key} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    rowGap: spacing.md,
    columnGap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  item: { alignItems: "center", gap: spacing.xs },
  value: { fontSize: 20, fontWeight: "700", color: colors.text },
});
