import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/story")({
  head: () => ({
    meta: [
      { title: "农场故事 | 北然生态基地" },
      { name: "description", content: "北然生态基地的季节性田野记录与农场故事。" },
    ],
  }),
  component: () => <MockFrame src="/mock/story.html" title="农场故事" />,
});
