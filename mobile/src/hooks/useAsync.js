import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

// Loads data whenever the screen gains focus, so changes made on another tab show
// up. Refocusing refetches quietly behind the current data; passing a different
// `loader` (e.g. a new date) shows the loading state. Stale responses are dropped.
// `loader` must be stable: a module function or one wrapped in useCallback.
export function useAsync(loader) {
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const shownLoader = useRef(null);

  const run = useCallback(
    async (mode = "auto") => {
      const id = ++requestId.current;
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
    }, [run])
  );

  return {
    ...state,
    refreshing,
    reload: () => run("reload"),
    refresh: () => run("refresh"),
    revalidate: () => run(),
  };
}
