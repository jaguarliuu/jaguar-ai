import Link from "next/link";
import { Container } from "./container";
import { navLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background/95 backdrop-blur-sm">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-serif text-xl font-semibold tracking-tight">
          JaguarAI
        </Link>
        <nav className="hidden items-center gap-6 font-mono text-[11px] uppercase tracking-[0.2em] text-muted md:flex">
          {navLinks.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </header>
  );
}
