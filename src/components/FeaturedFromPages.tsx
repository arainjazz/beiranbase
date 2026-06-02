import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type Row = { page: string; title: string; body: string; updated_at: string };

const PAGE_META: Record<string, { label: string; to: string }> = {
  species: { label: "多物种共生", to: "/species" },
  courses: { label: "自然课程", to: "/courses" },
  gifts: { label: "生态礼品", to: "/gifts" },
  story: { label: "我们的故事", to: "/story" },
  community: { label: "在地社区", to: "/community" },
  ecofarming: { label: "生态种养", to: "/ecofarming" },
};

function excerpt(html: string, n = 120) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = (div.textContent || "").replace(/\s+/g, " ").trim();
  return text.length > n ? text.slice(0, n) + "…" : text;
}

function firstImg(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

export function FeaturedFromPages() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select("page,title,body,updated_at")
        .neq("page", "home" as any)
        .order("updated_at", { ascending: false })
        .limit(60);
      if (!alive) return;
      // dedupe: keep latest per page (one card per sub-page)
      const seen = new Map<string, Row>();
      (data ?? []).forEach((r: any) => { if (!seen.has(r.page)) seen.set(r.page, r); });
      setRows(Array.from(seen.values()));
    })();
    return () => { alive = false; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="bg-surface-container-low py-20 px-6 md:px-16">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-on-surface-variant mb-2">最新更新</p>
            <h2 className="font-headline text-3xl md:text-4xl text-on-background">来自各版块的精选</h2>
          </div>
          <span className="text-sm text-on-surface-variant hidden md:block">由管理员发布的最新内容自动汇总</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rows.map((r) => {
            const meta = PAGE_META[r.page] ?? { label: r.page, to: "/" };
            const img = firstImg(r.body);
            return (
              <Link
                key={r.page}
                to={meta.to}
                className="group block bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {img && (
                  <div className="aspect-[16/10] overflow-hidden bg-surface-variant">
                    <img src={img} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                )}
                <div className="p-5">
                  <p className="text-[11px] tracking-[0.18em] uppercase text-primary mb-2">{meta.label}</p>
                  <h3 className="font-headline text-lg text-on-background mb-2 line-clamp-2">{r.title}</h3>
                  <p className="text-sm text-on-surface-variant line-clamp-3">{excerpt(r.body)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
