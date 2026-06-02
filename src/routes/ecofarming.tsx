import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { ContentPage } from "@/components/ContentPage";

export const Route = createFileRoute("/ecofarming")({
  head: () => ({
    meta: [
      { title: "生态农法 | 北然生态基地" },
      { name: "description", content: "朴门永续、食物森林、稻鸭共作——北然的生态农法实践。" },
    ],
  }),
  component: () => (
    <SiteShell>
      <ContentPage page="ecofarming" />
    </SiteShell>
  ),
});
