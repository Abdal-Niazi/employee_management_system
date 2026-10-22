import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// The side of the square photo that is kept: enough for the biggest place a photo shows, and small
// enough to be about 30 to 60 KB.
const SIDE = 400;

// Lets the person choose a photo from the gallery. Answers it as base64 text of a JPEG, cut to a
// square from the middle and shrunk (what the server accepts), or null when they cancel. On the web
// it has to be called straight from a button press.
export async function pickPhoto() {
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const { uri } = picked.assets[0];
  let { width, height } = picked.assets[0];
  // The picker leaves the size out sometimes (0): read it from the picture
  if (!width || !height) {
    const probe = await ImageManipulator.manipulate(uri).renderAsync();
    ({ width, height } = probe);
  }

  const side = Math.min(width, height);
  const square = await ImageManipulator.manipulate(uri)
    .crop({ originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side })
    .resize({ width: SIDE })
    .renderAsync();
  const saved = await square.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });

  return saved.base64;
}
