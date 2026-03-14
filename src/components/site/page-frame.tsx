import type { ReactNode } from "react";
import { SiteFooter } from "./footer";
import { SiteHeader } from "./header";

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
