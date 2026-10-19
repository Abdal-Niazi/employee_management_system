import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import AccountButtons from "../../components/AccountButtons";
import { colors } from "../../theme";

const ICONS = {
  "(employees)": "people",
  leave: "airplane",
  attendance: "calendar",
};

// The HR Admin part of the app: everyone's records, leave and attendance.
export default function HrLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
        headerRight: () => <AccountButtons />,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? ICONS[route.name] : `${ICONS[route.name]}-outline`} size={size} color={color} />
        ),
      })}
    >
      {/* The employees tab has its own stack (list, detail, add, edit) and header. */}
      <Tabs.Screen name="(employees)" options={{ title: "Employees", headerShown: false }} />
      <Tabs.Screen name="leave" options={{ title: "Leave requests", tabBarLabel: "Leave" }} />
      <Tabs.Screen name="attendance" options={{ title: "Attendance" }} />
    </Tabs>
  );
}
