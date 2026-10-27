"use client";

import { createContext } from "react";

/** Bootstrap identity already verified by the server. Never authorizes an API request. */
export const ServerAdminContext = createContext<string | null>(null);
