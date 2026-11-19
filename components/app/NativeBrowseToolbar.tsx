"use client";

import type { ReactNode } from "react";
import { Tag } from "lucide-react";
import BrowseResultCount from "@/components/BrowseResultCount";
import BrowseSelect, { type BrowseSelectOption } from "@/components/BrowseSelect";
import styles from "./NativeBrowseToolbar.module.css";

/** One layout for native directory controls; callers retain their real filters and views. */
export default function NativeBrowseToolbar({ count, countLabel, filters = [], moreAction, viewControls, resultActions }: {
  count: number | null;
  countLabel: ReactNode;
  filters?: ReactNode[];
  moreAction?: ReactNode;
  viewControls?: ReactNode;
  resultActions?: ReactNode;
}) {
  return <div className={styles.container} data-native-browse-toolbar="v1">
    <div className={styles.rail}>
      <div className={styles.count}><BrowseResultCount count={count} label={countLabel} /></div>
      <div className={styles.filters}>{filters.map((filter, index) => <div className={styles.filter} key={index} data-quick-filter={index}>{filter}</div>)}</div>
      {moreAction && <div className={styles.more}>{moreAction}</div>}
      {viewControls && <div className={styles.views}>{viewControls}</div>}
    </div>
    {resultActions && <div className={styles.actions}>{resultActions}</div>}
  </div>;
}

/** The existing anchored listbox supplies keyboard, focus and full option labels. */
export function NativeBrowseQuickFilter({ label, value, options, onChange, icon }: {
  label: string;
  value: string;
  options: BrowseSelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
}) {
  return <BrowseSelect label={label} value={value} options={options} onChange={onChange} icon={icon ?? <Tag size={18} />}
    className={styles.quickSelect} triggerClassName={styles.quickTrigger} compactEmptyLabel iconOnly />;
}
