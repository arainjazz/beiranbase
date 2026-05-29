import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/", label: "首页" },
  { to: "/species", label: "多物种共生" },
  { to: "/courses", label: "自然课程" },
  { to: "/ecofarming", label: "生态农法" },
  { to: "/gifts", label: "生态礼品" },
  { to: "/story", label: "农场故事" },
] as const;

export function MockFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100">
      <nav className="flex flex-wrap items-center gap-1 border-b border-neutral-300 bg-white/95 px-4 py-2 text-xs backdrop-blur">
        <Link to="/" className="mr-4 flex items-center gap-2">
          <img
            src="/logo.png"
            alt="北然生态基地"
            className="h-9 w-9 rounded-sm object-contain"
          />
          <span className="font-serif text-sm font-semibold text-emerald-900">
            北然生态基地
          </span>
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="rounded px-2 py-1 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
            activeProps={{ className: "rounded px-2 py-1 bg-emerald-900 text-white" }}
            activeOptions={{ exact: true }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <iframe
        src={src}
        title={title}
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
