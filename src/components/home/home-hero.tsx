import Link from "next/link";

type HomeHeroPillar = {
  href: string;
  label: string;
  summary: string;
  meta: string;
};

type HomeHeroProps = {
  pillars: HomeHeroPillar[];
};

const statusItems = [
  { label: "公众号", value: "持续维护" },
  { label: "B 站", value: "内容同步更新" },
  { label: "课程", value: "章节化公开发布" },
  { label: "Daily Agent", value: "Git 自动推送" },
] as const;

export function HomeHero({ pillars }: HomeHeroProps) {
  return (
    <section className="border-b border-line">
      <div className="py-14 md:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">
          JaguarAI / Personal AI Brand
        </p>
        <h1 className="mt-6 max-w-5xl font-serif text-[2.9rem] leading-[0.96] font-semibold tracking-[-0.05em] md:text-[5.4rem]">
          把分散的 AI 内容、课程、日报与项目，收拢为一个持续更新的中文内容现场。
        </h1>
        <p className="mt-6 max-w-3xl text-[15px] leading-8 text-muted md:text-lg">
          这里集中维护 Jaguar 的文章、AI 日报、公开课程与开源项目。
          它既是长期内容载体，也是之后逐步展开 AI Lab 的基座。
        </p>

        <div className="mt-10 grid gap-3 border-y border-line py-4 md:grid-cols-4">
          {statusItems.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 md:block">
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">{item.label}</p>
              <p className="mt-0 text-sm text-foreground md:mt-2">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <Link
              key={pillar.href}
              href={pillar.href}
              className="group rounded-[22px] border border-line bg-surface p-5 transition-colors hover:border-line-strong md:p-6"
            >
              <div className="flex items-center justify-between gap-4 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                <span>{pillar.label}</span>
                <span>{pillar.meta}</span>
              </div>
              <h2 className="mt-5 font-serif text-[2rem] font-semibold tracking-tight">{pillar.label}</h2>
              <p className="mt-3 text-sm leading-7 text-muted md:text-[15px]">{pillar.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
