import Link from "next/link";
import { Bot, GitBranch, Inbox, MessageSquareReply, ShieldCheck, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { getUser } from "@/server/auth/session";

const FEATURES = [
  { icon: MessageSquareReply, title: "Comentário → Direct", text: "Responda comentários publicamente e envie o link no Direct na hora." },
  { icon: GitBranch, title: "Construtor visual", text: "Fluxos com botões, condições, delays e tags — arraste e conecte." },
  { icon: Bot, title: "IA com seus prompts", text: "Respostas naturais com OpenAI, treinadas com as informações do seu negócio." },
  { icon: Inbox, title: "Caixa de entrada", text: "Todas as conversas em tempo real, com pausa automática do bot quando um humano assume." },
  { icon: Tags, title: "Tags e segmentos", text: "Organize contatos e crie públicos dinâmicos por comportamento." },
  { icon: ShieldCheck, title: "API oficial da Meta", text: "Sem senha, sem risco de bloqueio: login oficial do Instagram e webhooks assinados." },
];

export default async function LandingPage() {
  const user = await getUser();

  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
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
