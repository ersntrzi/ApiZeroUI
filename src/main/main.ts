import { app, BrowserWindow, ipcMain, dialog, Menu } from "electron";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { loadStore, parseVariablesMap, saveStore } from "./core/store";
import { openApiDocumentToCollection } from "./core/openapiImport";
import { runRequestV1 } from "./core/requestRunner";
import {
  CollectionV1,
  CollectionNodeV1,
  CollectionFolderNodeV1,
  CollectionRequestNodeV1,
  EnvironmentV1,
  PersistedStore,
  RequestDefinitionV1,
  SendRequestResultV1,
  HistoryItem,
  OpenRequestTabV1,
} from "./core/types";

let mainWindow: BrowserWindow | null = null;

const storePath = path.join(app.getPath("userData"), "store.json");
const store: PersistedStore = loadStore(storePath);
if (!Array.isArray(store.openRequestTabs)) store.openRequestTabs = [];
if (store.activeRequestTabId === undefined) store.activeRequestTabId = null;

function migrateCollectionsToTreeV1() {
  if (!Array.isArray(store.collections)) store.collections = [];

  for (const c of store.collections) {
    if (Array.isArray(c.nodes)) continue;

    const nodes: CollectionNodeV1[] = [];
    if (Array.isArray(c.requests)) {
      for (const r of c.requests) {
        const node: CollectionRequestNodeV1 = {
          id: r.id,
          type: "request",
          name: r.name,
          definition: r.definition,
        };
        nodes.push(node);
      }
    }

    c.nodes = nodes;
    delete (c as any).requests;
  }
}

function persist() {
  saveStore(storePath, store);
}

function getRendererIndexPath(): string {
  // __dirname: dist/main
  if (app.isPackaged) {
    return path.join(__dirname, "..", "renderer", "index.html");
  }
  // dev: workspace/src/renderer/index.html
  return path.join(__dirname, "..", "..", "src", "renderer", "index.html");
}

function getAppIconPath(): string {
  // __dirname: dist/main
  if (app.isPackaged) {
    return path.join(__dirname, "..", "assets", "icon.png");
  }
  // dev: workspace/assets/icon.png
  return path.join(__dirname, "..", "..", "assets", "icon.png");
}

function createWindow() {
  // Electron'in native application menu bar'ını kapat.
  // (HTML'deki + New/Import menülerle karışmasın diye.)
  try {
    Menu.setApplicationMenu(null);
  } catch {
    /* ignore */
  }
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "..", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    mainWindow.setMenu(null);
  } catch {
    /* ignore */
  }

  mainWindow.loadFile(getRendererIndexPath());

  mainWindow.webContents.on("console-message", (_e, level, message) => {
    const m = String(message);
    if (m.includes("[ApiZero]") || level >= 2) {
      console.error("[Renderer]", m);
    }
  });
}

ipcMain.handle("getState", async () => {
  return store;
});

ipcMain.handle(
  "saveOpenRequestTabsV1",
  async (_evt, payload: { tabs: OpenRequestTabV1[]; activeTabId: string | null }) => {
    if (!payload || !Array.isArray(payload.tabs)) throw new Error("invalid tabs");
    store.openRequestTabs = payload.tabs;
    store.activeRequestTabId = payload.activeTabId ?? null;
    persist();
    return { ok: true };
  },
);

ipcMain.on(
  "saveOpenRequestTabsV1Sync",
  (_evt, payload: { tabs: OpenRequestTabV1[]; activeTabId: string | null }) => {
    if (!payload || !Array.isArray(payload.tabs)) return;
    store.openRequestTabs = payload.tabs;
    store.activeRequestTabId = payload.activeTabId ?? null;
    persist();
  },
);

ipcMain.handle("createEnvironmentV1", async (_evt, args: { name: string }) => {
  const name = (args?.name ?? "").trim();
  if (!name) throw new Error("environment name is empty");
  const id = crypto.randomUUID();
  const env: EnvironmentV1 = { id, name, variables: {} };
  store.environments.unshift(env);
  store.activeEnvironmentId = id;
  persist();
  return { ok: true, id };
});

ipcMain.handle("setActiveEnvironmentV1", async (_evt, args: { environmentId: string | null }) => {
  const id = args?.environmentId ?? null;
  if (id === null) {
    store.activeEnvironmentId = null;
    persist();
    return { ok: true };
  }
  if (!store.environments.some((e) => e.id === id)) throw new Error("environment not found");
  store.activeEnvironmentId = id;
  persist();
  return { ok: true };
});

ipcMain.handle("renameEnvironmentV1", async (_evt, args: { environmentId: string; name: string }) => {
  const id = args?.environmentId;
  const name = (args?.name ?? "").trim();
  if (!id) throw new Error("environmentId is required");
  if (!name) throw new Error("name is empty");
  const env = store.environments.find((e) => e.id === id);
  if (!env) throw new Error("environment not found");
  env.name = name;
  persist();
  return { ok: true };
});

ipcMain.handle("deleteEnvironmentV1", async (_evt, args: { environmentId: string }) => {
  const id = args?.environmentId;
  if (!id) throw new Error("environmentId is required");
  const idx = store.environments.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error("environment not found");
  store.environments.splice(idx, 1);
  if (store.activeEnvironmentId === id) store.activeEnvironmentId = store.environments[0]?.id ?? null;
  persist();
  return { ok: true };
});

ipcMain.handle("setGlobalsV1", async (_evt, args: { globals: any }) => {
  store.globals = parseVariablesMap(args.globals);
  persist();
  return { ok: true };
});

ipcMain.handle("setEnvironmentVarsV1", async (_evt, args: { environmentId: string; variables: any }) => {
  const id = args?.environmentId;
  if (!id) throw new Error("environmentId is required");
  const env = store.environments.find((e) => e.id === id);
  if (!env) throw new Error("environment not found");
  env.variables = parseVariablesMap(args.variables);
  persist();
  return { ok: true };
});

ipcMain.handle("clearHistory", async () => {
  store.history = [];
  persist();
  return { ok: true };
});

ipcMain.handle("sendRequestV1", async (_evt, request: RequestDefinitionV1) => {
  const result: SendRequestResultV1 = await runRequestV1(store, request);

  const item: HistoryItem = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    method: request.method,
    url: request.url,
    resolvedUrl: result.resolvedUrl,
    success: result.success,
    statusCode: result.statusCode,
    responsePreview: result.responsePreview,
    errorMessage: result.errorMessage,
  };

  store.history.unshift(item);
  if (store.history.length > 200) store.history.length = 200;
  persist();

  return result;
});

ipcMain.handle("createCollectionV1", async (_evt, args: { name: string }) => {
  const name = (args?.name ?? "").trim();
  if (!name) throw new Error("collection name is empty");

  const id = crypto.randomUUID();
  const collection: CollectionV1 = { id, name, nodes: [] };
  store.collections.unshift(collection);
  persist();
  return { ok: true, id };
});

ipcMain.handle("renameCollectionV1", async (_evt, args: { collectionId: string; name: string }) => {
  const collectionId = args?.collectionId;
  const name = (args?.name ?? "").trim();
  if (!collectionId) throw new Error("collectionId is required");
  if (!name) throw new Error("name is empty");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");

  collection.name = name;
  persist();
  return { ok: true };
});

ipcMain.handle("deleteCollectionV1", async (_evt, args: { collectionId: string }) => {
  const collectionId = args?.collectionId;
  if (!collectionId) throw new Error("collectionId is required");

  const idx = store.collections.findIndex((c) => c.id === collectionId);
  if (idx === -1) throw new Error("collection not found");

  store.collections.splice(idx, 1);
  persist();
  return { ok: true };
});

function findFolderById(nodes: CollectionNodeV1[], folderId: string | null): CollectionFolderNodeV1 | null {
  if (!folderId) return null;
  for (const n of nodes) {
    if (n.type === "folder") {
      if (n.id === folderId) return n;
      const found = findFolderById(n.children, folderId);
      if (found) return found;
    }
  }
  return null;
}

function findRequestById(nodes: CollectionNodeV1[], requestId: string): CollectionRequestNodeV1 | null {
  for (const n of nodes) {
    if (n.type === "request" && n.id === requestId) return n;
    if (n.type === "folder") {
      const found = findRequestById(n.children, requestId);
      if (found) return found;
    }
  }
  return null;
}

function deleteRequestById(nodes: CollectionNodeV1[], requestId: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === "request" && n.id === requestId) {
      nodes.splice(i, 1);
      return true;
    }
    if (n.type === "folder") {
      const deleted = deleteRequestById(n.children, requestId);
      if (deleted) return true;
    }
  }
  return false;
}

function renameFolderById(nodes: CollectionNodeV1[], folderId: string, newName: string): boolean {
  for (const n of nodes) {
    if (n.type === "folder") {
      if (n.id === folderId) {
        n.name = newName;
        return true;
      }
      const renamed = renameFolderById(n.children, folderId, newName);
      if (renamed) return true;
    }
  }
  return false;
}

function renameRequestById(nodes: CollectionNodeV1[], requestId: string, newName: string): boolean {
  for (const n of nodes) {
    if (n.type === "request" && n.id === requestId) {
      n.name = newName;
      return true;
    }
    if (n.type === "folder") {
      const renamed = renameRequestById(n.children, requestId, newName);
      if (renamed) return true;
    }
  }
  return false;
}

function extractRequestById(nodes: CollectionNodeV1[], requestId: string): CollectionRequestNodeV1 | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === "request" && n.id === requestId) {
      nodes.splice(i, 1);
      return n;
    }
    if (n.type === "folder") {
      const extracted = extractRequestById(n.children, requestId);
      if (extracted) return extracted;
    }
  }
  return null;
}

function extractFolderById(nodes: CollectionNodeV1[], folderId: string): CollectionFolderNodeV1 | null {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === "folder" && n.id === folderId) {
      nodes.splice(i, 1);
      return n;
    }
    if (n.type === "folder") {
      const extracted = extractFolderById(n.children, folderId);
      if (extracted) return extracted;
    }
  }
  return null;
}

function deleteFolderById(nodes: CollectionNodeV1[], folderId: string): boolean {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === "folder" && n.id === folderId) {
      nodes.splice(i, 1);
      return true;
    }
    if (n.type === "folder") {
      const deleted = deleteFolderById(n.children, folderId);
      if (deleted) return true;
    }
  }
  return false;
}

function containsFolderId(nodes: CollectionNodeV1[], folderId: string): boolean {
  for (const n of nodes) {
    if (n.type === "folder") {
      if (n.id === folderId) return true;
      if (containsFolderId(n.children, folderId)) return true;
    }
  }
  return false;
}

ipcMain.handle("createFolderV1", async (_evt, args: { collectionId: string; parentFolderId?: string | null; name: string }) => {
  const collectionId = args?.collectionId;
  if (!collectionId) throw new Error("collectionId is required");
  const name = (args?.name ?? "").trim();
  if (!name) throw new Error("folder name is empty");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  const parent = findFolderById(collection.nodes, args.parentFolderId ?? null);
  const target = parent ? parent.children : collection.nodes;

  target.unshift({
    id: crypto.randomUUID(),
    type: "folder",
    name,
    children: [],
  });

  persist();
  return { ok: true };
});

ipcMain.handle("deleteRequestNodeV1", async (_evt, args: { collectionId: string; requestId: string }) => {
  const collectionId = args?.collectionId;
  const requestId = args?.requestId;
  if (!collectionId) throw new Error("collectionId is required");
  if (!requestId) throw new Error("requestId is required");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  const deleted = deleteRequestById(collection.nodes, requestId);
  if (!deleted) throw new Error("request not found");

  persist();
  return { ok: true };
});

ipcMain.handle("deleteFolderV1", async (_evt, args: { collectionId: string; folderId: string }) => {
  const collectionId = args?.collectionId;
  const folderId = args?.folderId;
  if (!collectionId) throw new Error("collectionId is required");
  if (!folderId) throw new Error("folderId is required");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  const deleted = deleteFolderById(collection.nodes, folderId);
  if (!deleted) throw new Error("folder not found");

  persist();
  return { ok: true };
});

ipcMain.handle(
  "moveRequestNodeV1",
  async (
    _evt,
    args: {
      requestId: string;
      targetCollectionId: string;
      targetFolderId?: string | null;
    },
  ) => {
    const requestId = args?.requestId;
    const targetCollectionId = args?.targetCollectionId;
    const targetFolderId = args?.targetFolderId ?? null;
    if (!requestId) throw new Error("requestId is required");
    if (!targetCollectionId) throw new Error("targetCollectionId is required");

    // Extract from whichever collection contains it
    let extracted: CollectionRequestNodeV1 | null = null;
    for (const c of store.collections) {
      if (!Array.isArray(c.nodes)) c.nodes = [];
      extracted = extractRequestById(c.nodes, requestId);
      if (extracted) break;
    }
    if (!extracted) throw new Error("request not found");

    const targetCollection = store.collections.find((c) => c.id === targetCollectionId);
    if (!targetCollection) throw new Error("target collection not found");
    if (!Array.isArray(targetCollection.nodes)) targetCollection.nodes = [];

    const parent = findFolderById(targetCollection.nodes, targetFolderId);
    const targetArr = parent ? parent.children : targetCollection.nodes;
    targetArr.unshift(extracted);

    persist();
    return { ok: true };
  },
);

ipcMain.handle(
  "moveRequestNodeToIndexV1",
  async (
    _evt,
    args: {
      requestId: string;
      targetCollectionId: string;
      targetFolderId?: string | null;
      targetIndex: number;
    },
  ) => {
    const requestId = args?.requestId;
    const targetCollectionId = args?.targetCollectionId;
    const targetFolderId = args?.targetFolderId ?? null;
    const targetIndex = Number(args?.targetIndex);

    if (!requestId) throw new Error("requestId is required");
    if (!targetCollectionId) throw new Error("targetCollectionId is required");
    if (!Number.isFinite(targetIndex)) throw new Error("targetIndex is required");

    // Extract from whichever collection contains it
    let extracted: CollectionRequestNodeV1 | null = null;
    for (const c of store.collections) {
      if (!Array.isArray(c.nodes)) c.nodes = [];
      extracted = extractRequestById(c.nodes, requestId);
      if (extracted) break;
    }
    if (!extracted) throw new Error("request not found");

    const targetCollection = store.collections.find((c) => c.id === targetCollectionId);
    if (!targetCollection) throw new Error("target collection not found");
    if (!Array.isArray(targetCollection.nodes)) targetCollection.nodes = [];

    const parent = findFolderById(targetCollection.nodes, targetFolderId);
    const targetArr = parent ? parent.children : targetCollection.nodes;

    const idx = Math.max(0, Math.min(targetArr.length, Math.floor(targetIndex)));
    targetArr.splice(idx, 0, extracted);

    persist();
    return { ok: true };
  },
);

ipcMain.handle(
  "moveFolderV1",
  async (
    _evt,
    args: {
      folderId: string;
      targetCollectionId: string;
      targetFolderId?: string | null;
    },
  ) => {
    const folderId = args?.folderId;
    const targetCollectionId = args?.targetCollectionId;
    const targetFolderId = args?.targetFolderId ?? null;
    if (!folderId) throw new Error("folderId is required");
    if (!targetCollectionId) throw new Error("targetCollectionId is required");
    if (targetFolderId && targetFolderId === folderId) throw new Error("cannot move folder into itself");

    // Extract from whichever collection contains it
    let extracted: CollectionFolderNodeV1 | null = null;
    for (const c of store.collections) {
      if (!Array.isArray(c.nodes)) c.nodes = [];
      extracted = extractFolderById(c.nodes, folderId);
      if (extracted) break;
    }
    if (!extracted) throw new Error("folder not found");

    const targetCollection = store.collections.find((c) => c.id === targetCollectionId);
    if (!targetCollection) throw new Error("target collection not found");
    if (!Array.isArray(targetCollection.nodes)) targetCollection.nodes = [];

    // Descendant check: hedef klasor, tasinan klasorun icindeyse engelle
    if (targetFolderId && containsFolderId(extracted.children, targetFolderId)) {
      throw new Error("cannot move folder into its descendant");
    }

    const parent = findFolderById(targetCollection.nodes, targetFolderId);
    if (targetFolderId && !parent) throw new Error("target folder not found");
    if (parent && parent.id === extracted.id) throw new Error("cannot move folder into itself");

    const targetArr = parent ? parent.children : targetCollection.nodes;
    targetArr.unshift(extracted);

    persist();
    return { ok: true };
  },
);

ipcMain.handle("renameFolderV1", async (_evt, args: { collectionId: string; folderId: string; name: string }) => {
  const collectionId = args?.collectionId;
  const folderId = args?.folderId;
  const name = (args?.name ?? "").trim();
  if (!collectionId) throw new Error("collectionId is required");
  if (!folderId) throw new Error("folderId is required");
  if (!name) throw new Error("name is empty");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  const renamed = renameFolderById(collection.nodes, folderId, name);
  if (!renamed) throw new Error("folder not found");

  persist();
  return { ok: true };
});

ipcMain.handle("renameRequestNodeV1", async (_evt, args: { collectionId: string; requestId: string; name: string }) => {
  const collectionId = args?.collectionId;
  const requestId = args?.requestId;
  const name = (args?.name ?? "").trim();
  if (!collectionId) throw new Error("collectionId is required");
  if (!requestId) throw new Error("requestId is required");
  if (!name) throw new Error("name is empty");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  const renamed = renameRequestById(collection.nodes, requestId, name);
  if (!renamed) throw new Error("request not found");

  persist();
  return { ok: true };
});

ipcMain.handle("upsertRequestNodeV1", async (_evt, args: {
  collectionId: string;
  parentFolderId?: string | null;
  requestId?: string;
  name: string;
  definition: RequestDefinitionV1;
}) => {
  const collectionId = args?.collectionId;
  if (!collectionId) throw new Error("collectionId is required");
  const reqName = (args?.name ?? "").trim();
  if (!reqName) throw new Error("request name is empty");

  const collection = store.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error("collection not found");
  if (!Array.isArray(collection.nodes)) collection.nodes = [];

  if (args.requestId) {
    const existing = findRequestById(collection.nodes, args.requestId);
    if (!existing) throw new Error("request not found");
    existing.name = reqName;
    existing.definition = args.definition;
    persist();
    return { ok: true };
  }

  const parent = findFolderById(collection.nodes, args.parentFolderId ?? null);
  const target = parent ? parent.children : collection.nodes;

  target.unshift({
    id: crypto.randomUUID(),
    type: "request",
    name: reqName,
    definition: args.definition,
  } as CollectionRequestNodeV1);

  persist();
  return { ok: true };
});

ipcMain.handle("exportV1", async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Export",
    defaultPath: "apizero-export-v1.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return { ok: false, reason: "cancelled" };

  const payload = {
    version: "v1",
    environment: store.environment,
    globals: store.globals,
    collections: store.collections,
  };

  saveStore(filePath, payload as any);
  return { ok: true, filePath };
});

ipcMain.handle("importV1", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false, reason: "cancelled" };

  const filePath = filePaths[0];
  // payload is read via loadStore because it already does JSON parse
  // but we just need environment/globals.
  const imported = loadStore(filePath) as any;

  // imported might contain history as well; ignore.
  store.environment = imported.environment ? parseVariablesMap(imported.environment) : {};
  store.globals = imported.globals ? parseVariablesMap(imported.globals) : {};
  store.collections = imported.collections ? (imported.collections as CollectionV1[]) : [];

  migrateCollectionsToTreeV1();
  persist();
  return { ok: true, filePath };
});

function postmanUrlToRaw(url: any): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (typeof url.raw === "string") return url.raw;
  if (Array.isArray(url.path) && typeof url.protocol === "string" && Array.isArray(url.host)) {
    const host = url.host.join(".");
    const pathPart = url.path.join("/");
    return `${url.protocol}://${host}/${pathPart}`;
  }
  return "";
}

function postmanHeadersToRecord(headers: any): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const h of headers) {
      const key = String(h?.key ?? "").trim();
      if (!key) continue;
      if (h?.disabled) continue;
      out[key] = String(h?.value ?? "");
    }
  } else if (headers && typeof headers === "object") {
    for (const [k, v] of Object.entries(headers)) out[String(k)] = String(v ?? "");
  }
  return out;
}

function postmanBodyToRaw(body: any): string | undefined {
  if (!body) return undefined;
  if (body.mode === "raw" && typeof body.raw === "string") return body.raw;
  return undefined;
}

function postmanEventsToPostResScript(events: any): string {
  if (!Array.isArray(events)) return "";
  const test = events.find((e) => e?.listen === "test");
  const exec = test?.script?.exec;
  if (Array.isArray(exec)) return exec.join("\n");
  if (typeof exec === "string") return exec;
  return "";
}

function convertPostmanItemsToNodes(items: any[]): CollectionNodeV1[] {
  const nodes: CollectionNodeV1[] = [];
  for (const it of items ?? []) {
    const name = String(it?.name ?? "Item");
    if (Array.isArray(it?.item)) {
      nodes.push({
        id: crypto.randomUUID(),
        type: "folder",
        name,
        children: convertPostmanItemsToNodes(it.item),
      });
      continue;
    }

    const req = it?.request;
    if (!req) continue;
    const method = String(req.method ?? "GET").toUpperCase();
    const url = postmanUrlToRaw(req.url);
    const headers = postmanHeadersToRecord(req.header);
    const body = postmanBodyToRaw(req.body);
    const postResScript = postmanEventsToPostResScript(it?.event);

    nodes.push({
      id: crypto.randomUUID(),
      type: "request",
      name,
      definition: {
        method,
        url,
        headers,
        body,
        postResScript,
      },
    });
  }
  return nodes;
}

ipcMain.handle("importPostmanCollectionV21", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import Postman Collection (v2.1)",
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false, reason: "cancelled" };

  const filePath = filePaths[0];
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  const name = String(parsed?.info?.name ?? "Imported");
  const items = Array.isArray(parsed?.item) ? parsed.item : [];

  const collection: CollectionV1 = {
    id: crypto.randomUUID(),
    name,
    nodes: convertPostmanItemsToNodes(items),
  };

  store.collections.unshift(collection);
  persist();
  return { ok: true, id: collection.id };
});

async function fetchOpenApiJsonFromUrl(urlStr: string): Promise<string> {
  const trimmed = urlStr.trim();
  if (!trimmed) throw new Error("URL boş");
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("Geçersiz URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Sadece http veya https");
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(trimmed, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { Accept: "application/json, application/json;q=0.9, */*;q=0.8" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (text.length > 25 * 1024 * 1024) throw new Error("Yanıt çok büyük (en fazla 25 MB)");
    return text;
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Zaman aşımı (30 sn)");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function importOpenApiCollectionFromJsonText(raw: string): CollectionV1 {
  const parsed = JSON.parse(raw);
  return openApiDocumentToCollection(parsed);
}

function importOpenApiCollectionFromParsedJson(doc: unknown): CollectionV1 {
  return openApiDocumentToCollection(doc);
}

ipcMain.handle("importOpenApiV1", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: "Import OpenAPI / Swagger (JSON)",
    properties: ["openFile"],
    filters: [{ name: "OpenAPI / Swagger", extensions: ["json", "yaml", "yml"] }],
  });
  if (canceled || !filePaths || filePaths.length === 0) return { ok: false, reason: "cancelled" };

  const filePath = filePaths[0];
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".yaml" || ext === ".yml") {
      return {
        ok: false,
        reason: "yaml",
        message: "Şimdilik sadece JSON destekleniyor; swagger.json dosyasını kullanın.",
      };
    }
    const collection = importOpenApiCollectionFromJsonText(raw);
    store.collections.unshift(collection);
    persist();
    return { ok: true, id: collection.id, name: collection.name, requestCount: countRequestNodes(collection.nodes ?? []) };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
});

ipcMain.handle("importOpenApiFromUrlV1", async (_evt, args: { url: string }) => {
  const urlStr = String(args?.url ?? "").trim();
  if (!urlStr) return { ok: false, message: "URL boş" };
  try {
    const raw = await fetchOpenApiJsonFromUrl(urlStr);
    // BOM bazen JSON parse etmeyi bozuyor (özellikle bazı editör/servislerde)
    const normalized = raw.replace(/^\uFEFF/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(normalized);
    } catch (e: any) {
      const t = String(normalized ?? "").trim();
      const lower = t.slice(0, 500).toLowerCase();
      // Swagger UI gibi HTML dönüyorsa direkt mesaj verelim.
      if (lower.startsWith("<") || lower.includes("swagger-ui")) {
        return {
          ok: false,
          message: "URL HTML döndürüyor gibi görünüyor (Swagger UI sayfası olabilir). Lütfen JSON endpoint kullan (örn: /swagger.json).",
        };
      }
      // YAML ihtimalinde açıkça söyleyelim.
      if (lower.startsWith("openapi:") || lower.startsWith("swagger:") || lower.includes("\nopenapi:") || lower.includes("\nswagger:")) {
        return {
          ok: false,
          message: "URL YAML döndürüyor gibi görünüyor. Şimdilik URL'den sadece JSON import destekleniyor (örn: /swagger.json).",
        };
      }
      return {
        ok: false,
        message: `JSON parse edilemedi: ${e?.message ?? "hata"}. URL'nin swagger.json/OpenAPI JSON döndürdüğünden emin ol.`,
      };
    }

    const collection = importOpenApiCollectionFromParsedJson(parsed);
    store.collections.unshift(collection);
    persist();
    return { ok: true, id: collection.id, name: collection.name, requestCount: countRequestNodes(collection.nodes ?? []) };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? String(e) };
  }
});

function countRequestNodes(nodes: CollectionNodeV1[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.type === "request") n += 1;
    else if (node.type === "folder") n += countRequestNodes(node.children ?? []);
  }
  return n;
}

app.whenReady().then(() => {
  migrateCollectionsToTreeV1();
  persist();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

