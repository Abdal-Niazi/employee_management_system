import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { addDays, formatDay, relativeDayLabel } from "../utils/date";

// Previous / next day bar for the attendance screens. `today` is the company's day, sent by the
// server, so a phone in another timezone still shows the right day and can't go past today.
export default function DayNav({ date, today, shift, onChange }) {
  const isToday = !today || date === today;
  const label = relativeDayLabel(date, today);
  const subtitle = label === formatDay(date) ? "" : formatDay(date);
  const details = [subtitle, shift && `Shift ${shift.start}–${shift.end}`].filter(Boolean).join(" · ");

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
        {details ? <Text style={font.small}>{details}</Text> : null}
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
