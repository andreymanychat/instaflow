"use client";

const VARIABLES = [
  { key: "{{first_name}}", label: "primeiro nome" },
  { key: "{{name}}", label: "nome" },
  { key: "{{username}}", label: "@usuário" },
  { key: "{{last_text}}", label: "última mensagem" },
];

export function VariableHint({ onInsert }: { onInsert: (variable: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {VARIABLES.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(v.key)}
          className="rounded border bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={`Inserir ${v.label}`}
        >
          {v.key}
        </button>
      ))}
    </div>
  );
}
