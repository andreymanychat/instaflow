import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

type Point = { day: string; inbound: number; outbound: number };

/** Gráfico de barras agrupadas em CSS puro: leve e sem dependência extra. */
export function ActivityChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.inbound, d.outbound)));

  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem dados ainda.</p>;
  }

  return (
    <div>
      <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Mensagens recebidas e enviadas por dia">
        {data.map((point) => (
          <div key={point.day} className="group relative flex h-full flex-1 items-end justify-center gap-0.5">
            <div className="w-1/2 rounded-t bg-primary/80" style={{ height: `${(point.inbound / max) * 100}%` }} />
            <div className="w-1/2 rounded-t bg-fuchsia-400/70" style={{ height: `${(point.outbound / max) * 100}%` }} />
            <div className="pointer-events-none absolute -top-10 z-10 hidden whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow group-hover:block">
              {point.inbound} recebidas · {point.outbound} enviadas
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] text-muted-foreground">
        {data.map((point, i) => (
          <span key={point.day} className="flex-1 text-center">
            {i % 2 === 0 ? format(parseISO(point.day), "dd/MM", { locale: ptBR }) : ""}
          </span>
        ))}
      </div>
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary/80" /> Recebidas</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-fuchsia-400/70" /> Enviadas</span>
      </div>
    </div>
  );
}
