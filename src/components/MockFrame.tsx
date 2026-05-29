import { Link } from "@tanstack/react-router";

const NAV = [
  { to: "/", label: "首页 Home" },
  { to: "/species", label: "物种发现 Species" },
  { to: "/gifts", label: "生态礼品 Gifts" },
  { to: "/courses", label: "自然课程 Courses" },
] as const;

export function MockFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-100">
      <nav className="flex flex-wrap items-center gap-1 border-b border-neutral-300 bg-white/95 px-3 py-2 text-xs backdrop-blur">
        <span className="mr-3 font-serif text-sm font-semibold text-neutral-800">
          北然生态基地
        </span>
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="rounded px-2 py-1 text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900"
            activeProps={{ className: "rounded px-2 py-1 bg-neutral-900 text-white" }}
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
