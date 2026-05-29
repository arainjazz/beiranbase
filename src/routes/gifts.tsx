import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/gifts")({
  head: () => ({
    meta: [
      { title: "生态礼品 | 北然生态基地" },
      { name: "description", content: "Ecological farming and gifts from Beiran." },
      { property: "og:title", content: "生态礼品 | 北然生态基地" },
      { property: "og:description", content: "Ecological farming and gifts." },
    ],
  }),
  component: () => <MockFrame src="/mock/gifts.html" title="生态礼品" />,
});
