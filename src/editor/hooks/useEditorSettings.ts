import { useCallback, useEffect, useReducer } from "react";
import { putProject } from "@/shared/db";
import { applySettingsPatch, withDefaults, type BrowserFrameStyle, type EditorSettings, type SettingsPatch, type ZoomClip } from "@/shared/settings";
import type { ProjectRecord } from "@/shared/types";

const COALESCE_WINDOW_MS = 1000;
const SAVE_DELAY_MS = 400;
const HISTORY_LIMIT = 100;

interface HistoryState {
  past: EditorSettings[];
  present: EditorSettings;
  future: EditorSettings[];
  coalesceKey: string | null;
  coalesceAt: number;
}

type HistoryAction =
  | { type: "patch"; patch: SettingsPatch; coalesceKey: string | null; at: number }
  | { type: "undo" }
  | { type: "redo" };

function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "patch": {
      const present = applySettingsPatch(state.present, action.patch);
      const coalesce = action.coalesceKey !== null
        && action.coalesceKey === state.coalesceKey
        && action.at - state.coalesceAt < COALESCE_WINDOW_MS;
      return {
        past: coalesce ? state.past : [...state.past, state.present].slice(-HISTORY_LIMIT),
        present,
        future: [],
        coalesceKey: action.coalesceKey,
        coalesceAt: action.at,
      };
    }
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], coalesceKey: null, coalesceAt: 0 };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future, coalesceKey: null, coalesceAt: 0 };
    }
  }
}

export interface EditorSettingsController {
  settings: EditorSettings;
  update: (patch: SettingsPatch, coalesceKey?: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function systemBrowserFrame(): BrowserFrameStyle {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialSettings(project: ProjectRecord, initialZoom: () => ZoomClip[]): EditorSettings {
  const settings = withDefaults(project.settings);
  const zoom = Array.isArray(project.settings?.zoom) ? settings.zoom : initialZoom();
  if (project.settings || !project.pages?.length) return { ...settings, zoom };
  return { ...settings, zoom, background: { ...settings.background, browserFrame: systemBrowserFrame() } };
}

export function useEditorSettings(project: ProjectRecord, initialZoom: () => ZoomClip[]): EditorSettingsController {
  const [state, dispatch] = useReducer(historyReducer, project, (initial): HistoryState => ({
    past: [],
    present: initialSettings(initial, initialZoom),
    future: [],
    coalesceKey: null,
    coalesceAt: 0,
  }));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void putProject({ ...project, settings: state.present });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [project, state.present]);

  const update = useCallback((patch: SettingsPatch, coalesceKey?: string) => {
    dispatch({ type: "patch", patch, coalesceKey: coalesceKey ?? null, at: performance.now() });
  }, []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return {
    settings: state.present,
    update,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
