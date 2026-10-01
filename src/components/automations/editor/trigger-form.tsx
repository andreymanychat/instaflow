"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeywordsInput } from "@/components/shared/keywords-input";
import { TRIGGER_LABELS } from "@/lib/automation-templates";
import { MediaPicker } from "./media-picker";
import { useEditor, type TriggerDetails } from "./editor-context";
import type { Enums } from "@/types/database";
import type { KeywordMatch } from "@/types/flow";

const MATCH_LABELS: Record<KeywordMatch, string> = {
  contains: "Contém a palavra",
  exact: "É exatamente igual",
  starts_with: "Começa com",
  any: "Qualquer texto",
};

export function TriggerForm({ details, onChange }: { details: TriggerDetails; onChange: (d: TriggerDetails) => void }) {
  const { lookups } = useEditor();
  const cfg = details.triggerConfig;
  const setConfig = (patch: Partial<TriggerDetails["triggerConfig"]>) => onChange({ ...details, triggerConfig: { ...cfg, ...patch } });
  const usesKeywords = details.triggerType === "comment" || details.triggerType === "dm_keyword" || details.triggerType === "story_reply";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Tipo de gatilho</Label>
        <Select
          value={details.triggerType}
          onValueChange={(v) => onChange({ ...details, triggerType: v as Enums<"trigger_type"> })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {details.triggerType === "default_reply" && (
          <p className="text-xs text-muted-foreground">
            Dispara quando nenhuma palavra-chave casar e a IA automática estiver desligada. No máximo uma vez a cada 24h por contato.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Conta do Instagram</Label>
        <Select
          value={details.instagramAccountId ?? "all"}
          onValueChange={(v) => onChange({ ...details, instagramAccountId: v === "all" ? null : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {lookups.accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {usesKeywords && (
        <>
          <div className="space-y-2">
            <Label>Regra de correspondência</Label>
            <Select value={cfg.match} onValueChange={(v) => setConfig({ match: v as KeywordMatch })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MATCH_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cfg.match !== "any" && (
            <div className="space-y-2">
              <Label>Palavras-chave</Label>
              <KeywordsInput value={cfg.keywords} onChange={(keywords) => setConfig({ keywords })} placeholder="ex.: quero, link, preço" />
              <p className="text-xs text-muted-foreground">Não diferencia maiúsculas nem acentos.</p>
            </div>
          )}
        </>
      )}

      {details.triggerType === "comment" && (
        <>
          <div className="space-y-2">
            <Label>Publicações</Label>
            <p className="text-xs text-muted-foreground">Nenhuma selecionada = vale para todas as publicações e reels.</p>
            <MediaPicker
              accountId={details.instagramAccountId}
              selected={cfg.mediaIds}
              onChange={(mediaIds) => setConfig({ mediaIds })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label>Só o primeiro comentário</Label>
              <p className="text-xs text-muted-foreground">Evita reenviar a DM se a pessoa comentar de novo no mesmo post.</p>
            </div>
            <Switch checked={cfg.onlyFirstComment} onCheckedChange={(onlyFirstComment) => setConfig({ onlyFirstComment })} />
          </div>
        </>
      )}

      <div className="space-y-2">
        <Label>Prioridade</Label>
        <Input
          type="number"
          min={-100}
          max={100}
          value={details.priority}
          onChange={(e) => onChange({ ...details, priority: Number(e.target.value) || 0 })}
          className="w-28"
        />
        <p className="text-xs text-muted-foreground">Quando mais de uma automação casar, a de maior prioridade vence.</p>
      </div>
    </div>
  );
}
