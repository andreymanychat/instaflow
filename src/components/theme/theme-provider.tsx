"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Tema claro/escuro via classe `.dark` no <html>. A escolha fica salva no navegador. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
