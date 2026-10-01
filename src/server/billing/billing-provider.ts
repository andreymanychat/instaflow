import "server-only";
import { isStripeConfigured } from "@/lib/env";

/**
 * Abstração de cobrança. Hoje só existe o provedor "manual" (planos alterados
 * pelo banco). Para ativar o Stripe:
 *   1. npm i stripe
 *   2. implemente StripeBillingProvider (checkout + portal) com a mesma interface
 *   3. preencha plans.stripe_price_id e as envs STRIPE_*
 *   4. trate os eventos em /api/billing/webhook atualizando organizations.*
 * Nenhuma tela precisa mudar: elas dependem apenas desta interface.
 */
export interface BillingProvider {
  readonly name: string;
  readonly enabled: boolean;
  createCheckoutSession(params: { organizationId: string; planId: string; customerEmail: string }): Promise<{ url: string }>;
  createPortalSession(params: { organizationId: string }): Promise<{ url: string }>;
}

class ManualBillingProvider implements BillingProvider {
  readonly name = "manual";
  readonly enabled = false;

  async createCheckoutSession(): Promise<{ url: string }> {
    throw new Error("Pagamentos ainda não estão habilitados. Entre em contato para fazer upgrade.");
  }

  async createPortalSession(): Promise<{ url: string }> {
    throw new Error("Portal de cobrança ainda não está habilitado.");
  }
}

export function getBillingProvider(): BillingProvider {
  if (isStripeConfigured()) {
    // Ponto único de troca quando o StripeBillingProvider for implementado.
    return new ManualBillingProvider();
  }
  return new ManualBillingProvider();
}
