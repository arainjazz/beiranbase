import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/species")({
  head: () => ({
    meta: [
      { title: "多物种共生 | 北然生态基地" },
      { name: "description", content: "多物种共生 — 北然生态基地的生物多样性档案。" },
      { property: "og:title", content: "多物种共生 | 北然生态基地" },
      { property: "og:description", content: "多物种共生 — 北然生态基地的生物多样性档案。" },
    ],
  }),
  component: () => <MockFrame src="/mock/species.html" title="多物种共生" />,
});

