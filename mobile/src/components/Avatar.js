import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { photoSource } from "../api/client";
import { usePhotoSource } from "../hooks/usePhotoSource";
import { colors } from "../theme";

const PALETTE = ["#3355d6", "#12805c", "#b26a00", "#7a3fd1", "#c4372f", "#0e7490"];

// The person's photo when they have one, else their initials. `photoFor` is the employee's data
// (it needs `id` and `photoUpdatedAt`). A photo that can't be loaded (no connection, taken off
// meanwhile) falls back to the initials.
export default function Avatar({ firstName = "", lastName = "", size = 40, photoFor = null }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
  const tint = PALETTE[(initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % PALETTE.length];

  const source = usePhotoSource(photoFor ? photoSource(photoFor.id, photoFor.photoUpdatedAt) : null);
  // The address that failed, so a new photo (a new address) gets its own chance
  const [failed, setFailed] = useState(null);

  if (source && failed !== source.uri) {
    return (
      <Image
        source={source}
        onError={() => setFailed(source.uri)}
        accessibilityLabel={`${firstName} ${lastName}`.trim()}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

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
