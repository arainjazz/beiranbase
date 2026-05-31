import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    request: (s.request as "admin" | "subscriber" | undefined) ?? undefined,
    mode: (s.mode as "signup" | "login" | undefined) ?? undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { request, mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">(
    initialMode ?? (request ? "signup" : "login"),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [requestedRole, setRequestedRole] = useState<"admin" | "subscriber" | "none">(
    request ?? "subscriber",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { data, error: e1 } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName || email.split("@")[0] } },
        });
        if (e1) throw e1;
        if (!data.user) throw new Error("注册失败");
        if (requestedRole !== "none" && email.toLowerCase() !== "arainjazz@gmail.com") {
          await supabase.from("role_requests").insert({
            user_id: data.user.id,
            requested_role: requestedRole,
            note: note || null,
          });
        }
      } else {
        const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
        if (e2) throw e2;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-8 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-serif text-2xl text-emerald-900">
            {mode === "signup" ? "注册账号" : "登录"}
          </h1>
          <Link to="/" className="text-xs text-neutral-500 hover:underline">
            返回首页
          </Link>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="text-sm">
            邮箱 / Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>
          <label className="text-sm">
            密码 / Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2"
            />
          </label>
          {mode === "signup" && (
            <>
              <label className="text-sm">
                显示名称 / Display name
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                />
              </label>
              <label className="text-sm">
                申请身份
                <select
                  value={requestedRole}
                  onChange={(e) => setRequestedRole(e.target.value as "admin" | "subscriber" | "none")}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="subscriber">订阅用户 (Subscriber)</option>
                  <option value="admin">管理员 (Admin)</option>
                  <option value="none">不申请，仅浏览</option>
                </select>
              </label>
              {requestedRole !== "none" && (
                <label className="text-sm">
                  申请说明（可选）
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="mt-1 w-full border rounded px-3 py-2"
                    rows={2}
                  />
                </label>
              )}
            </>
          )}
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="bg-emerald-700 text-white rounded py-2 hover:bg-emerald-800 disabled:opacity-60"
          >
            {busy ? "处理中…" : mode === "signup" ? "注册并提交申请" : "登录"}
          </button>
        </form>
        <button
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          className="mt-4 w-full text-sm text-emerald-700 hover:underline"
        >
          {mode === "signup" ? "已有账号？去登录" : "没有账号？去注册"}
        </button>
        {mode === "signup" && (
          <p className="mt-4 text-xs text-neutral-500 leading-relaxed">
            注册后需 Owner / 管理员审批通过，方可使用对应权限（管理员可编辑内容、订阅用户可评论和报名课程）。
          </p>
        )}
      </div>
    </div>
  );
}
