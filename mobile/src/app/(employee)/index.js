import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../auth/AuthContext";
import CheckInCard from "../../components/CheckInCard";
import { colors, font, radius, spacing } from "../../theme";

export default function TodayScreen() {
  const { user } = useAuth();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={font.title}>Hello, {user.name || user.email.split("@")[0]}</Text>

      <CheckInCard />

      <View style={styles.hint}>
        <Ionicons name="help-circle-outline" size={18} color={colors.muted} />
        <Text style={[font.small, styles.flex]}>
          Forgot to check in or out, or is a time wrong? Ask your manager: they can send a correction to HR.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1 },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
