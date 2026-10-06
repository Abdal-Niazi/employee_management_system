import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";

export default function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: colors.neutralSoft,
    borderRadius: radius.md,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    borderRadius: radius.sm + 2,
    paddingHorizontal: 6,
  },
  selected: {
    backgroundColor: colors.surface,
    boxShadow: "0 1px 3px rgba(16, 24, 40, 0.12)",
  },
  label: { fontSize: 14, fontWeight: "600", color: colors.muted },
  labelSelected: { color: colors.text },
});
