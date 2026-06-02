import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/courses")({
  head: () => ({
    meta: [
      { title: "自然课程 | 北然生态基地" },
      { name: "description", content: "北然生态基地的四季自然课程与工作坊。" },
    ],
  }),
  component: () => <MockFrame src="/mock/courses.html" title="自然课程" page="courses" />,
});
