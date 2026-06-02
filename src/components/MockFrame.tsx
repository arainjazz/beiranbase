import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "@/hooks/useSession";

const NAV = [
  { to: "/", cn: "首页", en: "Home" },
  { to: "/species", cn: "多物种共生", en: "Species" },
  { to: "/courses", cn: "自然课程", en: "Course" },
  { to: "/ecofarming", cn: "生态农法", en: "Eco-farming" },
  { to: "/community", cn: "本地社区", en: "Local Community Culture" },
  { to: "/gifts", cn: "生态礼品", en: "Eco-gift" },
  { to: "/story", cn: "农场故事", en: "Story" },
] as const;

export function MockFrame({ src, title }: { src: string; title: string }) {
  const { user, roles, signOut } = useSession();
  const navigate = useNavigate();
  const isAdmin = roles.includes("owner") || roles.includes("admin");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100">
      <nav className="border-b border-neutral-300 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3 md:px-6 md:py-4 min-h-[72px] md:min-h-[88px]">
          <Link to="/" className="mr-2 md:mr-6 flex items-center gap-3">
            <img src="/logo.png" alt="北然生态基地" className="h-12 w-12 md:h-16 md:w-16 rounded-sm object-contain" />
            <span className="flex flex-col leading-tight">
              <span className="font-serif text-base font-semibold text-emerald-900">北然生态基地</span>
              <span className="text-[9px] uppercase tracking-widest text-emerald-700">BeiRanEcoBase</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex flex-wrap items-center gap-1">
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
                <span className="text-[9px] uppercase tracking-wide opacity-80">{n.en}</span>
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {!user ? (
              <>
                <Link
                  to="/login"
                  search={{ request: "admin", mode: "signup" }}
                  className="hidden sm:flex flex-col items-center rounded border border-emerald-700 px-3 py-1.5 leading-tight text-emerald-800 transition hover:bg-emerald-50"
                >
                  <span className="text-xs">注册管理员</span>
                  <span className="text-[9px] uppercase opacity-80">Admin Sign-up</span>
                </Link>
                <Link
                  to="/login"
                  search={{ request: "subscriber", mode: "signup" }}
                  className="flex flex-col items-center rounded bg-emerald-700 px-3 py-1.5 leading-tight text-white transition hover:bg-emerald-800"
                >
                  <span className="text-xs">注册</span>
                  <span className="text-[9px] uppercase opacity-80">Sign up</span>
                </Link>
                <Link
                  to="/login"
                  search={{ mode: "login" }}
                  className="flex flex-col items-center rounded px-3 py-1.5 leading-tight text-neutral-700 hover:bg-neutral-100"
                >
                  <span className="text-xs">登录</span>
                  <span className="text-[9px] uppercase opacity-80">Log in</span>
                </Link>
              </>
            ) : (
              <>
                <div className="hidden md:flex flex-col items-end leading-tight px-2">
                  <span className="text-xs text-neutral-700">{user.email}</span>
                  <span className="text-[9px] uppercase tracking-wide text-emerald-700">
                    {roles.join(" · ") || "待审批 / pending"}
                  </span>
                </div>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex flex-col items-center rounded bg-emerald-900 px-3 py-1.5 leading-tight text-white hover:bg-emerald-950"
                  >
                    <span className="text-xs">管理后台</span>
                    <span className="text-[9px] uppercase opacity-80">Admin</span>
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
                  <span className="text-[9px] uppercase opacity-80">Log out</span>
                </button>
              </>
            )}

            {/* Hamburger - mobile only */}
            <button
              type="button"
              aria-label="菜单"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden ml-1 inline-flex h-10 w-10 items-center justify-center rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {menuOpen ? (
                  <>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="7" x2="21" y2="7" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="17" x2="21" y2="17" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-white px-2 py-2 flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-baseline justify-between rounded px-3 py-3 leading-tight text-neutral-700 hover:bg-neutral-100"
                activeProps={{ className: "flex items-baseline justify-between rounded px-3 py-3 leading-tight bg-emerald-900 text-white" }}
                activeOptions={{ exact: true }}
              >
                <span className="text-base">{n.cn}</span>
                <span className="text-[10px] uppercase opacity-70">{n.en}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>
      <iframe src={src} title={title} className="h-full w-full flex-1 border-0 bg-white" />
    </div>
  );
}
