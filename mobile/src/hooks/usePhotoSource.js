import { useEffect, useState } from "react";
import { Platform } from "react-native";

// Photos are only for people who are signed in, so the picture has to be asked for with the login.
// A phone's <Image> takes the login as a header, so it loads the photo itself. A browser can't send
// one with an <img>, so there the picture is fetched with the login and shown from a local copy.
const copies = new Map(); // address -> the local copy's address (kept for as long as the app is open)

// `source` is { uri, headers } from photoSource, or null. Answers what to give <Image>, or null while
// a browser is still fetching it or when it couldn't be loaded.
export function usePhotoSource(source) {
  const uri = source?.uri ?? null;
  const [fetched, setFetched] = useState(null); // { uri, copy } of the last picture that arrived

  useEffect(() => {
    if (Platform.OS !== "web" || !uri || copies.has(uri)) return undefined;

    let stale = false;
    fetch(uri, { headers: source.headers })
      .then((response) => (response.ok ? response.blob() : Promise.reject(new Error("No photo"))))
      .then((blob) => {
        const copy = URL.createObjectURL(blob);
        copies.set(uri, copy);
        if (!stale) setFetched({ uri, copy });
      })
      // Nothing to show: the initials stay
      .catch(() => {});

    return () => {
      stale = true;
    };
    // The headers hold the login, which doesn't change what the picture is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri]);

  if (!source) return null;
  if (Platform.OS !== "web") return source;

  const copy = copies.get(uri) ?? (fetched?.uri === uri ? fetched.copy : null);
  return copy ? { uri: copy } : null;
}
