# Como testar cada funcionalidade

## Testes automatizados

```bash
npm test          # palavras-chave, variáveis, IDs grandes, CPF/CNPJ, carteira e períodos de cobrança
npm run test:db   # migração + RLS multi-tenant num Postgres embutido (planos, carteira, cartões, privacidade do perfil)
npm run typecheck
npm run lint
npm run build
```

## Testes sem a Meta (simulador de webhooks)

Com `npm run dev` rodando e o `.env.local` preenchido (incluindo `INSTAGRAM_APP_SECRET`), pegue o `ig_user_id`
da conta conectada (Supabase → Table Editor → `instagram_accounts`) e rode:

```bash
npm run simulate -- dm "quero o preço" --ig 17841400000000000
npm run simulate -- comment "quero" --ig 17841400000000000 --username maria
npm run simulate -- story "amei!" --ig 17841400000000000
```

O webhook é assinado exatamente como a Meta faz. Você verá o contato, a conversa, a execução do fluxo e os logs.
Como o remetente é fictício, o **envio** da resposta à Meta falha (aparece como "não entregue" na inbox) —
o restante do pipeline é exercitado de ponta a ponta.

Para testar clique em botão, copie o payload `r:<runId>:<nodeId>:<buttonId>` de `messages.payload` e rode:
```bash
npm run simulate -- click "r:<runId>:<nodeId>:<buttonId>" --ig <IG_USER_ID> --title "Quero o link"
```

## Roteiro manual (com uma conta testadora real)

Use **outra** conta do Instagram (não a conectada) para comentar e mandar DMs.

| # | Funcionalidade | Como testar | Resultado esperado |
|---|---|---|---|
| 1 | Cadastro | `/signup` → confirmar email | Redireciona para `/onboarding` |
| 2 | Login / logout | `/login`, menu do usuário → Sair | Sessão criada/encerrada; `/dashboard` sem login redireciona |
| 3 | Recuperar senha | `/forgot-password` → link do email | Abre `/reset-password` e troca a senha |
| 4 | Multiempresa | Menu da organização → Nova organização; alternar | Dados isolados por organização |
| 5 | Multiusuário | Config → Equipe → gerar convite → abrir link em outra conta | Novo membro aparece com o papel escolhido |
| 6 | Conectar Instagram | Config → Instagram → Conectar | Conta com "Recebendo eventos" e validade do token |
| 7 | Webhook | Envie uma DM para a conta | Aparece em `/inbox` em tempo real e em Logs → Webhooks brutos |
| 8 | Palavra-chave DM | Modelo "Palavra-chave no Direct" (preço/valor) → Ativar → envie "qual o valor?" | Mensagem, pausa de 3s, segunda mensagem com botões |
| 9 | Comentário → DM | Modelo "Comentário → Direct" → Ativar → comente "quero" num post | Resposta pública sorteada + DM privada com botão |
| 10 | Botões / janela 24h | Toque em "Quero o link" | Chega a mensagem com botão de link; tag aplicada (se escolhida) |
| 11 | Fluxo condicional | Modelo "Link só para seguidores" → teste seguindo e sem seguir | Caminho "Sim"/"Não" conforme segue o perfil |
| 12 | Delay longo | Passo Aguardar 2 minutos entre duas mensagens | Execução fica "Aguardando delay" em Logs → Execuções e continua em ~2 min (requer `cron.sql`) |
| 13 | Tags | Contatos → Gerenciar tags; adicione/remova no contato ou via fluxo | Tag aparece no contato e na inbox |
| 14 | Segmentação | Segmentos → Novo (ex.: tem tag X E interagiu em 7 dias) | Contagem ao vivo; "Ver contatos" filtra a lista |
| 15 | Caixa de entrada | Responda pelo painel | Mensagem entregue; banner "Atendimento humano" pausa o bot |
| 16 | Human takeover pelo app | Responda pelo app do Instagram | Mensagem aparece como "Atendente" e o bot pausa |
| 17 | IA automática | IA → crie um prompt → ative "IA no Direct" → mande uma pergunta sem palavra-chave | Resposta gerada pela IA (marcada "IA") |
| 18 | Passo de IA no fluxo | Adicione "Resposta com IA" num fluxo | Resposta gerada dentro do fluxo |
| 19 | Sugestão de IA | Inbox → ✨ | Texto sugerido no campo, editável antes de enviar |
| 20 | Playground | IA → Testar prompt | Conversa simulada sem enviar ao Instagram |
| 21 | Resposta padrão | Modelo "Resposta padrão com IA" com IA automática desligada | Dispara 1x a cada 24h por contato |
| 22 | Story | Modelo "Resposta a Stories" → responda um story | DM de agradecimento |
| 23 | Logs | `/logs` → Eventos / Execuções / Webhooks brutos | Filtros por nível e origem |
| 24 | Limites do plano | Ative 2 automações no plano Free | Erro "Seu plano permite 1 automação(ões) ativa(s)" |
| 25 | Assinatura | `/billing` | Uso vs. limites e os planos Free/Pro/Business ("Em breve" sem `ASAAS_API_KEY`) |
| 25a | Tema | Menu do usuário → Tema → Escuro/Claro/Sistema | Interface troca na hora e lembra a escolha |
| 25b | Perfil | Minha conta → CPF inválido; CEP 01310-100 | CPF recusado; endereço preenchido pelo CEP |
| 25c | Foto | Minha conta → Enviar foto (PNG até 2 MB) | Foto aparece no menu lateral |
| 25d | Checkout cartão | `/billing` → Assinar Pro → cartão de teste do sandbox | Plano Pro ativo, renovação em 1 mês, cartão salvo |
| 25e | Checkout Pix | Assinar Business → Pix → confirmar no painel do Asaas | Tela confirma sozinha em até 5s |
| 25f | Carteira | Carteira → Adicionar saldo R$ 20 via Pix → pagar | Saldo R$ 20 e extrato; usado na próxima assinatura |
| 25g | Indique e ganhe | Assinante gera link → abrir em aba anônima → cadastrar → assinar | Quem indicou recebe R$ 10 na carteira |
| 25h | Renovação | Ajuste `current_period_end` para daqui a 2 dias e chame `/api/cron/billing` | Pix de renovação gerado (sem cartão) |
| 25i | Inadimplência | Ajuste `current_period_end` para o passado e chame o cron | Organização volta ao Free e automações excedentes pausadas |
| 25j | Excluir conta | Minha conta → Excluir conta → digitar o email | Login, organizações (só dono) e dados apagados |
| 26 | Renovação de token | `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://seuprojeto.vercel.app/api/cron/refresh-tokens` | `{"ok":true,"checked":N,"refreshed":M}` |
| 27 | Desautorização | Instagram → Apps e sites → remover o app | Conta fica "Acesso removido — reconecte" |
| 28 | Exclusão de dados | Remover o app marcando exclusão | Conta e dados apagados; `/exclusao-de-dados?codigo=...` mostra o status |

## Endpoints úteis

```bash
# Verificação do webhook (deve devolver 123)
curl "https://seuprojeto.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=SEU_TOKEN&hub.challenge=123"

# Diagnóstico
curl https://seuprojeto.vercel.app/api/health

# Processar a fila manualmente
curl -X POST -H "Authorization: Bearer SEU_CRON_SECRET" https://seuprojeto.vercel.app/api/cron/process-jobs
```
