"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction, type Dispatch } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { sameViewValue, viewRecord, writeViewRecord } from "@/lib/navigation-context";

/** Retain small view controls on the actual history entry, separately for each account. */
export function useViewState<T>(field: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const path = usePathname();
  const { userId } = useAuth();
  const owner = userId ?? "guest";
  const [value, setValue] = useState(initial);
  const current = useRef(value);
  const defaults = useRef(value);
  const skipWrite = useRef(true);
  useLayoutEffect(() => {
    const restore = () => {
      const fields = viewRecord(window.history.state, path, owner).fields;
      const next = Object.hasOwn(fields, field) ? fields[field] as T : defaults.current;
      current.current = next;
      skipWrite.current = true;
      setValue(next);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [field, owner, path]);
  useEffect(() => {
    if (skipWrite.current) { skipWrite.current = false; return; }
    const record = viewRecord(window.history.state, path, owner);
    if (!Object.hasOwn(record.fields, field) || !sameViewValue(record.fields[field], value)) {
      writeViewRecord(path, owner, { fields: { ...record.fields, [field]: value } });
    }
  });
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next = typeof action === "function" ? (action as (previous: T) => T)(current.current) : action;
    current.current = next;
    const record = viewRecord(window.history.state, path, owner);
    writeViewRecord(path, owner, { fields: { ...record.fields, [field]: next } });
    setValue(next);
  }, [field, owner, path]);
  return [value, update];
}
