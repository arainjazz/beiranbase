import { useCallback, useEffect, useRef, useState } from "react";
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
const ADMIN_ATTR = "data-lov-admin";

function pickBlocks(doc: Document): HTMLElement[] {
  const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
  const semantic = Array.from(main.querySelectorAll("section, article")) as HTMLElement[];
  if (semantic.length > 0) {
    const leaves = semantic.filter((el) => !el.querySelector("section, article"));
    return leaves.length > 0 ? leaves : semantic;
  }

  const children = Array.from(main.children) as HTMLElement[];
  const grid = children.find((el) => el.matches(".grid") || el.className.includes("grid"));
  if (grid) return Array.from(grid.children) as HTMLElement[];

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

function firstEditableChild(block: HTMLElement) {
  return (Array.from(block.children) as HTMLElement[]).find((el) => !el.hasAttribute(ADMIN_ATTR)) ?? block;
}

function childForTarget(block: HTMLElement, target: EventTarget | null) {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node.parentElement !== block) {
    if (node === block) return firstEditableChild(block);
    node = node.parentElement;
  }
  return node ?? firstEditableChild(block);
}

function cleanAdminChrome(el: HTMLElement) {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${ADMIN_ATTR}], [contenteditable]`).forEach((node) => {
    if ((node as HTMLElement).hasAttribute(ADMIN_ATTR)) node.remove();
    else (node as HTMLElement).removeAttribute("contenteditable");
  });
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("draggable");
  clone.querySelectorAll("[draggable]").forEach((node) => node.removeAttribute("draggable"));
  clone.style.outline = "";
  clone.style.outlineOffset = "";
  clone.style.caretColor = "";
  clone.style.cursor = "";
  clone.style.userSelect = "";
  clone.classList.remove("lov-editing");
  clone.querySelectorAll(".lov-selected-node").forEach((node) => node.classList.remove("lov-selected-node"));
  return clone.outerHTML;
}

function startVisualEdit(opts: {
  doc: Document;
  block: HTMLElement;
  onSave: (html: string) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;
  onMove?: (direction: -1 | 1) => Promise<void> | void;
  showDelete?: boolean;
}) {
  const { doc, block, onSave, onCancel, onDelete, onMove, showDelete } = opts;
  const win = doc.defaultView;
  const original = block.outerHTML;
  let selectedNode: HTMLElement = firstEditableChild(block);
  let selectedImage: HTMLImageElement | null = null;
  let dragging: HTMLElement | null = null;
  let saving = false;

  doc.querySelectorAll(`[${ADMIN_ATTR}="toolbar"], [${ADMIN_ATTR}="nodebar"]`).forEach((el) => el.remove());
  block.querySelectorAll(`[${ADMIN_ATTR}]`).forEach((el) => el.remove());
  block.contentEditable = "true";
  block.classList.add("lov-editing");
  block.style.outline = "2px dashed #047857";
  block.style.outlineOffset = "6px";
  block.style.caretColor = "#111827";
  block.style.cursor = "text";
  block.style.userSelect = "text";
  block.focus();

  const style = doc.createElement("style");
  style.setAttribute(ADMIN_ATTR, "toolbar");
  style.textContent = `
    .lov-editing, .lov-editing * { caret-color:#111827 !important; }
    .lov-editing ::selection { background:rgba(4,120,87,.22); }
    .lov-selected-node { outline:2px solid rgba(4,120,87,.55) !important; outline-offset:4px !important; }
    .lov-editing img { cursor:context-menu; }
  `;
  doc.head.appendChild(style);

  const fileInput = doc.createElement("input");
  fileInput.setAttribute(ADMIN_ATTR, "toolbar");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  doc.body.appendChild(fileInput);

  const selectNode = (node: HTMLElement | null) => {
    block.querySelectorAll(".lov-selected-node").forEach((el) => el.classList.remove("lov-selected-node"));
    selectedNode = node ?? firstEditableChild(block);
    selectedImage = selectedNode instanceof HTMLImageElement ? selectedNode : selectedNode.querySelector("img");
    selectedNode.classList.add("lov-selected-node");
    moveNodebar();
  };

  const insertAfterSelected = (el: HTMLElement) => {
    selectedNode.after(el);
    selectNode(el);
    el.focus();
  };

  const insertImageFromFile = async (file: File) => {
    const dataUrl = await readImageAsDataUrl(file);
    if (selectedImage) {
      selectedImage.src = dataUrl;
      selectedImage.removeAttribute("srcset");
      selectedImage.alt = selectedImage.alt || file.name.replace(/\.[^.]+$/, "");
      selectNode(selectedImage);
      return;
    }
    const img = doc.createElement("img");
    img.src = dataUrl;
    img.alt = file.name.replace(/\.[^.]+$/, "");
    img.style.cssText = "max-width:100%;height:auto;display:block;margin:24px 0;border-radius:8px;";
    insertAfterSelected(img);
  };

  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (file) void insertImageFromFile(file);
    fileInput.value = "";
  };

  const toolbar = doc.createElement("div");
  toolbar.setAttribute(ADMIN_ATTR, "toolbar");
  toolbar.style.cssText = [
    "position:fixed",
    "top:12px",
    "left:50%",
    "transform:translateX(-50%)",
    "z-index:99999",
    "display:flex",
    "gap:5px",
    "flex-wrap:wrap",
    "align-items:center",
    "padding:8px",
    "background:#111827",
    "border-radius:10px",
    "box-shadow:0 10px 25px rgba(0,0,0,.25)",
    "font:500 12px/1 system-ui,sans-serif",
    "max-width:96vw",
  ].join(";");

  const nodebar = doc.createElement("div");
  nodebar.setAttribute(ADMIN_ATTR, "nodebar");
  nodebar.style.cssText = [
    "position:absolute",
    "z-index:99998",
    "display:flex",
    "gap:4px",
    "padding:5px",
    "background:#ffffff",
    "border:1px solid #d1d5db",
    "border-radius:8px",
    "box-shadow:0 8px 20px rgba(0,0,0,.16)",
    "font:500 12px/1 system-ui,sans-serif",
  ].join(";");

  function moveNodebar() {
    if (!win || !selectedNode.isConnected) return;
    const rect = selectedNode.getBoundingClientRect();
    nodebar.style.left = `${Math.max(8, rect.left + win.scrollX)}px`;
    nodebar.style.top = `${Math.max(8, rect.top + win.scrollY - 38)}px`;
  }

  const mkBtn = (label: string, title: string, fn: () => void, accent?: string) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.style.cssText = `padding:7px 10px;border:0;border-radius:7px;cursor:pointer;color:#fff;background:${accent || "#374151"};white-space:nowrap;`;
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    return b;
  };

  const mkNodeBtn = (label: string, title: string, fn: () => void) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.style.cssText = "padding:6px 8px;border:0;border-radius:6px;background:#f3f4f6;color:#111827;cursor:pointer;white-space:nowrap;";
    b.onmousedown = (e) => e.preventDefault();
    b.onclick = fn;
    return b;
  };

  const cmd = (command: string, value?: string) => {
    block.focus();
    doc.execCommand(command, false, value);
  };

  const makeParagraph = () => {
    const p = doc.createElement("p");
    p.textContent = "输入新的正文内容…";
    p.style.cssText = "margin:16px 0;line-height:1.75;";
    insertAfterSelected(p);
  };

  const makeHeading = () => {
    const h = doc.createElement("h2");
    h.textContent = "新的小标题";
    h.style.cssText = "margin:24px 0 12px;font-size:28px;line-height:1.25;";
    insertAfterSelected(h);
  };

  const makeCard = () => {
    const card = doc.createElement("div");
    card.style.cssText = "margin:20px 0;padding:22px;border:1px solid #d1d5db;border-radius:10px;background:#fff;";
    card.innerHTML = "<h3 style=\"margin:0 0 10px;font-size:22px;line-height:1.35;\">新内容卡片</h3><p style=\"margin:0;line-height:1.7;\">在这里输入卡片正文…</p>";
    insertAfterSelected(card);
  };

  const moveSelected = (direction: -1 | 1) => {
    if (selectedNode === block) return;
    const sibling = direction < 0 ? selectedNode.previousElementSibling : selectedNode.nextElementSibling;
    if (!sibling || (sibling as HTMLElement).hasAttribute(ADMIN_ATTR)) return;
    if (direction < 0) sibling.before(selectedNode);
    else sibling.after(selectedNode);
    selectNode(selectedNode);
  };

  const finish = () => {
    toolbar.remove();
    nodebar.remove();
    style.remove();
    fileInput.remove();
    block.contentEditable = "false";
    block.classList.remove("lov-editing");
    block.querySelectorAll(".lov-selected-node").forEach((el) => el.classList.remove("lov-selected-node"));
    block.style.outline = "";
    block.style.outlineOffset = "";
    block.style.caretColor = "";
    block.style.cursor = "";
    block.style.userSelect = "";
    block.querySelectorAll("[draggable]").forEach((node) => node.removeAttribute("draggable"));
  };

  toolbar.appendChild(mkBtn("B", "粗体", () => cmd("bold")));
  toolbar.appendChild(mkBtn("I", "斜体", () => cmd("italic")));
  toolbar.appendChild(mkBtn("U", "下划线", () => cmd("underline")));
  toolbar.appendChild(mkBtn("H2", "标题 2", () => cmd("formatBlock", "H2")));
  toolbar.appendChild(mkBtn("H3", "标题 3", () => cmd("formatBlock", "H3")));
  toolbar.appendChild(mkBtn("正文", "段落", () => cmd("formatBlock", "P")));
  toolbar.appendChild(mkBtn("• 列表", "无序列表", () => cmd("insertUnorderedList")));
  toolbar.appendChild(mkBtn("1. 列表", "有序列表", () => cmd("insertOrderedList")));
  toolbar.appendChild(mkBtn("+ 标题", "新增标题块", makeHeading));
  toolbar.appendChild(mkBtn("+ 正文", "新增正文块", makeParagraph));
  toolbar.appendChild(mkBtn("+ 卡片", "新增卡片块", makeCard));
  toolbar.appendChild(mkBtn("🖼 图片", "从本地选择图片", () => fileInput.click()));
  toolbar.appendChild(
    mkBtn("🔗 链接", "给选中文字添加链接", () => {
      const url = win?.prompt("链接 URL", "https://");
      if (url) cmd("createLink", url);
    }),
  );
  toolbar.appendChild(mkBtn("↑ 区块", "整个版块上移", () => void onMove?.(-1)));
  toolbar.appendChild(mkBtn("↓ 区块", "整个版块下移", () => void onMove?.(1)));
  toolbar.appendChild(mkBtn("清格式", "清除选区格式", () => cmd("removeFormat")));
  toolbar.appendChild(
    mkBtn(
      "保存",
      "保存并退出编辑",
      () => {
        if (saving) return;
        saving = true;
        const html = cleanAdminChrome(block);
        finish();
        void Promise.resolve(onSave(html)).finally(() => {
          saving = false;
        });
      },
      "#059669",
    ),
  );
  toolbar.appendChild(
    mkBtn(
      "取消",
      "放弃本次修改",
      () => {
        finish();
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
    toolbar.appendChild(
      mkBtn(
        "删除版块",
        "删除整个版块",
        () => {
          if (!win?.confirm("确定要删除该版块吗？")) return;
          finish();
          block.remove();
          void onDelete?.();
        },
        "#b91c1c",
      ),
    );
  }

  nodebar.appendChild(mkNodeBtn("+ 正文", "在当前内容后新增正文", makeParagraph));
  nodebar.appendChild(mkNodeBtn("+ 图", "在当前内容后新增图片", () => fileInput.click()));
  nodebar.appendChild(mkNodeBtn("↑", "当前内容上移", () => moveSelected(-1)));
  nodebar.appendChild(mkNodeBtn("↓", "当前内容下移", () => moveSelected(1)));
  nodebar.appendChild(
    mkNodeBtn("删", "删除当前内容", () => {
      const next = (selectedNode.nextElementSibling || selectedNode.previousElementSibling) as HTMLElement | null;
      if (selectedNode !== block) selectedNode.remove();
      selectNode(next ?? firstEditableChild(block));
    }),
  );

  doc.body.appendChild(toolbar);
  doc.body.appendChild(nodebar);

  (Array.from(block.children) as HTMLElement[]).forEach((child) => {
    child.draggable = true;
    child.addEventListener("dragstart", () => {
      dragging = child;
      selectNode(child);
    });
    child.addEventListener("dragover", (event) => event.preventDefault());
    child.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!dragging || dragging === child) return;
      const rect = child.getBoundingClientRect();
      if (event.clientY < rect.top + rect.height / 2) child.before(dragging);
      else child.after(dragging);
      selectNode(dragging);
      dragging = null;
    });
  });

  block.addEventListener("click", (event) => selectNode(childForTarget(block, event.target)));
  block.addEventListener("keyup", moveNodebar);
  block.addEventListener("mouseup", moveNodebar);
  block.addEventListener("contextmenu", (event) => {
    const img = event.target instanceof HTMLElement ? event.target.closest("img") : null;
    if (!img) return;
    event.preventDefault();
    selectNode(img as HTMLImageElement);
    selectedImage = img as HTMLImageElement;
    fileInput.click();
  });
  win?.addEventListener("scroll", moveNodebar, { passive: true });
  selectNode(firstEditableChild(block));
}

export function MockFrame({ src, title, page }: Props) {
  const { roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState<number>(1200);
  const [savedByOrder, setSavedByOrder] = useState<Map<number, SavedPost>>(new Map());
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
    setSavedByOrder(map);
    return map;
  }, [page]);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

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

    let blocks = pickBlocks(doc);
    if (savedByOrder.size > 0) {
      blocks.forEach((el, idx) => {
        const saved = savedByOrder.get(idx);
        if (!saved) return;
        const wrapper = doc.createElement("div");
        wrapper.innerHTML = saved.body;
        const replacement = wrapper.firstElementChild as HTMLElement | null;
        if (replacement) {
          el.replaceWith(replacement);
          blocks[idx] = replacement;
        }
      });
      const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
      Array.from(savedByOrder.entries())
        .filter(([order]) => order >= blocks.length)
        .sort((a, b) => a[0] - b[0])
        .forEach(([, saved]) => {
          const wrapper = doc.createElement("div");
          wrapper.innerHTML = saved.body;
          const el = wrapper.firstElementChild as HTMLElement | null;
          if (el) {
            main.appendChild(el);
            blocks.push(el);
          }
        });
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(doc.body);

    if (!isAdmin || !page) {
      return () => {
        ro.disconnect();
        cancelAnimationFrame(raf);
      };
    }

    const persistOrder = async (currentBlocks: HTMLElement[]) => {
      const updates = currentBlocks.map((el, order) => {
        const id = savedByOrder.get(Number(el.getAttribute(EDITABLE_ATTR)))?.id;
        return id
          ? supabase.from("posts").update({ sort_order: order }).eq("id", id)
          : Promise.resolve({ error: null });
      });
      await Promise.all(updates);
      await loadSaved();
      setRevision((r) => r + 1);
    };

    blocks.forEach((sec, idx) => {
      sec.setAttribute(EDITABLE_ATTR, String(idx));
      if (doc.defaultView?.getComputedStyle(sec).position === "static") sec.style.position = "relative";

      const btn = doc.createElement("button");
      btn.setAttribute(ADMIN_ATTR, "edit");
      btn.type = "button";
      btn.textContent = "✏ 编辑";
      btn.style.cssText =
        "position:absolute;top:8px;right:8px;z-index:40;font:600 12px/1 system-ui,sans-serif;padding:7px 11px;border:1px solid #d4d4d4;border-radius:7px;background:#fffffff2;color:#111;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.10);";
      btn.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        startVisualEdit({
          doc,
          block: sec,
          showDelete: true,
          onMove: async (direction) => {
            const liveBlocks = pickBlocks(doc);
            const currentIndex = liveBlocks.indexOf(sec);
            const target = liveBlocks[currentIndex + direction];
            if (!target) return;
            if (direction < 0) target.before(sec);
            else target.after(sec);
            await persistOrder(pickBlocks(doc));
          },
          onSave: async (html) => {
            const saved = savedByOrder.get(idx);
            const heading = getHeading(sec) || `版块 ${idx + 1}`;
            if (saved) {
              await supabase.from("posts").update({ body: html, title: heading, updated_at: new Date().toISOString() }).eq("id", saved.id);
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
            const saved = savedByOrder.get(idx);
            if (saved) await supabase.from("posts").delete().eq("id", saved.id);
            await loadSaved();
            setRevision((r) => r + 1);
          },
        });
      };
      sec.appendChild(btn);
    });

    const bar = doc.createElement("div");
    bar.setAttribute(ADMIN_ATTR, "add");
    bar.style.cssText = "max-width:1200px;margin:32px auto 48px;padding:0 24px;";
    const addBtn = doc.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "+ 添加新内容区块";
    addBtn.style.cssText =
      "width:100%;padding:20px;border:2px dashed rgba(4,120,87,.45);border-radius:10px;background:#fffef9;color:#065f46;font:600 16px/1 ui-serif,Georgia,serif;cursor:pointer;";
    addBtn.onclick = () => {
      const main = (doc.querySelector("main") ?? doc.body) as HTMLElement;
      const newIdx = pickBlocks(doc).length;
      const sec = doc.createElement("section");
      sec.style.cssText = "position:relative;max-width:960px;margin:48px auto;padding:32px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;";
      sec.innerHTML =
        "<h2 style=\"font:600 28px/1.3 ui-serif,Georgia,serif;margin:0 0 12px;color:#065f46;\">新版块标题</h2><p style=\"font:400 16px/1.7 system-ui,sans-serif;color:#374151;margin:0;\">在此输入正文内容，可继续添加标题、图片、卡片或列表。</p>";
      main.appendChild(sec);
      sec.scrollIntoView({ behavior: "smooth", block: "center" });
      startVisualEdit({
        doc,
        block: sec,
        showDelete: true,
        onMove: async (direction) => {
          const liveBlocks = pickBlocks(doc);
          const currentIndex = liveBlocks.indexOf(sec);
          const target = liveBlocks[currentIndex + direction];
          if (!target) return;
          if (direction < 0) target.before(sec);
          else target.after(sec);
          await persistOrder(pickBlocks(doc));
        },
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
        onCancel: () => sec.remove(),
        onDelete: async () => sec.remove(),
      });
    };
    bar.appendChild(addBtn);
    doc.body.appendChild(bar);

    resize();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [isAdmin, page, savedByOrder, loadSaved]);

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