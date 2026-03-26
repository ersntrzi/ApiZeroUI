import { contextBridge, ipcRenderer } from "electron";
import type { CollectionV1, HistoryItem, RequestDefinitionV1 } from "./main/core/types";

contextBridge.exposeInMainWorld("api", {
  getState: () => ipcRenderer.invoke("getState") as Promise<{
    environments: Array<{ id: string; name: string; variables: any }>;
    activeEnvironmentId: string | null;
    globals: Record<string, { type: string; value: any }>;
    history: HistoryItem[];
    collections: CollectionV1[];
  }>,
  createEnvironmentV1: (args: { name: string }) => ipcRenderer.invoke("createEnvironmentV1", args),
  setActiveEnvironmentV1: (args: { environmentId: string | null }) =>
    ipcRenderer.invoke("setActiveEnvironmentV1", args),
  renameEnvironmentV1: (args: { environmentId: string; name: string }) =>
    ipcRenderer.invoke("renameEnvironmentV1", args),
  deleteEnvironmentV1: (args: { environmentId: string }) => ipcRenderer.invoke("deleteEnvironmentV1", args),
  setEnvironmentVarsV1: (args: { environmentId: string; variables: any }) =>
    ipcRenderer.invoke("setEnvironmentVarsV1", args),
  setGlobalsV1: (args: { globals: any }) => ipcRenderer.invoke("setGlobalsV1", args),
  clearHistory: () => ipcRenderer.invoke("clearHistory"),
  sendRequestV1: (request: RequestDefinitionV1) => ipcRenderer.invoke("sendRequestV1", request),
  createCollectionV1: (args: { name: string }) => ipcRenderer.invoke("createCollectionV1", args),
  createFolderV1: (args: { collectionId: string; parentFolderId?: string | null; name: string }) =>
    ipcRenderer.invoke("createFolderV1", args),
  deleteRequestNodeV1: (args: { collectionId: string; requestId: string }) =>
    ipcRenderer.invoke("deleteRequestNodeV1", args),
  deleteFolderV1: (args: { collectionId: string; folderId: string }) =>
    ipcRenderer.invoke("deleteFolderV1", args),
  moveRequestNodeV1: (args: { requestId: string; targetCollectionId: string; targetFolderId?: string | null }) =>
    ipcRenderer.invoke("moveRequestNodeV1", args),
  moveFolderV1: (args: { folderId: string; targetCollectionId: string; targetFolderId?: string | null }) =>
    ipcRenderer.invoke("moveFolderV1", args),
  renameCollectionV1: (args: { collectionId: string; name: string }) =>
    ipcRenderer.invoke("renameCollectionV1", args),
  deleteCollectionV1: (args: { collectionId: string }) =>
    ipcRenderer.invoke("deleteCollectionV1", args),
  renameFolderV1: (args: { collectionId: string; folderId: string; name: string }) =>
    ipcRenderer.invoke("renameFolderV1", args),
  renameRequestNodeV1: (args: { collectionId: string; requestId: string; name: string }) =>
    ipcRenderer.invoke("renameRequestNodeV1", args),
  upsertRequestNodeV1: (args: {
    collectionId: string;
    parentFolderId?: string | null;
    requestId?: string;
    name: string;
    definition: RequestDefinitionV1;
  }) => ipcRenderer.invoke("upsertRequestNodeV1", args),
  exportV1: () => ipcRenderer.invoke("exportV1"),
  importV1: () => ipcRenderer.invoke("importV1"),
  importPostmanCollectionV21: () => ipcRenderer.invoke("importPostmanCollectionV21"),
  importOpenApiV1: () => ipcRenderer.invoke("importOpenApiV1"),
  importOpenApiFromUrlV1: (args: { url: string }) => ipcRenderer.invoke("importOpenApiFromUrlV1", args),
  saveOpenRequestTabsV1: (payload: { tabs: unknown[]; activeTabId: string | null }) =>
    ipcRenderer.invoke("saveOpenRequestTabsV1", payload),
  saveOpenRequestTabsV1Sync: (payload: { tabs: unknown[]; activeTabId: string | null }) => {
    ipcRenderer.sendSync("saveOpenRequestTabsV1Sync", payload);
  },
});

