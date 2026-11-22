"use client";
import { createContext, useContext } from "react";
export const NativeInboxSurfaceContext = createContext(false);
export function useNativeInboxSurface() { return useContext(NativeInboxSurfaceContext); }
