import fs from "fs";
import path from "path";
import {
  CollectionV1,
  EnvironmentV1,
  HistoryItem,
  OpenRequestTabV1,
  PersistedStore,
  TypedVariable,
  VariablesMap,
} from "./types";

const DEFAULT_STORE: PersistedStore = {
  environments: [],
  activeEnvironmentId: null,
  globals: {},
  history: [],
  collections: [],
  openRequestTabs: [],
  activeRequestTabId: null,
};

function deepCopyVariables(input: VariablesMap): VariablesMap {
  const out: VariablesMap = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = { type: v.type, value: v.value };
  }
  return out;
}

function coerceTypedVariable(name: string, input: any): TypedVariable {
  if (input === null || input === undefined) {
    throw new Error(`Variable ${name}: value is null/undefined`);
  }

  // Canonical format: { type: "...", value: ... }
  if (typeof input === "object" && typeof input.type === "string" && "value" in input) {
    const type = input.type as TypedVariable["type"];
    if (type !== "string" && type !== "number" && type !== "boolean") {
      throw new Error(`Variable ${name}: invalid type '${input.type}'`);
    }
    const value = input.value;
    if (type === "string") return { type, value: String(value) };
    if (type === "number") {
      if (typeof value === "number" && Number.isFinite(value)) return { type, value };
      if (typeof value === "string") {
        const n = Number.parseFloat(value);
        if (Number.isFinite(n)) return { type, value: n };
      }
      throw new Error(`Variable ${name}: cannot coerce value to number`);
    }
    if (type === "boolean") {
      if (typeof value === "boolean") return { type, value };
      if (typeof value === "string") {
        const s = value.trim().toLowerCase();
        if (s === "true") return { type, value: true };
        if (s === "false") return { type, value: false };
      }
      throw new Error(`Variable ${name}: cannot coerce value to boolean`);
    }
  }

  // Tolerant format: { name: primitive }
  if (typeof input === "string") return { type: "string", value: input };
  if (typeof input === "number" && Number.isFinite(input)) return { type: "number", value: input };
  if (typeof input === "boolean") return { type: "boolean", value: input };

  throw new Error(`Variable ${name}: unsupported format`);
}

export function loadStore(storePath: string): PersistedStore {
  try {
    const raw = fs.readFileSync(storePath, "utf-8");
    const parsed = JSON.parse(raw);
    const environments: EnvironmentV1[] = Array.isArray(parsed.environments)
      ? (parsed.environments as EnvironmentV1[]).map((e: any) => ({
          id: String(e.id),
          name: String(e.name ?? "Environment"),
          variables: deepCopyVariables(e.variables ?? {}),
        }))
      : [];

    // Migration: old "environment" map -> create Default environment
    const legacyEnv = parsed.environment ? deepCopyVariables(parsed.environment ?? {}) : null;
    if (environments.length === 0 && legacyEnv && Object.keys(legacyEnv).length >= 0) {
      environments.push({
        id: "default",
        name: "Default",
        variables: legacyEnv,
      });
    }

    const activeEnvironmentId =
      typeof parsed.activeEnvironmentId === "string"
        ? parsed.activeEnvironmentId
        : environments[0]?.id ?? null;

    return {
      environments,
      activeEnvironmentId: environments.some((e) => e.id === activeEnvironmentId) ? activeEnvironmentId : (environments[0]?.id ?? null),
      globals: deepCopyVariables(parsed.globals ?? {}),
      history: Array.isArray(parsed.history) ? (parsed.history as HistoryItem[]) : [],
      collections: Array.isArray(parsed.collections) ? (parsed.collections as CollectionV1[]) : [],
      openRequestTabs: Array.isArray(parsed.openRequestTabs) ? (parsed.openRequestTabs as OpenRequestTabV1[]) : [],
      activeRequestTabId:
        typeof parsed.activeRequestTabId === "string" ? parsed.activeRequestTabId : null,
    };
  } catch {
    return structuredClone(DEFAULT_STORE);
  }
}

export function saveStore(storePath: string, store: PersistedStore) {
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf-8");
}

export function parseVariablesMap(input: any): VariablesMap {
  if (!input || typeof input !== "object") return {};
  const out: VariablesMap = {};
  for (const [name, value] of Object.entries(input)) {
    out[name] = coerceTypedVariable(name, value);
  }
  return out;
}

