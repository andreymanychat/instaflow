import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegalPage } from "@/components/legal/legal-page";
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

      <p>Você pode pedir a exclusão dos seus dados de três formas:</p>

      <h2>1. Pelo Instagram (automático)</h2>
      <ul>
        <li>Abra o Instagram → Configurações e privacidade → Apps e sites.</li>
        <li>Encontre o InstaFlow em “Ativos” e toque em “Remover”.</li>
        <li>Marque a opção para excluir os dados. A Meta nos avisa e apagamos automaticamente a conta conectada, contatos, conversas e comentários.</li>
      </ul>

      <h2>2. Pelo painel (titulares de conta)</h2>
      <p>Em Configurações → Instagram, clique em “Desconectar”. Todos os dados vinculados àquela conta são apagados imediatamente.</p>

      <h2>3. Por solicitação</h2>
      <p>
        Se você interagiu com uma empresa que usa o InstaFlow e quer que seus dados sejam removidos, envie um email para o contato informado no
        cadastro do aplicativo na Meta com seu @ do Instagram. Atendemos em até 15 dias, conforme a LGPD.
      </p>
    </LegalPage>
  );
}
