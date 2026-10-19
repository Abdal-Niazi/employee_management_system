import { Platform } from "react-native";

// Hands a CSV file to the person. In a browser it is a download. On a phone the text is saved as a
// file and the share sheet opens, so it can go to Drive, WhatsApp or email, or open in Sheets or Excel.
// The phone's modules load only when needed, so the web app never pulls them in.
export async function exportCsv(filename, text) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const { File, Paths } = await import("expo-file-system");
  const Sharing = await import("expo-sharing");

  if (!(await Sharing.isAvailableAsync())) throw new Error("This phone can't share files.");

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(text);

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    dialogTitle: filename,
    UTI: "public.comma-separated-values-text",
  });
}
