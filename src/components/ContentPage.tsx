import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { BlockView } from "./BlockEditor";
import type { Block, PartialBlock } from "@blocknote/core";
import { parseBody } from "./BlockEditor";

const BlockEditorPanel = lazy(() =>
  import("./BlockEditor").then((m) => ({ default: m.BlockEditorPanel })),
);

type PagePost = {
  id: string;
  page: string;
  title: string;
  subtitle: string | null;
  body: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

export type PageKey =
  | "species"
  | "courses"
  | "ecofarming"
  | "community"
  | "gifts"
  | "story";

export function ContentPage({ page }: { page: PageKey }) {
  const { roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");

  const [intro, setIntro] = useState<string>("");
  const [editingIntro, setEditingIntro] = useState(false);
  const [draftIntro, setDraftIntro] = useState("");
  const [posts, setPosts] = useState<PagePost[]>([]);
  const [editing, setEditing] = useState<PagePost | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [{ data: introRow }, { data: postsData }] = await Promise.all([
      (supabase as any).from("page_intros").select("intro").eq("page", page).maybeSingle(),
      supabase
        .from("posts")
        .select("*")
        .eq("page", page as any)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    setIntro((introRow as any)?.intro ?? "");
    setPosts((postsData ?? []) as unknown as PagePost[]);
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveIntro = async () => {
    await (supabase as any)
      .from("page_intros")
      .upsert({ page, intro: draftIntro, updated_at: new Date().toISOString() });
    setIntro(draftIntro);
    setEditingIntro(false);
  };

  return (
    <div className="bg-[#f8f6f1]">
      <article className="mx-auto max-w-4xl px-6 py-16">
        {/* Intro */}
        <section className="relative">
          {editingIntro ? (
            <div className="space-y-3">
              <textarea
                value={draftIntro}
                onChange={(e) => setDraftIntro(e.target.value.slice(0, 200))}
                rows={4}
                className="w-full rounded border border-neutral-300 px-3 py-2 text-base"
              />
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>{draftIntro.length}/200</span>
                <button onClick={saveIntro} className="ml-auto rounded bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800">
                  保存
                </button>
                <button onClick={() => setEditingIntro(false)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <p className="font-serif text-lg leading-relaxed text-neutral-800">{intro}</p>
          )}
          {isAdmin && !editingIntro && (
            <button
              onClick={() => {
                setDraftIntro(intro);
                setEditingIntro(true);
              }}
              className="absolute -top-2 right-0 text-xs text-emerald-700 hover:underline"
            >
              编辑简介
            </button>
          )}
        </section>

        <hr className="my-10 border-t border-neutral-300" />

        {/* Posts */}
        <div className="space-y-14">
          {posts.length === 0 && (
            <p className="text-center text-sm text-neutral-500">暂无内容。</p>
          )}
          {posts.map((p) => (
            <PostBlock key={p.id} post={p} canEdit={isAdmin} onEdit={() => setEditing(p)} />
          ))}
        </div>

        {/* Add new */}
        {isAdmin && (
          <button
            onClick={() => setCreating(true)}
            className="mt-16 block w-full rounded-lg border-2 border-dashed border-emerald-700/40 px-6 py-5 text-center font-serif text-base text-emerald-800 transition hover:border-emerald-700 hover:bg-emerald-50"
          >
            + 添加新内容
          </button>
        )}
      </article>

      {(editing || creating) && (
        <Suspense fallback={null}>
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
              void load();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function PostBlock({
  post,
  canEdit,
  onEdit,
}: {
  post: PagePost;
  canEdit: boolean;
  onEdit: () => void;
}) {
  return (
    <section className="relative">
      {post.subtitle && (
        <span className="text-xs uppercase tracking-[0.25em] text-emerald-700">
          {post.subtitle}
        </span>
      )}
      <h2 className="mt-2 font-serif text-3xl text-neutral-900">{post.title}</h2>
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.title}
          className="my-6 h-72 w-full rounded object-cover"
          loading="lazy"
        />
      )}
      <div className="prose prose-neutral max-w-none text-neutral-800">
        <BlockView body={post.body} />
      </div>
      {canEdit && (
        <button
          onClick={onEdit}
          className="absolute -top-1 right-0 rounded border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100"
        >
          编辑
        </button>
      )}
    </section>
  );
}

function PostEditorDialog({
  page,
  post,
  onClose,
  onSaved,
}: {
  page: PageKey;
  post: PagePost | null;
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
      if (post) {
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
    if (!post) return;
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
          <h3 className="font-serif text-lg text-emerald-900">{post ? "编辑内容" : "新建内容"}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-800">✕</button>
        </div>

        <div className="space-y-3 p-5">
          <input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="副标题 / 分类（可选）"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="标题"
            className="w-full rounded border border-neutral-300 px-3 py-3 font-serif text-xl"
          />
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="封面图 URL（可选）"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <div className="rounded border border-neutral-200">
            <Suspense fallback={<div className="p-6 text-sm text-neutral-500">加载编辑器…</div>}>
              <BlockEditorPanel initial={initial} onChange={setBlocks} />
            </Suspense>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3">
          <div>
            {post && (
              <button onClick={remove} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-50">
                删除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded border border-neutral-300 px-4 py-2 text-sm">取消</button>
            <button onClick={save} disabled={busy || !title.trim()} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50">
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
