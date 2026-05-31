import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "管理后台 | 北然生态基地" }] }),
  component: AdminPage,
});

type RoleRequest = {
  id: string;
  user_id: string;
  requested_role: "admin" | "subscriber";
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
};
type Profile = { id: string; email: string; display_name: string | null };

function AdminPage() {
  const { user, roles, loading } = useSession();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const isOwner = roles.includes("owner");
  const isAdmin = roles.includes("admin") || isOwner;

  const load = useCallback(async () => {
    const { data: reqs } = await supabase
      .from("role_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const list = (reqs ?? []) as RoleRequest[];
    setRequests(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .in("id", ids);
      const map: Record<string, Profile> = {};
      (ps ?? []).forEach((p) => (map[p.id] = p as Profile));
      setProfiles(map);
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
    if (isAdmin) void load();
  }, [loading, user, isAdmin, load, navigate]);

  const decide = async (req: RoleRequest, approve: boolean) => {
    setBusy(req.id);
    setMsg(null);
    try {
      // Only owner can approve admin requests
      if (req.requested_role === "admin" && !isOwner) {
        setMsg("仅 Owner 可审批管理员申请");
        return;
      }
      if (approve) {
        const { error: e1 } = await supabase
          .from("user_roles")
          .insert({ user_id: req.user_id, role: req.requested_role });
        if (e1 && !e1.message.includes("duplicate")) throw e1;
      }
      const { error: e2 } = await supabase
        .from("role_requests")
        .update({
          status: approve ? "approved" : "rejected",
          decided_at: new Date().toISOString(),
          decided_by: user!.id,
        })
        .eq("id", req.id);
      if (e2) throw e2;
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-12 text-center text-neutral-500">加载中…</div>;
  if (!user)
    return (
      <div className="p-12 text-center">
        请先 <Link to="/login" className="text-emerald-700 underline">登录</Link>
      </div>
    );
  if (!isAdmin)
    return (
      <div className="p-12 text-center text-neutral-600">
        当前账号没有管理员权限。<br />
        <Link to="/" className="text-emerald-700 underline mt-2 inline-block">返回首页</Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-serif text-3xl text-emerald-900">管理后台</h1>
            <p className="text-sm text-neutral-600 mt-1">
              当前身份：{roles.join(", ") || "（无）"} · {user.email}
            </p>
          </div>
          <Link to="/" className="text-sm text-emerald-700 hover:underline">
            ← 返回网站
          </Link>
        </div>

        {msg && <div className="mb-4 p-3 rounded bg-amber-100 text-amber-900 text-sm">{msg}</div>}

        <h2 className="font-serif text-xl mb-4 text-neutral-800">待审批申请</h2>
        {requests.length === 0 ? (
          <div className="text-neutral-500 text-sm py-12 text-center bg-white rounded border">
            暂无待审批申请。
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => {
              const p = profiles[r.user_id];
              const canDecide = r.requested_role === "admin" ? isOwner : isAdmin;
              return (
                <div
                  key={r.id}
                  className="bg-white border border-neutral-200 rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          r.requested_role === "admin"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {r.requested_role === "admin" ? "管理员" : "订阅用户"}
                      </span>
                      <span className="font-medium">{p?.display_name ?? "(未知)"}</span>
                      <span className="text-sm text-neutral-500">{p?.email}</span>
                    </div>
                    {r.note && <p className="text-sm text-neutral-600 mt-1">{r.note}</p>}
                    <p className="text-xs text-neutral-400 mt-1">
                      {new Date(r.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  {canDecide ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        disabled={busy === r.id}
                        onClick={() => decide(r, true)}
                        className="px-3 py-1.5 text-sm bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-50"
                      >
                        通过
                      </button>
                      <button
                        disabled={busy === r.id}
                        onClick={() => decide(r, false)}
                        className="px-3 py-1.5 text-sm border border-neutral-300 rounded hover:bg-neutral-100 disabled:opacity-50"
                      >
                        驳回
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400 shrink-0">需 Owner 审批</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
