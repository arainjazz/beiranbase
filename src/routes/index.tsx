import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";
import { FeaturedFromPages } from "@/components/FeaturedFromPages";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "北然生态基地 | Ecological Academy & Symbiotic Farm" },
      { name: "description", content: "北然生态基地 — Ecological academy and symbiotic farm in China." },
      { property: "og:title", content: "北然生态基地" },
      { property: "og:description", content: "Ecological academy and symbiotic farm." },
    ],
  }),
  component: () => (
    <MockFrame
      src="/mock/home.html"
      title="首页"
      page="home"
      afterFrame={<FeaturedFromPages />}
    />
  ),
});
