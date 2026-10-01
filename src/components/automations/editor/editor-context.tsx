"use client";

import { createContext, useContext } from "react";
import type { Enums } from "@/types/database";
import type { TriggerConfig } from "@/types/flow";

export type EditorLookups = {
  tags: { id: string; name: string; color: string }[];
  prompts: { id: string; name: string }[];
  accounts: { id: string; username: string }[];
};

export type TriggerDetails = {
  name: string;
  instagramAccountId: string | null;
  triggerType: Enums<"trigger_type">;
  triggerConfig: TriggerConfig;
  priority: number;
};

/** Dados de apoio (tags, prompts, gatilho) acessíveis pelos nós sem prop drilling. */
export const EditorContext = createContext<{ lookups: EditorLookups; details: TriggerDetails } | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor deve ser usado dentro do AutomationEditor");
  return ctx;
}
