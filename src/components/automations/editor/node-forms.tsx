"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VariableHint } from "./variable-hint";
import { shortId } from "./node-catalog";
import { useEditor } from "./editor-context";
import type {
  AiReplyNodeData,
  CommentReplyNodeData,
  ConditionNodeData,
  ConditionRule,
  DelayNodeData,
  MessageNodeData,
  TagNodeData,
} from "@/types/flow";

type FormProps<T> = { data: T; onChange: (data: T) => void };

const MAX_QUICK_REPLIES = 13;
const MAX_TEMPLATE_BUTTONS = 3;

export function MessageForm({ data, onChange }: FormProps<MessageNodeData>) {
  const usingTemplate = data.linkButtons.length > 0;
  const buttonLimit = usingTemplate ? MAX_TEMPLATE_BUTTONS : MAX_QUICK_REPLIES;
  const totalButtons = data.linkButtons.length + data.quickReplies.length;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Texto</Label>
        <Textarea
          rows={6}
          maxLength={usingTemplate ? 640 : 1000}
          value={data.text}
          placeholder="Oi {{first_name}}! ..."
          onChange={(e) => onChange({ ...data, text: e.target.value })}
        />
        <VariableHint onInsert={(v) => onChange({ ...data, text: `${data.text}${v}` })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Botões de resposta</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={totalButtons >= buttonLimit}
            onClick={() => onChange({ ...data, quickReplies: [...data.quickReplies, { id: shortId(), title: "" }] })}
          >
            <Plus className="size-4" /> Botão
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Cada botão cria uma saída no fluxo. O fluxo pausa até o contato tocar em um deles (isso também abre a janela de 24h da Meta).
        </p>
        {data.quickReplies.map((button, index) => (
          <div key={button.id} className="flex gap-2">
            <Input
              value={button.title}
              maxLength={20}
              placeholder={`Botão ${index + 1}`}
              onChange={(e) =>
                onChange({
                  ...data,
                  quickReplies: data.quickReplies.map((b) => (b.id === button.id ? { ...b, title: e.target.value } : b)),
                })
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remover botão"
              onClick={() => onChange({ ...data, quickReplies: data.quickReplies.filter((b) => b.id !== button.id) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Botões de link</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={totalButtons >= MAX_TEMPLATE_BUTTONS}
            onClick={() => onChange({ ...data, linkButtons: [...data.linkButtons, { id: shortId(), title: "", url: "https://" }] })}
          >
            <Plus className="size-4" /> Link
          </Button>
        </div>
        {usingTemplate && (
          <p className="text-xs text-muted-foreground">Com links, a Meta permite no máximo 3 botões no total e texto de até 640 caracteres.</p>
        )}
        {data.linkButtons.map((button) => (
          <div key={button.id} className="space-y-2 rounded-lg border p-2">
            <div className="flex gap-2">
              <Input
                value={button.title}
                maxLength={20}
                placeholder="Texto do botão"
                onChange={(e) =>
                  onChange({ ...data, linkButtons: data.linkButtons.map((b) => (b.id === button.id ? { ...b, title: e.target.value } : b)) })
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remover link"
                onClick={() => onChange({ ...data, linkButtons: data.linkButtons.filter((b) => b.id !== button.id) })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <Input
              type="url"
              value={button.url}
              placeholder="https://..."
              onChange={(e) =>
                onChange({ ...data, linkButtons: data.linkButtons.map((b) => (b.id === button.id ? { ...b, url: e.target.value } : b)) })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommentReplyForm({ data, onChange }: FormProps<CommentReplyNodeData>) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Resposta pública ao comentário. Uma variação é sorteada a cada vez, o que deixa as respostas mais naturais.
      </p>
      {data.texts.map((text, index) => (
        <div key={index} className="flex gap-2">
          <Textarea
            rows={2}
            value={text}
            maxLength={2200}
            onChange={(e) => onChange({ texts: data.texts.map((t, i) => (i === index ? e.target.value : t)) })}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Remover variação"
            disabled={data.texts.length <= 1}
            onClick={() => onChange({ texts: data.texts.filter((_, i) => i !== index) })}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange({ texts: [...data.texts, ""] })}>
        <Plus className="size-4" /> Variação
      </Button>
    </div>
  );
}

export function DelayForm({ data, onChange }: FormProps<DelayNodeData>) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          max={999}
          value={data.amount}
          onChange={(e) => onChange({ ...data, amount: Math.max(0, Number(e.target.value)) })}
          className="w-28"
        />
        <Select value={data.unit} onValueChange={(unit) => onChange({ ...data, unit: unit as DelayNodeData["unit"] })}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="seconds">Segundos</SelectItem>
            <SelectItem value="minutes">Minutos</SelectItem>
            <SelectItem value="hours">Horas</SelectItem>
            <SelectItem value="days">Dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Até 15 segundos o envio é imediato após a pausa. Acima disso o passo vai para a fila e é retomado pelo agendador (precisão de ~1 minuto).
        Lembre-se: a Meta só permite mensagens até 24h após a última mensagem do contato.
      </p>
    </div>
  );
}

function TagSelect({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { lookups } = useEditor();
  if (lookups.tags.length === 0) {
    return <p className="text-sm text-muted-foreground">Crie tags em “Contatos e tags” para usá-las aqui.</p>;
  }
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Escolha uma tag" />
      </SelectTrigger>
      <SelectContent>
        {lookups.tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} /> {tag.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TagForm({ data, onChange }: FormProps<TagNodeData>) {
  return (
    <div className="space-y-2">
      <Label>Tag</Label>
      <TagSelect value={data.tagId} onChange={(tagId) => onChange({ tagId })} />
    </div>
  );
}

export function ConditionForm({ data, onChange }: FormProps<ConditionNodeData>) {
  const updateRule = (id: string, patch: Partial<ConditionRule>) =>
    onChange({ ...data, rules: data.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const defaultOperator = (field: ConditionRule["field"]): ConditionRule["operator"] =>
    field === "tag" ? "has" : field === "is_follower" ? "is_true" : "contains";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Combinar regras</Label>
        <Select value={data.match} onValueChange={(match) => onChange({ ...data, match: match as ConditionNodeData["match"] })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as regras (E)</SelectItem>
            <SelectItem value="any">Qualquer regra (OU)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {data.rules.map((rule) => (
        <div key={rule.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <Select
              value={rule.field}
              onValueChange={(field) =>
                updateRule(rule.id, { field: field as ConditionRule["field"], operator: defaultOperator(field as ConditionRule["field"]), value: "" })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="is_follower">Segue o perfil</SelectItem>
                <SelectItem value="tag">Tag</SelectItem>
                <SelectItem value="message_text">Texto da mensagem</SelectItem>
                <SelectItem value="username">@usuário</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Remover regra"
              onClick={() => onChange({ ...data, rules: data.rules.filter((r) => r.id !== rule.id) })}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>

          {rule.field === "is_follower" && (
            <Select value={rule.operator} onValueChange={(operator) => updateRule(rule.id, { operator: operator as ConditionRule["operator"] })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="is_true">Sim, segue</SelectItem>
                <SelectItem value="is_false">Não segue</SelectItem>
              </SelectContent>
            </Select>
          )}

          {rule.field === "tag" && (
            <>
              <Select value={rule.operator} onValueChange={(operator) => updateRule(rule.id, { operator: operator as ConditionRule["operator"] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="has">Tem a tag</SelectItem>
                  <SelectItem value="not_has">Não tem a tag</SelectItem>
                </SelectContent>
              </Select>
              <TagSelect value={rule.value || null} onChange={(value) => updateRule(rule.id, { value })} />
            </>
          )}

          {(rule.field === "message_text" || rule.field === "username") && (
            <>
              <Select value={rule.operator} onValueChange={(operator) => updateRule(rule.id, { operator: operator as ConditionRule["operator"] })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="not_contains">Não contém</SelectItem>
                  <SelectItem value="equals">É igual a</SelectItem>
                </SelectContent>
              </Select>
              <Input value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder="valor" />
            </>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange({ ...data, rules: [...data.rules, { id: shortId(), field: "is_follower", operator: "is_true", value: "" }] })}
      >
        <Plus className="size-4" /> Regra
      </Button>
      <p className="text-xs text-muted-foreground">
        “Segue o perfil” é consultado na Meta no momento da execução. A Meta só libera essa informação depois que o contato envia uma mensagem ou toca em um botão.
      </p>
    </div>
  );
}

export function AiReplyForm({ data, onChange }: FormProps<AiReplyNodeData>) {
  const { lookups } = useEditor();
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Prompt</Label>
        <Select value={data.promptId ?? "default"} onValueChange={(v) => onChange({ ...data, promptId: v === "default" ? null : v })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Padrão da organização</SelectItem>
            {lookups.prompts.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Instruções extras (opcional)</Label>
        <Textarea
          rows={4}
          value={data.extraInstructions}
          maxLength={2000}
          placeholder="Ex.: ofereça o cupom BEMVINDO10 no final."
          onChange={(e) => onChange({ ...data, extraInstructions: e.target.value })}
        />
      </div>
    </div>
  );
}
