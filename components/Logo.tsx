"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// CineGenius signature chevron: a softened forward mark, kept simple for small headers.
// A clear forward mark that stays legible in compact headers.
function ChevronMark({ size = 28 }: { size?: number }) {
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
        points="5.5,4 18.5,12 5.5,20"
        stroke="var(--color-gold)"
        strokeWidth="3.2"
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
      className="flex items-center gap-2.5 shrink-0 group"
      aria-label="CineGenius"
    >
      <ChevronMark size={28} />
      <span className="font-sans text-[16px] leading-none select-none tracking-[-0.035em]">
        <span className="font-medium text-text-primary">Cine</span>
        <span className="font-bold" style={{ color: "var(--color-gold)" }}>Genius</span>
      </span>
    </Link>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return <ChevronMark size={size} />;
}
