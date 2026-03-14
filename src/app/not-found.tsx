import Link from "next/link";
import { Container } from "@/components/site/container";

export default function NotFound() {
  return (
    <Container className="py-24 md:py-32">
      <div className="max-w-3xl border-t border-line pt-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">404 / Not Found</p>
        <h1 className="mt-4 font-serif text-[2.8rem] font-semibold tracking-[-0.04em] md:text-[4.2rem]">
          这个页面不存在，或者还没有被发布。
        </h1>
        <p className="mt-5 text-[15px] leading-8 text-muted md:text-lg">
          你可以先回到首页，或者从 Posts、Daily、Courses 重新进入内容系统。
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full border border-line px-5 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted transition-colors hover:border-line-strong hover:text-foreground"
        >
          Back Home
        </Link>
      </div>
    </Container>
  );
}
