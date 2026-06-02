import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/SiteShell";
import { ContentPage } from "@/components/ContentPage";

export const Route = createFileRoute("/gifts")({
  head: () => ({
    meta: [
      { title: "生态礼品 | 北然生态基地" },
      { name: "description", content: "来自基地与村落的生态礼品。" },
    ],
  }),
  component: () => (
    <SiteShell>
      <ContentPage page="gifts" />
    </SiteShell>
  ),
});
