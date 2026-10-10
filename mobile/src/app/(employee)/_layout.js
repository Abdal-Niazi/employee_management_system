import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import SignOutButton from "../../components/SignOutButton";
import { colors } from "../../theme";

const ICONS = {
  index: "today",
  history: "calendar",
};

// The Employee part of the app: today's check-in and the person's own attendance.
export default function EmployeeLayout() {
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
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="history" options={{ title: "My attendance" }} />
    </Tabs>
  );
}
