import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

const PALETTE = ["#3355d6", "#12805c", "#b26a00", "#7a3fd1", "#c4372f", "#0e7490"];

export default function Avatar({ firstName = "", lastName = "", size = 40 }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
  const tint = PALETTE[(initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % PALETTE.length];

  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: `${tint}1f` },
      ]}
    >
      <Text style={[styles.text, { color: tint, fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontWeight: "700" },
});
