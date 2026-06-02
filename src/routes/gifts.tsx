import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/gifts")({
  head: () => ({
    meta: [
      { title: "生态礼品 | 北然生态基地" },
      { name: "description", content: "来自基地与村落的生态礼品。" },
    ],
  }),
  component: () => <MockFrame src="/mock/gifts.html" title="生态礼品" page="gifts" />,
});
