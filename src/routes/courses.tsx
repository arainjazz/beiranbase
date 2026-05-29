import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "自然课程 - 北然生态基地" },
      { name: "description", content: "Nature courses at Beiran Ecological Base." },
      { property: "og:title", content: "自然课程 - 北然生态基地" },
      { property: "og:description", content: "Nature courses at Beiran Ecological Base." },
    ],
  }),
  component: () => <MockFrame src="/mock/courses.html" title="自然课程" />,
});
