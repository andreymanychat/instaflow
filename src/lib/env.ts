import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente do servidor, validadas de forma preguiçosa.
 * A validação ocorre no primeiro acesso para não quebrar o build quando
 * alguma integração opcional (ex.: OpenAI, Stripe) ainda não foi configurada.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  INSTAGRAM_APP_ID: z.string().min(5),
  INSTAGRAM_APP_SECRET: z.string().min(10),
  /** Opcional: chave secreta do app Meta (Configurações → Básico), aceita como alternativa na validação de assinaturas. */
  META_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().min(16),
  META_GRAPH_API_VERSION: z.string().default("v23.0"),

  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY deve ter 64 caracteres hex (32 bytes)"),
  CRON_SECRET: z.string().min(16),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_DEFAULT_MODEL: z.string().default("gpt-5-mini"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const isOpenAIConfigured = () => Boolean(process.env.OPENAI_API_KEY);
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
