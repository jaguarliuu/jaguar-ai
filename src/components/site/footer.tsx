import Link from "next/link";
import { Container } from "./container";
import { navLinks } from "./nav-links";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="flex flex-col gap-8 py-12 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <Link href="/" className="font-serif text-3xl font-semibold tracking-tight">
            JaguarAI
          </Link>
          <p className="mt-4 text-sm leading-7 text-muted">
            A calm editorial-tech home for AI posts, daily briefings, structured courses, and
            maintained projects.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          {navLinks.slice(1).map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
