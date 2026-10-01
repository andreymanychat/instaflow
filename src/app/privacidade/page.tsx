import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Política de Privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="29/09/2026">
      <p>
        Esta política explica como o InstaFlow coleta, usa e protege dados ao oferecer automação de mensagens para contas profissionais do
        Instagram por meio da API oficial da Meta. Ela segue a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>Dados de cadastro dos usuários do painel: nome, email e senha (armazenada com hash pelo provedor de autenticação).</li>
        <li>Dados da conta profissional do Instagram conectada: ID, nome de usuário, nome, foto e número de seguidores.</li>
        <li>Token de acesso concedido pelo Instagram, armazenado criptografado (AES-256-GCM).</li>
        <li>
          Dados de quem interage com a conta conectada: ID de escopo do Instagram, nome de usuário, nome, foto, mensagens do Direct,
          comentários e se segue o perfil — somente quando essas pessoas interagem com a conta.
        </li>
      </ul>

      <h2>2. Como usamos os dados</h2>
      <ul>
        <li>Executar as automações configuradas pelo titular da conta (responder comentários e mensagens).</li>
        <li>Exibir o histórico de conversas na caixa de entrada.</li>
        <li>Gerar respostas com inteligência artificial quando o titular ativar esse recurso (o conteúdo da conversa é enviado à OpenAI apenas para gerar a resposta).</li>
        <li>Segurança, prevenção a abusos e diagnóstico de erros.</li>
      </ul>
      <p>Não vendemos dados pessoais e não os usamos para publicidade.</p>

      <h2>3. Compartilhamento</h2>
      <p>
        Usamos operadores necessários ao serviço: Supabase (banco de dados e autenticação), Vercel (hospedagem), Meta Platforms (API do
        Instagram) e OpenAI (quando a IA está ativa). Todos tratam dados apenas para prestar o serviço.
      </p>

      <h2>4. Retenção</h2>
      <p>
        Dados ficam armazenados enquanto a conta do Instagram estiver conectada. Ao desconectar a conta, remover o app nas configurações do
        Instagram ou solicitar a exclusão, apagamos contatos, conversas, comentários e tokens associados. Logs técnicos são mantidos por até 30 dias.
      </p>

      <h2>5. Seus direitos</h2>
      <p>
        Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento. Veja como em{" "}
        <Link href="/exclusao-de-dados" className="text-primary underline">Exclusão de dados</Link>.
      </p>

      <h2>6. Segurança</h2>
      <p>
        Aplicamos criptografia em trânsito (HTTPS) e em repouso para tokens, isolamento entre clientes com Row Level Security no banco e
        validação de assinatura em todos os webhooks recebidos da Meta.
      </p>

      <h2>7. Contato</h2>
      <p>Dúvidas sobre privacidade: entre em contato pelo email informado no cadastro do aplicativo na Meta.</p>
    </LegalPage>
  );
}
