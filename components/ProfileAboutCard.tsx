import type { CSSProperties, ReactNode } from "react";
import type { CrewData } from "@/lib/profile-types";
import { profileAboutTheme, profileAboutThemeFromVisibleRole } from "@/lib/profile-about-theme";
import styles from "./ProfileAboutCard.module.css";

/** Decoration of existing visible content; no reads, writes or visibility decisions. */
export default function ProfileAboutCard({ crew, role, children }: {
  crew?: Pick<CrewData, "primaryOccupation" | "occupations" | "department"> | null;
  role?: string | null;
  children: ReactNode;
}) {
  const theme = crew ? profileAboutTheme(crew) : profileAboutThemeFromVisibleRole(role);
  return <div className={styles.about} data-native-profile-about={theme.department}
    style={{ "--about-hue": theme.hue, "--about-saturation": theme.saturation } as CSSProperties}>{children}</div>;
}
