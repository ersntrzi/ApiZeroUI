export type VariableType = "string" | "number" | "boolean";
export type VariableValue = string | number | boolean;

export interface TypedVariable {
  type: VariableType;
  value: VariableValue;
}

export type VariablesMap = Record<string, TypedVariable>;

export interface EnvironmentV1 {
  id: string;
  name: string;
  variables: VariablesMap;
}

export interface HistoryItem {
  id: string;
  createdAt: number;
  method: string;
  url: string;
  resolvedUrl?: string;
  success: boolean;
  statusCode?: number;
  responsePreview?: string;
  errorMessage?: string;
}

export interface CollectionRequestItemV1 {
  id: string;
  name: string;
  definition: RequestDefinitionV1;
}

export type CollectionNodeTypeV1 = "folder" | "request";

export interface CollectionFolderNodeV1 {
  id: string;
  type: "folder";
  name: string;
  children: CollectionNodeV1[];
  isCollapsed?: boolean;
}

export interface CollectionRequestNodeV1 {
  id: string;
  type: "request";
  name: string;
  definition: RequestDefinitionV1;
}

export type CollectionNodeV1 = CollectionFolderNodeV1 | CollectionRequestNodeV1;

export interface CollectionV1 {
  id: string;
  name: string;
  /**
   * V1 initial: requests[]
   * V1+ (postman-like): nodes tree (folders + requests)
   */
  requests?: CollectionRequestItemV1[];
  nodes?: CollectionNodeV1[];
}

/** Request sekmeleri (renderer openTabs) — uygulama kapaninca kalici */
export interface RequestTabDraftV1 {
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  postResScript: string;
}

export interface OpenRequestTabV1 {
  id: string;
  title: string;
  linked: { collectionId: string; requestId: string } | null;
  draft: RequestTabDraftV1;
}

export interface PersistedStore {
  /**
   * Backward-compat (old V1): store.environment (single map)
   * New (postman-like): environments[] + activeEnvironmentId
   */
  environment?: VariablesMap;
  environments: EnvironmentV1[];
  activeEnvironmentId: string | null;
  globals: VariablesMap;
  history: HistoryItem[];
  collections: CollectionV1[];
  /** Son acik request sekmeleri */
  openRequestTabs: OpenRequestTabV1[];
  activeRequestTabId: string | null;
}

export interface RequestDefinitionV1 {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string; // raw string; template resolution happens before send
  postResScript: string; // V1: only post-res is supported
}

export interface SendRequestResultV1 {
  success: boolean;
  statusCode?: number;
  responsePreview?: string;
  responseRaw?: string;
  responseContentType?: string;
  errorMessage?: string;
  resolvedUrl?: string;
}

