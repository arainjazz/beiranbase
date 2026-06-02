import { useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseBody } from "./BlockEditor";
import type { Block, PartialBlock } from "@blocknote/core";

const BlockEditorPanel = lazy(() =>
  import("./BlockEditor").then((m) => ({ default: m.BlockEditorPanel })),
);

export type EditingPost = {
  id?: string;
  title?: string;
  subtitle?: string | null;
  image_url?: string | null;
  body?: string;
};

export function PostEditorDialog({
  page,
  post,
  onClose,
  onSaved,
}: {
  page: string;
  post: EditingPost | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [subtitle, setSubtitle] = useState(post?.subtitle ?? "");
  const [imageUrl, setImageUrl] = useState(post?.image_url ?? "");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [busy, setBusy] = useState(false);
  const initial: PartialBlock[] = parseBody(post?.body);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const payload: any = {
        page,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        image_url: imageUrl.trim() || null,
        body: JSON.stringify(blocks.length ? blocks : initial),
        updated_at: new Date().toISOString(),
      };
      if (post?.id) {
        await supabase.from("posts").update(payload).eq("id", post.id);
      } else {
        await supabase.from("posts").insert(payload);
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!post?.id) return;
    if (!confirm("确认删除这篇内容？")) return;
    setBusy(true);
    try {
      await supabase.from("posts").delete().eq("id", post.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <h3 className="font-serif text-lg text-emerald-900">{post?.id ? "编辑内容" : "新建内容"}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">✕</button>
        </div>
        <div className="space-y-3 p-5">
          <input value={subtitle ?? ""} onChange={(e) => setSubtitle(e.target.value)} placeholder="副标题 / 版块名（可选）" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" className="w-full rounded border border-neutral-300 px-3 py-3 font-serif text-xl" />
          <input value={imageUrl ?? ""} onChange={(e) => setImageUrl(e.target.value)} placeholder="封面图 URL（可选）" className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
          <div className="rounded border border-neutral-200">
            <Suspense fallback={<div className="p-6 text-sm text-neutral-500">加载编辑器…</div>}>
              <BlockEditorPanel initial={initial} onChange={setBlocks} />
            </Suspense>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
          <div>{post?.id && (<button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">删除</button>)}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded border border-neutral-300 px-4 py-2 text-sm">取消</button>
            <button onClick={save} disabled={busy || !title.trim()} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50">{busy ? "保存中…" : "保存"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
