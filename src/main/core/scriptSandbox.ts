import vm from "vm";
import { TypedVariable, VariablesMap } from "./types";

export class ApiZeroScriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiZeroScriptError";
  }
}

function createTrackedProxy(value: any, currentPath: string, onUndefinedPath: (p: string) => void): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  // Proxy sadece okuma tarafinda kullaniliyor (script'in set islemi kullaniciya acik degil).
  return new Proxy(value, {
    get(target, prop, receiver) {
      // Symbol/JS internallari haric.
      if (typeof prop === "symbol") {
        return Reflect.get(target, prop, receiver);
      }

      const nextPath = `${currentPath}.${String(prop)}`;
      const nextVal = target[prop];

      if (nextVal === undefined) {
        onUndefinedPath(nextPath);
        return undefined;
      }

      return createTrackedProxy(nextVal, nextPath, onUndefinedPath);
    },
  });
}

function convertToType(name: string, variableType: TypedVariable["type"], rawValue: any): TypedVariable["value"] {
  if (variableType === "string") return String(rawValue);

  if (variableType === "number") {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) return rawValue;
    if (typeof rawValue === "string") {
      const n = Number.parseFloat(rawValue);
      if (Number.isFinite(n)) return n;
    }
    throw new ApiZeroScriptError(`post-res: set ${name} failed - cannot convert value to number`);
  }

  // boolean
  if (typeof rawValue === "boolean") return rawValue;
  if (typeof rawValue === "string") {
    const s = rawValue.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  throw new ApiZeroScriptError(`post-res: set ${name} failed - cannot convert value to boolean`);
}

function inferTypeFromValue(name: string, rawValue: any): TypedVariable["type"] {
  if (typeof rawValue === "string") return "string";
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) return "number";
  if (typeof rawValue === "boolean") return "boolean";
  throw new ApiZeroScriptError(
    `post-res: set ${name} failed - value must be string/number/boolean`
  );
}

export interface RunPostResScriptArgs {
  code: string;
  resBody: any;
  environmentDraft: VariablesMap;
  globalsDraft: VariablesMap;
}

export function runPostResScriptV1(args: RunPostResScriptArgs): void {
  const code = (args.code ?? "").trim();
  if (!code) return;

  let lastUndefinedPath: string | undefined;
  const onUndefinedPath = (p: string) => {
    lastUndefinedPath = p;
  };

  const trackedBody = createTrackedProxy(args.resBody, "res.body", onUndefinedPath);

  const pm = {
    environment: {
      set: (name: string, value: any) => {
        if (value === undefined) {
          const p = lastUndefinedPath ?? `res.body.${name}`;
          throw new ApiZeroScriptError(
            `post-res: set ${name} failed - ${p} is undefined`
          );
        }

        const existing = args.environmentDraft[name];
        if (!existing) {
          const type = inferTypeFromValue(name, value);
          args.environmentDraft[name] = { type, value: convertToType(name, type, value) };
          return;
        }

        const converted = convertToType(name, existing.type, value);
        args.environmentDraft[name] = { type: existing.type, value: converted };
      },
    },
    globals: {
      set: (name: string, value: any) => {
        if (value === undefined) {
          const p = lastUndefinedPath ?? `res.body.${name}`;
          throw new ApiZeroScriptError(
            `post-res: set ${name} failed - ${p} is undefined`
          );
        }

        const existing = args.globalsDraft[name];
        if (!existing) {
          const type = inferTypeFromValue(name, value);
          args.globalsDraft[name] = { type, value: convertToType(name, type, value) };
          return;
        }

        const converted = convertToType(name, existing.type, value);
        args.globalsDraft[name] = { type: existing.type, value: converted };
      },
    },
  };

  // vm sandbox: kullaniciya sadece res ve pm veriyoruz.
  const sandbox: any = {
    pm,
    res: {
      body: trackedBody,
    },
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(code, { filename: "post-res.js" });

  // Timeout ile sonsuz dongu riskini azaltiyoruz (V1 icin async/loop karsit anlayis).
  script.runInContext(context, { timeout: 1000 });
}

