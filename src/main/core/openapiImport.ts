import crypto from "crypto";
import type {
  CollectionFolderNodeV1,
  CollectionNodeV1,
  CollectionRequestNodeV1,
  CollectionV1,
  RequestDefinitionV1,
} from "./types";

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
  "trace",
]);

/** OpenAPI path `{id}` -> ApiZero `{{id}}` */
function pathToUrlTemplate(path: string): string {
  return String(path).replace(/\{([^}]+)\}/g, "{{$1}}");
}

function joinBasePath(base: string, path: string): string {
  const b = base.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!b) return p;
  return `${b}${p}`;
}

function hasJsonRequestBodyOas3(op: Record<string, unknown>): boolean {
  const rb = op.requestBody as Record<string, unknown> | undefined;
  if (!rb || typeof rb !== "object") return false;
  const content = rb.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== "object") return false;
  return (
    "application/json" in content ||
    "application/*+json" in content ||
    Object.keys(content).some((k) => k.includes("json"))
  );
}

function hasJsonBodySwagger2(op: Record<string, unknown>): boolean {
  const consumes = op.consumes;
  if (Array.isArray(consumes)) {
    return consumes.some((c) => String(c).toLowerCase().includes("json"));
  }
  const params = op.parameters;
  if (!Array.isArray(params)) return false;
  return params.some((p: any) => p && p.in === "body");
}

function buildDefinition(
  method: string,
  url: string,
  withJsonBody: boolean,
): RequestDefinitionV1 {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (withJsonBody) {
    headers["Content-Type"] = "application/json";
    body = "{}";
  }
  return {
    method,
    url,
    headers,
    body,
    postResScript: "",
  };
}

function requestNameForOperation(
  method: string,
  pathStr: string,
  op: Record<string, unknown>,
): string {
  const summary = typeof op.summary === "string" ? op.summary.trim() : "";
  if (summary) return summary;
  const oid = typeof op.operationId === "string" ? op.operationId.trim() : "";
  if (oid) return oid;
  return `${method} ${pathStr}`;
}

function folderNameForOperation(op: Record<string, unknown>): string {
  const tags = op.tags;
  if (Array.isArray(tags) && tags.length > 0 && typeof tags[0] === "string" && tags[0].trim()) {
    return tags[0].trim();
  }
  return "Genel";
}

function convertPathsToRequests(
  pathsObj: Record<string, unknown>,
  baseUrl: string,
  isSwagger2: boolean,
): Map<string, CollectionRequestNodeV1[]> {
  const byTag = new Map<string, CollectionRequestNodeV1[]>();

  const paths = pathsObj ?? {};
  for (const [pathStr, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object" || pathItem === null) continue;
    const pi = pathItem as Record<string, unknown>;
    if ("$ref" in pi) continue;

    const urlT = pathToUrlTemplate(pathStr);
    const fullUrl = joinBasePath(baseUrl, urlT);

    for (const methodLower of Object.keys(pi)) {
      if (!HTTP_METHODS.has(methodLower)) continue;
      const op = pi[methodLower];
      if (!op || typeof op !== "object" || op === null) continue;
      if ("$ref" in (op as object)) continue;

      const o = op as Record<string, unknown>;
      const method = methodLower.toUpperCase();
      const name = requestNameForOperation(method, pathStr, o);
      const jsonBody = isSwagger2 ? hasJsonBodySwagger2(o) : hasJsonRequestBodyOas3(o);
      const def = buildDefinition(method, fullUrl, jsonBody);
      const folder = folderNameForOperation(o);

      const node: CollectionRequestNodeV1 = {
        id: crypto.randomUUID(),
        type: "request",
        name,
        definition: def,
      };

      const list = byTag.get(folder) ?? [];
      list.push(node);
      byTag.set(folder, list);
    }
  }

  return byTag;
}

function tagMapToFolderNodes(byTag: Map<string, CollectionRequestNodeV1[]>): CollectionNodeV1[] {
  const tags = [...byTag.keys()].sort((a, b) => a.localeCompare(b, "tr"));
  const nodes: CollectionNodeV1[] = [];
  for (const tag of tags) {
    const children = byTag.get(tag) ?? [];
    if (children.length === 0) continue;
    if (tags.length === 1 && tag === "Genel") {
      nodes.push(...children);
    } else {
      const folder: CollectionFolderNodeV1 = {
        id: crypto.randomUUID(),
        type: "folder",
        name: tag,
        children,
      };
      nodes.push(folder);
    }
  }
  return nodes;
}

function convertOpenApi3(doc: Record<string, unknown>): CollectionV1 {
  const info = doc.info as Record<string, unknown> | undefined;
  const title =
    typeof info?.title === "string" && info.title.trim() ? info.title.trim() : "OpenAPI import";

  let baseUrl = "";
  const servers = doc.servers;
  if (Array.isArray(servers) && servers.length > 0) {
    const u = (servers[0] as { url?: string })?.url;
    if (typeof u === "string") baseUrl = u.trim().replace(/\/$/, "");
  }

  const paths = (doc.paths ?? {}) as Record<string, unknown>;
  const byTag = convertPathsToRequests(paths, baseUrl, false);
  const nodes = tagMapToFolderNodes(byTag);

  return {
    id: crypto.randomUUID(),
    name: title,
    nodes,
  };
}

function convertSwagger2(doc: Record<string, unknown>): CollectionV1 {
  const info = doc.info as Record<string, unknown> | undefined;
  const title =
    typeof info?.title === "string" && info.title.trim() ? info.title.trim() : "Swagger import";

  const schemes = Array.isArray(doc.schemes) && doc.schemes.length ? String(doc.schemes[0]) : "https";
  const host = typeof doc.host === "string" ? doc.host.trim() : "";
  const basePath = typeof doc.basePath === "string" ? doc.basePath : "";
  let baseUrl = "";
  if (host) {
    const bp = basePath.startsWith("/") ? basePath : `/${basePath}`;
    baseUrl = `${schemes}://${host}${bp}`.replace(/\/$/, "");
  }

  const paths = (doc.paths ?? {}) as Record<string, unknown>;
  const byTag = convertPathsToRequests(paths, baseUrl, true);
  const nodes = tagMapToFolderNodes(byTag);

  return {
    id: crypto.randomUUID(),
    name: title,
    nodes,
  };
}

/**
 * OpenAPI 3.x veya Swagger 2.0 JSON -> ApiZero collection (klasorler tag adina gore).
 */
export function openApiDocumentToCollection(doc: unknown): CollectionV1 {
  if (!doc || typeof doc !== "object" || doc === null) {
    throw new Error("Geçersiz belge");
  }
  const d = doc as Record<string, unknown>;

  if (typeof d.openapi === "string" && d.openapi.startsWith("3.")) {
    return convertOpenApi3(d);
  }
  if (d.swagger === "2.0") {
    return convertSwagger2(d);
  }

  throw new Error('Dosya OpenAPI 3.x ("openapi": "3...") veya Swagger 2.0 ("swagger": "2.0") olmalı');
}
