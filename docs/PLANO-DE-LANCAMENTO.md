# Plano de lançamento do ChatFlow

Como usar: digite o comando da escolha no chat (ex.: `fazer 7`). Dá para pedir várias de uma vez (`fazer 9 10 11`),
ver o andamento (`status`) ou pular um item (`pular 12`).

Legenda: **Quem** = quem executa. Você = só você pode fazer (pagamento, documentos, login pessoal);
Eu = faço no código/servidor; Juntos = eu preparo e abro as telas, você confirma.

## Fase 1 — Destravar a venda (caminho crítico)

| # | O que | Quem | Tempo | Status | Comando |
|---|---|---|---|---|---|
| 1 | Verificação da empresa na Meta (Business Verification): CNPJ, documentos, domínio/email | Juntos | 1–10 dias (análise da Meta) | 🟡 enviado em 02/10 — "Em análise" (~2 dias úteis). App ligado ao portfólio A M R Ribeiro | `fazer 1` |
| 2 | Análise do app na Meta (App Review) para as 3 permissões do Instagram: textos, roteiro do vídeo e envio | Juntos | 3–15 dias (análise da Meta) | ⬜ | `fazer 2` |
| 3 | Vercel Pro (uso comercial exige) | Você paga, eu confiro | 10 min | ⬜ | `fazer 3` |
| 4 | Supabase Pro + proteção contra senhas vazadas | Você paga, eu configuro | 15 min | ⬜ | `fazer 4` |
| 5 | Email próprio para cadastro/senha (Resend + SMTP no Supabase) | Juntos | 30 min (+ DNS) | ⬜ | `fazer 5` |
| 6 | Asaas produção: conta PJ, chave de produção, liberar cartão, nota fiscal (NFS-e) automática | Juntos | 1–5 dias (análise do Asaas) | 🟡 conta PJ criada (A M R Ribeiro, andreymanychat) — documentos em análise (03/10). Serviço NFS-e: 01.05.01 (São Luís). Código pronto | `fazer 6` |
| 7 | Teste completo no sandbox: perfil → assinar Pro com Pix e cartão → webhook → recarga → indicação | Juntos | 30 min | ✅ 02/10 — 9 testes ok; 5 bugs corrigidos | `fazer 7` |

## Fase 2 — Essencial antes do primeiro cliente pagante

| # | O que | Quem | Tempo | Status | Comando |
|---|---|---|---|---|---|
| 8 | Termos de uso e privacidade com cobrança recorrente, cancelamento, arrependimento de 7 dias (CDC art. 49) e LGPD | Eu redijo (revisão de advogado recomendada) | 1 h | ⬜ | `fazer 8` |
| 9 | Antifraude no checkout: Cloudflare Turnstile + limite de tentativas por usuário/IP | Eu | 1–2 h | ⬜ | `fazer 9` |
| 10 | Emails do sistema: boas-vindas, pagamento aprovado/recusado, Pix de renovação, voltou ao Free | Eu (após o item 5) | 2–3 h | ⬜ | `fazer 10` |
| 11 | Retentativa do cartão (1–2 tentativas em 3 dias) antes de voltar ao Free | Eu (você decide a regra) | 1–2 h | ⬜ | `fazer 11` |
| 12 | Revisar cota de IA do Business (50.000/mês pode custar mais que R$ 97) e preços | Você decide, eu aplico | 15 min | ⬜ | `fazer 12` |

## Fase 3 — Aguentar 1.000 assinaturas

| # | O que | Quem | Tempo | Status | Comando |
|---|---|---|---|---|---|
| 13 | Agendador em lotes e em paralelo (fila de delays, tokens do Instagram, renovações) | Eu | 2–3 h | ⬜ | `fazer 13` |
| 14 | Limpeza/retenção automática de mensagens, comentários e execuções antigas | Eu | 1 h | ⬜ | `fazer 14` |
| 15 | Painel administrativo: clientes, assinaturas, créditos, estornos, trocar plano | Eu | 4–6 h | ⬜ | `fazer 15` |
| 16 | Monitoramento: Sentry + alertas (webhook falhando, renovação com erro, fila parada) | Juntos | 1–2 h | ⬜ | `fazer 16` |

## Fase 4 — Vender mais e mais rápido

| # | O que | Quem | Tempo | Status | Comando |
|---|---|---|---|---|---|
| 17 | Domínio próprio (ex.: chatflow.com.br) + email profissional | Você compra, eu configuro | 1 h (+ DNS) | ⬜ | `fazer 17` |
| 18 | Página de vendas: depoimentos, demonstração em vídeo, perguntas frequentes, botão de WhatsApp | Eu | 2–3 h | ⬜ | `fazer 18` |
| 19 | Plano anual com desconto (ex.: 2 meses grátis) — caixa antecipado | Eu | 2 h | ⬜ | `fazer 19` |
| 20 | Teste grátis do Pro por 7 dias (sem cartão) para aumentar conversão | Eu | 2 h | ⬜ | `fazer 20` |
| 21 | Onboarding guiado: conectar Instagram → criar 1ª automação a partir de modelo em 3 minutos | Eu | 2–3 h | ⬜ | `fazer 21` |

## Ordem recomendada para monetizar mais rápido

1. **Hoje:** `fazer 1` e `fazer 6` (as análises da Meta e do Asaas demoram — quanto antes começar, melhor) + `fazer 7`.
2. **Enquanto a Meta e o Asaas analisam:** `fazer 3 4 5`, depois `fazer 8 9 10 11 12`.
3. **Com a verificação da Meta aprovada:** `fazer 2`.
4. **Aprovado na Meta + Asaas produção:** abrir vendas. Em paralelo, `fazer 13 14 16` e depois `fazer 18 19 20 21 17 15`.
