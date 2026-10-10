import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import SignOutButton from "../../components/SignOutButton";
import { colors, spacing } from "../../theme";

const icon = (name) =>
  function TabIcon({ color, size, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />;
  };

export default function HrLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      {/* The employees tab has its own stack (list, detail, add, edit) and header. */}
      <Tabs.Screen name="(employees)" options={{ title: "Employees", headerShown: false, tabBarIcon: icon("people") }} />
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
          tabBarIcon: icon("calendar"),
          headerRight: () => (
            <View style={{ marginRight: spacing.lg }}>
              <SignOutButton />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
