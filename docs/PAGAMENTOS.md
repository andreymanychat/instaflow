# Planos, pagamentos, carteira e indicações

## Planos

| | Free | Pro | Business |
|---|---|---|---|
| Preço | R$ 0 | R$ 57,00/mês | R$ 97,00/mês |
| Contas do Instagram | 1 | 2 | 5 |
| Contatos | 500 | 1.000 | 50.000 |
| Automações ativas | 1 | 5 | ilimitadas |
| Respostas de IA/mês | 20 | 200 | 50.000 |
| Membros na equipe | 1 | 3 | 10 |
| Segmentação avançada | — | ✓ | ✓ |
| Suporte prioritário | — | — | ✓ |

Os limites ficam na tabela `plans` (coluna `limits`) e são aplicados em `plan-service.ts`.
Toda organização nasce no Free.

## Por que Asaas

Cartão de crédito **e** Pix com uma única API, cliente brasileiro com CPF/CNPJ, tokenização de cartão
(o número nunca é guardado pelo ChatFlow) e webhooks com reenvio automático.

## Fluxos

**Assinatura** (`/billing` → Assinar):
1. Exige cadastro completo em **Minha conta** (CPF/CNPJ válido, telefone, endereço) — o Asaas exige esses dados.
2. **Saldo da carteira primeiro**, diferença no cartão ou Pix. Se a diferença ficar abaixo de R$ 5,00
   (mínimo do Asaas), usa-se um pouco menos de saldo.
3. Cartão aprovado → plano ativo na hora. Pix → QR Code na tela, confirmação automática (webhook + consulta a cada 5s).
4. Período de 1 mês. Trocar de plano começa um novo período (sem proporcional).

**Renovação** (agendador de hora em hora, `/api/cron/billing`):
- 3 dias antes: se não houver cartão nem saldo suficiente, gera um Pix com vencimento no dia da renovação
  (o Asaas envia o Pix por email ao cliente e ele aparece em `/billing`).
- No vencimento: usa o saldo; a diferença vai para o cartão padrão.
- **Sem pagamento no vencimento → volta ao Free na hora**, e as automações acima do limite do Free são pausadas.
  Pagar o Pix depois reativa o plano.
- "Cancelar assinatura" mantém o plano até o fim do período e então volta ao Free.

**Carteira** (`/account/wallet`): saldo por usuário, recarga via Pix (mínimo R$ 10), extrato e cartões salvos.

**Indique e ganhe** (`/account/referrals`): assinantes Pro/Business geram um link `/r/<código>` válido por **3 dias**.
Quem se cadastra pelo link fica vinculado; quando assinar um plano pago pela primeira vez, quem indicou
recebe **R$ 10,00** na carteira (uma vez por indicado, idempotente).

**Convite de equipe** (Configurações → Equipe): continua existindo, agora expira em 3 dias.

## Segurança

- Dados do cartão passam pelo servidor apenas em memória até a tokenização no Asaas; não são gravados nem logados.
  O banco guarda só `token`, bandeira e final — e a coluna `token` não é legível pelo navegador (grant por coluna).
- CPF, telefone e endereço não são visíveis para colegas de organização (grant por coluna em `profiles`).
- Saldo só muda pela função `wallet_apply` (service_role), atômica e idempotente por referência.
- Webhook autenticado pelo header `asaas-access-token`; cada evento é gravado em `billing_events` com o id do Asaas
  (eventos repetidos são ignorados) e processado depois da resposta 200.

## Configurar (sandbox → produção)

1. Crie a conta em <https://sandbox.asaas.com> e, em **Integrações → Chave de API**, gere a chave.
2. Cadastre uma **chave Pix** na conta (necessária para gerar QR Codes).
3. Na Vercel (e no `.env.local`): `ASAAS_API_KEY`, `ASAAS_ENVIRONMENT=sandbox`, `ASAAS_WEBHOOK_TOKEN` (gere com
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Redeploy.
4. Asaas → **Integrações → Webhooks → Adicionar**: URL `https://SEU-APP/api/billing/webhook`, token de autenticação =
   `ASAAS_WEBHOOK_TOKEN`, versão v3, fila ativa, eventos de **Cobranças** (no mínimo: PAYMENT_CONFIRMED,
   PAYMENT_RECEIVED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED, PAYMENT_CREDIT_CARD_CAPTURE_REFUSED,
   PAYMENT_REPROVED_BY_RISK_ANALYSIS, PAYMENT_CHARGEBACK_REQUESTED).
5. Rode o `supabase/cron.sql` atualizado (inclui o job `instaflow-billing`).
6. Teste: no sandbox, pague o Pix pelo painel do Asaas (abra a cobrança → confirmar recebimento) e, para cartão, use os
   [cartões de teste do sandbox](https://docs.asaas.com/docs/como-testar-funcionalidades) (validade futura, qualquer CVV).
7. Produção: crie a conta em <https://www.asaas.com>, troque a chave e `ASAAS_ENVIRONMENT=production`, refaça o webhook.
   A tokenização de cartão em produção precisa ser habilitada pelo Asaas (solicite ao gerente da conta).

## Nota fiscal automática (NFS-e)

Cada cobrança paga no Asaas (Pix ou cartão) gera uma NFS-e agendada pela API (`POST /v3/invoices`), vinculada à cobrança.
A parte paga com saldo da carteira não gera nova nota (recargas já têm nota própria; crédito de indicação é desconto).
Ative preenchendo `ASAAS_INVOICE_CONFIG` com os dados do contador (código/nome do serviço municipal e alíquotas) e
configurando as informações fiscais na conta do Asaas (Notas fiscais → Configurações). O status aparece em
`payments.invoice_status` e erros da prefeitura vão para Logs. Inclua os eventos `INVOICE_*` no webhook.

## Virada para produção (checklist)

1. Conta de produção aprovada no Asaas (PJ), conta bancária PJ para saques, tokenização de cartão liberada pelo gerente.
2. Informações fiscais configuradas no Asaas e `ASAAS_INVOICE_CONFIG` definida.
3. Rodar `supabase/go-live-asaas.sql` (apaga só dados de cobrança do sandbox: clientes, cartões, pagamentos, saldos de teste).
4. Na Vercel: `ASAAS_API_KEY` = chave de produção, `ASAAS_ENVIRONMENT=production` → redeploy.
5. Criar a chave Pix e o webhook (com eventos `PAYMENT_*` e `INVOICE_*`) na conta de produção.
6. Fazer uma assinatura real de R$ 57 com seu cartão, conferir a nota e estornar pelo painel do Asaas se quiser.

Referências: [notas fiscais](https://docs.asaas.com/docs/emitindo-notas-fiscais-de-servico), [cobranças](https://docs.asaas.com/reference/criar-nova-cobranca),
[tokenização](https://docs.asaas.com/docs/tokenizacao-de-cartao-de-credito),
[QR Code Pix](https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix),
[webhooks](https://docs.asaas.com/docs/sobre-os-webhooks).
