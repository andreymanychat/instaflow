import Link from "next/link";
import { Bot, Check, GitBranch, Inbox, MessageSquareReply, ShieldCheck, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/server/auth/session";
import { cn, formatCurrency } from "@/lib/utils";

const FEATURES = [
  { icon: MessageSquareReply, title: "Comentário → Direct", text: "Responda comentários publicamente e envie o link no Direct na hora." },
  { icon: GitBranch, title: "Construtor visual", text: "Fluxos com botões, condições, delays e tags — arraste e conecte." },
  { icon: Bot, title: "IA com seus prompts", text: "Respostas naturais com OpenAI, treinadas com as informações do seu negócio." },
  { icon: Inbox, title: "Caixa de entrada", text: "Todas as conversas em tempo real, com pausa automática do bot quando um humano assume." },
  { icon: Tags, title: "Tags e segmentos", text: "Organize contatos e crie públicos dinâmicos por comportamento." },
  { icon: ShieldCheck, title: "API oficial da Meta", text: "Sem senha, sem risco de bloqueio: login oficial do Instagram e webhooks assinados." },
];

export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const { conta } = await searchParams;
  const user = await getUser();
  const supabase = await createClient();
  const { data: plans } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#precos">Preços</Link>
          </Button>
          {user ? (
            <Button asChild>
              <Link href="/dashboard">Abrir painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Começar grátis</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        {conta === "excluida" && (
          <p className="mx-auto mt-4 max-w-xl rounded-lg border px-4 py-3 text-center text-sm text-muted-foreground">
            Sua conta e todos os dados criados por ela foram excluídos.
          </p>
        )}
        <section className="mx-auto max-w-4xl px-4 py-20 text-center md:py-28">
          <span className="rounded-full border px-3 py-1 text-xs text-muted-foreground">Automação oficial para Instagram</span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-6xl">
            Cada comentário vira uma{" "}
            <span className="bg-gradient-to-r from-fuchsia-500 via-violet-600 to-indigo-600 bg-clip-text text-transparent">conversa</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Automatize respostas a comentários, DMs e stories com fluxos visuais e inteligência artificial. Multiusuário, multiempresa e 100% via API oficial da Meta.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href={user ? "/dashboard" : "/signup"}>Criar conta grátis</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#recursos">Ver recursos</Link>
            </Button>
          </div>
        </section>

        <section id="recursos" className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 md:px-6 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border p-6">
              <feature.icon className="size-6 text-primary" />
              <h2 className="mt-4 font-semibold">{feature.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </section>

        <section id="precos" className="mx-auto max-w-6xl px-4 pb-24 md:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Planos simples, sem fidelidade</h2>
          <p className="mt-2 text-center text-muted-foreground">Comece grátis. Pague com cartão de crédito ou Pix quando precisar de mais.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {plans?.map((plan) => (
              <div key={plan.id} className={cn("flex flex-col rounded-xl border p-6", plan.id === "pro" && "border-primary ring-1 ring-primary")}>
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-4 text-3xl font-semibold">
                  {plan.price_cents === 0 ? "Grátis" : formatCurrency(plan.price_cents, plan.currency)}
                  {plan.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {feature}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={plan.id === "pro" ? "default" : "outline"}>
                  <Link href={user ? "/billing" : "/signup"}>{plan.price_cents === 0 ? "Começar grátis" : `Assinar o ${plan.name}`}</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground md:px-6">
          <span>© {new Date().getFullYear()} ChatFlow</span>
          <nav className="flex gap-4">
            <Link href="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link href="/termos" className="hover:text-foreground">Termos</Link>
            <Link href="/exclusao-de-dados" className="hover:text-foreground">Exclusão de dados</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
