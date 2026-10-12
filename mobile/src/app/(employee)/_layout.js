import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import SignOutButton from "../../components/SignOutButton";
import { colors, spacing } from "../../theme";

const icon = (name) =>
  function TabIcon({ color, size, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };

export default function EmployeeLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: () => (
          <View style={{ marginRight: spacing.lg }}>
            <SignOutButton />
          </View>
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My profile", tabBarIcon: icon("person") }} />
      <Tabs.Screen name="attendance" options={{ title: "My attendance", tabBarLabel: "Attendance", tabBarIcon: icon("calendar") }} />
      <Tabs.Screen name="leave" options={{ title: "My leave", tabBarLabel: "Leave", tabBarIcon: icon("airplane") }} />
    </Tabs>
  );
}
