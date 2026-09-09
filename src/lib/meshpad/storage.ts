import type { Project, SceneState, SketchEdit, Stroke } from "./types";
import { uid } from "./types";

/**
 * Local project storage.
 *
 * This module is the single place the app reads/writes saved projects, so a
 * cloud backend (auth + database + storage) can later replace the bodies of
 * these functions without touching any component.
 */

const KEY = "meshpad.projects.v1";
const LAST_KEY = "meshpad.lastProjectId.v1";

const canUse = () => typeof window !== "undefined" && !!window.localStorage;

export function listProjects(): Project[] {
  if (!canUse()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Project[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProject(input: {
  id?: string | undefined;
  name: string;
  scene: SceneState;
  strokes: Stroke[];
  sketchEdits?: SketchEdit[];
}): Project {
  const project: Project = {
    id: input.id ?? uid(),
    name: input.name.trim() || "Untitled project",
    updatedAt: Date.now(),
    scene: input.scene,
    strokes: input.strokes,
    sketchEdits: input.sketchEdits,
  };
  if (!canUse()) return project;
  const all = listProjects().filter((p) => p.id !== project.id);
  all.unshift(project);
  window.localStorage.setItem(KEY, JSON.stringify(all.slice(0, 30)));
  window.localStorage.setItem(LAST_KEY, project.id);
  return project;
}

export function loadProject(id: string): Project | null {
  return listProjects().find((p) => p.id === id) ?? null;
}

export function deleteProject(id: string) {
  if (!canUse()) return;
  window.localStorage.setItem(KEY, JSON.stringify(listProjects().filter((p) => p.id !== id)));
}

export function lastProjectId(): string | null {
  if (!canUse()) return null;
  return window.localStorage.getItem(LAST_KEY);
}
