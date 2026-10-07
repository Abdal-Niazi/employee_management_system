import { StyleSheet, Text, View } from "react-native";
import { colors, radius } from "../theme";
import { statusInfo } from "../utils/status";

const TONES = {
  success: [colors.successSoft, colors.success],
  warning: [colors.warningSoft, colors.warning],
  danger: [colors.dangerSoft, colors.danger],
  info: [colors.infoSoft, colors.info],
  neutral: [colors.neutralSoft, colors.neutral],
};

export default function StatusPill({ status, label }) {
  const info = statusInfo(status);
  const [bg, fg] = TONES[info.tone];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label ?? info.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
