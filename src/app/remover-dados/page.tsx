import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { DataDeletionInstructions } from "@/components/legal/data-deletion-instructions";

export const metadata: Metadata = { title: "Como excluir seus dados" };

/**
 * "URL de instruções de exclusão de dados" cadastrada em Configurações → Básico da Meta.
 * Página estática e sem POST: o validador da Meta recusa /exclusao-de-dados, que também
 * recebe o callback (POST) de exclusão.
 */
export default function DataDeletionInstructionsPage() {
  return (
    <LegalPage title="Como excluir seus dados" updatedAt="01/10/2026">
      <DataDeletionInstructions />
    </LegalPage>
  );
}
