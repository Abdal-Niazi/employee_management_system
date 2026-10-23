import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";

const RESUME_RELOAD_AFTER_MS = 30_000;

// Loads data whenever the screen gains focus, and when the app comes back to the front while the
// screen is shown (so a phone left in the background overnight shows today, not yesterday), so
// changes made elsewhere show up. Coming back only reloads when the last load is older than
// RESUME_RELOAD_AFTER_MS: the share sheet, the photo picker and the fingerprint prompt also bring
// the app back to the front, and shouldn't refetch every time. Refocusing refetches quietly behind
// the current data (and keeps it if that fails); passing a different `loader` (e.g. a new date)
// shows the loading state. Stale responses are dropped.
// `loader` must be stable: a module function or one wrapped in useCallback.
export function useAsync(loader) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const shownLoader = useRef(null);
  const lastLoadAt = useRef(0);

  const run = useCallback(
    async (mode = "auto") => {
      const id = ++requestId.current;
      lastLoadAt.current = Date.now();
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "reload" || shownLoader.current !== loader) {
        setState((s) => ({ ...s, status: "loading", error: null }));
      }

      try {
        const data = await loader();
        if (id !== requestId.current) return;
        shownLoader.current = loader;
        setState({ status: "success", data, error: null });
      } catch (error) {
        if (id !== requestId.current) return;
        // A quiet refetch (refocus, pull-to-refresh, after an action) that fails keeps the data
        // already on screen, e.g. on a brief network drop; a first load, a Retry or a new
        // loader shows the error instead.
        if (mode !== "reload" && shownLoader.current === loader) return;
        shownLoader.current = null;
        setState({ status: "error", data: null, error });
      } finally {
        if (id === requestId.current) setRefreshing(false);
      }
    },
    [loader]
  );

  useFocusEffect(
    useCallback(() => {
      run();
      const subscription = AppState.addEventListener("change", (next) => {
        if (next === "active" && Date.now() - lastLoadAt.current > RESUME_RELOAD_AFTER_MS) run();
      });
      return () => subscription.remove();
    }, [run])
  );

  // Shows data the screen already has (e.g. what an action answered) without fetching again. A load
  // still in flight is dropped, so it can't put older data back.
  const replace = useCallback(
    (data) => {
      requestId.current += 1;
      shownLoader.current = loader;
      setState({ status: "success", data, error: null });
      setRefreshing(false);
    },
    [loader]
  );

  return {
    ...state,
    refreshing,
    reload: () => run("reload"),
    refresh: () => run("refresh"),
    revalidate: () => run(),
    replace,
  };
}
