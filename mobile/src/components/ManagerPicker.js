import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radius, spacing } from "../theme";
import { fullName } from "../utils/status";
import Avatar from "./Avatar";

// A field that opens a list of employees to pick a manager from (or "No manager").
export default function ManagerPicker({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((e) => e.id === value);

  const choose = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { opacity: 0.75 }]}
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? fullName(selected) : "No manager"}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={font.title}>Choose manager</Text>
            <FlatList
              data={[{ id: null }, ...options]}
              keyExtractor={(e) => String(e.id)}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => choose(item.id)}
                  style={({ pressed }) => [styles.option, pressed && { opacity: 0.6 }]}
                >
                  {item.id === null ? (
                    <Text style={[font.body, styles.flex]}>No manager</Text>
                  ) : (
                    <>
                      <Avatar firstName={item.firstName} lastName={item.lastName} size={32} />
                      <View style={styles.flex}>
                        <Text style={font.body} numberOfLines={1}>
                          {fullName(item)}
                        </Text>
                        <Text style={font.small} numberOfLines={1}>
                          {[item.position, item.department].filter(Boolean).join(" · ") || item.employeeId}
                        </Text>
                      </View>
                    </>
                  )}
                  {item.id === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    backgroundColor: colors.surface,
  },
  value: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.muted },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(16, 24, 40, 0.45)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    alignSelf: "center",
  },
  list: { flexGrow: 0 },
  option: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  separator: { height: 1, backgroundColor: colors.border },
  flex: { flex: 1 },
});
