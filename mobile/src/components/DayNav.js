import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { addDays, formatDay, relativeDayLabel, todayKey } from "../utils/date";

// Previous / next day bar for the attendance screens. You can't go past today.
export default function DayNav({ date, shift, onChange }) {
  const isToday = date === todayKey();
  const label = relativeDayLabel(date);
  const subtitle = label === formatDay(date) ? "" : `${formatDay(date)} · `;

  return (
    <View style={styles.dateNav}>
      <Pressable
        accessibilityLabel="Previous day"
        onPress={() => onChange(addDays(date, -1))}
        style={({ pressed }) => [styles.navButton, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={styles.dateLabel}>
        <Text style={font.heading}>{label}</Text>
        <Text style={font.small}>
          {subtitle}
          {shift ? `Shift ${shift.start}–${shift.end}` : ""}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Next day"
        disabled={isToday}
        onPress={() => onChange(addDays(date, 1))}
        style={({ pressed }) => [styles.navButton, (pressed || isToday) && { opacity: 0.35 }]}
      >
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateLabel: { flex: 1, alignItems: "center" },
});
