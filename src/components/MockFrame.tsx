import { useEffect, useRef, useState, useCallback } from "react";
import { SiteShell } from "./SiteShell";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

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
  body: string;
  sort_order: number;
};

const EDITABLE_ATTR = "data-lov-block";

function pickBlocks(doc: Document): HTMLElement[] {
  const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
  // Prefer semantic sections / articles at any depth of main.
  const sections = Array.from(main.querySelectorAll(":scope > section, :scope > article")) as HTMLElement[];
  if (sections.length > 0) return sections;
  // Otherwise treat top-level children of main as modules (heading, paragraph, grids, etc.)
  return (Array.from(main.children) as HTMLElement[]).filter(
    (el) => !["SCRIPT", "STYLE", "TEMPLATE"].includes(el.tagName),
  );
}

function getHeading(el: HTMLElement) {
  return el.querySelector("h1,h2,h3,h4")?.textContent?.trim() || "";
}

/** Inline WYSIWYG editor that lives inside the iframe document. */
function startInlineEdit(opts: {
  doc: Document;
  block: HTMLElement;
  onSave: (html: string) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  showDelete?: boolean;
}) {
  const { doc, block, onSave, onCancel, onDelete, showDelete } = opts;
  const original = block.outerHTML;
  block.contentEditable = "true";
  block.style.outline = "2px dashed #047857";
  block.style.outlineOffset = "4px";
  (block.style as any).caretColor = "#047857";
  block.focus();

  const bar = doc.createElement("div");
  bar.setAttribute("data-lov-admin", "toolbar");
  bar.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:99999",
    "display:flex",
    "gap:4px",
    "flex-wrap:wrap",
    "padding:8px",
    "background:#111827",
    "border-radius:10px",
    "box-shadow:0 10px 25px rgba(0,0,0,.25)",
    "font:500 12px/1 system-ui,sans-serif",
    "max-width:96vw",
  ].join(";");

  const mkBtn = (label: string, title: string, fn: () => void, accent?: string) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.style.cssText = `padding:6px 10px;border:0;border-radius:6px;cursor:pointer;color:#fff;background:${accent || "#374151"};`;
    b.onmousedown = (e) => e.preventDefault(); // keep selection
    b.onclick = fn;
    return b;
  };

  const cmd = (c: string, v?: string) => {
    block.focus();
    doc.execCommand(c, false, v);
  };

  bar.appendChild(mkBtn("B", "粗体", () => cmd("bold")));
  bar.appendChild(mkBtn("I", "斜体", () => cmd("italic")));
  bar.appendChild(mkBtn("U", "下划线", () => cmd("underline")));
  bar.appendChild(mkBtn("H2", "标题 2", () => cmd("formatBlock", "H2")));
  bar.appendChild(mkBtn("H3", "标题 3", () => cmd("formatBlock", "H3")));
  bar.appendChild(mkBtn("¶", "段落", () => cmd("formatBlock", "P")));
  bar.appendChild(mkBtn("• 列表", "无序列表", () => cmd("insertUnorderedList")));
  bar.appendChild(mkBtn("1. 列表", "有序列表", () => cmd("insertOrderedList")));
  bar.appendChild(
    mkBtn("🔗 链接", "插入链接", () => {
      const url = window.prompt("链接 URL", "https://");
      if (url) cmd("createLink", url);
    }),
  );
  bar.appendChild(
    mkBtn("🖼 图片", "插入图片 URL", () => {
      const url = window.prompt("图片 URL", "https://");
      if (url) cmd("insertImage", url);
    }),
  );
  bar.appendChild(mkBtn("清除格式", "清除", () => cmd("removeFormat")));

  const finish = () => {
    bar.remove();
    block.contentEditable = "false";
    block.style.outline = "";
    block.style.outlineOffset = "";
  };

  bar.appendChild(
    mkBtn(
      "保存",
      "保存",
      async () => {
        const html = block.outerHTML;
        finish();
        await onSave(html);
      },
      "#059669",
    ),
  );
  bar.appendChild(
    mkBtn(
      "取消",
      "取消",
      () => {
        finish();
        // Restore original HTML
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = original;
        const restored = wrapper.firstElementChild as HTMLElement | null;
        if (restored) block.replaceWith(restored);
        onCancel();
      },
      "#6b7280",
    ),
  );
  if (showDelete) {
    bar.appendChild(
      mkBtn(
        "删除",
        "删除该版块",
        async () => {
          if (!window.confirm("确定要删除该版块吗？")) return;
          finish();
          block.remove();
          await onDelete?.();
        },
        "#b91c1c",
      ),
    );
  }

  doc.body.appendChild(bar);
}

export function MockFrame({ src, title, page }: Props) {
  const { roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(1200);
  const [savedById, setSavedById] = useState<Map<number, SavedPost>>(new Map());
  const [revision, setRevision] = useState(0);

  const loadSaved = useCallback(async () => {
    if (!page) return new Map<number, SavedPost>();
    const { data } = await supabase
      .from("posts")
      .select("id,page,title,body,sort_order")
      .eq("page", page as any)
      .order("sort_order", { ascending: true });
    const map = new Map<number, SavedPost>();
    (data ?? []).forEach((p: any) => map.set(p.sort_order, p as SavedPost));
    setSavedById(map);
    return map;
  }, [page]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const decorate = useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc?.body) return;

    // Auto-resize (throttled via rAF to avoid ResizeObserver loop warnings)
    let raf = 0;
    const resize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
        if (h) setHeight((prev) => (Math.abs(h - prev) > 4 ? h : prev));
      });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(doc.body);

    // Clean previously injected admin chrome
    doc.querySelectorAll("[data-lov-admin]").forEach((el) => el.remove());

    // Apply saved overrides FIRST, before measuring blocks
    let blocks = pickBlocks(doc);
    if (savedById.size > 0) {
      blocks.forEach((el, idx) => {
        const saved = savedById.get(idx);
        if (!saved) return;
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = saved.body;
        const replacement = wrapper.firstElementChild as HTMLElement | null;
        if (replacement) {
          el.replaceWith(replacement);
          blocks[idx] = replacement;
        }
      });
      // Append blocks beyond the original count (newly added by admin)
      const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
      const sortedExtras = Array.from(savedById.entries())
        .filter(([k]) => k >= blocks.length)
        .sort((a, b) => a[0] - b[0]);
      sortedExtras.forEach(([, saved]) => {
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = saved.body;
        const el = wrapper.firstElementChild as HTMLElement | null;
        if (el) {
          main.appendChild(el);
          blocks.push(el);
        }
      });
    }

    if (!isAdmin || !page) {
      resize();
      return () => ro.disconnect();
    }

    // Tag and decorate each editable block with a pill
    blocks.forEach((sec, idx) => {
      sec.setAttribute(EDITABLE_ATTR, String(idx));
      if (getComputedStyle(sec).position === "static") sec.style.position = "relative";

      const btn = doc.createElement("button");
      btn.setAttribute("data-lov-admin", "edit");
      btn.type = "button";
      btn.textContent = "✏ 编辑";
      btn.style.cssText =
        "position:absolute;top:8px;right:8px;z-index:40;font:500 12px/1 system-ui,sans-serif;padding:6px 10px;border:1px solid #d4d4d4;border-radius:6px;background:#ffffffee;color:#111;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.08);";
      btn.onclick = (e) => {
        e.preventDefault();
        startInlineEdit({
          doc,
          block: sec,
          showDelete: true,
          onSave: async (html) => {
            const saved = savedById.get(idx);
            const heading = getHeading(sec) || `版块 ${idx + 1}`;
            if (saved) {
              await supabase.from("posts").update({ body: html, title: heading }).eq("id", saved.id);
            } else {
              await supabase.from("posts").insert({
                page: page as any,
                sort_order: idx,
                title: heading,
                body: html,
              } as any);
            }
            await loadSaved();
            setRevision((r) => r + 1);
          },
          onCancel: () => setRevision((r) => r + 1),
          onDelete: async () => {
            const saved = savedById.get(idx);
            if (saved) await supabase.from("posts").delete().eq("id", saved.id);
            await loadSaved();
            setRevision((r) => r + 1);
          },
        });
      };
      sec.appendChild(btn);
    });

    // Bottom "+ 添加新内容" bar
    const bar = doc.createElement("div");
    bar.setAttribute("data-lov-admin", "add");
    bar.style.cssText = "max-width:1200px;margin:32px auto 48px;padding:0 24px;";
    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+ 添加新内容";
    addBtn.style.cssText =
      "width:100%;padding:18px;border:2px dashed rgba(4,120,87,.45);border-radius:10px;background:transparent;color:#065f46;font:500 16px/1 ui-serif,Georgia,serif;cursor:pointer;";
    addBtn.onclick = () => {
      const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
      const newIdx = blocks.length;
      const sec = doc.createElement("section");
      sec.style.cssText = "position:relative;max-width:960px;margin:48px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;";
      sec.innerHTML =
        "<h2 style=\"font:600 28px/1.3 ui-serif,Georgia,serif;margin:0 0 12px;color:#065f46;\">新版块标题</h2><p style=\"font:400 16px/1.7 system-ui,sans-serif;color:#374151;margin:0;\">在此输入正文内容…</p>";
      main.appendChild(sec);
      bar.scrollIntoView({ behavior: "smooth", block: "start" });
      startInlineEdit({
        doc,
        block: sec,
        showDelete: true,
        onSave: async (html) => {
          const heading = getHeading(sec) || `版块 ${newIdx + 1}`;
          await supabase.from("posts").insert({
            page: page as any,
            sort_order: newIdx,
            title: heading,
            body: html,
          } as any);
          await loadSaved();
          setRevision((r) => r + 1);
        },
        onCancel: () => {
          sec.remove();
        },
        onDelete: async () => {
          sec.remove();
        },
      });
    };
    bar.appendChild(addBtn);
    doc.body.appendChild(bar);

    resize();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isAdmin, page, savedById, loadSaved]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    let cleanup: (() => void) | void;
    const run = () => {
      cleanup?.();
      cleanup = decorate();
    };
    iframe.addEventListener("load", run);
    if (iframe.contentDocument?.readyState === "complete") run();
    return () => {
      iframe.removeEventListener("load", run);
      cleanup?.();
    };
  }, [decorate, revision]);

  return (
    <SiteShell>
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="w-full border-0 bg-white"
        style={{ height }}
      />
    </SiteShell>
  );
}
