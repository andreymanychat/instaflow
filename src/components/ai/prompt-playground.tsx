"use client";

import { useState, useTransition } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { testPrompt } from "@/server/actions/ai-actions";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string };

export function PromptPlayground({ prompts }: { prompts: { id: string; name: string }[] }) {
  const [promptId, setPromptId] = useState(prompts[0]?.id ?? "");
  const [history, setHistory] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  const send = () => {
    const content = text.trim();
    if (!content || !promptId) return;
    const next: Turn[] = [...history, { role: "user", content }];
    setHistory(next);
    setText("");
    startTransition(async () => {
      const result = await testPrompt(promptId, next);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setHistory([...next, { role: "assistant", content: result.data.text }]);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Testar prompt</CardTitle>
          <CardDescription>Simule uma conversa. Nada é enviado ao Instagram (as chamadas à OpenAI são cobradas normalmente).</CardDescription>
        </div>
        <div className="flex gap-2">
          <Select value={promptId} onValueChange={setPromptId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {prompts.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Reiniciar" onClick={() => setHistory([])}>
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-72 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
          {history.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">Envie uma mensagem como se fosse um cliente.</p>}
          {history.map((turn, i) => (
            <div key={i} className={cn("flex", turn.role === "user" ? "justify-start" : "justify-end")}>
              <p
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm",
                  turn.role === "user" ? "bg-background" : "bg-primary text-primary-foreground",
                )}
              >
                {turn.content}
              </p>
            </div>
          ))}
          {pending && (
            <div className="flex justify-end">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Qual o horário de funcionamento?" />
          <Button type="submit" disabled={pending || !text.trim()} aria-label="Enviar">
            <Send className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
