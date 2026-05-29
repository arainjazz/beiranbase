import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/species")({
  head: () => ({
    meta: [
      { title: "物种发现 | 北然生态基地" },
      { name: "description", content: "Discover species at Beiran Ecological Base." },
      { property: "og:title", content: "物种发现 | 北然生态基地" },
      { property: "og:description", content: "Discover species at Beiran Ecological Base." },
    ],
  }),
  component: () => <MockFrame src="/mock/species.html" title="物种发现" />,
});
