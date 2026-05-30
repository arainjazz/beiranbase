import { Link } from "@tanstack/react-router";

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
  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100">
      <nav className="flex flex-wrap items-center gap-2 border-b border-neutral-300 bg-white/95 px-6 py-4 backdrop-blur min-h-[88px]">
        <Link to="/" className="mr-6 flex items-center gap-3">
          <img
            src="/logo.png"
            alt="北然生态基地"
            className="h-16 w-16 rounded-sm object-contain"
          />
          <span className="flex flex-col leading-tight">
            <span className="font-serif text-base font-semibold text-emerald-900">
              北然生态基地
            </span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-700">
              BRecoBase
            </span>
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
              <span className="text-[10px] uppercase tracking-wide opacity-80">
                {n.en}
              </span>
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="flex flex-col items-center rounded border border-emerald-700 px-3 py-1.5 leading-tight text-emerald-800 transition hover:bg-emerald-50"
            onClick={() =>
              alert("注册管理员申请已提交，等待 Owner 审批。\n(后端功能即将上线)")
            }
          >
            <span className="text-xs">注册管理员</span>
            <span className="text-[10px] uppercase opacity-80">Admin Sign-up</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center rounded bg-emerald-700 px-3 py-1.5 leading-tight text-white transition hover:bg-emerald-800"
            onClick={() =>
              alert("订阅用户注册申请已提交，等待审批。\n(后端功能即将上线)")
            }
          >
            <span className="text-xs">注册订阅用户</span>
            <span className="text-[10px] uppercase opacity-80">Subscribe</span>
          </button>
        </div>
      </nav>
      <iframe
        src={src}
        title={title}
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
