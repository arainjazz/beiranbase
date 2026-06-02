import { createFileRoute } from "@tanstack/react-router";
import { MockFrame } from "@/components/MockFrame";

export const Route = createFileRoute("/species")({
  head: () => ({
    meta: [
      { title: "多物种共生 | 北然生态基地" },
      { name: "description", content: "北然基地与周边土地的多物种生命记录。" },
    ],
  }),
  component: () => <MockFrame src="/mock/species.html" title="多物种共生" page="species" />,
});
