import type { CSSProperties, ReactNode } from "react";
import type { CrewData } from "@/lib/profile-types";
import { profileAboutTheme } from "@/lib/profile-about-theme";
import styles from "./ProfileAboutCard.module.css";

/** Decoration of existing visible content; no reads, writes or visibility decisions. */
export default function ProfileAboutCard({ crew, children }: {
  crew?: Pick<CrewData, "primaryOccupation" | "occupations" | "department"> | null;
  children: ReactNode;
}) {
  const theme = profileAboutTheme(crew);
  return <div className={styles.about} data-native-profile-about={theme.department}
    style={{ "--about-hue": theme.hue, "--about-saturation": theme.saturation } as CSSProperties}>{children}</div>;
}
