function $(id) {
  return document.getElementById(id);
}

function closeNewCollectionModal() {
  const m = $("newCollectionModal");
  if (m) {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
}

function openNewCollectionModal() {
  closeImportModal();
  closeNewFolderModal();
  const m = $("newCollectionModal");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    const inp = $("newCollectionName");
    if (inp) {
      inp.value = "";
      requestAnimationFrame(() => {
        try {
          inp.focus();
        } catch {
          /* ignore */
        }
      });
    }
  }
}

function openImportModal() {
  closeNewCollectionModal();
  closeNewFolderModal();
  const m = $("importModal");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }
}

function closeImportModal() {
  const m = $("importModal");
  if (m) {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
}

function closeSaveRequestModal() {
  const m = $("saveRequestModal");
  if (m) {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
}

function closeImportOpenApiUrlModal() {
  const m = $("importOpenApiUrlModal");
  if (m) {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
}

function openImportOpenApiUrlModal(initialValue) {
  closeImportModal();
  closeNewCollectionModal();
  closeNewFolderModal();
  closeSaveRequestModal();
  const m = $("importOpenApiUrlModal");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }
  const inp = $("importOpenApiUrlInput");
  if (inp) {
    inp.value = String(initialValue ?? inp.value ?? "").trim();
    requestAnimationFrame(() => {
      try {
        inp.focus();
        inp.select();
      } catch {}
    });
  }
}

function openSaveRequestModal() {
  closeImportModal();
  closeNewCollectionModal();
  closeNewFolderModal();
  const m = $("saveRequestModal");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }
  const sourceName = String(($("requestNameInput")?.value ?? getActiveTab()?.title ?? "")).trim();
  const input = $("saveRequestNameInput");
  if (input) {
    input.value = sourceName;
    requestAnimationFrame(() => {
      try {
        input.focus();
        input.select();
      } catch {
        /* ignore */
      }
    });
  }
  syncSaveRequestCollectionSelect();
}

async function runSaveRequestFallback(forceNew) {
  const initial = String(($("requestNameInput")?.value ?? getActiveTab()?.title ?? "")).trim();
  const name = window.prompt("Request adı girin:", initial || "New Request");
  if (name == null) return;
  const trimmed = String(name).trim();
  if (!trimmed) {
    $("resultLine").textContent = "Request name bos olamaz.";
    return;
  }
  if ($("requestNameInput")) $("requestNameInput").value = trimmed;
  await saveRequest({ forceNew: !!forceNew });
}

function syncSaveRequestCollectionSelect() {
  const sel = $("saveRequestCollectionSelect");
  if (!sel) return;
  const collections = cachedState?.collections ?? [];
  sel.innerHTML = "";
  for (const c of collections) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name ?? "Untitled Collection";
    sel.appendChild(opt);
  }
  const preferredId = saveTargetCollectionId || selectedCollectionId || collections[0]?.id || "";
  if (preferredId) sel.value = preferredId;
}

let newFolderContext = null; // { collectionId: string, parentFolderId: string|null }

function closeNewFolderModal() {
  const m = $("newFolderModal");
  if (m) {
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
  newFolderContext = null;
}

function openNewFolderModal(ctx) {
  closeImportModal();
  closeNewCollectionModal();

  newFolderContext = ctx ?? null;

  const m = $("newFolderModal");
  if (m) {
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
    const inp = $("newFolderModalName");
    if (inp) {
      inp.value = "";
      requestAnimationFrame(() => {
        try {
          inp.focus();
        } catch {
          /* ignore */
        }
      });
    }
  }
}

function tryParseJson(text) {
  const t = (text ?? "").trim();
  if (!t) return null;
  return JSON.parse(t);
}

function stringifyVars(v) {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

let __apiZeroLogging = false;

/** Beklenmeyen hata: konsol + status satiri + window.__APIZERO_ERRORS (konsolda: __APIZERO_ERRORS) */
function logApiZeroError(scope, err) {
  if (__apiZeroLogging) {
    try {
      console.error("[ApiZero] (nested)", scope, err);
    } catch {
      /* ignore */
    }
    return;
  }
  __apiZeroLogging = true;
  try {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ApiZero] ${scope}`, msg, err);
    try {
      const buf = (window.__APIZERO_ERRORS = window.__APIZERO_ERRORS || []);
      const stack = err instanceof Error ? err.stack || "" : "";
      buf.push({ t: Date.now(), scope, msg: msg.slice(0, 800), stack: stack.slice(0, 4000) });
      if (buf.length > 120) buf.shift();
    } catch {
      /* ignore */
    }
    try {
      const line = $("resultLine");
      if (line && msg.length < 240) {
        line.textContent = `[ApiZero] ${scope}: ${msg}`;
      }
    } catch {
      /* ignore */
    }
  } catch (e) {
    try {
      console.error("[ApiZero] logApiZeroError failed", e);
    } catch {
      /* ignore */
    }
  } finally {
    __apiZeroLogging = false;
  }
}

/** Global yakalayicilar DOM'a dokunmaz — window.error icinde logApiZeroError sonsuz donguye yol acabilir */
function installApiZeroGlobalErrorHandlers() {
  window.addEventListener("error", (ev) => {
    try {
      console.error("[ApiZero] window.error", ev.error || ev.message || ev);
    } catch {
      /* ignore */
    }
  });
  window.addEventListener("unhandledrejection", (ev) => {
    try {
      console.error("[ApiZero] unhandledrejection", ev.reason);
    } catch {
      /* ignore */
    }
  });
}

let selectedCollectionId = null;
let selectedRequestId = null;
let selectedFolderId = null;
let lastResponse = null;
let headerRows = [];
let paramRows = [];
let syncingUrlFromParams = false;

let saveTargetCollectionId = null;
let saveTargetFolderId = null;

// Tree request reorder drag UI
let draggingTreeRequestEl = null;
let treeDropTargetEl = null;

let renaming = null; // { type: "folder"|"request", id: string, initialName: string }
let pendingDelete = null; // { type: "collection"|"request"|"folder", collectionId: string, id: string }

let cachedState = null; // son getState sonucu
let refreshStateInFlight = null;
const refreshStatePendingOpts = {
  deferHeavy: null,
};
let collapseState = {
  collections: {}, // { [collectionId]: boolean }
  folders: {}, // { [folderId]: boolean }
};

// ---- Request tabs (Postman-like) ----
let openTabs = []; // [{ id, title, linked: {collectionId, requestId} | null, draft }]
let activeTabId = null;
let persistOpenTabsTimer = null;
let isDraggingTab = false;

function reorderOpenTabs(fromTabId, toTabId) {
  if (!fromTabId || !toTabId || fromTabId === toTabId) return;
  const fromIdx = openTabs.findIndex((t) => t.id === fromTabId);
  const toIdx = openTabs.findIndex((t) => t.id === toTabId);
  if (fromIdx === -1 || toIdx === -1) return;

  const [moving] = openTabs.splice(fromIdx, 1);
  const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
  openTabs.splice(insertIdx, 0, moving);
}

function requestExistsInNodes(nodes, requestId) {
  for (const n of nodes ?? []) {
    if (n.type === "request" && n.id === requestId) return true;
    if (n.type === "folder" && requestExistsInNodes(n.children ?? [], requestId)) return true;
  }
  return false;
}

function normalizeDraft(d) {
  if (!d || typeof d !== "object") return newDraft();
  const h = d.headers;
  return {
    name: String(d.name ?? ""),
    method: String(d.method ?? "GET"),
    url: String(d.url ?? ""),
    headers: h && typeof h === "object" ? { ...h } : { "Content-Type": "application/json" },
    body: String(d.body ?? ""),
    postResScript: String(d.postResScript ?? ""),
  };
}

function normalizeRawTab(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "");
  if (!id) return null;
  const draft = normalizeDraft(raw.draft);
  let linked = null;
  if (raw.linked && raw.linked.collectionId && raw.linked.requestId) {
    linked = { collectionId: String(raw.linked.collectionId), requestId: String(raw.linked.requestId) };
  }
  return {
    id,
    title: String(raw.title ?? "Request"),
    linked,
    draft,
  };
}

function restoreOpenTabsFromState(state) {
  const collections = state?.collections ?? [];
  const rawTabs = state?.openRequestTabs;
  if (!Array.isArray(rawTabs) || rawTabs.length === 0) {
    openTabs = [];
    activeTabId = null;
    ensureActiveTab();
    return;
  }
  const next = [];
  for (const raw of rawTabs) {
    const t = normalizeRawTab(raw);
    if (!t) continue;
    if (t.linked) {
      const col = collections.find((c) => c.id === t.linked.collectionId);
      if (!col || !requestExistsInNodes(col.nodes ?? [], t.linked.requestId)) {
        t.linked = null;
      }
    }
    next.push(t);
  }
  if (next.length === 0) {
    openTabs = [];
    activeTabId = null;
    ensureActiveTab();
    return;
  }
  openTabs = next;
  const want = state.activeRequestTabId;
  activeTabId = want && openTabs.some((x) => x.id === want) ? want : openTabs[0].id;
}

async function persistOpenRequestTabsNow() {
  const cur = getActiveTab();
  if (cur) cur.draft = readFormToDraft();
  const tabs = openTabs.map((t) => ({
    id: t.id,
    title: t.title,
    linked: t.linked,
    draft: normalizeDraft(t.draft),
  }));
  try {
    await window.api.saveOpenRequestTabsV1({ tabs, activeTabId });
  } catch (e) {
    console.warn(e);
  }
}

function persistOpenRequestTabsSync() {
  try {
    const cur = getActiveTab();
    if (cur) cur.draft = readFormToDraft();
    const tabs = openTabs.map((t) => ({
      id: t.id,
      title: t.title,
      linked: t.linked,
      draft: normalizeDraft(t.draft),
    }));
    if (window.api.saveOpenRequestTabsV1Sync) {
      window.api.saveOpenRequestTabsV1Sync({ tabs, activeTabId });
    }
  } catch (e) {
    console.warn(e);
  }
}

function schedulePersistOpenRequestTabs() {
  clearTimeout(persistOpenTabsTimer);
  persistOpenTabsTimer = setTimeout(() => {
    persistOpenRequestTabsNow();
  }, 400);
}

function newDraft() {
  return {
    name: "",
    method: "GET",
    url: "",
    headers: { "Content-Type": "application/json" },
    body: "",
    postResScript: "",
  };
}

function readFormToDraft() {
  // headers table -> textarea -> object
  syncHeadersTextareaFromRows();
  let headersObj = {};
  try {
    headersObj = tryParseJson($("headersJson").value) || {};
  } catch {
    headersObj = { "Content-Type": "application/json" };
  }

  return {
    name: ($("requestNameInput")?.value ?? "").trim(),
    method: $("methodSel")?.value ?? "GET",
    url: $("urlInput")?.value ?? "",
    headers: headersObj,
    body: $("bodyJson")?.value ?? "",
    postResScript: $("postResScript")?.value ?? "",
  };
}

function loadDraftToForm(d) {
  if (!d) d = newDraft();
  if ($("requestNameInput")) $("requestNameInput").value = d.name ?? "";
  if ($("methodSel")) $("methodSel").value = d.method ?? "GET";
  if ($("urlInput")) $("urlInput").value = d.url ?? "";
  setParamRowsFromUrl($("urlInput")?.value ?? "");
  renderParamsTable();
  setHeadersRowsFromObject(d.headers ?? { "Content-Type": "application/json" });
  if ($("bodyJson")) $("bodyJson").value = d.body ?? "";
  if ($("postResScript")) $("postResScript").value = d.postResScript ?? "";
  setResponseUI(null);
  scheduleRefreshVariableHighlights();
}

function ensureActiveTab() {
  if (activeTabId && openTabs.some((t) => t.id === activeTabId)) return;
  if (openTabs.length === 0) {
    const id = cryptoRandomId();
    openTabs.push({ id, title: "New Request", linked: null, draft: newDraft() });
    activeTabId = id;
  } else {
    activeTabId = openTabs[0].id;
  }
}

function cryptoRandomId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function treeIconPlusSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function treeIconXSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function treeIconCopySvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 9h10v10H9zM5 5h10v2H7v8H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

function treeChevronSvg(collapsed) {
  if (collapsed) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function getActiveTab() {
  ensureActiveTab();
  return openTabs.find((t) => t.id === activeTabId);
}

function renderOpenTabsBar() {
  const host = $("openTabsBar");
  if (!host) return;
  host.innerHTML = "";
  ensureActiveTab();

  for (const t of openTabs) {
    const pill = document.createElement("div");
    pill.className = "reqTab" + (t.id === activeTabId ? " active" : "");
    pill.title = t.title;
    pill.draggable = true;
    pill.style.cursor = "grab";

    const label = document.createElement("span");
    label.textContent = t.title || "Request";
    pill.appendChild(label);

    const close = document.createElement("span");
    close.className = "reqTabClose";
    close.textContent = "✕";
    close.addEventListener("click", (ev) => {
      ev.stopPropagation();
      closeTab(t.id);
    });
    pill.appendChild(close);

    pill.addEventListener("click", () => {
      if (isDraggingTab) return;
      switchToTab(t.id);
    });

    pill.addEventListener("dragstart", (ev) => {
      isDraggingTab = true;
      ev.dataTransfer.effectAllowed = "move";
      try {
        ev.dataTransfer.setData("application/x-apizero-tabid", t.id);
      } catch {
        /* ignore */
      }
      pill.classList.add("dragging");
    });

    pill.addEventListener("dragend", () => {
      isDraggingTab = false;
      pill.classList.remove("dragging");
      try {
        host.classList.remove("dragging");
      } catch {
        /* ignore */
      }
    });

    pill.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
    });

    pill.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const fromId = ev.dataTransfer.getData("application/x-apizero-tabid");
      if (!fromId) return;
      reorderOpenTabs(fromId, t.id);
      renderOpenTabsBar();
      schedulePersistOpenRequestTabs();
      // activeTabId degismedigi icin form uzerinden ekstra loading yapmiyoruz
    });

    host.appendChild(pill);
  }
}

function switchToTab(tabId) {
  const current = getActiveTab();
  if (current) current.draft = readFormToDraft();

  activeTabId = tabId;
  const next = getActiveTab();
  loadDraftToForm(next?.draft);
  renderOpenTabsBar();
  schedulePersistOpenRequestTabs();
}

function closeTab(tabId) {
  const idx = openTabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;
  const wasActive = openTabs[idx].id === activeTabId;
  openTabs.splice(idx, 1);
  if (wasActive) {
    activeTabId = openTabs[idx - 1]?.id ?? openTabs[0]?.id ?? null;
    const next = getActiveTab();
    loadDraftToForm(next?.draft);
  }
  renderOpenTabsBar();
  schedulePersistOpenRequestTabs();
}

function openTabForRequest(node, collectionId) {
  // if already open, activate
  const existing = openTabs.find((t) => t.linked?.requestId === node.id && t.linked?.collectionId === collectionId);
  if (existing) {
    switchToTab(existing.id);
    return;
  }

  const current = getActiveTab();
  if (current) current.draft = readFormToDraft();

  const id = cryptoRandomId();
  openTabs.push({
    id,
    title: node.name,
    linked: { collectionId, requestId: node.id },
    draft: {
      name: node.name ?? "",
      method: node.definition?.method ?? "GET",
      url: node.definition?.url ?? "",
      headers: node.definition?.headers ?? { "Content-Type": "application/json" },
      body: node.definition?.body ?? "",
      postResScript: node.definition?.postResScript ?? "",
    },
  });
  activeTabId = id;
  loadDraftToForm(openTabs[openTabs.length - 1].draft);
  renderOpenTabsBar();
  schedulePersistOpenRequestTabs();
}

function beginInlineRename(node) {
  renaming = { type: node.type, id: node.id, initialName: node.name };
}

function beginInlineRenameCollection(collection) {
  renaming = { type: "collection", id: collection.id, initialName: collection.name };
}

async function commitInlineRename(newName) {
  if (!renaming) return;
  const name = String(newName ?? "").trim();
  if (!name) {
    renaming = null;
    return;
  }

  try {
    if (renaming.type === "collection") {
      await window.api.renameCollectionV1({ collectionId: renaming.id, name });
      $("resultLine").textContent = "Collection yeniden adlandirildi.";
    } else if (renaming.type === "folder") {
      if (!selectedCollectionId) return;
      await window.api.renameFolderV1({
        collectionId: selectedCollectionId,
        folderId: renaming.id,
        name,
      });
      $("resultLine").textContent = "Folder yeniden adlandirildi.";
    } else {
      if (!selectedCollectionId) return;
      await window.api.renameRequestNodeV1({
        collectionId: selectedCollectionId,
        requestId: renaming.id,
        name,
      });
      if (selectedRequestId === renaming.id && $("requestNameInput")) {
        $("requestNameInput").value = name;
      }
      $("resultLine").textContent = "Request yeniden adlandirildi.";
    }
  } catch (e) {
    $("resultLine").textContent = `Rename hatasi: ${e?.message || e}`;
  } finally {
    renaming = null;
    await refreshState();
  }
}

function cancelInlineRename() {
  renaming = null;
}

function setLeftTab(tab) {
  const panels = {
    environment: $("envTabPanel"),
    history: $("historyTabPanel"),
    collections: $("collectionsTabPanel"),
  };
  const buttons = {
    environment: $("tabEnvironmentBtn"),
    history: $("tabHistoryBtn"),
    collections: $("tabCollectionsBtn"),
  };

  hideVarSuggest();
  hideVarHoverTooltip();
  closeImportModal();
  closeImportOpenApiUrlModal();
  closeNewCollectionModal();
  closeNewFolderModal();
  closeSaveRequestModal();

  for (const [k, el] of Object.entries(panels)) {
    if (!el) continue;
    el.classList.toggle("active", k === tab);
  }
  for (const [k, el] of Object.entries(buttons)) {
    if (!el) continue;
    el.classList.toggle("active", k === tab);
  }
}

function setRequestTab(tab) {
  const panels = {
    params: $("reqPanelParams"),
    headers: $("reqPanelHeaders"),
    body: $("reqPanelBody"),
    scripts: $("reqPanelScripts"),
  };
  const buttons = {
    params: $("reqTabParams"),
    headers: $("reqTabHeaders"),
    body: $("reqTabBody"),
    scripts: $("reqTabScripts"),
  };

  for (const [k, el] of Object.entries(panels)) {
    if (!el) continue;
    el.classList.toggle("active", k === tab);
  }
  for (const [k, el] of Object.entries(buttons)) {
    if (!el) continue;
    el.classList.toggle("active", k === tab);
  }
  if (tab === "headers") {
    requestAnimationFrame(() => renderHeadersTable());
  } else if (tab === "params") {
    requestAnimationFrame(() => renderParamsTable());
  }
}

let responseViewMode = "pretty"; // pretty | raw | preview

function setResponseViewMode(mode) {
  responseViewMode = mode;
  const btnMap = {
    pretty: $("respViewPrettyBtn"),
    raw: $("respViewRawBtn"),
    preview: $("respViewPreviewBtn"),
  };
  const panelMap = {
    pretty: $("respPrettyPanel"),
    raw: $("respRawPanel"),
    preview: $("respPreviewPanel"),
  };
  for (const [k, el] of Object.entries(btnMap)) {
    if (!el) continue;
    el.classList.toggle("active", k === mode);
  }
  for (const [k, el] of Object.entries(panelMap)) {
    if (!el) continue;
    el.classList.toggle("active", k === mode);
  }
}

function detectResponseKind(result) {
  const ct = String(result?.responseContentType ?? "").toLowerCase();
  if (ct.includes("json")) return "json";
  if (ct.includes("html")) return "html";
  const raw = String(result?.responseRaw ?? result?.responsePreview ?? "");
  const t = raw.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("<!doctype html") || t.startsWith("<html") || t.startsWith("<body")) return "html";
  return "text";
}

function setResponseUI(result) {
  lastResponse = result || null;

  const badge = $("respStatusBadge");
  const info = $("respInfo");
  const prettyPre = $("respPrettyPre");
  const rawPre = $("respRawPre");
  const htmlFrame = $("respHtmlFrame");
  const dot = $("statusDot");

  if (!badge || !info || !prettyPre || !rawPre || !htmlFrame) return;

  if (!result) {
    badge.className = "badge";
    badge.textContent = "-";
    info.textContent = "-";
    prettyPre.textContent = "";
    rawPre.textContent = "";
    htmlFrame.srcdoc = "";
    setResponseViewMode("pretty");
    if (dot) dot.className = "statusDot";
    return;
  }

  const ok = !!result.success;
  badge.className = `badge ${ok ? "ok" : "fail"}`;
  badge.textContent = ok ? "OK" : "FAILED";
  info.textContent = result.statusCode !== undefined ? `Status: ${result.statusCode}` : "Status: -";
  const rawText = String(result.responseRaw ?? result.responsePreview ?? "");
  const fallbackText = result.errorMessage ? `Error: ${result.errorMessage}` : "";
  const rawOut = rawText || fallbackText;
  rawPre.textContent = rawOut;

  const kind = detectResponseKind(result);
  if (kind === "json") {
    prettyPre.textContent = tryPrettyJsonString(rawOut, rawOut);
    htmlFrame.srcdoc = "";
    setResponseViewMode("pretty");
  } else if (kind === "html") {
    prettyPre.textContent = rawOut;
    htmlFrame.srcdoc = rawOut;
    setResponseViewMode("preview");
  } else {
    prettyPre.textContent = rawOut;
    htmlFrame.srcdoc = "";
    setResponseViewMode("raw");
  }
  if (dot) dot.className = `statusDot ${ok ? "ok" : "fail"}`;
}

function renderHistory(items) {
  const list = $("historyList");
  list.innerHTML = "";
  const max = Math.min(items.length, 30);
  for (let i = 0; i < max; i++) {
    const item = items[i];
    const wrapper = document.createElement("div");
    wrapper.className = "historyItem";

    const line = document.createElement("div");
    const status = item.success ? "SUCCESS" : "FAILED";
    line.className = "historyHeader";
    line.innerHTML = `<div class="${item.success ? "success" : "failed"}">${status}</div><div class="muted">${item.statusCode !== undefined ? item.statusCode : ""}</div>`;

    const meta = document.createElement("div");
    meta.className = "historyMeta";
    const resolvedPart = item.resolvedUrl && item.resolvedUrl !== item.url
      ? ` -> ${item.resolvedUrl}`
      : "";
    meta.textContent = `${new Date(item.createdAt).toLocaleString()} | ${item.method} | ${item.url}${resolvedPart}`;

    const preview = document.createElement("pre");
    preview.style.marginTop = "6px";
    const previewText = String(item.responsePreview || "");
    preview.textContent = previewText.length > 1200 ? previewText.slice(0, 1200) + "...(truncated)" : previewText;

    const err = document.createElement("div");
    err.className = "muted";
    err.style.marginTop = "6px";
    err.textContent = item.errorMessage ? `Error: ${item.errorMessage}` : "";

    wrapper.appendChild(line);
    wrapper.appendChild(meta);
    wrapper.appendChild(preview);
    wrapper.appendChild(err);

    wrapper.addEventListener("click", () => {
      setResponseUI({
        success: item.success,
        statusCode: item.statusCode,
        responsePreview: item.responsePreview,
        errorMessage: item.errorMessage,
      });
    });
    list.appendChild(wrapper);
  }
}

function tryPrettyJsonString(raw, fallback) {
  if (raw === undefined || raw === null) return fallback;
  const t = String(raw);
  if (!t.trim()) return fallback;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return t;
  }
}

/** Content-Type: liste disi degerler (import vb.) icin */
const CONTENT_TYPE_PRESETS = [
  "application/json",
  "application/xml",
  "text/plain",
  "text/html",
  "multipart/form-data",
  "application/x-www-form-urlencoded",
  "application/octet-stream",
];

function isContentTypeKey(key) {
  return String(key ?? "").trim().toLowerCase() === "content-type";
}

function ensureDefaultHeadersIfEmpty() {
  if (!Array.isArray(headerRows)) headerRows = [];
  if (headerRows.length === 0) {
    headerRows = [{ key: "Content-Type", value: "application/json" }];
  }
}

function syncHeadersTextareaFromRows() {
  const obj = {};
  for (const r of headerRows) {
    const k = (r?.key ?? "").trim();
    if (!k) continue;
    obj[k] = String(r?.value ?? "");
  }
  const ta = $("headersJson");
  if (ta) ta.value = JSON.stringify(obj, null, 2);
}

function splitUrlForQuery(rawUrl) {
  const text = String(rawUrl ?? "");
  const hashIdx = text.indexOf("#");
  const hashPart = hashIdx >= 0 ? text.slice(hashIdx) : "";
  const withoutHash = hashIdx >= 0 ? text.slice(0, hashIdx) : text;
  const qIdx = withoutHash.indexOf("?");
  if (qIdx < 0) return { base: withoutHash, query: "", hash: hashPart };
  return {
    base: withoutHash.slice(0, qIdx),
    query: withoutHash.slice(qIdx + 1),
    hash: hashPart,
  };
}

function setParamRowsFromUrl(rawUrl) {
  const { query } = splitUrlForQuery(rawUrl);
  if (!query) {
    paramRows = [];
    return;
  }
  const params = new URLSearchParams(query);
  paramRows = [];
  for (const [key, value] of params.entries()) {
    paramRows.push({ key, value });
  }
}

function buildUrlFromParamRows(rawUrl) {
  const { base, hash } = splitUrlForQuery(rawUrl);
  const params = new URLSearchParams();
  for (const row of paramRows) {
    const key = String(row?.key ?? "").trim();
    if (!key) continue;
    params.append(key, String(row?.value ?? ""));
  }
  const q = params.toString();
  return `${base}${q ? `?${q}` : ""}${hash}`;
}

function renderParamsTable() {
  const host = $("paramsTable");
  if (!host) return;
  host.innerHTML = "";

  for (let i = 0; i < paramRows.length; i++) {
    const r = paramRows[i];
    const wrap = document.createElement("div");
    wrap.className = "kvRow";

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = "Key";
    keyInput.value = r.key ?? "";

    const valInput = document.createElement("input");
    valInput.type = "text";
    valInput.placeholder = "Value";
    valInput.value = r.value ?? "";

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "iconBtn";
    delBtn.textContent = "✕";

    const applyToUrl = () => {
      const urlEl = $("urlInput");
      if (!urlEl) return;
      syncingUrlFromParams = true;
      try {
        urlEl.value = buildUrlFromParamRows(urlEl.value);
        syncVarHighlightBackdrop(urlEl);
      } finally {
        syncingUrlFromParams = false;
      }
      schedulePersistOpenRequestTabs();
    };

    keyInput.addEventListener("input", () => {
      paramRows[i].key = keyInput.value;
      applyToUrl();
    });
    valInput.addEventListener("input", () => {
      paramRows[i].value = valInput.value;
      applyToUrl();
    });
    delBtn.addEventListener("click", () => {
      paramRows.splice(i, 1);
      renderParamsTable();
      applyToUrl();
    });

    wrap.appendChild(keyInput);
    wrap.appendChild(valInput);
    wrap.appendChild(delBtn);
    host.appendChild(wrap);
  }
}

function renderHeadersTable() {
  const host = $("headersTable");
  if (!host) return;
  host.innerHTML = "";

  ensureDefaultHeadersIfEmpty();

  const debPersistDraft = () => schedulePersistOpenRequestTabs();

  headerRows.forEach((row, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "kvRow";

    const keyInput = document.createElement("input");
    keyInput.type = "text";
    keyInput.placeholder = "Key";
    keyInput.value = row.key ?? "";
    keyInput.addEventListener("input", () => {
      const prev = row.key;
      headerRows[idx].key = keyInput.value;
      syncHeadersTextareaFromRows();
      if (isContentTypeKey(prev) !== isContentTypeKey(keyInput.value)) {
        renderHeadersTable();
      }
      debPersistDraft();
    });

    let valueEl;
    if (isContentTypeKey(row.key)) {
      const valWrap = document.createElement("div");
      valWrap.className = "ctValueWrap";

      const sel = document.createElement("select");
      const cur = String(row.value ?? "").trim();
      const inPreset = CONTENT_TYPE_PRESETS.includes(cur);

      for (const v of CONTENT_TYPE_PRESETS) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v;
        sel.appendChild(o);
      }
      const optCustom = document.createElement("option");
      optCustom.value = "__custom__";
      optCustom.textContent = "Özel değer…";
      sel.appendChild(optCustom);

      sel.value = inPreset && cur ? cur : "__custom__";

      const customInput = document.createElement("input");
      customInput.type = "text";
      customInput.className = "ctCustom";
      customInput.placeholder = "Content-Type (elle)";
      customInput.value = !inPreset ? cur : "";
      customInput.style.display = inPreset ? "none" : "block";

      const applyCtValue = () => {
        if (sel.value === "__custom__") {
          headerRows[idx].value = customInput.value.trim();
        } else {
          headerRows[idx].value = sel.value;
        }
        syncHeadersTextareaFromRows();
      };

      sel.addEventListener("change", () => {
        if (sel.value === "__custom__") {
          customInput.style.display = "block";
          const prev = String(headerRows[idx].value ?? "").trim();
          customInput.value = CONTENT_TYPE_PRESETS.includes(prev) ? "" : prev;
          customInput.focus();
          requestAnimationFrame(() => syncVarHighlightBackdrop(customInput));
        } else {
          customInput.style.display = "none";
          headerRows[idx].value = sel.value;
          syncHeadersTextareaFromRows();
        }
        debPersistDraft();
      });

      customInput.addEventListener("input", () => {
        applyCtValue();
        syncVarHighlightBackdrop(customInput);
        debPersistDraft();
      });

      bindVarSuggestToEl(customInput);
      ensureVarHighlight(customInput);

      valWrap.appendChild(sel);
      valWrap.appendChild(customInput);
      valueEl = valWrap;
    } else {
      const valInput = document.createElement("input");
      valInput.type = "text";
      valInput.placeholder = "Value";
      valInput.value = row.value ?? "";
      valInput.addEventListener("input", () => {
        headerRows[idx].value = valInput.value;
        syncHeadersTextareaFromRows();
        syncVarHighlightBackdrop(valInput);
        debPersistDraft();
      });
      bindVarSuggestToEl(valInput);
      ensureVarHighlight(valInput);
      valueEl = valInput;
    }

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "iconBtn";
    delBtn.textContent = "✕";
    delBtn.addEventListener("click", () => {
      headerRows.splice(idx, 1);
      renderHeadersTable();
      syncHeadersTextareaFromRows();
      debPersistDraft();
    });

    wrap.appendChild(keyInput);
    wrap.appendChild(valueEl);
    wrap.appendChild(delBtn);
    host.appendChild(wrap);
  });
}

function setHeadersRowsFromObject(obj) {
  headerRows = [];
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      headerRows.push({ key: k, value: String(v ?? "") });
    }
  }
  ensureDefaultHeadersIfEmpty();
  renderHeadersTable();
  syncHeadersTextareaFromRows();
}

function loadRequestIntoRightPanel(requestItem) {
  if (!requestItem) return;

  // Legacy helper: now handled by tabs; keep for safety
  const d = {
    name: requestItem.name ?? "",
    method: requestItem.definition?.method ?? "GET",
    url: requestItem.definition?.url ?? "",
    headers: requestItem.definition?.headers ?? { "Content-Type": "application/json" },
    body: requestItem.definition?.body ?? "",
    postResScript: requestItem.definition?.postResScript ?? "",
  };
  loadDraftToForm(d);
  setRequestTab("headers");
}

function resetRequestForm() {
  selectedRequestId = null;
  // folder seciliyse yeni request o folder altina kaydedilebilir; folderi koruyoruz.
  loadDraftToForm(newDraft());
}

function findFolderNodeById(nodes, folderId) {
  if (!folderId) return null;
  for (const n of nodes ?? []) {
    if (n?.type === "folder") {
      if (n.id === folderId) return n;
      const found = findFolderNodeById(n.children ?? [], folderId);
      if (found) return found;
    }
  }
  return null;
}

function renderRequestsList(_collection) {
  const container = $("requestsList");
  container.innerHTML = "";
  const filterText = String($("sidebarFilter")?.value ?? "").trim().toLowerCase();

  // artik getState cagrisi yapmiyoruz: cachedState uzerinden render ediyoruz.
  const state = cachedState;
  const collections = state?.collections ?? [];

    if (collections.length === 0) {
      const div = document.createElement("div");
      div.className = "muted";
      div.textContent = "Collection yok.";
      container.appendChild(div);
      return;
    }

    if (!selectedCollectionId) selectedCollectionId = collections[0]?.id ?? null;
    if (!saveTargetCollectionId) saveTargetCollectionId = selectedCollectionId;

    const nodeMatchesFilter = (node, q) => {
      if (!q) return true;
      if (String(node?.name ?? "").toLowerCase().includes(q)) return true;
      if (node?.type === "folder") {
        for (const ch of node.children ?? []) {
          if (nodeMatchesFilter(ch, q)) return true;
        }
      }
      return false;
    };

    const renderNode = (node, depth, collectionId, parentFolderId = null) => {
    if (!nodeMatchesFilter(node, filterText)) return;

    const row = document.createElement("div");
    row.className = "treeItem";
    if (node.type === "request" && node.id === selectedRequestId) row.classList.add("active");
    if (node.type === "folder" && node.id === selectedFolderId) row.classList.add("active");
    row.style.paddingLeft = `${8 + depth * 14}px`;

    const icon = document.createElement("div");
    icon.className = "treeIcon";
    if (node.type === "folder") {
      const collapsed = !!collapseState.folders[node.id];
      icon.innerHTML = `${treeChevronSvg(collapsed)}<span class="treeTypeGlyph">📁</span>`;
    } else {
      // Request icon
      icon.textContent = "📝";
    }

    const name = document.createElement("div");
    name.className = "treeName";

    const isRenaming = renaming && renaming.id === node.id && renaming.type === node.type;
    if (isRenaming) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = renaming.initialName ?? node.name ?? "";
      input.style.padding = "6px 8px";
      input.style.borderRadius = "10px";
      input.style.border = "1px solid var(--border)";
      input.addEventListener("click", (ev) => ev.stopPropagation());
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          commitInlineRename(input.value);
        } else if (ev.key === "Escape") {
          ev.preventDefault();
          cancelInlineRename();
          renderRequestsList(null);
        }
      });
      input.addEventListener("blur", () => {
        // blur'da kaydet (bos ise iptal)
        commitInlineRename(input.value);
      });
      name.appendChild(input);
      // focus async (DOM insert sonra)
      setTimeout(() => {
        try {
          input.focus();
          input.select();
        } catch {}
      }, 0);
    } else {
      name.textContent = node.name;
      if (node.type === "request") {
        name.title = String(node.name ?? "");
      }
    }

    row.appendChild(icon);
    row.appendChild(name);

    const actions = document.createElement("div");
    actions.className = "treeActions";

    if (node.type === "request") {
      const isConfirming =
        pendingDelete &&
        pendingDelete.type === "request" &&
        pendingDelete.collectionId === collectionId &&
        pendingDelete.id === node.id;

      if (!isConfirming) {
        const copy = document.createElement("button");
        copy.type = "button";
        copy.className = "treeActionBtn";
        copy.title = "Kopyala";
        copy.innerHTML = treeIconCopySvg();
        copy.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          try {
            const copiedName = `${String(node.name ?? "Untitled Request")} (copy)`;
            const copiedDef = JSON.parse(JSON.stringify(node.definition ?? {}));
            await window.api.upsertRequestNodeV1({
              collectionId,
              parentFolderId,
              name: copiedName,
              definition: copiedDef,
            });
            selectedCollectionId = collectionId;
            selectedFolderId = parentFolderId;
            $("resultLine").textContent = "Request kopyalandi.";
            await refreshState();
          } catch (e) {
            $("resultLine").textContent = `Kopyalama hatasi: ${e?.message || e}`;
          }
        });
        actions.appendChild(copy);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "treeActionBtn danger";
        del.title = "Sil";
          del.innerHTML = treeIconXSvg();
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = { type: "request", collectionId, id: node.id };
          renderRequestsList(null);
        });
        actions.appendChild(del);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "confirmPill";

        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "pillBtn danger";
        yes.textContent = "Yes";
        yes.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          try {
            await window.api.deleteRequestNodeV1({ collectionId, requestId: node.id });
            if (selectedRequestId === node.id) selectedRequestId = null;
            $("resultLine").textContent = "Request silindi.";
            pendingDelete = null;
            await refreshState();
          } catch (e) {
            $("resultLine").textContent = `Silme hatasi: ${e?.message || e}`;
          }
        });

        const no = document.createElement("button");
        no.type = "button";
        no.className = "pillBtn";
        no.textContent = "No";
        no.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = null;
          renderRequestsList(null);
        });

        wrap.appendChild(yes);
        wrap.appendChild(no);
        actions.appendChild(wrap);
      }
    }

    row.appendChild(actions);

    if (node.type === "folder") {
      // Folder: icon click toggles collapse, row click selects.
      // Folder drag
      row.draggable = true;
      row.addEventListener("dragstart", (ev) => {
        try {
          ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "folder", folderId: node.id }));
        } catch {}
      });

      // Drop targets: allow dropping request/folder into folder
      icon.style.cursor = "pointer";
      row.addEventListener("dragover", (ev) => {
        ev.preventDefault();
      });
      row.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        try {
          const raw = ev.dataTransfer?.getData("text/plain");
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (payload?.type === "request" && payload.requestId) {
            await window.api.moveRequestNodeV1({
              requestId: payload.requestId,
              targetCollectionId: collectionId,
              targetFolderId: node.id,
            });
            $("resultLine").textContent = "Request tasindi.";
          } else if (payload?.type === "folder" && payload.folderId) {
            await window.api.moveFolderV1({
              folderId: payload.folderId,
              targetCollectionId: collectionId,
              targetFolderId: node.id,
            });
            $("resultLine").textContent = "Folder tasindi.";
          } else {
            return;
          }
          await refreshState();
        } catch (e) {
          $("resultLine").textContent = `Tasima hatasi: ${e?.message || e}`;
        }
      });

      icon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectedCollectionId = collectionId;
        selectedFolderId = node.id;
        selectedRequestId = null;
        collapseState.folders[node.id] = !collapseState.folders[node.id];
        renderRequestsList(null);
      });

      row.addEventListener("click", () => {
        selectedCollectionId = collectionId;
        selectedFolderId = node.id;
        selectedRequestId = null;
        renderRequestsList(null);
      });

      row.addEventListener("dblclick", async (ev) => {
        ev.stopPropagation();
        beginInlineRename(node);
        renderRequestsList(null);
      });

      // Folder delete action (with confirm)
      const isConfirming =
        pendingDelete &&
        pendingDelete.type === "folder" &&
        pendingDelete.collectionId === collectionId &&
        pendingDelete.id === node.id;

      if (!isConfirming) {
        const addFolder = document.createElement("button");
        addFolder.type = "button";
        addFolder.className = "treeActionBtn";
        addFolder.title = "Alt klasor ekle";
        addFolder.innerHTML = treeIconPlusSvg();
        addFolder.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openNewFolderModal({ collectionId, parentFolderId: node.id });
        });
        actions.appendChild(addFolder);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "treeActionBtn danger";
        del.title = "Folder sil";
        del.innerHTML = treeIconXSvg();
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = { type: "folder", collectionId, id: node.id };
          renderRequestsList(null);
        });
        actions.appendChild(del);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "confirmPill";

        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "pillBtn danger";
        yes.textContent = "Yes";
        yes.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          try {
            await window.api.deleteFolderV1({ collectionId, folderId: node.id });
            if (selectedFolderId === node.id) selectedFolderId = null;
            $("resultLine").textContent = "Folder silindi.";
            pendingDelete = null;
            await refreshState();
          } catch (e) {
            $("resultLine").textContent = `Silme hatasi: ${e?.message || e}`;
          }
        });

        const no = document.createElement("button");
        no.type = "button";
        no.className = "pillBtn";
        no.textContent = "No";
        no.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = null;
          renderRequestsList(null);
        });

        wrap.appendChild(yes);
        wrap.appendChild(no);
        actions.appendChild(wrap);
      }
    } else {
      // Request: row click selects+loads.
      row.draggable = true;
      row.addEventListener("dragstart", (ev) => {
        try {
          ev.dataTransfer.setData("text/plain", JSON.stringify({ type: "request", requestId: node.id }));
        } catch {}
        try {
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.dropEffect = "move";
        } catch {}

        // Visual feedback
        draggingTreeRequestEl = row;
        row.classList.add("treeItemDragging");

        // Cleaner drag image (native ghost often looks ugly)
        try {
          const ghost = document.createElement("div");
          ghost.style.position = "fixed";
          ghost.style.top = "-1000px";
          ghost.style.left = "-1000px";
          ghost.style.padding = "8px 10px";
          ghost.style.background = "rgba(255,255,255,0.98)";
          ghost.style.border = "1px solid var(--border)";
          ghost.style.borderRadius = "10px";
          ghost.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
          ghost.style.fontSize = "12px";
          ghost.style.color = "var(--text)";
          ghost.style.whiteSpace = "nowrap";
          ghost.textContent = String(node.name ?? "Request");
          document.body.appendChild(ghost);
          ev.dataTransfer.setDragImage(ghost, 10, 10);
          setTimeout(() => {
            try {
              ghost.remove();
            } catch {}
          }, 0);
        } catch {}
      });

      // Request reorder (within same parent list)
      row.addEventListener("dragover", (ev) => {
        // Drop'un calismasi icin dragover'da preventDefault sart.
        // Veri parse edilemeyse bile drop'u engellemiyoruz.
        ev.preventDefault();
        try {
          ev.dataTransfer.dropEffect = "move";
        } catch {}
        if (treeDropTargetEl && treeDropTargetEl !== row) {
          treeDropTargetEl.classList.remove("treeItemDropTarget");
        }
        treeDropTargetEl = row;
        if (!row.classList.contains("treeItemDropTarget")) row.classList.add("treeItemDropTarget");
      });
      row.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
          if (treeDropTargetEl) treeDropTargetEl.classList.remove("treeItemDropTarget");
          treeDropTargetEl = null;

          if (draggingTreeRequestEl) draggingTreeRequestEl.classList.remove("treeItemDragging");
          draggingTreeRequestEl = null;

          const raw = ev.dataTransfer?.getData("text/plain");
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (payload?.type !== "request" || !payload.requestId) return;
          if (payload.requestId === node.id) return;

          const state = cachedState;
          const collections = state?.collections ?? [];
          const targetCollection = collections.find((c) => c.id === collectionId);
          if (!targetCollection) return;

          const parentNode = parentFolderId ? findFolderNodeById(targetCollection.nodes ?? [], parentFolderId) : null;
          const targetArr = parentNode ? parentNode.children ?? [] : targetCollection.nodes ?? [];

          const insertionOriginalIndex = targetArr.findIndex((x) => x?.type === "request" && x.id === node.id);
          if (insertionOriginalIndex < 0) return;

          const draggingIndex = targetArr.findIndex((x) => x?.type === "request" && x.id === payload.requestId);
          let targetIndex = insertionOriginalIndex;
          if (draggingIndex !== -1 && draggingIndex < insertionOriginalIndex) targetIndex = insertionOriginalIndex - 1;

          await window.api.moveRequestNodeToIndexV1({
            requestId: payload.requestId,
            targetCollectionId: collectionId,
            targetFolderId: parentFolderId,
            targetIndex,
          });

          $("resultLine").textContent = "Request siralandirildi.";
          await refreshState({ deferHeavy: true });
        } catch (e) {
          $("resultLine").textContent = `Sirala hatasi: ${e?.message || e}`;
          if (treeDropTargetEl) treeDropTargetEl.classList.remove("treeItemDropTarget");
          treeDropTargetEl = null;
          if (draggingTreeRequestEl) draggingTreeRequestEl.classList.remove("treeItemDragging");
          draggingTreeRequestEl = null;
        }
      });

      row.addEventListener("dragend", () => {
        try {
          if (treeDropTargetEl) treeDropTargetEl.classList.remove("treeItemDropTarget");
          treeDropTargetEl = null;
          if (draggingTreeRequestEl) draggingTreeRequestEl.classList.remove("treeItemDragging");
          draggingTreeRequestEl = null;
        } catch {}
      });

      row.addEventListener("click", () => {
        selectedCollectionId = collectionId;
        selectedRequestId = node.id;
        selectedFolderId = null;
        openTabForRequest(node, collectionId);
        // Save hedefini de secili request'in collection'ina al (Postman hissi)
        saveTargetCollectionId = collectionId;
        saveTargetFolderId = null;
        renderRequestsList(null);
      });

      row.addEventListener("dblclick", async (ev) => {
        ev.stopPropagation();
        beginInlineRename(node);
        renderRequestsList(null);
      });
    }

    container.appendChild(row);

    const folderCollapsedByUser = !!collapseState.folders[node.id];
    const showExpandedForSearch = !!filterText;
    if (node.type === "folder" && (showExpandedForSearch || !folderCollapsedByUser)) {
      for (const ch of node.children ?? []) renderNode(ch, depth + 1, collectionId, node.id);
    }
  };

    let renderedCollectionCount = 0;
    for (const c of collections) {
      const collectionMatches = !filterText
        ? true
        : String(c?.name ?? "").toLowerCase().includes(filterText) ||
          (c.nodes ?? []).some((n) => nodeMatchesFilter(n, filterText));
      if (!collectionMatches) continue;
      renderedCollectionCount += 1;

      // collection header row
      const header = document.createElement("div");
      header.className = "treeItem";
      header.style.paddingLeft = "8px";
      if (c.id === selectedCollectionId && !selectedFolderId && !selectedRequestId) header.classList.add("active");

      const icon = document.createElement("div");
      icon.className = "treeIcon";
      const colCollapsed = !!collapseState.collections[c.id];
      icon.innerHTML = `${treeChevronSvg(colCollapsed)}<span class="treeTypeGlyph">🧰</span>`;
      icon.style.cursor = "pointer";
      icon.addEventListener("click", (ev) => {
        ev.stopPropagation();
        collapseState.collections[c.id] = !collapseState.collections[c.id];
        renderRequestsList(null);
      });

      const name = document.createElement("div");
      name.className = "treeName";
      const isRenaming = renaming && renaming.type === "collection" && renaming.id === c.id;
      if (isRenaming) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = renaming.initialName ?? c.name ?? "";
        input.style.padding = "6px 8px";
        input.style.borderRadius = "10px";
        input.style.border = "1px solid var(--border)";
        input.addEventListener("click", (ev) => ev.stopPropagation());
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            commitInlineRename(input.value);
          } else if (ev.key === "Escape") {
            ev.preventDefault();
            cancelInlineRename();
            renderRequestsList(null);
          }
        });
        input.addEventListener("blur", () => commitInlineRename(input.value));
        name.appendChild(input);
        setTimeout(() => {
          try { input.focus(); input.select(); } catch {}
        }, 0);
      } else {
        name.textContent = c.name;
      }

      header.appendChild(icon);
      header.appendChild(name);

      const actions = document.createElement("div");
      actions.className = "treeActions";

      const isConfirming =
        pendingDelete &&
        pendingDelete.type === "collection" &&
        pendingDelete.id === c.id;

      if (!isConfirming) {
        const addFolder = document.createElement("button");
        addFolder.type = "button";
        addFolder.className = "treeActionBtn";
        addFolder.title = "Klasor ekle";
        addFolder.innerHTML = treeIconPlusSvg();
        addFolder.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openNewFolderModal({ collectionId: c.id, parentFolderId: null });
        });
        actions.appendChild(addFolder);

        const del = document.createElement("button");
        del.type = "button";
        del.className = "treeActionBtn danger";
        del.title = "Collection sil";
        del.innerHTML = treeIconXSvg();
        del.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = { type: "collection", collectionId: c.id, id: c.id };
          renderRequestsList(null);
        });
        actions.appendChild(del);
      } else {
        const wrap = document.createElement("div");
        wrap.className = "confirmPill";

        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "pillBtn danger";
        yes.textContent = "Yes";
        yes.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          try {
            await window.api.deleteCollectionV1({ collectionId: c.id });
            if (selectedCollectionId === c.id) {
              selectedCollectionId = null;
              selectedFolderId = null;
              selectedRequestId = null;
            }
            $("resultLine").textContent = "Collection silindi.";
            pendingDelete = null;
            await refreshState();
          } catch (e) {
            $("resultLine").textContent = `Silme hatasi: ${e?.message || e}`;
          }
        });

        const no = document.createElement("button");
        no.type = "button";
        no.className = "pillBtn";
        no.textContent = "No";
        no.addEventListener("click", (ev) => {
          ev.stopPropagation();
          pendingDelete = null;
          renderRequestsList(null);
        });

        wrap.appendChild(yes);
        wrap.appendChild(no);
        actions.appendChild(wrap);
      }
      header.appendChild(actions);

      // Drop on collection header -> move to collection root
      header.addEventListener("dragover", (ev) => {
        ev.preventDefault();
      });
      header.addEventListener("drop", async (ev) => {
        ev.preventDefault();
        try {
          const raw = ev.dataTransfer?.getData("text/plain");
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (payload?.type === "request" && payload.requestId) {
            await window.api.moveRequestNodeV1({
              requestId: payload.requestId,
              targetCollectionId: c.id,
              targetFolderId: null,
            });
            $("resultLine").textContent = "Request tasindi.";
          } else if (payload?.type === "folder" && payload.folderId) {
            await window.api.moveFolderV1({
              folderId: payload.folderId,
              targetCollectionId: c.id,
              targetFolderId: null,
            });
            $("resultLine").textContent = "Folder tasindi.";
          } else {
            return;
          }
          await refreshState();
        } catch (e) {
          $("resultLine").textContent = `Tasima hatasi: ${e?.message || e}`;
        }
      });

      header.addEventListener("click", () => {
        selectedCollectionId = c.id;
        selectedFolderId = null;
        selectedRequestId = null;
        saveTargetCollectionId = c.id;
        saveTargetFolderId = null;
        renderRequestsList(null);
      });

      header.addEventListener("dblclick", (ev) => {
        ev.stopPropagation();
        beginInlineRenameCollection(c);
        renderRequestsList(null);
      });

      container.appendChild(header);

      const collectionCollapsedByUser = !!collapseState.collections[c.id];
      const showExpandedForSearch = !!filterText;
      if (showExpandedForSearch || !collectionCollapsedByUser) {
        const nodes = c.nodes ?? [];
        for (const n of nodes) renderNode(n, 1, c.id, null);
      }
    }

    if (renderedCollectionCount === 0) {
      const div = document.createElement("div");
      div.className = "muted";
      div.textContent = "Aramana uygun oge bulunamadi.";
      container.appendChild(div);
    }
}

function renderCollections(stateCollections) {
  const collections = stateCollections ?? [];

  // Choose selected collection if possible
  if (!selectedCollectionId || !collections.some((c) => c.id === selectedCollectionId)) {
    selectedCollectionId = collections[0]?.id ?? null;
  }

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const containsRequestId = (nodes, requestId) => {
    for (const n of nodes ?? []) {
      if (n.type === "request" && n.id === requestId) return true;
      if (n.type === "folder" && containsRequestId(n.children ?? [], requestId)) return true;
    }
    return false;
  };

  const containsFolderId = (nodes, folderId) => {
    for (const n of nodes ?? []) {
      if (n.type === "folder" && n.id === folderId) return true;
      if (n.type === "folder" && containsFolderId(n.children ?? [], folderId)) return true;
    }
    return false;
  };

  if (
    selectedRequestId &&
    !containsRequestId(selectedCollection?.nodes ?? [], selectedRequestId)
  ) {
    selectedRequestId = null;
  }
  if (
    selectedFolderId &&
    !containsFolderId(selectedCollection?.nodes ?? [], selectedFolderId)
  ) {
    selectedFolderId = null;
  }
  renderRequestsList(selectedCollection);
}

// Save target dropdowns kaldırıldı (Postman-like: tree selection determines target)

async function init() {
  const state = await window.api.getState();
  cachedState = state;

  renderEnvironmentsUI(state);
  renderGlobalsUI(state);

  renderHistory(state.history ?? []);

  // Tabs default: Collections
  setLeftTab("collections");
  setRequestTab("headers");
  setResponseUI(null);

  // Ensure at least one collection exists
  if (!state.collections || state.collections.length === 0) {
    await window.api.createCollectionV1({ name: "Default" });
  }

  const state2 = await window.api.getState();
  cachedState = state2;
  renderCollections(state2.collections ?? []);

  restoreOpenTabsFromState(state2);
  loadDraftToForm(getActiveTab().draft);
  renderOpenTabsBar();
  setupVarHighlightForRequestEditors();
  requestAnimationFrame(() => {
    try {
      renderHeadersTable();
      scheduleRefreshVariableHighlights();
      renderOpenTabsBar();
    } catch (e) {
      logApiZeroError("init.postLoad", e);
    }
  });
}

function getRequestPayload() {
  const method = $("methodSel").value;
  const url = $("urlInput").value.trim();
  syncHeadersTextareaFromRows();
  const headersText = $("headersJson").value;
  const bodyText = $("bodyJson").value;
  const postResScript = $("postResScript").value;

  let headers;
  try {
    headers = tryParseJson(headersText) || {};
  } catch {
    throw new Error("Headers JSON gecersiz");
  }
  const bodyString = (bodyText ?? "").trim() ? String(bodyText) : undefined;

  // requestRunner V1 template resolver expects raw string with {{Var}}.
  return {
    method,
    url,
    headers,
    body: bodyString,
    postResScript,
  };
}

async function saveVars() {
  try {
    const envParsed = tryParseJson($("envJson").value) || {};
    const globalsParsed = tryParseJson($("globalsJson").value) || {};
    const res = await window.api.setVariables({ environment: envParsed, globals: globalsParsed });
    $("resultLine").textContent = res?.ok ? "Vars kaydedildi." : "Vars kaydedilemedi.";
    // Variables kaydi yaptik: state'i guncelle ama editorsiz bozma icin sadece history/collections yenile.
    await refreshState();
  } catch (e) {
    $("resultLine").textContent = `Vars kaydetme hatasi: ${e?.message || e}`;
  }
}

/** Cok buyuk body'de highlight senkron islem — ayri idle ile */
function scheduleVariableHighlightsDeferred() {
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(
      () => {
        try {
          scheduleRefreshVariableHighlights();
        } catch (e) {
          logApiZeroError("scheduleVariableHighlightsDeferred", e);
        }
      },
      { timeout: 800 },
    );
  } else {
    setTimeout(() => {
      try {
        scheduleRefreshVariableHighlights();
      } catch (e) {
        logApiZeroError("scheduleVariableHighlightsDeferred", e);
      }
    }, 48);
  }
}

/** Koleksiyon + history agacini yeniden cizmek buyuk projelerde UI kilitler; ortam/globals guncellemelerinde ertelenebilir */
function runHeavyRefreshFromCache(opts = {}) {
  const deferHighlights = opts.deferHighlights === true;
  const state = cachedState;
  if (!state) return;
  renderHistory(state.history ?? []);
  renderCollections(state.collections ?? []);
  if (deferHighlights) {
    scheduleVariableHighlightsDeferred();
  } else {
    scheduleRefreshVariableHighlights();
  }
}

async function refreshState(opts = {}) {
  const deferHeavy = opts.deferHeavy === true;
  refreshStatePendingOpts.deferHeavy = refreshStatePendingOpts.deferHeavy || deferHeavy;

  if (refreshStateInFlight) {
    return refreshStateInFlight;
  }

  refreshStateInFlight = (async () => {
    try {
      while (refreshStatePendingOpts.deferHeavy !== null) {
        const runDeferHeavy = refreshStatePendingOpts.deferHeavy === true;
        refreshStatePendingOpts.deferHeavy = null;

        const state = await window.api.getState();
        cachedState = state;
        renderEnvironmentsUI(state);
        renderGlobalsUI(state);
        if (runDeferHeavy) {
          if (typeof requestIdleCallback !== "undefined") {
            requestIdleCallback(() => runHeavyRefreshFromCache({ deferHighlights: true }), { timeout: 350 });
          } else {
            setTimeout(() => runHeavyRefreshFromCache({ deferHighlights: true }), 0);
          }
        } else {
          runHeavyRefreshFromCache({ deferHighlights: false });
        }
      }
    } finally {
      refreshStateInFlight = null;
    }
  })();

  return refreshStateInFlight;
}

// ---- Environments / Globals (Postman-like) ----
let envVarRows = [];
let globalVarRows = [];

function typedVarToRow(name, tv) {
  return { key: name, value: String(tv?.value ?? "") };
}

function rowsToVariablesMap(rows) {
  const out = {};
  for (const r of rows) {
    const k = String(r.key ?? "").trim();
    if (!k) continue;
    out[k] = { type: "string", value: String(r.value ?? "") };
  }
  return out;
}

function renderVarTable(hostId, rows, onChange) {
  const host = $(hostId);
  if (!host) return;
  host.innerHTML = "";

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const wrap = document.createElement("div");
    wrap.className = "varRow";

    const k = document.createElement("input");
    k.type = "text";
    k.placeholder = "Key";
    k.value = r.key ?? "";
    k.addEventListener("input", () => {
      rows[i].key = k.value;
      onChange?.();
    });

    const v = document.createElement("input");
    v.type = "text";
    v.placeholder = "Value";
    v.value = r.value ?? "";
    v.addEventListener("input", () => {
      rows[i].value = v.value;
      onChange?.();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "iconBtn";
    del.textContent = "✕";
    del.addEventListener("click", () => {
      rows.splice(i, 1);
      renderVarTable(hostId, rows, onChange);
      onChange?.();
    });

    wrap.appendChild(k);
    wrap.appendChild(v);
    wrap.appendChild(del);
    host.appendChild(wrap);
  }
}

function renderEnvironmentsUI(state) {
  const envSelect = $("envSelect");
  const reqEnvSelect = $("reqEnvSelect");
  if (!envSelect && !reqEnvSelect) return;

  const envs = state.environments ?? [];
  if (envSelect) {
    envSelect.innerHTML = "";
    for (const e of envs) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      envSelect.appendChild(opt);
    }
  }

  if (reqEnvSelect) {
    reqEnvSelect.innerHTML = "";
    const none = document.createElement("option");
    none.value = "";
    none.textContent = "No environment";
    reqEnvSelect.appendChild(none);
    for (const e of envs) {
      const opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.name;
      reqEnvSelect.appendChild(opt);
    }
  }

  const activeId = state.activeEnvironmentId ?? (envs[0]?.id ?? null);
  if (envSelect) {
    if (activeId && envs.some((e) => e.id === activeId)) envSelect.value = activeId;
  }
  if (reqEnvSelect) {
    reqEnvSelect.value = activeId && envs.some((e) => e.id === activeId) ? activeId : "";
  }

  const activeSelId = envSelect ? envSelect.value : (activeId ?? "");
  const active = envs.find((e) => e.id === activeSelId) || envs[0];
  const envNameEl = $("envNameInput");
  if (envNameEl && document.activeElement !== envNameEl) {
    envNameEl.value = active?.name ?? "";
  }

  envVarRows = [];
  const vars = active?.variables ?? {};
  for (const [k, tv] of Object.entries(vars)) envVarRows.push(typedVarToRow(k, tv));
  renderVarTable("envVarsTable", envVarRows);
}

function renderGlobalsUI(state) {
  globalVarRows = [];
  for (const [k, tv] of Object.entries(state.globals ?? {})) globalVarRows.push(typedVarToRow(k, tv));
  renderVarTable("globalsVarsTable", globalVarRows);
}

// ---- {{variable}} autocomplete (active env + globals) ----
const varSuggestState = {
  active: false,
  targetEl: null,
  anchorStart: 0,
  filtered: [],
  /** { type: 'item', item } | { type: 'newVar', name } */
  displayRows: [],
  selectedIndex: 0,
};

let varSuggestSubmitLock = false;

function typedVarToString(tv) {
  if (tv == null || tv.value === undefined || tv.value === null) return "";
  return String(tv.value);
}

function getVarSuggestionsList() {
  const state = cachedState;
  if (!state) return [];
  const envs = state.environments ?? [];
  const activeId = state.activeEnvironmentId ?? envs[0]?.id ?? null;
  const env = activeId ? envs.find((e) => e.id === activeId) : null;
  const envVars = env ? Object.keys(env.variables ?? {}) : [];
  const globalVars = Object.keys(state.globals ?? {});
  const items = [];
  const seen = new Set();
  for (const k of envVars) {
    if (seen.has(k)) continue;
    seen.add(k);
    const tv = env.variables?.[k];
    items.push({ name: k, scope: "env", value: typedVarToString(tv) });
  }
  for (const k of globalVars) {
    if (seen.has(k)) continue;
    seen.add(k);
    const tv = state.globals?.[k];
    items.push({ name: k, scope: "global", value: typedVarToString(tv) });
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}

function isValidNewVarName(s) {
  const t = (s ?? "").trim();
  if (!t) return false;
  return /^[A-Za-z0-9_]+$/.test(t);
}

function nameExistsInVars(name) {
  const all = getVarSuggestionsList();
  return all.some((x) => x.name === name);
}

/**
 * Imleç {{ ... }} icindeyse ve metinde '}}' kapanisi varsa tam degisken adini doner.
 * Aksi halde null (sadece acik {{ ile yazilan partial kullanilir).
 */
function getClosedTokenVarName(value, anchorStart, cursorPos) {
  const open = anchorStart + 2;
  if (cursorPos < open) return null;
  const rest = value.slice(open);
  const closeRel = rest.indexOf("}}");
  if (closeRel < 0) return null;
  const closePos = open + closeRel;
  if (cursorPos > closePos) return null;
  const name = value.slice(open, closePos).trim();
  if (!name || !/^[A-Za-z0-9_]+$/.test(name)) return null;
  return name;
}

/** Eslenek yok + gecerli ad => yeni degisken paneli */
function buildVarSuggestDisplayRows(filtered, partialRaw, fullNameIfClosed) {
  const raw = (partialRaw ?? "").trim();
  const useFull =
    fullNameIfClosed &&
    isValidNewVarName(fullNameIfClosed) &&
    !nameExistsInVars(fullNameIfClosed);
  const nameForNew = useFull ? fullNameIfClosed : raw;
  const showNew =
    nameForNew.length >= 2 &&
    isValidNewVarName(nameForNew) &&
    !nameExistsInVars(nameForNew) &&
    filtered.length === 0;
  const rows = filtered.map((item) => ({ type: "item", item }));
  if (showNew) rows.push({ type: "newVar", name: nameForNew });
  return rows;
}

async function mergeVariableIntoActiveEnvironment(name, value) {
  let state = cachedState;
  if (!state) {
    state = await window.api.getState();
    cachedState = state;
  }
  let envId = state.activeEnvironmentId ?? state.environments?.[0]?.id;
  if (!envId) {
    await window.api.createEnvironmentV1({ name: "Default" });
    state = await window.api.getState();
    cachedState = state;
    envId = state.activeEnvironmentId ?? state.environments?.[0]?.id;
  }
  if (!envId) throw new Error("Ortam olusturulamadi");
  const env = state.environments.find((e) => e.id === envId);
  const variables = {};
  for (const [k, tv] of Object.entries(env?.variables ?? {})) {
    variables[k] = tv;
  }
  variables[name] = { type: "string", value: String(value) };
  await window.api.setEnvironmentVarsV1({ environmentId: envId, variables });
}

async function mergeVariableIntoGlobals(name, value) {
  let state = cachedState;
  if (!state) {
    state = await window.api.getState();
    cachedState = state;
  }
  const g = {};
  for (const [k, tv] of Object.entries(state.globals ?? {})) {
    g[k] = tv;
  }
  g[name] = { type: "string", value: String(value) };
  await window.api.setGlobalsV1({ globals: g });
}

function completeVarSuggestInsertion(name) {
  const el = varSuggestState.targetEl;
  if (!el) return;
  const v = el.value;
  const cur = el.selectionStart ?? v.length;
  const start = varSuggestState.anchorStart;
  /** Imleç kapanis '}}' onundeyse metindeki o '}}' tekrar birakilmamali */
  let end = cur;
  if (v.slice(end, end + 2) === "}}") {
    end += 2;
  }
  const newVal = v.slice(0, start) + "{{" + name + "}}" + v.slice(end);
  el.value = newVal;
  const newPos = start + 2 + name.length + 2;
  try {
    el.selectionStart = el.selectionEnd = newPos;
  } catch {}
  el.dispatchEvent(new Event("input", { bubbles: true }));
  schedulePersistOpenRequestTabs();
}

async function submitNewVariableFromSuggest(scope, name) {
  const inp = $("varSuggestNewValInput");
  const value = (inp?.value ?? "").trim();
  try {
    if (scope === "env") {
      await mergeVariableIntoActiveEnvironment(name, value);
    } else {
      await mergeVariableIntoGlobals(name, value);
    }
    hideVarSuggest();
    clearVarSuggestInputDebounce();
    varSuggestSubmitLock = true;
    try {
      completeVarSuggestInsertion(name);
      await refreshState({ deferHeavy: true });
    } finally {
      setTimeout(() => {
        varSuggestSubmitLock = false;
      }, 600);
    }
    $("resultLine").textContent = `Değişken eklendi (${scope === "env" ? "ortam" : "global"}).`;
  } catch (e) {
    $("resultLine").textContent = `Hata: ${e?.message || e}`;
  }
}

/** Hover tooltip: uzun degerleri kirp */
function buildVarSuggestTooltip(item) {
  const scopeLabel = item.scope === "env" ? "Ortam" : "Global";
  let v = item.value ?? "";
  if (v.length > 1800) v = v.slice(0, 1797) + "...";
  const valLine = v === "" ? "(boş)" : v;
  return `${item.name} · ${scopeLabel}\nMevcut değer:\n${valLine}`;
}

/** Ortam once, sonra global — requestRunner ile ayni */
function getVarValueForLookup(name) {
  const state = cachedState;
  if (!state) return { scope: null, value: "" };
  const envs = state.environments ?? [];
  const activeId = state.activeEnvironmentId ?? envs[0]?.id ?? null;
  const env = activeId ? envs.find((e) => e.id === activeId) : null;
  const tvE = env?.variables?.[name];
  if (tvE) return { scope: "env", value: typedVarToString(tvE) };
  const tvG = state.globals?.[name];
  if (tvG) return { scope: "global", value: typedVarToString(tvG) };
  return { scope: null, value: "" };
}

function escapeHtmlHighlight(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildVariableHighlightHtml(text) {
  const s = String(text ?? "");
  if (s.length > 120000) {
    return escapeHtmlHighlight(s);
  }
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let last = 0;
  let out = "";
  let m;
  while ((m = re.exec(text)) !== null) {
    out += escapeHtmlHighlight(text.slice(last, m.index));
    const lk = getVarValueForLookup(m[1]);
    let cls = "varTok varTok-miss";
    if (lk.scope === "env") cls = "varTok varTok-env";
    else if (lk.scope === "global") cls = "varTok varTok-global";
    out += `<span class="${cls}">${escapeHtmlHighlight(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtmlHighlight(text.slice(last));
  return out;
}

function forceVarInputTransparent(el) {
  if (!el || el.dataset.varHighlightInit !== "1") return;
  el.style.setProperty("color", "transparent", "important");
  el.style.setProperty("-webkit-text-fill-color", "transparent", "important");
}

function syncVarHighlightBackdrop(el) {
  try {
    const wrap = el.closest(".varHighlightWrap");
    if (!wrap) return;
    const backdrop = wrap.querySelector(".varHighlightBackdrop");
    const inner = wrap.querySelector(".varHighlightInner");
    if (!backdrop || !inner) return;
    const raw = String(el.value ?? "");
    if (raw.length > 120000) {
      forceVarInputTransparent(el);
      inner.innerHTML = escapeHtmlHighlight(raw) + (el.tagName === "TEXTAREA" ? "\n" : "");
      inner.style.whiteSpace = el.tagName === "TEXTAREA" ? "pre-wrap" : "pre";
      inner.style.wordBreak = el.tagName === "TEXTAREA" ? "break-word" : "normal";
      if (el.tagName === "TEXTAREA") {
        inner.style.minHeight = el.scrollHeight + "px";
        backdrop.scrollTop = el.scrollTop;
        backdrop.scrollLeft = el.scrollLeft;
      }
      return;
    }
    forceVarInputTransparent(el);
    const cs = window.getComputedStyle(el);
    backdrop.style.padding = cs.padding;
    backdrop.style.font = cs.font;
    backdrop.style.lineHeight = cs.lineHeight;
    backdrop.style.letterSpacing = cs.letterSpacing;
    inner.innerHTML = buildVariableHighlightHtml(el.value) + (el.tagName === "TEXTAREA" ? "\n" : "");
    inner.style.whiteSpace = el.tagName === "TEXTAREA" ? "pre-wrap" : "pre";
    inner.style.wordBreak = el.tagName === "TEXTAREA" ? "break-word" : "normal";
    if (el.tagName === "TEXTAREA") {
      inner.style.minHeight = el.scrollHeight + "px";
      backdrop.scrollTop = el.scrollTop;
      backdrop.scrollLeft = el.scrollLeft;
    }
  } catch (e) {
    logApiZeroError("syncVarHighlightBackdrop", e);
  }
}

let varHighlightRaf = null;
const pendingVarHighlightEls = new Set();

function scheduleVarHighlightForEl(el) {
  if (!el) return;
  pendingVarHighlightEls.add(el);
  if (varHighlightRaf) return;
  varHighlightRaf = requestAnimationFrame(() => {
    varHighlightRaf = null;
    const queued = Array.from(pendingVarHighlightEls);
    pendingVarHighlightEls.clear();
    queued.forEach((queuedEl) => {
      try {
        forceVarInputTransparent(queuedEl);
        syncVarHighlightBackdrop(queuedEl);
      } catch (e) {
        logApiZeroError("scheduleVarHighlightForEl.flush", e);
      }
    });
  });
}

function ensureVarHighlight(el) {
  if (!el || el.dataset.varHighlightInit === "1") return;
  try {
    if (!el.parentNode) return;
    const wrap = document.createElement("div");
    wrap.className = "varHighlightWrap";
    const backdrop = document.createElement("div");
    backdrop.className = "varHighlightBackdrop";
    const inner = document.createElement("div");
    inner.className = "varHighlightInner";
    backdrop.appendChild(inner);
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(backdrop);
    wrap.appendChild(el);
    el.classList.add("varHighlightInput");
    el.dataset.varHighlightInit = "1";

    const update = () => {
      try {
        scheduleVarHighlightForEl(el);
      } catch (e) {
        logApiZeroError("varHighlight.input", e);
      }
    };
    el.addEventListener("input", update);
    el.addEventListener("scroll", update);
    el.addEventListener("click", update);
    el.addEventListener("keyup", update);
    update();
    forceVarInputTransparent(el);
    requestAnimationFrame(() => {
      try {
        scheduleVarHighlightForEl(el);
        requestAnimationFrame(() => scheduleVarHighlightForEl(el));
      } catch (e) {
        logApiZeroError("ensureVarHighlight.rAF", e);
      }
    });
  } catch (e) {
    logApiZeroError("ensureVarHighlight", e);
  }
}

function refreshVariableHighlights() {
  document.querySelectorAll(".varHighlightInput").forEach((el) => {
    try {
      scheduleVarHighlightForEl(el);
    } catch (e) {
      logApiZeroError("refreshVariableHighlights", e);
    }
  });
}

let varHighlightRefreshRaf = null;
function scheduleRefreshVariableHighlights() {
  if (varHighlightRefreshRaf) return;
  varHighlightRefreshRaf = requestAnimationFrame(() => {
    varHighlightRefreshRaf = null;
    refreshVariableHighlights();
  });
}

function setupVarHighlightForRequestEditors() {
  ensureVarHighlight($("urlInput"));
  ensureVarHighlight($("bodyJson"));
  scheduleRefreshVariableHighlights();
}

/** Backend ile ayni: {{\\s*([A-Za-z0-9_]+)\\s*}} */
function findVariableAtIndex(text, index) {
  const re = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    if (index >= start && index < end) return { name: m[1], start, end, full: m[0] };
  }
  return null;
}

function buildVarInlineHoverText(name, scope, value) {
  const scopeLabel = scope === "env" ? "Ortam" : scope === "global" ? "Global" : "tanımsız";
  let v = value ?? "";
  if (v.length > 480) v = v.slice(0, 477) + "...";
  const valLine = v === "" ? "(boş)" : v;
  const lines = [`${name} · ${scopeLabel}`, `Mevcut değer: ${valLine}`];
  if (scope === null) lines.push("(Tanımlı değil — gönderimde hata verir)");
  return lines.join("\n");
}

let varHoverRaf = null;
/** Fare hareketinde asiri is (layout/canvas) → UI kilitlenmesin */
let varHoverThrottleUntil = 0;
const VAR_HOVER_THROTTLE_MS = 48;
let lastVarHoverSig = "";
let measureTextCtx = null;

function getMeasureTextCtx() {
  if (!measureTextCtx) {
    const c = document.createElement("canvas");
    measureTextCtx = c.getContext("2d");
  }
  return measureTextCtx;
}

function hideVarHoverTooltip() {
  try {
    lastVarHoverSig = "";
    const t = $("varHoverTooltip");
    if (t) {
      t.style.display = "none";
      t.textContent = "";
      t.setAttribute("aria-hidden", "true");
    }
  } catch (e) {
    logApiZeroError("hideVarHoverTooltip", e);
  }
}

function showVarHoverTooltip(clientX, clientY, text) {
  try {
    const t = $("varHoverTooltip");
    if (!t) return;
    const sig = `${text}|${Math.round(clientX / 6)}|${Math.round(clientY / 6)}`;
    if (sig === lastVarHoverSig && t.style.display === "block") {
      return;
    }
    lastVarHoverSig = sig;
    t.textContent = text;
    t.style.display = "block";
    t.setAttribute("aria-hidden", "false");
    requestAnimationFrame(() => {
      try {
        const pad = 12;
        const tw = t.offsetWidth || 280;
        const th = t.offsetHeight || 48;
        let left = clientX + pad;
        let top = clientY + pad;
        if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 8);
        if (top + th > window.innerHeight - 8) top = Math.max(8, clientY - th - pad);
        left = Math.max(8, left);
        top = Math.max(8, top);
        t.style.left = `${left}px`;
        t.style.top = `${top}px`;
      } catch (e) {
        logApiZeroError("showVarHoverTooltip.rAF", e);
      }
    });
  } catch (e) {
    logApiZeroError("showVarHoverTooltip", e);
  }
}

/** Tek satir input: fare X -> karakter indeksi (canvas measureText) */
function getInputIndexFromPoint(input, clientX) {
  try {
    if (!input || input.tagName !== "INPUT") return null;
    const text = input.value;
    const rect = input.getBoundingClientRect();
    const style = window.getComputedStyle(input);
    const pl = parseFloat(style.paddingLeft) || 0;
    const bl = parseFloat(style.borderLeftWidth) || 0;
    const scrollLeft = input.scrollLeft || 0;
    const x = clientX - rect.left - bl - pl + scrollLeft;
    if (x < 0) return 0;
    const ctx = getMeasureTextCtx();
    if (!ctx) return null;
    ctx.font = style.font;
    const totalW = ctx.measureText(text).width;
    if (x >= totalW) return text.length;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (ctx.measureText(text.slice(0, mid)).width <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  } catch (e) {
    logApiZeroError("getInputIndexFromPoint", e);
    return null;
  }
}

/** Textarea: imleç indeksi — contains() gevşek kalınca yanlış offset + ağır maliyet */
function getTextareaIndexFromPoint(textarea, clientX, clientY) {
  try {
    if (!textarea || textarea.tagName !== "TEXTAREA") return null;

    const fromRange = () => {
      const d = document;
      if (typeof d.caretRangeFromPoint !== "function") return null;
      try {
        const r = d.caretRangeFromPoint(clientX, clientY);
        if (!r) return null;
        const sc = r.startContainer;
        if (sc === textarea) return r.startOffset;
        if (sc.nodeType === Node.TEXT_NODE && sc.parentNode === textarea) return r.startOffset;
      } catch {
        return null;
      }
      return null;
    };

    const fromCaretPos = () => {
      if (!document.caretPositionFromPoint) return null;
      try {
        const cp = document.caretPositionFromPoint(clientX, clientY);
        if (!cp || typeof cp.offset !== "number") return null;
        const node = cp.offsetNode;
        if (node === textarea) return cp.offset;
        if (node?.nodeType === Node.TEXT_NODE && node.parentNode === textarea) return cp.offset;
      } catch {
        return null;
      }
      return null;
    };

    return fromRange() ?? fromCaretPos();
  } catch (e) {
    logApiZeroError("getTextareaIndexFromPoint", e);
    return null;
  }
}

function getCharIndexUnderPoint(el, clientX, clientY) {
  try {
    if (el.tagName === "INPUT") return getInputIndexFromPoint(el, clientX);
    if (el.tagName === "TEXTAREA") return getTextareaIndexFromPoint(el, clientX, clientY);
    return null;
  } catch (e) {
    logApiZeroError("getCharIndexUnderPoint", e);
    return null;
  }
}

function updateVarHoverFromPointer(el, clientX, clientY) {
  try {
    if (varSuggestState.active && varSuggestState.targetEl === el) {
      hideVarHoverTooltip();
      return;
    }

    let idx = getCharIndexUnderPoint(el, clientX, clientY);
    if (idx === null || idx === undefined) {
      hideVarHoverTooltip();
      return;
    }
    const len = el.value.length;
    if (typeof idx === "number") {
      if (idx < 0) idx = 0;
      else if (idx > len) idx = len;
    }
    const hit = findVariableAtIndex(el.value, idx);
    if (!hit) {
      hideVarHoverTooltip();
      return;
    }
    const now = Date.now();
    if (now < varHoverThrottleUntil) return;
    varHoverThrottleUntil = now + VAR_HOVER_THROTTLE_MS;

    const { scope, value } = getVarValueForLookup(hit.name);
    showVarHoverTooltip(clientX, clientY, buildVarInlineHoverText(hit.name, scope, value));
  } catch (e) {
    logApiZeroError("updateVarHoverFromPointer", e);
    try {
      hideVarHoverTooltip();
    } catch {
      /* ignore */
    }
  }
}

function bindVarHoverTooltip(el) {
  if (!el || el.dataset.varHoverBound === "1") return;
  // Scroll performansi icin textarea hover'i kapat (en pahali path).
  if (el.tagName === "TEXTAREA") return;
  el.dataset.varHoverBound = "1";

  const host = el.closest(".varHighlightWrap") || el;

  const move = (ev) => {
    if (varHoverRaf) cancelAnimationFrame(varHoverRaf);
    const cx = ev.clientX;
    const cy = ev.clientY;
    varHoverRaf = requestAnimationFrame(() => {
      varHoverRaf = null;
      try {
        updateVarHoverFromPointer(el, cx, cy);
      } catch (e) {
        logApiZeroError("varHover.mousemove", e);
      }
    });
  };

  host.addEventListener("mousemove", move, { passive: true });
  host.addEventListener("mouseleave", () => {
    if (varHoverRaf) cancelAnimationFrame(varHoverRaf);
    varHoverRaf = null;
    hideVarHoverTooltip();
  });

  el.addEventListener("scroll", () => hideVarHoverTooltip());
}

function setupVarHoverTooltipUI() {
  bindVarHoverTooltip($("urlInput"));
  document.addEventListener("mousedown", () => hideVarHoverTooltip());
  document.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "Escape") {
        hideVarSuggest();
        hideVarHoverTooltip();
        closeImportModal();
        closeNewCollectionModal();
        closeNewFolderModal();
        closeSaveRequestModal();
      }
    },
    true,
  );
}

/** Cursor icinde acik bir {{ ... (henuz }} yok) bolgesi var mi? */
function getVarBraceState(value, cursorPos) {
  const prefix = value.slice(0, cursorPos);
  const lastOpen = prefix.lastIndexOf("{{");
  if (lastOpen < 0) return null;
  const between = prefix.slice(lastOpen + 2);
  if (between.includes("}}")) return null;
  return { anchorStart: lastOpen, partial: between };
}

function hideVarSuggest() {
  const dd = $("varSuggestDropdown");
  if (dd) {
    dd.style.display = "none";
    dd.style.pointerEvents = "none";
    dd.style.left = "";
    dd.style.top = "";
    dd.style.minWidth = "";
    dd.innerHTML = "";
    dd.setAttribute("aria-hidden", "true");
  }
  varSuggestState.active = false;
  varSuggestState.targetEl = null;
  varSuggestState.filtered = [];
  varSuggestState.displayRows = [];
  varSuggestState.selectedIndex = 0;
}

/**
 * Textarea / input icinde imlecin ekran koordinatlari (acilir liste icin).
 * Kaydirma (scroll) ile hizalamak icin icerik translate ile tasinir.
 */
function getCaretViewportRect(el) {
  if (!el) return null;
  const pos = el.selectionStart ?? 0;
  const textBefore = el.value.slice(0, pos);
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const lh = parseFloat(style.lineHeight) || 16;
  /** Cok uzun metinde mirror DOM (binlerce satir) UI dondurur */
  if (textBefore.length > 48000) {
    return {
      left: rect.left + 8,
      top: rect.top + 8,
      bottom: rect.top + 8 + lh,
      height: lh,
    };
  }

  const outer = document.createElement("div");
  outer.style.position = "fixed";
  outer.style.left = `${rect.left}px`;
  outer.style.top = `${rect.top}px`;
  outer.style.width = `${el.clientWidth}px`;
  outer.style.height = `${el.clientHeight}px`;
  outer.style.overflow = "hidden";
  outer.style.visibility = "hidden";
  outer.style.pointerEvents = "none";
  outer.style.zIndex = "-1";
  outer.style.boxSizing = style.boxSizing;

  const inner = document.createElement("div");
  inner.style.whiteSpace = el.tagName === "TEXTAREA" ? "pre-wrap" : "pre";
  inner.style.wordWrap = "break-word";
  inner.style.overflowWrap = "break-word";
  inner.style.padding = style.padding;
  inner.style.border = style.border;
  inner.style.font = style.font;
  inner.style.lineHeight = style.lineHeight;
  inner.style.letterSpacing = style.letterSpacing;
  inner.style.textIndent = style.textIndent;
  inner.style.transform = `translate(${-el.scrollLeft}px, ${-el.scrollTop}px)`;

  const lines = textBefore.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) inner.appendChild(document.createElement("br"));
    inner.appendChild(document.createTextNode(lines[i]));
  }
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  inner.appendChild(marker);
  outer.appendChild(inner);

  document.body.appendChild(outer);
  const m = marker.getBoundingClientRect();
  document.body.removeChild(outer);

  const h = m.height > 0 ? m.height : lh;
  return { left: m.left, top: m.top, bottom: m.bottom, height: h };
}

function positionVarSuggest(anchorEl) {
  const dd = $("varSuggestDropdown");
  if (!dd || !anchorEl) return;
  const pad = 4;
  const caret = getCaretViewportRect(anchorEl);
  const dr = varSuggestState.displayRows ?? [];
  const hasNew = dr.some((r) => r.type === "newVar");
  const estH = Math.min(300, dr.length * 38 + (hasNew ? 88 : 0) + 16);
  const rect = anchorEl.getBoundingClientRect();

  let left = caret ? caret.left : rect.left;
  let top = caret ? caret.bottom + pad : rect.bottom + pad;

  if (left + 220 > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - 228);
  }
  left = Math.max(8, left);

  if (top + estH > window.innerHeight - 8) {
    const above = caret ? caret.top - estH - pad : rect.top - estH - pad;
    top = Math.max(8, above);
  }

  const lw = Number.isFinite(left) ? left : 8;
  const tw = Number.isFinite(top) ? top : 8;
  dd.style.left = `${lw}px`;
  dd.style.top = `${tw}px`;
  dd.style.minWidth = `${Math.max(220, Math.min(rect.width, 420))}px`;
  dd.style.pointerEvents = "auto";
}

function renderVarSuggestDropdown() {
  const dd = $("varSuggestDropdown");
  if (!dd) return;
  dd.innerHTML = "";
  const rows = varSuggestState.displayRows ?? [];
  rows.forEach((rowDef, i) => {
    if (rowDef.type === "item") {
      const item = rowDef.item;
      const row = document.createElement("div");
      row.className = "varSuggestItem" + (i === varSuggestState.selectedIndex ? " active" : "");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", i === varSuggestState.selectedIndex ? "true" : "false");
      row.setAttribute("title", buildVarSuggestTooltip(item));

      const name = document.createElement("span");
      name.textContent = item.name;

      const scope = document.createElement("span");
      scope.className = "varSuggestScope " + (item.scope === "env" ? "scope-env" : "scope-global");
      scope.textContent = item.scope === "env" ? "env" : "global";

      row.appendChild(name);
      row.appendChild(scope);

      row.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
        varSuggestState.selectedIndex = i;
        applyVarSuggestSelection();
      });
      dd.appendChild(row);
    } else if (rowDef.type === "newVar") {
      const panel = document.createElement("div");
      panel.className = "varSuggestAddPanel" + (i === varSuggestState.selectedIndex ? " active" : "");
      panel.setAttribute("role", "group");

      const lab = document.createElement("div");
      lab.className = "varSuggestAddLabel";
      lab.appendChild(document.createTextNode("Tanımlı değil · "));
      const strong = document.createElement("strong");
      strong.textContent = "{{" + rowDef.name + "}}";
      lab.appendChild(strong);
      lab.appendChild(document.createTextNode(" için değer girin"));

      const actions = document.createElement("div");
      actions.className = "varSuggestAddRow";

      const valInput = document.createElement("input");
      valInput.id = "varSuggestNewValInput";
      valInput.type = "text";
      valInput.placeholder = "Değer";
      valInput.autocomplete = "off";
      valInput.addEventListener("keydown", (ev) => {
        ev.stopPropagation();
        if (ev.key === "Escape") {
          ev.preventDefault();
          hideVarSuggest();
        }
      });

      const btnEnv = document.createElement("button");
      btnEnv.type = "button";
      btnEnv.className = "btn-primary";
      btnEnv.textContent = "Ortam";
      btnEnv.title = "Aktif ortama ekle";
      btnEnv.addEventListener("mousedown", (ev) => ev.preventDefault());
      btnEnv.addEventListener("click", () => submitNewVariableFromSuggest("env", rowDef.name));

      const btnGlob = document.createElement("button");
      btnGlob.type = "button";
      btnGlob.textContent = "Global";
      btnGlob.title = "Globals'a ekle";
      btnGlob.addEventListener("mousedown", (ev) => ev.preventDefault());
      btnGlob.addEventListener("click", () => submitNewVariableFromSuggest("global", rowDef.name));

      actions.appendChild(valInput);
      actions.appendChild(btnEnv);
      actions.appendChild(btnGlob);

      panel.appendChild(lab);
      panel.appendChild(actions);

      panel.addEventListener("mousedown", (ev) => {
        if (ev.target === panel || ev.target === lab) {
          ev.preventDefault();
          varSuggestState.selectedIndex = i;
          renderVarSuggestDropdown();
          positionVarSuggest(varSuggestState.targetEl);
        }
      });

      dd.appendChild(panel);
    }
  });
  dd.setAttribute("aria-hidden", "false");
}

function updateVarSuggestFromEl(el, keepSelection) {
  try {
    const dd = $("varSuggestDropdown");
    if (!el || !dd) return;
    if (varSuggestSubmitLock) return;
    if (Date.now() < varSuggestSuppressUntil) return;
    const v = el.value;
    const cursor = el.selectionStart ?? v.length;
    const st = getVarBraceState(v, cursor);
    if (!st) {
      hideVarSuggest();
      return;
    }
    const all = getVarSuggestionsList();
    const p = (st.partial || "").toLowerCase();
    const fullNameIfClosed = getClosedTokenVarName(v, st.anchorStart, cursor);
    /** Kapali {{Name}} icinde: sadece tam ad (UserId on ekiyle karismasin) */
    const filtered = fullNameIfClosed
      ? all.filter((x) => x.name.toLowerCase() === fullNameIfClosed.toLowerCase())
      : all.filter((x) => x.name.toLowerCase().startsWith(p));
    const displayRows = buildVarSuggestDisplayRows(filtered, st.partial, fullNameIfClosed);
    if (displayRows.length === 0) {
      hideVarSuggest();
      return;
    }
    varSuggestState.active = true;
    varSuggestState.targetEl = el;
    varSuggestState.anchorStart = st.anchorStart;
    varSuggestState.filtered = filtered;
    varSuggestState.displayRows = displayRows;
    if (!keepSelection) {
      varSuggestState.selectedIndex = 0;
    } else {
      varSuggestState.selectedIndex = Math.max(0, Math.min(varSuggestState.selectedIndex, displayRows.length - 1));
    }
    renderVarSuggestDropdown();
    positionVarSuggest(el);
    dd.style.pointerEvents = "auto";
    dd.style.display = "block";
    const activeRow = dd.querySelector(".varSuggestItem.active, .varSuggestAddPanel.active");
    if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
  } catch (e) {
    logApiZeroError("updateVarSuggestFromEl", e);
    try {
      hideVarSuggest();
    } catch {
      /* ignore */
    }
  }
}

function applyVarSuggestSelection() {
  const el = varSuggestState.targetEl;
  const rows = varSuggestState.displayRows ?? [];
  const row = rows[varSuggestState.selectedIndex];
  if (!el || !row) {
    hideVarSuggest();
    return;
  }
  if (row.type === "newVar") {
    const inp = $("varSuggestNewValInput");
    if (inp) {
      inp.focus();
    }
    return;
  }
  const item = row.item;
  completeVarSuggestInsertion(item.name);
  hideVarSuggest();
}

const VAR_SUGGEST_INPUT_DEBOUNCE_MS = 48;
let varSuggestInputDebounceTimer = null;
let varSuggestPendingEl = null;
let varSuggestPendingKeepSelection = false;
let varSuggestSuppressUntil = 0;

function suppressVarSuggestBriefly(ms = 300) {
  varSuggestSuppressUntil = Date.now() + ms;
}

function clearVarSuggestInputDebounce() {
  if (varSuggestInputDebounceTimer) clearTimeout(varSuggestInputDebounceTimer);
  varSuggestInputDebounceTimer = null;
  varSuggestPendingEl = null;
  varSuggestPendingKeepSelection = false;
}

function scheduleVarSuggestUpdate(el, keepSelection = false) {
  if (!el) return;
  varSuggestPendingEl = el;
  varSuggestPendingKeepSelection = varSuggestPendingKeepSelection || !!keepSelection;
  if (varSuggestInputDebounceTimer) return;
  varSuggestInputDebounceTimer = setTimeout(() => {
    varSuggestInputDebounceTimer = null;
    const targetEl = varSuggestPendingEl;
    const keep = varSuggestPendingKeepSelection;
    varSuggestPendingEl = null;
    varSuggestPendingKeepSelection = false;
    if (targetEl) updateVarSuggestFromEl(targetEl, keep);
  }, VAR_SUGGEST_INPUT_DEBOUNCE_MS);
}

function bindVarSuggestToEl(el) {
  if (!el || el.dataset.varSuggestBound === "1") return;
  el.dataset.varSuggestBound = "1";

  el.addEventListener("input", () => {
    scheduleVarSuggestUpdate(el, false);
  });

  el.addEventListener("click", () => {
    scheduleVarSuggestUpdate(el, true);
  });

  el.addEventListener("scroll", () => {
    if (varSuggestState.active && varSuggestState.targetEl === el) {
      positionVarSuggest(el);
    }
  });

  el.addEventListener("keydown", (ev) => {
    if (!varSuggestState.active || varSuggestState.targetEl !== el) return;
    const n = (varSuggestState.displayRows ?? []).length;
    if (n === 0) return;

    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      varSuggestState.selectedIndex = (varSuggestState.selectedIndex + 1) % n;
      renderVarSuggestDropdown();
      positionVarSuggest(el);
      const dd = $("varSuggestDropdown");
      const activeRow = dd?.querySelector(".varSuggestItem.active, .varSuggestAddPanel.active");
      if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
      return;
    }
    if (ev.key === "ArrowUp") {
      ev.preventDefault();
      varSuggestState.selectedIndex = (varSuggestState.selectedIndex - 1 + n) % n;
      renderVarSuggestDropdown();
      positionVarSuggest(el);
      const dd = $("varSuggestDropdown");
      const activeRow = dd?.querySelector(".varSuggestItem.active, .varSuggestAddPanel.active");
      if (activeRow) activeRow.scrollIntoView({ block: "nearest" });
      return;
    }
    if (ev.key === "Enter" || ev.key === "Tab") {
      ev.preventDefault();
      applyVarSuggestSelection();
      return;
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      hideVarSuggest();
    }
  });
}

function setupVarSuggestUI() {
  bindVarSuggestToEl($("urlInput"));
  bindVarSuggestToEl($("bodyJson"));
  window.addEventListener("resize", () => {
    hideVarSuggest();
    hideVarHoverTooltip();
  });
  document.addEventListener("mousedown", (ev) => {
    const dd = $("varSuggestDropdown");
    if (!dd || dd.style.display === "none") return;
    if (ev.target === dd || dd.contains(ev.target)) return;
    const t = varSuggestState.targetEl;
    if (t && (ev.target === t || (t.parentElement && t.parentElement.contains(ev.target)))) return;
    hideVarSuggest();
  });
}

async function sendRequest() {
  try {
    $("resultLine").textContent = "Calisiyor...";
    const payload = getRequestPayload();
    const result = await window.api.sendRequestV1(payload);
    $("resultLine").textContent = result.success ? "OK" : `FAILED: ${result.errorMessage || ""}`;
    setResponseUI(result);
    await refreshState();
  } catch (e) {
    $("resultLine").textContent = `Hata: ${e?.message || e}`;
    setResponseUI({ success: false, errorMessage: e?.message || String(e) });
  }
}

async function clearHistory() {
  await window.api.clearHistory();
  $("resultLine").textContent = "History temizlendi.";
  await refreshState();
}

async function saveRequest(options) {
  const forceNew = !!options?.forceNew;
  const requestedCollectionId = options?.targetCollectionId ?? null;
  try {
    if (!saveTargetCollectionId && selectedCollectionId) saveTargetCollectionId = selectedCollectionId;
    const targetCollectionId = requestedCollectionId || saveTargetCollectionId || selectedCollectionId || null;
    if (!targetCollectionId) {
      $("resultLine").textContent = "Kaydetmek icin once bir collection secin.";
      return;
    }

    const name = ($("requestNameInput")?.value ?? "").trim();
    if (!name) {
      $("resultLine").textContent = "Request name bos olamaz.";
      return;
    }

    const payload = getRequestPayload();
    $("resultLine").textContent = forceNew ? "Save as..." : "Save...";
    const targetFolderId = targetCollectionId === selectedCollectionId ? selectedFolderId || saveTargetFolderId : null;

    const activeTab = getActiveTab();
    await window.api.upsertRequestNodeV1({
      collectionId: targetCollectionId,
      parentFolderId: targetFolderId,
      requestId: forceNew ? undefined : selectedRequestId || undefined,
      name,
      definition: payload,
    });
    saveTargetCollectionId = targetCollectionId;
    saveTargetFolderId = targetFolderId;

    $("resultLine").textContent = forceNew ? "Kaydedildi (Save as)." : "Kaydedildi.";
    // Tab title update
    if (activeTab) {
      activeTab.title = name;
      activeTab.draft = readFormToDraft();
      if (!forceNew && selectedRequestId) {
        activeTab.linked = activeTab.linked ?? { collectionId: targetCollectionId, requestId: selectedRequestId };
      }
    }
    renderOpenTabsBar();
    schedulePersistOpenRequestTabs();
    await refreshState();
    setLeftTab("collections");
    return true;
  } catch (e) {
    $("resultLine").textContent = `Kaydetme hatasi: ${e?.message || e}`;
    return false;
  }
}

// Wire up events
window.addEventListener("DOMContentLoaded", async () => {
  await init();
  setupVarSuggestUI();
  setupVarHoverTooltipUI();
  $("respViewPrettyBtn")?.addEventListener("click", () => setResponseViewMode("pretty"));
  $("respViewRawBtn")?.addEventListener("click", () => setResponseViewMode("raw"));
  $("respViewPreviewBtn")?.addEventListener("click", () => setResponseViewMode("preview"));
  setResponseViewMode("pretty");

  window.addEventListener("beforeunload", () => {
    persistOpenRequestTabsSync();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) persistOpenRequestTabsSync();
  });

  (function attachAutoPersistOnDraftEdit() {
    const deb = () => schedulePersistOpenRequestTabs();
    ["urlInput", "bodyJson", "postResScript", "requestNameInput"].forEach((id) => {
      const el = $(id);
      if (el) {
        el.addEventListener("input", deb);
        el.addEventListener("change", deb);
      }
    });
    const ms = $("methodSel");
    if (ms) ms.addEventListener("change", deb);
    /** NOT: document capture input kullanma — sidebar (OpenAPI URL, env vb.) her input'ta
     *  closest() + readFormToDraft tetiklenip (buyuk body ile) UI kilitlenir. */
  })();

  const urlInput = $("urlInput");
  if (urlInput) {
    urlInput.addEventListener("input", () => {
      if (syncingUrlFromParams) return;
      setParamRowsFromUrl(urlInput.value);
      renderParamsTable();
    });
  }

  // Environments UI handlers
  const envSelect = $("envSelect");
  if (envSelect) {
    envSelect.addEventListener("change", async () => {
      await window.api.setActiveEnvironmentV1({ environmentId: envSelect.value });
      await refreshState({ deferHeavy: true });
    });
  }

  const reqEnvSelect = $("reqEnvSelect");
  if (reqEnvSelect) {
    reqEnvSelect.addEventListener("change", async () => {
      const v = reqEnvSelect.value;
      await window.api.setActiveEnvironmentV1({ environmentId: v ? v : null });
      await refreshState({ deferHeavy: true });
    });
  }
  const createEnvBtn = $("createEnvBtn");
  const newEnvNameInput = $("newEnvNameInput");
  const runCreateEnv = async () => {
    const name = String(newEnvNameInput?.value ?? "").trim();
    if (!name) {
      $("resultLine").textContent = "Yeni ortam adı girin.";
      newEnvNameInput?.focus();
      return;
    }
    try {
      await window.api.createEnvironmentV1({ name });
      if (newEnvNameInput) newEnvNameInput.value = "";
      await refreshState({ deferHeavy: true });
      $("resultLine").textContent = `Ortam oluşturuldu: ${name}`;
    } catch (e) {
      $("resultLine").textContent = `Ortam: ${e?.message || e}`;
    }
  };
  if (createEnvBtn) createEnvBtn.addEventListener("click", runCreateEnv);
  if (newEnvNameInput) {
    newEnvNameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        runCreateEnv();
      }
    });
  }
  if ($("renameEnvBtn")) {
    $("renameEnvBtn").addEventListener("click", async () => {
      const id = $("envSelect")?.value;
      const name = String($("envNameInput")?.value ?? "").trim();
      if (!id || !name) return;
      await window.api.renameEnvironmentV1({ environmentId: id, name });
      await refreshState({ deferHeavy: true });
    });
  }
  if ($("deleteEnvBtn")) {
    $("deleteEnvBtn").addEventListener("click", async () => {
      const id = $("envSelect")?.value;
      if (!id) return;
      await window.api.deleteEnvironmentV1({ environmentId: id });
      await refreshState({ deferHeavy: true });
    });
  }
  if ($("addEnvVarBtn")) {
    $("addEnvVarBtn").addEventListener("click", () => {
      envVarRows.push({ key: "", value: "" });
      renderVarTable("envVarsTable", envVarRows);
    });
  }
  if ($("saveEnvVarsBtn")) {
    $("saveEnvVarsBtn").addEventListener("click", async () => {
      const id = $("envSelect")?.value;
      if (!id) return;
      await window.api.setEnvironmentVarsV1({ environmentId: id, variables: rowsToVariablesMap(envVarRows) });
      $("resultLine").textContent = "Environment kaydedildi.";
      await refreshState({ deferHeavy: true });
    });
  }

  if ($("addGlobalVarBtn")) {
    $("addGlobalVarBtn").addEventListener("click", () => {
      globalVarRows.push({ key: "", value: "" });
      renderVarTable("globalsVarsTable", globalVarRows);
    });
  }
  if ($("saveGlobalsBtn")) {
    $("saveGlobalsBtn").addEventListener("click", async () => {
      await window.api.setGlobalsV1({ globals: rowsToVariablesMap(globalVarRows) });
      $("resultLine").textContent = "Globals kaydedildi.";
      await refreshState({ deferHeavy: true });
    });
  }

  if ($("sendBtn")) $("sendBtn").addEventListener("click", sendRequest);
  if ($("clearHistoryBtn")) $("clearHistoryBtn").addEventListener("click", clearHistory);
  if ($("saveReqBtn")) {
    $("saveReqBtn").addEventListener("click", async () => {
      openSaveRequestModal();
      const modal = $("saveRequestModal");
      const panel = $("saveRequestModalPanel");
      if (!modal || !panel) {
        await runSaveRequestFallback(false);
        return;
      }
      requestAnimationFrame(async () => {
        const cs = window.getComputedStyle(modal);
        const rect = panel.getBoundingClientRect();
        const visible =
          modal.classList.contains("open") &&
          cs.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0;
        if (!visible) {
          await runSaveRequestFallback(false);
        }
      });
    });
  }

  const saveRequestModalBackdrop = $("saveRequestModalBackdrop");
  const saveRequestModalClose = $("saveRequestModalClose");
  const saveRequestNameInput = $("saveRequestNameInput");
  const saveRequestCollectionSelect = $("saveRequestCollectionSelect");
  const saveRequestModalSaveBtn = $("saveRequestModalSaveBtn");
  const saveRequestModalSaveAsBtn = $("saveRequestModalSaveAsBtn");

  if (saveRequestModalBackdrop) saveRequestModalBackdrop.addEventListener("click", () => closeSaveRequestModal());
  if (saveRequestModalClose) saveRequestModalClose.addEventListener("click", () => closeSaveRequestModal());
  if (saveRequestNameInput) {
    saveRequestNameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveRequestModalSaveBtn?.click();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeSaveRequestModal();
      }
    });
  }
  if (saveRequestModalSaveBtn) {
    saveRequestModalSaveBtn.addEventListener("click", async () => {
      const nm = String(saveRequestNameInput?.value ?? "").trim();
      if (!nm) {
        $("resultLine").textContent = "Request name bos olamaz.";
        saveRequestNameInput?.focus();
        return;
      }
      const targetCollectionId = String(saveRequestCollectionSelect?.value ?? "").trim() || null;
      if ($("requestNameInput")) $("requestNameInput").value = nm;
      const ok = await saveRequest({ forceNew: false, targetCollectionId });
      if (ok) closeSaveRequestModal();
    });
  }
  if (saveRequestModalSaveAsBtn) {
    saveRequestModalSaveAsBtn.addEventListener("click", async () => {
      const nm = String(saveRequestNameInput?.value ?? "").trim();
      if (!nm) {
        $("resultLine").textContent = "Request name bos olamaz.";
        saveRequestNameInput?.focus();
        return;
      }
      const targetCollectionId = String(saveRequestCollectionSelect?.value ?? "").trim() || null;
      if ($("requestNameInput")) $("requestNameInput").value = nm;
      const ok = await saveRequest({ forceNew: true, targetCollectionId });
      if (ok) closeSaveRequestModal();
    });
  }

  // + New dropdown
  const newBtn = $("sidebarNewBtn");
  const menu = $("newMenu");
  if (newBtn && menu) {
    newBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      menu.classList.toggle("open");
      closeImportModal();
    });
  }
  const importMenuBtn = $("importMenuBtn");
  if (importMenuBtn) {
    importMenuBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openImportModal();
      if (menu) menu.classList.remove("open");
    });
  }
  document.addEventListener("click", () => {
    if (menu) menu.classList.remove("open");
  });

  const importModalBackdrop = $("importModalBackdrop");
  const importModalClose = $("importModalClose");
  if (importModalBackdrop) {
    importModalBackdrop.addEventListener("click", () => closeImportModal());
  }
  if (importModalClose) {
    importModalClose.addEventListener("click", () => closeImportModal());
  }

  const newCollectionModalBackdrop = $("newCollectionModalBackdrop");
  const newCollectionModalClose = $("newCollectionModalClose");
  if (newCollectionModalBackdrop) {
    newCollectionModalBackdrop.addEventListener("click", () => closeNewCollectionModal());
  }
  if (newCollectionModalClose) {
    newCollectionModalClose.addEventListener("click", () => closeNewCollectionModal());
  }
  const newCollectionOpenModalBtn = $("newCollectionOpenModalBtn");
  if (newCollectionOpenModalBtn) {
    newCollectionOpenModalBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openNewCollectionModal();
    });
  }

  const newCollectionBtn = $("newCollectionBtn");
  const newFolderBtn = $("newFolderBtn");
  const newRequestBtn = $("newRequestBtn");

  if (newCollectionBtn) {
    newCollectionBtn.addEventListener("click", () => {
      setLeftTab("collections");
      openNewCollectionModal();
      if (menu) menu.classList.remove("open");
    });
  }
  if (newFolderBtn) {
    newFolderBtn.addEventListener("click", () => {
      setLeftTab("collections");
      const el = $("newFolderName");
      if (el) el.focus();
      if (menu) menu.classList.remove("open");
    });
  }
  if (newRequestBtn) {
    newRequestBtn.addEventListener("click", () => {
      setLeftTab("collections");
      // new tab
      const current = getActiveTab();
      if (current) current.draft = readFormToDraft();
      const id = cryptoRandomId();
      openTabs.push({ id, title: "New Request", linked: null, draft: newDraft() });
      activeTabId = id;
      resetRequestForm();
      renderOpenTabsBar();
      schedulePersistOpenRequestTabs();
      const el = $("urlInput");
      if (el) el.focus();
      if (menu) menu.classList.remove("open");
    });
  }

  // Left tabs
  const tabEnv = $("tabEnvironmentBtn");
  const tabHistory = $("tabHistoryBtn");
  const tabCollections = $("tabCollectionsBtn");
  if (tabEnv) tabEnv.addEventListener("click", () => setLeftTab("environment"));
  if (tabHistory) tabHistory.addEventListener("click", () => setLeftTab("history"));
  if (tabCollections) tabCollections.addEventListener("click", () => setLeftTab("collections"));
  const sidebarFilter = $("sidebarFilter");
  const sidebarFilterClearBtn = $("sidebarFilterClearBtn");
  const updateSidebarFilterClearBtn = () => {
    if (!sidebarFilterClearBtn || !sidebarFilter) return;
    const hasText = String(sidebarFilter.value ?? "").trim().length > 0;
    sidebarFilterClearBtn.classList.toggle("hidden", !hasText);
  };
  const clearSidebarFilter = () => {
    if (!sidebarFilter) return;
    sidebarFilter.value = "";
    renderRequestsList(null);
    updateSidebarFilterClearBtn();
    try {
      sidebarFilter.focus();
    } catch {
      /* ignore */
    }
  };
  if (sidebarFilter) {
    sidebarFilter.addEventListener("input", () => {
      // Sadece collections listesi icin filtre.
      renderRequestsList(null);
      updateSidebarFilterClearBtn();
    });
    sidebarFilter.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        clearSidebarFilter();
      }
    });
  }
  if (sidebarFilterClearBtn) {
    sidebarFilterClearBtn.addEventListener("click", () => {
      clearSidebarFilter();
    });
  }
  updateSidebarFilterClearBtn();

  // Request tabs
  const rtParams = $("reqTabParams");
  const rtHeaders = $("reqTabHeaders");
  const rtBody = $("reqTabBody");
  const rtScripts = $("reqTabScripts");
  if (rtParams) rtParams.addEventListener("click", () => setRequestTab("params"));
  if (rtHeaders) rtHeaders.addEventListener("click", () => setRequestTab("headers"));
  if (rtBody) rtBody.addEventListener("click", () => setRequestTab("body"));
  if (rtScripts) rtScripts.addEventListener("click", () => setRequestTab("scripts"));

  const addParamRowBtn = $("addParamRowBtn");
  if (addParamRowBtn) {
    addParamRowBtn.addEventListener("click", () => {
      paramRows.push({ key: "", value: "" });
      renderParamsTable();
      schedulePersistOpenRequestTabs();
    });
  }

  // Headers table UI
  const addHeaderRowBtn = $("addHeaderRowBtn");
  if (addHeaderRowBtn) {
    addHeaderRowBtn.addEventListener("click", () => {
      headerRows.push({ key: "", value: "" });
      renderHeadersTable();
      syncHeadersTextareaFromRows();
      schedulePersistOpenRequestTabs();
    });
  }

  // Status bar: sadece bilgi gosterimi (clear butonu yok)

  // Collections UI
  const createCollectionBtn = $("createCollectionBtn");
  const createFolderBtn = $("createFolderBtn");
  const saveNewRequestBtn = $("saveNewRequestBtn");
  const updateRequestBtn = $("updateRequestBtn");

  if (createCollectionBtn) {
    createCollectionBtn.addEventListener("click", async () => {
      const name = $("newCollectionName")?.value;
      if (!name || !String(name).trim()) {
        $("resultLine").textContent = "Koleksiyon adi bos olamaz.";
        return;
      }
      $("resultLine").textContent = "Collection olusturuluyor...";
      await window.api.createCollectionV1({ name: String(name) });
      if ($("newCollectionName")) $("newCollectionName").value = "";
      closeNewCollectionModal();
      await refreshState();
      setLeftTab("collections");
    });
  }
  const newCollectionNameInput = $("newCollectionName");
  if (newCollectionNameInput) {
    newCollectionNameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        $("createCollectionBtn")?.click();
      }
    });
  }

  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", async () => {
      try {
        if (!selectedCollectionId) {
          $("resultLine").textContent = "Once bir collection secin.";
          return;
        }
        const name = $("newFolderName").value;
        if (!name || !String(name).trim()) {
          $("resultLine").textContent = "Folder adi bos olamaz.";
          return;
        }
        $("resultLine").textContent = "Folder olusturuluyor...";
        await window.api.createFolderV1({
          collectionId: selectedCollectionId,
          parentFolderId: selectedFolderId,
          name: String(name),
        });
        $("newFolderName").value = "";
        $("resultLine").textContent = "Folder olusturuldu.";
        await refreshState();
        setLeftTab("collections");
      } catch (e) {
        $("resultLine").textContent = `Folder olusturma hatasi: ${e?.message || e}`;
      }
    });
  }

  // New folder (modal) UI
  const newFolderModalBackdrop = $("newFolderModalBackdrop");
  const newFolderModalClose = $("newFolderModalClose");
  const newFolderModalNameInput = $("newFolderModalName");
  const createFolderModalBtn = $("createFolderModalBtn");

  if (newFolderModalBackdrop) {
    newFolderModalBackdrop.addEventListener("click", () => closeNewFolderModal());
  }
  if (newFolderModalClose) {
    newFolderModalClose.addEventListener("click", () => closeNewFolderModal());
  }
  if (newFolderModalNameInput) {
    newFolderModalNameInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        createFolderModalBtn?.click();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeNewFolderModal();
      }
    });
  }

  if (createFolderModalBtn) {
    createFolderModalBtn.addEventListener("click", async () => {
      try {
        const ctx = newFolderContext;
        if (!ctx || !ctx.collectionId) {
          $("resultLine").textContent = "Klasor eklemek icin once hedef secilmedi.";
          return;
        }
        const name = String(newFolderModalNameInput?.value ?? "").trim();
        if (!name) {
          $("resultLine").textContent = "Klasor adi bos olamaz.";
          newFolderModalNameInput?.focus();
          return;
        }

        $("resultLine").textContent = "Klasor olusturuluyor...";
        await window.api.createFolderV1({
          collectionId: ctx.collectionId,
          parentFolderId: ctx.parentFolderId,
          name,
        });

        // Yeni klasor gorunsun diye parent'i ac.
        if (ctx.parentFolderId) collapseState.folders[ctx.parentFolderId] = false;
        else collapseState.collections[ctx.collectionId] = false;

        selectedCollectionId = ctx.collectionId;
        selectedFolderId = ctx.parentFolderId;
        selectedRequestId = null;
        saveTargetCollectionId = ctx.collectionId;
        saveTargetFolderId = ctx.parentFolderId;

        closeNewFolderModal();
        await refreshState();
        setLeftTab("collections");
      } catch (e) {
        $("resultLine").textContent = `Folder olusturma hatasi: ${e?.message || e}`;
      }
    });
  }

  // Kaydetme artik sag tarafta (Save / Save as)

  // Export/Import (UI template)
  const exportBtn = $("exportVarsBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        $("resultLine").textContent = "Export ediliyor...";
        const res = await window.api.exportV1();
        $("resultLine").textContent = res?.ok
          ? `Export tamam: ${res.filePath}`
          : `Export iptal edildi`;
      } catch (e) {
        $("resultLine").textContent = `Export hata: ${e?.message || e}`;
      }
    });
  }

  async function runImportApiZero() {
    closeImportModal();
    try {
      $("resultLine").textContent = "Import ediliyor...";
      const res = await window.api.importV1();
      $("resultLine").textContent = res?.ok ? "Import tamam" : "Import iptal edildi";
      await refreshState();
    } catch (e) {
      $("resultLine").textContent = `Import hata: ${e?.message || e}`;
    }
  }

  async function runImportPostman() {
    closeImportModal();
    try {
      $("resultLine").textContent = "Postman collection import ediliyor...";
      const res = await window.api.importPostmanCollectionV21();
      $("resultLine").textContent = res?.ok ? "Postman import tamam" : "Postman import iptal edildi";
      await refreshState();
      setLeftTab("collections");
    } catch (e) {
      $("resultLine").textContent = `Postman import hata: ${e?.message || e}`;
    }
  }

  async function runImportOpenApiFile() {
    closeImportModal();
    try {
      $("resultLine").textContent = "OpenAPI / Swagger import ediliyor...";
      const res = await window.api.importOpenApiV1();
      if (res?.ok) {
        const c = res.requestCount != null ? ` (${res.requestCount} istek)` : "";
        $("resultLine").textContent = `OpenAPI import tamam: ${res.name ?? ""}${c}`;
      } else if (res?.reason === "cancelled") {
        $("resultLine").textContent = "OpenAPI import iptal";
      } else if (res?.message) {
        $("resultLine").textContent = `OpenAPI: ${res.message}`;
      } else {
        $("resultLine").textContent = "OpenAPI import başarısız";
      }
      await refreshState();
      setLeftTab("collections");
    } catch (e) {
      $("resultLine").textContent = `OpenAPI import hata: ${e?.message || e}`;
    }
  }

  async function runImportOpenApiUrl(urlStr) {
    closeImportModal();
    const url = String(urlStr ?? "").trim();
    if (!url) {
      $("resultLine").textContent = "URL boş.";
      return;
    }
    try {
      $("resultLine").textContent = "URL'den OpenAPI indiriliyor...";
      const res = await window.api.importOpenApiFromUrlV1({ url });
      if (res?.ok) {
        const c = res.requestCount != null ? ` (${res.requestCount} istek)` : "";
        $("resultLine").textContent = `OpenAPI import tamam: ${res.name ?? ""}${c}`;
      } else if (res?.message) {
        $("resultLine").textContent = `OpenAPI URL: ${res.message}`;
      } else {
        $("resultLine").textContent = "OpenAPI URL import başarısız";
      }
      await refreshState();
      setLeftTab("collections");
    } catch (e) {
      $("resultLine").textContent = `OpenAPI URL hata: ${e?.message || e}`;
    }
  }

  const importMenuApiZero = $("importMenuApiZero");
  if (importMenuApiZero) importMenuApiZero.addEventListener("click", (ev) => {
    ev.stopPropagation();
    runImportApiZero();
  });
  const importMenuPostman = $("importMenuPostman");
  if (importMenuPostman) importMenuPostman.addEventListener("click", (ev) => {
    ev.stopPropagation();
    runImportPostman();
  });
  const importMenuOpenApiFile = $("importMenuOpenApiFile");
  if (importMenuOpenApiFile) importMenuOpenApiFile.addEventListener("click", (ev) => {
    ev.stopPropagation();
    runImportOpenApiFile();
  });
  const importMenuOpenApiUrl = $("importMenuOpenApiUrl");
  if (importMenuOpenApiUrl) {
    importMenuOpenApiUrl.addEventListener("click", (ev) => {
      ev.stopPropagation();
      openImportOpenApiUrlModal();
    });
  }

  const importOpenApiUrlModalBackdrop = $("importOpenApiUrlModalBackdrop");
  const importOpenApiUrlModalClose = $("importOpenApiUrlModalClose");
  const importOpenApiUrlModalInput = $("importOpenApiUrlInput");
  const importOpenApiUrlModalImportBtn = $("importOpenApiUrlModalImportBtn");
  const importOpenApiUrlModalCancelBtn = $("importOpenApiUrlModalCancelBtn");

  if (importOpenApiUrlModalBackdrop) {
    importOpenApiUrlModalBackdrop.addEventListener("click", () => closeImportOpenApiUrlModal());
  }
  if (importOpenApiUrlModalClose) {
    importOpenApiUrlModalClose.addEventListener("click", () => closeImportOpenApiUrlModal());
  }
  if (importOpenApiUrlModalCancelBtn) {
    importOpenApiUrlModalCancelBtn.addEventListener("click", () => closeImportOpenApiUrlModal());
  }
  if (importOpenApiUrlModalInput) {
    importOpenApiUrlModalInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        importOpenApiUrlModalImportBtn?.click();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        closeImportOpenApiUrlModal();
      }
    });
  }
  if (importOpenApiUrlModalImportBtn) {
    importOpenApiUrlModalImportBtn.addEventListener("click", async () => {
      const url = String(importOpenApiUrlModalInput?.value ?? "").trim();
      closeImportOpenApiUrlModal();
      await runImportOpenApiUrl(url);
    });
  }
});

installApiZeroGlobalErrorHandlers();

