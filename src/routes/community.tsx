import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { ContentPage } from "@/components/ContentPage";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "本地社区 | 北然生态基地" },
      { name: "description", content: "北然生态基地与周边原住民、村落共同生活的记录。" },
    ],
  }),
  component: () => (
    <SiteShell>
      <ContentPage page="community" />
    </SiteShell>
  ),
});
