import { useEffect, useRef, useState, useCallback } from "react";
import { SiteShell } from "./SiteShell";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";
import { PostEditorDialog, type EditingPost } from "./PostEditorDialog";

export type MockPageKey =
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
}

type SavedPost = {
  id: string;
  page: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  body: string;
  sort_order: number;
};

/**
 * Renders a mock HTML page in an iframe (same-origin, served from /public/mock).
 * Auto-resizes to content height. For owner/admin, injects a small "编辑" pill
 * into the top-right of each <section> and appends a "+ 添加新内容" button.
 */
export function MockFrame({ src, title, page }: Props) {
  const { roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(1200);
  const [editing, setEditing] = useState<EditingPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [savedById, setSavedById] = useState<Map<number, SavedPost>>(new Map());

  // Load any admin-saved overrides for this page so the "编辑" pill can
  // re-open the post that maps to a section index.
  const loadSaved = useCallback(async () => {
    if (!page) return;
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("page", page as any)
      .order("sort_order", { ascending: true });
    const map = new Map<number, SavedPost>();
    (data ?? []).forEach((p: any) => map.set(p.sort_order, p as SavedPost));
    setSavedById(map);
  }, [page]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const decorate = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;

    // Auto-resize
    const resize = () => {
      const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      if (h && Math.abs(h - height) > 4) setHeight(h);
    };
    resize();
    // Observe future size changes (image loads, fonts, etc.)
    const ro = new ResizeObserver(resize);
    ro.observe(doc.body);

    if (!isAdmin || !page) return () => ro.disconnect();

    // Remove any prior injected controls
    doc.querySelectorAll("[data-lov-admin]").forEach((el) => el.remove());

    const sections = Array.from(doc.querySelectorAll("section"));
    sections.forEach((sec, idx) => {
      const s = sec as HTMLElement;
      if (getComputedStyle(s).position === "static") s.style.position = "relative";
      const btn = doc.createElement("button");
      btn.setAttribute("data-lov-admin", "edit");
      btn.textContent = "✏ 编辑";
      btn.style.cssText =
        "position:absolute;top:12px;right:12px;z-index:50;font:500 12px/1 system-ui,sans-serif;padding:6px 10px;border:1px solid #d4d4d4;border-radius:6px;background:#ffffffee;color:#111;cursor:pointer;backdrop-filter:blur(4px);box-shadow:0 1px 3px rgba(0,0,0,.08);";
      btn.onclick = (e) => {
        e.preventDefault();
        const existing = savedById.get(idx);
        // Try to pull a sensible default title from the section heading
        const heading = s.querySelector("h1,h2,h3")?.textContent?.trim() ?? `版块 ${idx + 1}`;
        setEditing(
          existing
            ? {
                id: existing.id,
                title: existing.title,
                subtitle: existing.subtitle,
                image_url: existing.image_url,
                body: existing.body,
              }
            : {
                title: heading,
                subtitle: `版块 ${idx + 1}`,
                body: "",
              },
        );
      };
      s.appendChild(btn);
    });

    // Bottom "+ 添加新内容" bar inside iframe doc
    const bar = doc.createElement("div");
    bar.setAttribute("data-lov-admin", "add");
    bar.style.cssText =
      "max-width:1200px;margin:32px auto 48px;padding:0 24px;";
    const addBtn = doc.createElement("button");
    addBtn.textContent = "+ 添加新内容";
    addBtn.style.cssText =
      "width:100%;padding:18px;border:2px dashed rgba(4,120,87,.45);border-radius:10px;background:transparent;color:#065f46;font:500 16px/1 ui-serif,Georgia,serif;cursor:pointer;";
    addBtn.onmouseenter = () => {
      addBtn.style.background = "rgba(4,120,87,.06)";
      addBtn.style.borderColor = "#047857";
    };
    addBtn.onmouseleave = () => {
      addBtn.style.background = "transparent";
      addBtn.style.borderColor = "rgba(4,120,87,.45)";
    };
    addBtn.onclick = () => setCreating(true);
    bar.appendChild(addBtn);
    doc.body.appendChild(bar);

    resize();
    return () => ro.disconnect();
  }, [isAdmin, page, savedById, height]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => decorate();
    iframe.addEventListener("load", onLoad);
    // If already loaded
    if (iframe.contentDocument?.readyState === "complete") decorate();
    return () => iframe.removeEventListener("load", onLoad);
  }, [decorate]);

  return (
    <SiteShell>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="w-full border-0 bg-white"
        style={{ height }}
      />
      {(editing || creating) && page && (
        <PostEditorDialog
          page={page}
          post={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            void loadSaved();
          }}
        />
      )}
    </SiteShell>
  );
}
