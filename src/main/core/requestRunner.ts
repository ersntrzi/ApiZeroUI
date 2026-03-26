import { ApiZeroScriptError, runPostResScriptV1 } from "./scriptSandbox";
import {
  PersistedStore,
  RequestDefinitionV1,
  SendRequestResultV1,
  TypedVariable,
} from "./types";

class ApiZeroRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiZeroRequestError";
  }
}

function valueToString(v: TypedVariable["value"]): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  return v ? "true" : "false";
}

function cloneVariablesMap(input: Record<string, { type: any; value: any }>): typeof input {
  const out: typeof input = {};
  for (const [k, v] of Object.entries(input)) out[k] = { type: v.type, value: v.value };
  return out;
}

function resolveTemplateStringV1(
  template: string,
  environment: Record<string, { type: any; value: any }>,
  globals: PersistedStore["globals"],
): string {
  const re = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

  return template.replace(re, (_, varName: string) => {
    const envVar = environment[varName];
    if (envVar) return valueToString(envVar.value);

    const globalVar = globals[varName];
    if (globalVar) return valueToString(globalVar.value);

    throw new ApiZeroRequestError(`variable not found: ${varName}`);
  });
}

async function sendHttpV1(args: {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyText?: string;
}) {
  const headers = { ...args.headers };

  let body: any = undefined;
  if (args.bodyText !== undefined) {
    const trimmed = args.bodyText.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      // JSON body gibi gorunuyorsa parse edip JSON gonderecegiz.
      try {
        const obj = JSON.parse(trimmed);
        body = JSON.stringify(obj);
        if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) {
          headers["Content-Type"] = "application/json";
        }
      } catch {
        // Yine de string olarak gonder
        body = args.bodyText;
      }
    } else {
      body = args.bodyText;
    }
  }

  // Node 18+ fetch (Electron tarafinda da var)
  const resp = await fetch(args.url, {
    method: args.method,
    headers,
    body,
  });

  return resp;
}

function previewJson(v: any, maxChars: number): string {
  try {
    const s = JSON.stringify(v, null, 2);
    return s.length > maxChars ? s.slice(0, maxChars) + "...(truncated)" : s;
  } catch {
    return String(v).slice(0, maxChars);
  }
}

export async function runRequestV1(
  store: PersistedStore,
  request: RequestDefinitionV1,
): Promise<SendRequestResultV1> {
  const activeEnv =
    store.activeEnvironmentId
      ? store.environments.find((e) => e.id === store.activeEnvironmentId)
      : undefined;
  const envVars = activeEnv?.variables ?? {};

  let resolvedUrl = request.url;
  let resolvedHeaders: Record<string, string> = {};
  let resolvedBody: string | undefined = request.body;

  try {
    resolvedUrl = resolveTemplateStringV1(resolvedUrl, envVars, store.globals);

    for (const [k, v] of Object.entries(request.headers ?? {})) {
      resolvedHeaders[k] = resolveTemplateStringV1(v, envVars, store.globals);
    }

    if (resolvedBody !== undefined) {
      resolvedBody = resolveTemplateStringV1(resolvedBody, envVars, store.globals);
    }
  } catch (e: any) {
    return { success: false, errorMessage: e?.message ?? "template resolve failed", resolvedUrl: resolvedUrl };
  }

  let resp: Response;
  try {
    resp = await sendHttpV1({
      method: request.method,
      url: resolvedUrl,
      headers: resolvedHeaders,
      bodyText: resolvedBody,
    });
  } catch (e: any) {
    return { success: false, errorMessage: e?.message ?? "http request failed", resolvedUrl };
  }

  const statusCode = resp.status;

  let rawText: string = "";
  try {
    rawText = await resp.text();
  } catch (e: any) {
    return { success: false, statusCode, errorMessage: e?.message ?? "failed to read response body", resolvedUrl };
  }

  // JSON ise parse et; degilse raw text olarak goster.
  let resBody: any = null;
  let isJson = false;
  if (rawText.trim()) {
    try {
      resBody = JSON.parse(rawText);
      isJson = true;
    } catch {
      isJson = false;
      resBody = null;
    }
  }

  const responsePreview = isJson
    ? previewJson(resBody, 8000)
    : (rawText.length > 8000 ? rawText.slice(0, 8000) + "...(truncated)" : rawText);

  // post-res (V1) parse sonrasi hemen calisir; basarisiz olursa deger set edilmez.
  const envDraft = cloneVariablesMap(envVars);
  const globalsDraft = cloneVariablesMap(store.globals);

  try {
    if (!isJson && (request.postResScript ?? "").trim()) {
      throw new ApiZeroScriptError("post-res requires JSON response");
    }
    runPostResScriptV1({
      code: request.postResScript,
      resBody,
      environmentDraft: envDraft,
      globalsDraft: globalsDraft,
    });
  } catch (e: any) {
    const msg = e instanceof ApiZeroScriptError ? e.message : e?.message ?? "post-res failed";
    return { success: false, statusCode, responsePreview, errorMessage: msg, resolvedUrl };
  }

  // Script basarili: commit degisiklikleri
  // active environment'a yaz
  if (activeEnv) {
    activeEnv.variables = envDraft as any;
  } else {
    // environment yoksa otomatik default olustur
    store.environments.push({ id: "default", name: "Default", variables: envDraft as any });
    store.activeEnvironmentId = "default";
  }
  store.globals = globalsDraft;

  const success = statusCode >= 200 && statusCode < 300;
  return { success, statusCode, responsePreview, resolvedUrl };
}

