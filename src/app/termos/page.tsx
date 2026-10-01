import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Termos de Serviço" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de Serviço" updatedAt="29/09/2026">
      <p>Ao usar o InstaFlow você concorda com estes termos.</p>

      <h2>1. O serviço</h2>
      <p>
        O InstaFlow é uma ferramenta de automação de mensagens para contas profissionais do Instagram que funciona exclusivamente por meio das
        APIs oficiais da Meta. A disponibilidade de recursos depende das políticas e da disponibilidade da própria Meta.
      </p>

      <h2>2. Responsabilidades do usuário</h2>
      <ul>
        <li>Cumprir os Termos da Plataforma Meta, as Diretrizes da Comunidade do Instagram e a legislação aplicável (incluindo a LGPD e o CDC).</li>
        <li>Não enviar spam, conteúdo enganoso, ilegal ou que viole direitos de terceiros.</li>
        <li>Manter suas credenciais seguras e responder pelos atos praticados em sua conta.</li>
        <li>Revisar o conteúdo gerado por inteligência artificial antes de usá-lo em contextos sensíveis.</li>
      </ul>

      <h2>3. Planos e limites</h2>
      <p>Cada plano possui limites de uso. Ao atingir um limite, alguns recursos podem ser pausados até o upgrade ou o próximo ciclo.</p>

      <h2>4. Suspensão</h2>
      <p>Podemos suspender contas que violem estes termos ou as políticas da Meta, ou que coloquem em risco a segurança da plataforma.</p>

      <h2>5. Limitação de responsabilidade</h2>
      <p>
        O serviço é fornecido “no estado em que se encontra”. Não nos responsabilizamos por indisponibilidades da Meta, bloqueios aplicados pela
        Meta à conta do usuário ou perdas decorrentes do uso inadequado das automações.
      </p>

      <h2>6. Alterações</h2>
      <p>Estes termos podem ser atualizados. Mudanças relevantes serão comunicadas no painel.</p>
    </LegalPage>
  );
}
