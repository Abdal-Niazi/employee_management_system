import { StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";

// How much leave is left this year, one tile per kind. Days waiting for a decision are already
// held back from "left", so asking twice can't get past the limit.
export default function LeaveBalance({ year, balances }) {
  return (
    <View style={styles.wrap}>
      <Text style={font.small}>Your leave for {year} (working days)</Text>
      <View style={styles.row}>
        {balances.map((b) => (
          <View key={b.type} style={styles.tile}>
            <Text style={styles.type}>{b.type}</Text>
            <Text style={[styles.left, b.remaining === 0 && styles.none]}>{b.remaining}</Text>
            <Text style={font.small}>of {b.entitlement} left</Text>
            {b.pending > 0 ? <Text style={styles.waiting}>{b.pending} waiting</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

// "8 of 14 Annual days left in 2026", for the request form.
export function balanceHint(balance, year) {
  if (!balance) return "";
  const { remaining, entitlement, type } = balance;
  return `${remaining} of ${entitlement} ${type} day${entitlement === 1 ? "" : "s"} left in ${year}`;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  type: { fontSize: 13, fontWeight: "600", color: colors.muted },
  left: { fontSize: 28, fontWeight: "700", color: colors.primary },
  none: { color: colors.danger },
  waiting: { fontSize: 12, fontWeight: "600", color: colors.warning },
});
