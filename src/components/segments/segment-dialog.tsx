"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { previewSegmentCount, saveSegment } from "@/server/actions/contact-actions";

type Field = "tag" | "is_follower" | "last_interaction" | "instagram_account" | "username";
type Operator = "has" | "not_has" | "is_true" | "is_false" | "within_days" | "older_than_days" | "equals" | "contains";
type Rule = { id: string; field: Field; operator: Operator; value: string };
export type SegmentFilters = { match: "all" | "any"; rules: Rule[] };

type Lookups = { tags: { id: string; name: string; color: string }[]; accounts: { id: string; username: string }[] };

const FIELD_OPTIONS: { value: Field; label: string; operators: { value: Operator; label: string }[] }[] = [
  { value: "tag", label: "Tag", operators: [{ value: "has", label: "tem" }, { value: "not_has", label: "não tem" }] },
  { value: "is_follower", label: "Segue o perfil", operators: [{ value: "is_true", label: "sim" }, { value: "is_false", label: "não" }] },
  {
    value: "last_interaction",
    label: "Última interação",
    operators: [{ value: "within_days", label: "nos últimos (dias)" }, { value: "older_than_days", label: "há mais de (dias)" }],
  },
  { value: "instagram_account", label: "Conta do Instagram", operators: [{ value: "equals", label: "é" }] },
  { value: "username", label: "@usuário", operators: [{ value: "contains", label: "contém" }, { value: "equals", label: "é igual a" }] },
];

const newRule = (): Rule => ({ id: Math.random().toString(36).slice(2, 9), field: "tag", operator: "has", value: "" });

type Props = {
  lookups: Lookups;
  segment?: { id: string; name: string; description: string; filters: SegmentFilters };
};

export function SegmentDialog({ lookups, segment }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [filters, setFilters] = useState<SegmentFilters>(segment?.filters ?? { match: "all", rules: [newRule()] });
  const [count, setCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Pré-visualização do tamanho do segmento enquanto as regras são editadas
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const result = await previewSegmentCount(filters);
      setCount(result.ok ? result.data.count : null);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters, open]);

  const updateRule = (id: string, patch: Partial<Rule>) =>
    setFilters((f) => ({ ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const submit = () =>
    startTransition(async () => {
      const result = await saveSegment(segment?.id ?? null, { name, description, filters });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Segmento salvo.");
      setOpen(false);
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {segment ? (
          <Button size="sm" variant="ghost">
            <Pencil className="size-4" /> Editar
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" /> Novo segmento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{segment ? "Editar segmento" : "Novo segmento"}</DialogTitle>
          <DialogDescription>O segmento é recalculado automaticamente sempre que é usado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            Contatos que atendem a
            <Select value={filters.match} onValueChange={(match) => setFilters((f) => ({ ...f, match: match as "all" | "any" }))}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">todas as regras</SelectItem>
                <SelectItem value="any">qualquer regra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filters.rules.map((rule) => {
              const field = FIELD_OPTIONS.find((f) => f.value === rule.field)!;
              return (
                <div key={rule.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                  <Select
                    value={rule.field}
                    onValueChange={(value) => {
                      const next = FIELD_OPTIONS.find((f) => f.value === value)!;
                      updateRule(rule.id, { field: next.value, operator: next.operators[0].value, value: next.value === "last_interaction" ? "7" : "" });
                    }}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={rule.operator} onValueChange={(operator) => updateRule(rule.id, { operator: operator as Operator })}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.operators.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {rule.field === "tag" && (
                    <Select value={rule.value || undefined} onValueChange={(value) => updateRule(rule.id, { value })}>
                      <SelectTrigger className="min-w-36 flex-1">
                        <SelectValue placeholder="Escolha a tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookups.tags.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {rule.field === "instagram_account" && (
                    <Select value={rule.value || undefined} onValueChange={(value) => updateRule(rule.id, { value })}>
                      <SelectTrigger className="min-w-36 flex-1">
                        <SelectValue placeholder="Escolha a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {lookups.accounts.map((a) => (
                          <SelectItem key={a.id} value={a.id}>@{a.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {(rule.field === "last_interaction" || rule.field === "username") && (
                    <Input
                      className="min-w-24 flex-1"
                      type={rule.field === "last_interaction" ? "number" : "text"}
                      min={0}
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                    />
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover regra"
                    onClick={() => setFilters((f) => ({ ...f, rules: f.rules.filter((r) => r.id !== rule.id) }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setFilters((f) => ({ ...f, rules: [...f.rules, newRule()] }))}>
              <Plus className="size-4" /> Regra
            </Button>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {count === null ? "Calculando..." : `${count.toLocaleString("pt-BR")} contato(s) neste segmento`}
          </p>
          <Button onClick={submit} disabled={pending || name.trim().length < 2}>Salvar segmento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
