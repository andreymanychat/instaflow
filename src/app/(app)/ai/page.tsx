import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { canManage, getOrgContext } from "@/server/auth/session";
import { isOpenAIConfigured } from "@/lib/env";
import { checkLimit } from "@/server/services/plan-service";
import { DEFAULT_SYSTEM_PROMPT } from "@/server/services/ai-service";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsCard } from "@/components/ai/ai-settings-card";
import { PromptList } from "@/components/ai/prompt-list";
import { PromptPlayground } from "@/components/ai/prompt-playground";

export const metadata: Metadata = { title: "Inteligência artificial" };

export default async function AiPage() {
  const { supabase, organization, role } = await getOrgContext();
  const { data: prompts } = await supabase
    .from("ai_prompts")
    .select("*")
    .eq("organization_id", organization.id)
    .order("created_at");
  const usage = await checkLimit(organization.id, "ai_replies_per_month");
  const configured = isOpenAIConfigured();
  const defaultModel = process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5-mini";

  return (
    <>
      <PageHeader title="Inteligência artificial" description="Respostas automáticas com OpenAI usando seus prompts" />
      <PageBody className="space-y-6">
        {!configured && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            A variável OPENAI_API_KEY não está configurada no servidor. As respostas de IA ficam desativadas até ela ser definida.
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <AiSettingsCard
            canEdit={canManage(role)}
            enabled={organization.ai_auto_reply_enabled}
            defaultPromptId={organization.default_ai_prompt_id}
            prompts={(prompts ?? []).map((p) => ({ id: p.id, name: p.name }))}
          />
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Uso no mês</CardTitle>
              <CardDescription>Respostas geradas pela IA (automáticas, em fluxos e sugestões enviadas).</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">
                {usage.usage.toLocaleString("pt-BR")}
                <span className="text-base font-normal text-muted-foreground"> / {usage.limit < 0 ? "ilimitado" : usage.limit.toLocaleString("pt-BR")}</span>
              </p>
              {usage.limit > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (usage.usage / usage.limit) * 100)}%` }} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <PromptList
          canEdit={canManage(role)}
          prompts={prompts ?? []}
          defaultPromptId={organization.default_ai_prompt_id}
          template={{ systemPrompt: DEFAULT_SYSTEM_PROMPT, model: defaultModel }}
        />

        {(prompts?.length ?? 0) > 0 && <PromptPlayground prompts={(prompts ?? []).map((p) => ({ id: p.id, name: p.name }))} />}
      </PageBody>
    </>
  );
}
