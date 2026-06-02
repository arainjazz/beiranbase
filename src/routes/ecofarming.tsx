import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/ecofarming")({
  head: () => ({
    meta: [
      { title: "生态农法 | 北然生态基地" },
      { name: "description", content: "朴门永续、食物森林、稻鸭共作——北然的生态农法实践。" },
    ],
  }),
  component: () => <MockFrame src="/mock/ecofarming.html" title="生态农法" page="ecofarming" />,
});
