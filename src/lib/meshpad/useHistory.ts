import { useCallback, useRef, useState } from "react";

/** Small undo/redo stack used for both the drawing and the 3D scene. */
export function useHistory<T>(initial: T, limit = 60) {
  const [state, setState] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const [, bump] = useState(0);

  const set = useCallback(
    (next: T, options?: { history?: boolean }) => {
      setState((prev) => {
        if (options?.history !== false) {
          past.current = [...past.current, prev].slice(-limit);
          future.current = [];
        }
        return next;
      });
      bump((n) => n + 1);
    },
    [limit],
  );

  const undo = useCallback(() => {
    setState((prev) => {
      const last = past.current[past.current.length - 1];
      if (last === undefined) return prev;
      past.current = past.current.slice(0, -1);
      future.current = [prev, ...future.current];
      return last;
    });
    bump((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      const next = future.current[0];
      if (next === undefined) return prev;
      future.current = future.current.slice(1);
      past.current = [...past.current, prev];
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const reset = useCallback((value: T) => {
    past.current = [];
    future.current = [];
    setState(value);
    bump((n) => n + 1);
  }, []);

  return {
    state,
    set,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
