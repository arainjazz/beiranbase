import { useCallback, useEffect, useRef, useState } from "react";
import { SiteShell } from "./SiteShell";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { SectionEditorDialog } from "./SectionEditorDialog";

export type MockPageKey =
  | "home"
  | "species"
  | "courses"
  | "ecofarming"
  | "community"
  | "gifts"
  | "story";

interface Props {
  src: string;
  title: string;
  page?: MockPageKey;
  afterFrame?: React.ReactNode;
}

type SavedPost = {
  id: string;
  page: string;
  title: string;
  body: string;
  sort_order: number;
};

const EDITABLE_ATTR = "data-lov-block";
const ADMIN_ATTR = "data-lov-admin";

function pickBlocks(doc: Document): HTMLElement[] {
  const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
  const semantic = Array.from(main.querySelectorAll("section, article")) as HTMLElement[];
  if (semantic.length > 0) {
    const leaves = semantic.filter((el) => !el.querySelector("section, article"));
    return leaves.length > 0 ? leaves : semantic;
  }
  const children = Array.from(main.children) as HTMLElement[];
  return children.filter((el) => !["SCRIPT", "STYLE", "TEMPLATE"].includes(el.tagName));
}

function getHeading(el: HTMLElement) {
  return el.querySelector("h1,h2,h3,h4")?.textContent?.trim() || "";
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function cleanAdminChrome(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${ADMIN_ATTR}]`).forEach((node) => node.remove());
  clone.removeAttribute(EDITABLE_ATTR);
  clone.querySelectorAll(`[${EDITABLE_ATTR}]`).forEach((n) => n.removeAttribute(EDITABLE_ATTR));
  clone.querySelectorAll("[contenteditable]").forEach((n) => (n as HTMLElement).removeAttribute("contenteditable"));
  return clone.outerHTML;
}

function ensureFrameResponsive(doc: Document) {
  doc.querySelectorAll(`[${ADMIN_ATTR}="responsive-style"]`).forEach((el) => el.remove());
  const style = doc.createElement("style");
  style.setAttribute(ADMIN_ATTR, "responsive-style");
  style.textContent = `
    html { -webkit-text-size-adjust: 100%; }
    body { overflow-x: hidden; }
    img, picture, video, canvas, svg { max-width: 100% !important; height: auto !important; }
    img { object-fit: cover; }
    * { box-sizing: border-box; }
    /* tablet */
    @media (max-width: 1024px) {
      [class*="lg:grid-cols-3"], [class*="md:grid-cols-3"] { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
      [class*="lg:grid-cols-4"], [class*="md:grid-cols-4"] { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
      section { padding-left: clamp(20px, 4vw, 40px) !important; padding-right: clamp(20px, 4vw, 40px) !important; }
      h1 { font-size: clamp(34px, 6vw, 56px) !important; line-height: 1.15 !important; }
    }
    /* mobile */
    @media (max-width: 768px) {
      body { font-size: clamp(15px, 3.9vw, 17px) !important; line-height: 1.7 !important; }
      main, section, article, header, footer, div { max-width: 100% !important; }
      section, article { padding-left: clamp(16px, 5vw, 24px) !important; padding-right: clamp(16px, 5vw, 24px) !important; padding-top: clamp(40px, 10vw, 64px) !important; padding-bottom: clamp(40px, 10vw, 64px) !important; }
      h1 { font-size: clamp(28px, 8vw, 44px) !important; line-height: 1.15 !important; }
      h2 { font-size: clamp(22px, 6.2vw, 32px) !important; line-height: 1.22 !important; }
      h3 { font-size: clamp(18px, 5vw, 24px) !important; line-height: 1.3 !important; }
      p, li, a, button, input, textarea { font-size: clamp(15px, 3.9vw, 17px) !important; }
      [class*="grid-cols-"], [style*="grid-template-columns"], [style*="display: grid"], [style*="display:grid"] { grid-template-columns: 1fr !important; gap: clamp(16px, 4vw, 24px) !important; }
      [style*="display: flex"], [style*="display:flex"] { flex-wrap: wrap !important; }
      img { border-radius: min(12px, 3vw) !important; }
      /* full-viewport hero often breaks on mobile */
      [class*="h-screen"] { height: auto !important; min-height: 78vh !important; }
      [class*="min-h-["] { min-height: 60vh !important; }
    }
  `;
  doc.head.appendChild(style);
}

type EditingState =
  | { mode: "edit"; idx: number; html: string; title: string }
  | { mode: "add"; idx: number }
  | null;

export function MockFrame({ src, title, page, afterFrame }: Props) {
  const { roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(1200);
  const [savedByOrder, setSavedByOrder] = useState<Map<number, SavedPost>>(new Map());
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<EditingState>(null);

  const loadSaved = useCallback(async () => {
    if (!page) return new Map<number, SavedPost>();
    const { data } = await supabase
      .from("posts")
      .select("id,page,title,body,sort_order")
      .eq("page", page as any)
      .order("sort_order", { ascending: true });
    const map = new Map<number, SavedPost>();
    (data ?? []).forEach((p: any) => map.set(p.sort_order, p as SavedPost));
    setSavedByOrder(map);
    return map;
  }, [page]);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const decorate = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;

    let raf = 0;
    const resize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h) setHeight((prev) => (Math.abs(h - prev) > 4 ? h : prev));
      });
    };

    doc.querySelectorAll(`[${ADMIN_ATTR}]`).forEach((el) => el.remove());
    ensureFrameResponsive(doc);

    let blocks = pickBlocks(doc);
    if (savedByOrder.size > 0) {
      blocks.forEach((el, idx) => {
        const saved = savedByOrder.get(idx);
        if (!saved) return;
        const wrap = doc.createElement("div");
        wrap.innerHTML = saved.body;
        const repl = wrap.firstElementChild as HTMLElement | null;
        if (repl) { el.replaceWith(repl); blocks[idx] = repl; }
      });
      const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
      Array.from(savedByOrder.entries())
        .filter(([order]) => order >= blocks.length)
        .sort((a, b) => a[0] - b[0])
        .forEach(([, saved]) => {
          const wrap = doc.createElement("div");
          wrap.innerHTML = saved.body;
          const el = wrap.firstElementChild as HTMLElement | null;
          if (el) { main.appendChild(el); blocks.push(el); }
        });
    }

    resize();
    const mo = new MutationObserver(resize);
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
    doc.addEventListener("load", resize, true);

    if (!isAdmin || !page) {
      return () => { mo.disconnect(); doc.removeEventListener("load", resize, true); cancelAnimationFrame(raf); };
    }

    // ---- Right-click any image → quick replace (no edit mode required) ----
    const globalFile = doc.createElement("input");
    globalFile.setAttribute(ADMIN_ATTR, "global-file");
    globalFile.type = "file";
    globalFile.accept = "image/*";
    globalFile.style.display = "none";
    doc.body.appendChild(globalFile);
    let pendingImg: HTMLImageElement | null = null;
    const onContext = (e: MouseEvent) => {
      const img = e.target instanceof HTMLElement ? e.target.closest("img") : null;
      if (!img) return;
      e.preventDefault();
      pendingImg = img as HTMLImageElement;
      globalFile.click();
    };
    globalFile.onchange = async () => {
      const file = globalFile.files?.[0];
      globalFile.value = "";
      if (!file || !pendingImg) return;
      const dataUrl = await readImageAsDataUrl(file);
      pendingImg.src = dataUrl;
      pendingImg.removeAttribute("srcset");
      const owner = pendingImg.closest(`[${EDITABLE_ATTR}]`) as HTMLElement | null;
      pendingImg = null;
      if (!owner) return;
      const idx = Number(owner.getAttribute(EDITABLE_ATTR));
      const heading = getHeading(owner) || `版块 ${idx + 1}`;
      const html = cleanAdminChrome(owner);
      const saved = savedByOrder.get(idx);
      if (saved) {
        await supabase.from("posts").update({ body: html, title: heading, updated_at: new Date().toISOString() }).eq("id", saved.id);
      } else {
        await supabase.from("posts").insert({ page: page as any, sort_order: idx, title: heading, body: html } as any);
      }
      await loadSaved();
      setRevision((r) => r + 1);
    };
    doc.addEventListener("contextmenu", onContext);

    // ---- Block-level drag reorder ----
    const persistOrder = async (currentBlocks: HTMLElement[]) => {
      const all = currentBlocks.map((el, i) => ({
        i,
        html: cleanAdminChrome(el),
        title: getHeading(el) || `版块 ${i + 1}`,
      }));
      await supabase.from("posts").delete().eq("page", page as any);
      if (all.length > 0) {
        await supabase.from("posts").insert(
          all.map((b) => ({ page: page as any, sort_order: b.i, title: b.title, body: b.html })) as any
        );
      }
      await loadSaved();
      setRevision((r) => r + 1);
    };

    let dragSrc: HTMLElement | null = null;

    blocks.forEach((sec, idx) => {
      sec.setAttribute(EDITABLE_ATTR, String(idx));
      if (doc.defaultView?.getComputedStyle(sec).position === "static") sec.style.position = "relative";

      // Drag handle (top-left)
      const handle = doc.createElement("div");
      handle.setAttribute(ADMIN_ATTR, "handle");
      handle.draggable = true;
      handle.title = "按住拖动以重排版块";
      handle.innerHTML = "⇕ 拖动排序";
      handle.style.cssText = "position:absolute;top:8px;left:8px;z-index:9999;font:600 12px/1 system-ui,sans-serif;padding:7px 11px;border:1px solid #d4d4d4;border-radius:7px;background:#fffffff2;color:#111;cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.10);user-select:none;";
      handle.addEventListener("dragstart", (e) => {
        dragSrc = sec;
        sec.style.opacity = "0.5";
        e.dataTransfer?.setData("text/plain", String(idx));
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      handle.addEventListener("dragend", () => { sec.style.opacity = ""; });
      sec.addEventListener("dragover", (e) => {
        if (!dragSrc || dragSrc === sec) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        sec.style.boxShadow = "inset 0 4px 0 #047857";
      });
      sec.addEventListener("dragleave", () => { sec.style.boxShadow = ""; });
      sec.addEventListener("drop", async (e) => {
        e.preventDefault();
        sec.style.boxShadow = "";
        if (!dragSrc || dragSrc === sec) return;
        const r = sec.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) sec.before(dragSrc);
        else sec.after(dragSrc);
        dragSrc = null;
        await persistOrder(pickBlocks(doc));
      });
      sec.appendChild(handle);

      // Edit button (top-right) → opens BlockNote dialog
      const btn = doc.createElement("button");
      btn.setAttribute(ADMIN_ATTR, "edit");
      btn.type = "button";
      btn.textContent = "✏ 编辑";
      btn.style.cssText = "position:absolute;top:8px;right:8px;z-index:9999;font:600 12px/1 system-ui,sans-serif;padding:7px 11px;border:1px solid #d4d4d4;border-radius:7px;background:#fffffff2;color:#111;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.10);";
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setEditing({
          mode: "edit",
          idx,
          html: cleanAdminChrome(sec),
          title: getHeading(sec) || `版块 ${idx + 1}`,
        });
      };
      sec.appendChild(btn);
    });

    // "Add new block" bar
    const bar = doc.createElement("div");
    bar.setAttribute(ADMIN_ATTR, "add");
    bar.style.cssText = "max-width:1200px;margin:32px auto 48px;padding:0 24px;";
    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+ 添加新内容区块";
    addBtn.style.cssText = "width:100%;padding:20px;border:2px dashed rgba(4,120,87,.45);border-radius:10px;background:#fffef9;color:#065f46;font:600 16px/1 ui-serif,Georgia,serif;cursor:pointer;";
    addBtn.onclick = () => {
      const newIdx = pickBlocks(doc).length;
      setEditing({ mode: "add", idx: newIdx });
    };
    bar.appendChild(addBtn);
    doc.body.appendChild(bar);

    resize();
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
      doc.removeEventListener("load", resize, true);
      doc.removeEventListener("contextmenu", onContext);
    };
  }, [isAdmin, page, savedByOrder, loadSaved]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cleanup: (() => void) | void;
    const run = () => { cleanup?.(); cleanup = decorate(); };
    iframe.addEventListener("load", run);
    if (iframe.contentDocument?.readyState === "complete") run();
    return () => { iframe.removeEventListener("load", run); cleanup?.(); };
  }, [decorate, revision]);

  const handleSave = async (html: string) => {
    if (!editing || !page) return;
    const idx = editing.idx;
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    const heading = (wrap.querySelector("h1,h2,h3,h4")?.textContent?.trim()) || `版块 ${idx + 1}`;
    if (editing.mode === "edit") {
      const saved = savedByOrder.get(idx);
      if (saved) {
        await supabase.from("posts").update({ body: html, title: heading, updated_at: new Date().toISOString() }).eq("id", saved.id);
      } else {
        await supabase.from("posts").insert({ page: page as any, sort_order: idx, title: heading, body: html } as any);
      }
    } else {
      await supabase.from("posts").insert({ page: page as any, sort_order: idx, title: heading, body: html } as any);
    }
    await loadSaved();
    setRevision((r) => r + 1);
  };

  const handleDelete = async () => {
    if (!editing || editing.mode !== "edit" || !page) return;
    const saved = savedByOrder.get(editing.idx);
    if (saved) await supabase.from("posts").delete().eq("id", saved.id);
    await loadSaved();
    setRevision((r) => r + 1);
  };

  return (
    <SiteShell>
      <iframe ref={iframeRef} src={src} title={title} className="w-full border-0 bg-white" style={{ height }} />
      {afterFrame}
      {editing && (
        <SectionEditorDialog
          initialHtml={editing.mode === "edit" ? editing.html : ""}
          title={editing.mode === "edit" ? editing.title : `新版块 ${editing.idx + 1}`}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={editing.mode === "edit" ? handleDelete : undefined}
        />
      )}
    </SiteShell>
  );
}
