import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

/**
 * Notion-style section editor.
 * Takes the section's current HTML, parses it into BlockNote blocks,
 * lets the user edit visually, then returns a clean HTML string on save.
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
  const editor = useCreateBlockNote();
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

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const html = await editor.blocksToHTMLLossy(editor.document);
      // Wrap in a section so it slots into the page nicely
      const wrapped = `<section class="lov-saved-section" style="max-width:980px;margin:48px auto;padding:32px 28px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;line-height:1.75;">${html}</section>`;
      await onSave(wrapped);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!confirm("确定要删除该版块吗？此操作不可撤销。")) return;
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
          <div className="font-serif text-lg text-emerald-900">编辑版块：{title}</div>
          <div className="flex gap-2">
            {onDelete && (
              <button
                onClick={remove}
                disabled={busy}
                className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                删除版块
              </button>
            )}
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={save}
              disabled={busy || !ready}
              className="rounded bg-emerald-700 px-4 py-1.5 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-[#fafaf7] py-6">
          {ready ? (
            <BlockNoteView editor={editor} editable theme="light" />
          ) : (
            <div className="p-10 text-center text-sm text-neutral-500">加载编辑器…</div>
          )}
        </div>
        <div className="border-t border-neutral-200 bg-neutral-50 px-5 py-2 text-xs text-neutral-500">
          提示：输入「/」可插入标题、图片、列表、引用等模块；图片可直接拖入或点击 + 添加；模块左侧拖动手柄可调整顺序。
        </div>
      </div>
    </div>
  );
}
