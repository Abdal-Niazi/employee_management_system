import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import SignOutButton from "../../components/SignOutButton";
import { colors } from "../../theme";

const ICONS = {
  index: "grid",
  team: "people",
  attendance: "calendar",
  leave: "airplane",
};

export default function ManagerLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: () => <SignOutButton />,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`} size={size} color={color} />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: "Overview" }} />
      <Tabs.Screen name="team" options={{ title: "My Team" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
      <Tabs.Screen name="leave" options={{ title: "Leave" }} />
    </Tabs>
  );
}
