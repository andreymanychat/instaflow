import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegalPage } from "@/components/legal/legal-page";
import { DataDeletionInstructions } from "@/components/legal/data-deletion-instructions";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Exclusão de dados" };

/**
 * Página pública de instruções de exclusão + consulta de status pelo código
 * de confirmação devolvido à Meta. O POST da Meta nesta mesma URL é
 * reescrito pelo proxy para /api/oauth/data-deletion.
 */
export default async function DataDeletionPage({ searchParams }: PageProps<"/exclusao-de-dados">) {
  const { codigo } = await searchParams;
  const code = typeof codigo === "string" && /^[0-9a-f]{16}$/.test(codigo) ? codigo : null;

  const request = code
    ? (await createAdminClient().from("data_deletion_requests").select("status, created_at").eq("confirmation_code", code).maybeSingle()).data
    : null;

  return (
    <LegalPage title="Exclusão de dados" updatedAt="29/09/2026">
      {code && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="font-medium">Solicitação {code}</p>
          <p className="text-sm text-muted-foreground">
            {request
              ? `Status: ${request.status === "completed" ? "concluída" : request.status} em ${formatDateTime(request.created_at)}.`
              : "Código não encontrado."}
          </p>
        </div>
      )}

      <DataDeletionInstructions />
    </LegalPage>
  );
}
