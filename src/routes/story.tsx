import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { ContentPage } from "@/components/ContentPage";

export const Route = createFileRoute("/story")({
  head: () => ({
    meta: [
      { title: "农场故事 | 北然生态基地" },
      { name: "description", content: "北然生态基地的季节性田野记录与农场故事。" },
    ],
  }),
  component: () => (
    <SiteShell>
      <ContentPage page="story" />
    </SiteShell>
  ),
});
