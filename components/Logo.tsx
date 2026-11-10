"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";


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
      className="h-7 w-7 shrink-0 max-[360px]:h-5 max-[360px]:w-5"
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
  const uiText = useTranslations();

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
      className="flex items-center gap-2.5 max-[420px]:gap-1 shrink-0 group"
      aria-label={uiText("AdminNewsletter.brandName")}
    >{uiText.rich("Ui.text_44b6b8362d2bfa", { part1: () => (<ChevronMark size={28} />), part3: chunks => (<span className="font-medium text-text-primary">{chunks}</span>), part4: chunks => (<span className="font-bold" style={{ color: "var(--color-gold)" }}>{chunks}</span>), part2: chunks => (<span className="font-sans text-[16px] max-[420px]:text-[14px] max-[360px]:text-[13px] leading-none select-none tracking-[-0.035em]">{chunks}</span>) })}</Link>
  );
}

export function LogoMark({ size = 28 }: { size?: number }) {
  return <ChevronMark size={size} />;
}
