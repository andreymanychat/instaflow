import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Diagnóstico rápido de configuração (não expõe valores, só se estão presentes). */
export async function GET() {
  const envs = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "INSTAGRAM_APP_ID",
    "INSTAGRAM_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN",
    "TOKEN_ENCRYPTION_KEY",
    "CRON_SECRET",
    "OPENAI_API_KEY",
    "ASAAS_API_KEY",
    "ASAAS_WEBHOOK_TOKEN",
  ];
  const configured = Object.fromEntries(envs.map((key) => [key, Boolean(process.env[key])]));

  let database = false;
  try {
    const { error } = await createAdminClient().from("plans").select("id").limit(1);
    database = !error;
  } catch {
    database = false;
  }

  return NextResponse.json({
    ok: database,
    database,
    env: configured,
    billingEnvironment: process.env.ASAAS_ENVIRONMENT ?? "sandbox",
  });
}
