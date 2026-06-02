import type { ReactNode } from "react";
import { SiteNav } from "./SiteNav";
import { Footer } from "./Footer";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
