"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Open chevron mark — the universal "play / forward / action" symbol.
// Two clean strokes forming ›, rendered sharp on dark or light backgrounds.
function ChevronMark({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <polyline
        points="6,4 18,12 6,20"
        stroke="var(--color-gold)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ href = "/", onClick }: { href?: string; onClick?: () => void }) {
  const pathname = usePathname();

  function handleClick() {
    onClick?.();
    if (pathname === href) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className="flex items-center gap-2 shrink-0 group"
      aria-label="CineGenius"
    >
      <ChevronMark size={26} />
      <span className="font-sans text-[15px] leading-none select-none tracking-tight">
        <span className="font-normal text-text-secondary">Cine</span>
        <span className="font-bold" style={{ color: "var(--color-gold)" }}>Genius</span>
      </span>
    </Link>
  );
}

export function LogoMark({ size = 26 }: { size?: number }) {
  return <ChevronMark size={size} />;
}
