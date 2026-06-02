import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

type FeedbackMsg = {
  id: string;
  name: string | null;
  email: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
};

export function Footer() {
  const { user, roles } = useSession();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<FeedbackMsg[]>([]);
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const loadUnread = useCallback(async () => {
    if (!isAdmin) return;
    const { count } = await (supabase as any)
      .from("feedback_messages")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    setUnread(count ?? 0);
  }, [isAdmin]);

  const loadMessages = useCallback(async () => {
    if (!isAdmin) return;
    const { data } = await (supabase as any)
      .from("feedback_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setMessages((data ?? []) as FeedbackMsg[]);
  }, [isAdmin]);

  useEffect(() => {
    void loadUnread();
    if (!isAdmin) return;
    const ch = supabase
      .channel("feedback_unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        () => void loadUnread(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [isAdmin, loadUnread]);

  const handleOpen = async () => {
    setSent(false);
    setOpen(true);
    if (isAdmin) await loadMessages();
  };

  const markRead = async (id: string) => {
    await (supabase as any).from("feedback_messages").update({ is_read: true }).eq("id", id);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: true } : m)));
    void loadUnread();
  };

  const deleteMsg = async (id: string) => {
    await (supabase as any).from("feedback_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
    void loadUnread();
  };

  const sendMessage = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await (supabase as any).from("feedback_messages").insert({
        body: body.trim(),
        name: name.trim() || null,
        email: email.trim() || null,
        user_id: user?.id ?? null,
      });
      setBody("");
      setName("");
      setEmail("");
      setSent(true);
      void loadUnread();
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <footer className="border-t border-neutral-300 bg-[#f8f6f1] px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="font-serif text-sm md:text-base italic leading-relaxed text-emerald-900">
            「北然」是我们当地方言"回家"的意思，回到万物和谐共生的家园。
          </p>
          <button
            type="button"
            onClick={handleOpen}
            aria-label={isAdmin ? "查看留言" : "写留言"}
            className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-700 text-emerald-800 hover:bg-emerald-50"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            {isAdmin && unread > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        </div>
      </footer>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
              <h3 className="font-serif text-lg text-emerald-900">
                {isAdmin ? `留言收件箱（未读 ${unread}）` : "给我们留言"}
              </h3>
              <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-800" aria-label="关闭">✕</button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {isAdmin ? (
                messages.length === 0 ? (
                  <p className="py-10 text-center text-sm text-neutral-500">暂无留言</p>
                ) : (
                  <ul className="space-y-3">
                    {messages.map((m) => (
                      <li
                        key={m.id}
                        className={`rounded-lg border p-3 ${m.is_read ? "border-neutral-200 bg-white" : "border-emerald-300 bg-emerald-50/50"}`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
                          <span>
                            {m.name || "匿名"}{m.email ? ` · ${m.email}` : ""}
                          </span>
                          <span>{new Date(m.created_at).toLocaleString("zh-CN")}</span>
                        </div>
                        <p className="my-2 whitespace-pre-wrap text-sm text-neutral-800">{m.body}</p>
                        <div className="flex gap-2 text-xs">
                          {!m.is_read && (
                            <button onClick={() => markRead(m.id)} className="rounded border border-emerald-700 px-2 py-1 text-emerald-800 hover:bg-emerald-50">
                              标为已读
                            </button>
                          )}
                          <button onClick={() => deleteMsg(m.id)} className="rounded border border-neutral-300 px-2 py-1 text-neutral-600 hover:bg-neutral-100">
                            删除
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              ) : sent ? (
                <div className="py-10 text-center">
                  <p className="font-serif text-lg text-emerald-800">留言已送达，谢谢你 🌱</p>
                  <button onClick={() => setSent(false)} className="mt-4 text-sm text-emerald-700 underline">
                    再写一条
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="您的称呼（可选）"
                      className="rounded border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="邮箱（可选，便于回复）"
                      className="rounded border border-neutral-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={6}
                    maxLength={2000}
                    placeholder="想对我们说点什么？"
                    className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400">{body.length}/2000</span>
                    <button
                      onClick={sendMessage}
                      disabled={sending || !body.trim()}
                      className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      {sending ? "发送中…" : "发送"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
