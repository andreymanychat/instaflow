/** Instruções de exclusão de dados (exigidas pela Meta), compartilhadas pelas páginas públicas. */
export function DataDeletionInstructions() {
  return (
    <>
      <p>Você pode pedir a exclusão dos seus dados de três formas:</p>

      <h2>1. Pelo Instagram (automático)</h2>
      <ul>
        <li>Abra o Instagram → Configurações e privacidade → Apps e sites.</li>
        <li>Encontre o app “ChatFlow” em “Ativos” e toque em “Remover”.</li>
        <li>Marque a opção para excluir os dados. A Meta nos avisa e apagamos automaticamente a conta conectada, contatos, conversas e comentários.</li>
      </ul>

      <h2>2. Pelo painel (titulares de conta)</h2>
      <p>Em Configurações → Instagram, clique em “Desconectar”. Todos os dados vinculados àquela conta são apagados imediatamente.</p>

      <h2>3. Por solicitação</h2>
      <p>
        Se você interagiu com uma empresa que usa a plataforma e quer que seus dados sejam removidos, envie um email para o contato informado no
        cadastro do aplicativo na Meta com seu @ do Instagram. Atendemos em até 15 dias, conforme a LGPD.
      </p>
    </>
  );
}
