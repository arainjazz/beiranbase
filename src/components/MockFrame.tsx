import { Link, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/useSession";

const NAV = [
  { to: "/", cn: "首页", en: "Home" },
  { to: "/species", cn: "多物种共生", en: "Species" },
  { to: "/courses", cn: "自然课程", en: "Course" },
  { to: "/ecofarming", cn: "生态农法", en: "Eco-farming" },
  { to: "/community", cn: "共生社区", en: "Local Community Culture" },
  { to: "/gifts", cn: "生态礼品", en: "Eco-gift" },
  { to: "/story", cn: "农场故事", en: "Story" },
] as const;

export function MockFrame({ src, title }: { src: string; title: string }) {
  const { user, roles, signOut } = useSession();
  const navigate = useNavigate();
  const isAdmin = roles.includes("owner") || roles.includes("admin");

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100">
      <nav className="flex flex-wrap items-center gap-2 border-b border-neutral-300 bg-white/95 px-6 py-4 backdrop-blur min-h-[88px]">
        <Link to="/" className="mr-6 flex items-center gap-3">
          <img src="/logo.png" alt="北然生态基地" className="h-16 w-16 rounded-sm object-contain" />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-base font-semibold text-emerald-900">北然生态基地</span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-700">BRecoBase</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-col items-center rounded px-3 py-2 leading-tight text-neutral-700 transition hover:bg-neutral-200 hover:text-neutral-900"
              activeProps={{
                className:
                  "flex flex-col items-center rounded px-3 py-2 leading-tight bg-emerald-900 text-white",
              }}
              activeOptions={{ exact: true }}
            >
              <span className="text-sm">{n.cn}</span>
              <span className="text-[10px] uppercase tracking-wide opacity-80">{n.en}</span>
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!user ? (
            <>
              <Link
                to="/login"
                search={{ request: "admin", mode: "signup" }}
                className="flex flex-col items-center rounded border border-emerald-700 px-3 py-1.5 leading-tight text-emerald-800 transition hover:bg-emerald-50"
              >
                <span className="text-xs">注册管理员</span>
                <span className="text-[10px] uppercase opacity-80">Admin Sign-up</span>
              </Link>
              <Link
                to="/login"
                search={{ request: "subscriber", mode: "signup" }}
                className="flex flex-col items-center rounded bg-emerald-700 px-3 py-1.5 leading-tight text-white transition hover:bg-emerald-800"
              >
                <span className="text-xs">注册订阅用户</span>
                <span className="text-[10px] uppercase opacity-80">Subscribe</span>
              </Link>
              <Link
                to="/login"
                search={{ mode: "login" }}
                className="flex flex-col items-center rounded px-3 py-1.5 leading-tight text-neutral-700 hover:bg-neutral-100"
              >
                <span className="text-xs">登录</span>
                <span className="text-[10px] uppercase opacity-80">Log in</span>
              </Link>
            </>
          ) : (
            <>
              <div className="flex flex-col items-end leading-tight px-2">
                <span className="text-xs text-neutral-700">{user.email}</span>
                <span className="text-[10px] uppercase tracking-wide text-emerald-700">
                  {roles.join(" · ") || "待审批 / pending"}
                </span>
              </div>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex flex-col items-center rounded bg-emerald-900 px-3 py-1.5 leading-tight text-white hover:bg-emerald-950"
                >
                  <span className="text-xs">管理后台</span>
                  <span className="text-[10px] uppercase opacity-80">Admin</span>
                </Link>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="flex flex-col items-center rounded border border-neutral-300 px-3 py-1.5 leading-tight text-neutral-700 hover:bg-neutral-100"
              >
                <span className="text-xs">退出</span>
                <span className="text-[10px] uppercase opacity-80">Log out</span>
              </button>
            </>
          )}
        </div>
      </nav>
      <iframe src={src} title={title} className="h-full w-full flex-1 border-0 bg-white" />
    </div>
  );
}
