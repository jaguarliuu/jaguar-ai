"use client";

import { useEffect, useState } from "react";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsVisible(window.scrollY > 480);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-5 bottom-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface text-sm text-foreground shadow-[0_10px_30px_rgba(17,17,17,0.08)] transition-all hover:border-line-strong md:right-8 md:bottom-8 ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <span aria-hidden="true" className="font-mono text-xs uppercase tracking-[0.18em]">
        Top
      </span>
      <span className="sr-only">Back to top</span>
    </button>
  );
}
