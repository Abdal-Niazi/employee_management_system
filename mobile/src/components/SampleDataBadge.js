import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../theme";

// Marks screens showing generated data, so it is never mistaken for real records.
export default function SampleDataBadge({ label = "Sample data — backend endpoint not built yet" }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="flask-outline" size={14} color={colors.warning} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs + 2,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 12, fontWeight: "600", color: colors.warning, flexShrink: 1 },
});
