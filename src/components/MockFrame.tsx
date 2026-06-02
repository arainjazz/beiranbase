import { SiteShell } from "./SiteShell";

export function MockFrame({ src, title }: { src: string; title: string }) {
  return (
    <SiteShell>
      <iframe src={src} title={title} className="h-[calc(100vh-88px-80px)] w-full border-0 bg-white" />
    </SiteShell>
  );
}
