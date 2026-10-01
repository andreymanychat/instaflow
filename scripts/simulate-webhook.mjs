#!/usr/bin/env node
/**
 * Simula webhooks da Meta assinados com INSTAGRAM_APP_SECRET, para testar
 * gatilhos, fluxos, inbox e logs sem precisar comentar/enviar DM de verdade.
 *
 * Uso:
 *   node scripts/simulate-webhook.mjs dm "quero o link" --ig <IG_USER_ID> [--from 999] [--url http://localhost:3000]
 *   node scripts/simulate-webhook.mjs comment "quero" --ig <IG_USER_ID> [--media 123] [--username fulano]
 *   node scripts/simulate-webhook.mjs story "amei" --ig <IG_USER_ID>
 *   node scripts/simulate-webhook.mjs click "<payload do botão>" --ig <IG_USER_ID> --title "Quero o link"
 *
 * <IG_USER_ID> é o ig_user_id da conta conectada (tabela instagram_accounts).
 * Obs.: como o remetente é fictício, o ENVIO da resposta para a Meta falha —
 * mas gatilho, execução do fluxo, contato, inbox e logs são exercitados de ponta a ponta.
 */
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const [, , kind, text = "", ...rest] = process.argv;
const flags = Object.fromEntries(
  rest.reduce((acc, value, i, arr) => (value.startsWith("--") ? [...acc, [value.slice(2), arr[i + 1]]] : acc), []),
);

const secret = process.env.INSTAGRAM_APP_SECRET;
const igUserId = flags.ig;
const baseUrl = flags.url ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const senderId = flags.from ?? "9990001112223";

if (!secret || !igUserId || !["dm", "comment", "story", "click"].includes(kind)) {
  console.error("Uso: node scripts/simulate-webhook.mjs <dm|comment|story|click> \"texto\" --ig <IG_USER_ID>");
  console.error("Requer INSTAGRAM_APP_SECRET no ambiente ou em .env.local");
  process.exit(1);
}

const now = Date.now();
const entry = { id: igUserId, time: Math.floor(now / 1000) };

if (kind === "comment") {
  entry.changes = [
    {
      field: "comments",
      value: {
        id: `sim_${randomUUID()}`,
        text,
        from: { id: senderId, username: flags.username ?? "cliente_teste" },
        media: { id: flags.media ?? "sim_media_1", media_product_type: "FEED" },
      },
    },
  ];
} else {
  const message =
    kind === "click"
      ? { mid: `sim_${randomUUID()}`, text: flags.title ?? "Botão", quick_reply: { payload: text } }
      : { mid: `sim_${randomUUID()}`, text, ...(kind === "story" ? { reply_to: { story: { id: "sim_story", url: "https://example.com" } } } : {}) };
  entry.messaging = [{ sender: { id: senderId }, recipient: { id: igUserId }, timestamp: now, message }];
}

const body = JSON.stringify({ object: "instagram", entry: [entry] });
const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const response = await fetch(`${baseUrl}/api/webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature },
  body,
});
console.log(`${response.status} ${await response.text()}`);
console.log("Acompanhe o resultado em /logs e /inbox.");
