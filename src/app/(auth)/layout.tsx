import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-700 lg:block">
        <div className="absolute inset-0 flex flex-col justify-end p-12 text-white">
          <p className="text-3xl font-semibold leading-tight">
            Transforme comentários e mensagens do Instagram em vendas — no piloto automático.
          </p>
          <p className="mt-4 max-w-md text-white/80">
            Automações visuais, IA e caixa de entrada unificada usando apenas a API oficial da Meta.
          </p>
        </div>
      </div>
    </div>
  );
}
