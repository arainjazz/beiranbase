import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { locales } from "@blocknote/core";

/**
 * Build a bilingual dictionary by deep-merging zh + en.
 * String fields become "中文 / English".
 * Array fields (aliases) are concatenated and de-duplicated.
 */
function buildBilingualDict(): any {
  const zh: any = (locales as any).zh;
  const en: any = (locales as any).en;
  const merge = (z: any, e: any): any => {
    if (typeof z === "string" && typeof e === "string") {
      if (z === e) return z;
      return `${z} / ${e}`;
    }
    if (Array.isArray(z) && Array.isArray(e)) {
      return Array.from(new Set([...z, ...e]));
    }
    if (z && typeof z === "object" && e && typeof e === "object") {
      const out: any = {};
      const keys = new Set([...Object.keys(z), ...Object.keys(e)]);
      keys.forEach((k) => {
        out[k] = merge(z[k], e[k]);
      });
      return out;
    }
    return z ?? e;
  };
  return merge(zh, en);
}

/** Convert a File or Blob into a data: URL we can embed directly in HTML. */
async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Notion-style section editor (bilingual UI + local upload + paste + URL).
 */
export function SectionEditorDialog({
  initialHtml,
  title,
  onClose,
  onSave,
  onDelete,
}: {
  initialHtml: string;
  title: string;
  onClose: () => void;
  onSave: (html: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const dict = useMemo(() => buildBilingualDict(), []);
  const editor = useCreateBlockNote({
    dictionary: dict,
    // Enables local file upload + paste/drag-and-drop in the image block.
    uploadFile: async (file: File) => {
      // Inline as base64 data URL — works for URL, local upload, and clipboard paste.
      return await fileToDataUrl(file);
    },
  });
  const initialized = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      try {
        const blocks = await editor.tryParseHTMLToBlocks(initialHtml || "<p></p>");
        editor.replaceBlocks(editor.document, blocks.length ? blocks : [{ type: "paragraph" } as any]);
      } catch {
        // fall back to empty
      } finally {
        setReady(true);
      }
    })();
  }, [editor, initialHtml]);

  // Global clipboard paste fallback: if the user pastes an image anywhere
  // inside the editor area, insert an image block at the current cursor.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (!file) continue;
          e.preventDefault();
          const url = await fileToDataUrl(file);
          try {
            const cursor = editor.getTextCursorPosition();
            editor.insertBlocks(
              [{ type: "image", props: { url } } as any],
              cursor.block,
              "after",
            );
          } catch {
            // ignore
          }
          return;
        }
      }
    };
    el.addEventListener("paste", onPaste as any);
    return () => el.removeEventListener("paste", onPaste as any);
  }, [editor]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html = await editor.blocksToHTMLLossy(editor.document);
      const wrapped = `<section class="lov-saved-section" style="max-width:980px;margin:48px auto;padding:32px 28px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;line-height:1.75;">${html}</section>`;
      await onSave(wrapped);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!confirm("确定要删除该版块吗？此操作不可撤销。/ Delete this section? This cannot be undone.")) return;
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black/50" onClick={onClose}>
      <div
        className="m-auto flex h-[92vh] w-[min(960px,96vw)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div className="font-serif text-lg text-emerald-900">
            编辑版块 / Edit Section：{title}
          </div>
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={remove}
                disabled={busy}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                删除版块 / Delete
              </button>
            )}
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              取消 / Cancel
            </button>
            <button
              onClick={save}
              disabled={busy || !ready}
              className="rounded bg-emerald-700 px-4 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? "保存中… / Saving…" : "保存 / Save"}
            </button>
          </div>
        </div>
        <div ref={wrapRef} className="flex-1 overflow-auto bg-[#fafaf7] py-6">
          {ready ? (
            <BlockNoteView editor={editor} editable theme="light" />
          ) : (
            <div className="p-10 text-center text-sm text-neutral-500">
              加载编辑器… / Loading editor…
            </div>
          )}
        </div>
        <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-2 text-xs text-neutral-500">
          提示 / Tip：输入「/」插入模块；图片可粘贴 (Ctrl/⌘+V)、拖拽本地文件、或填写 URL。
          Type "/" to insert blocks; images support clipboard paste, local file upload, and URL.
        </div>
      </div>
    </div>
  );
}
