import "server-only";
import { env } from "@/lib/env";
import { parseJsonSafe } from "@/lib/safe-json";
import type {
  IgLongLivedTokenResponse,
  IgMedia,
  IgOutgoingMessage,
  IgProfile,
  IgRecipient,
  IgSendResponse,
  IgTokenResponse,
  IgUserProfile,
} from "./types";

export const INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
] as const;

export const WEBHOOK_FIELDS = ["comments", "messages", "messaging_postbacks"] as const;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = "MetaApiError";
  }

  /** Código 190 = token inválido/expirado/revogado. */
  get isAuthError() {
    return this.code === 190 || this.status === 401;
  }

  /** Fora da janela de 24h ou usuário indisponível para mensagens. */
  get isMessagingWindowError() {
    return this.code === 10 || this.subcode === 2534022 || this.subcode === 2018278;
  }
}

const graphBase = () => `https://graph.instagram.com/${env().META_GRAPH_API_VERSION}`;

async function request<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  const response = await fetch(url, {
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let body: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any -- formato varia por endpoint
  try {
    body = text ? parseJsonSafe(text) : {};
  } catch {
    body = {};
  }
  if (!response.ok || body?.error) {
    const err = body?.error ?? {};
    throw new MetaApiError(
      err.message ?? err.error_user_msg ?? body?.error_message ?? `Meta API respondeu ${response.status}`,
      response.status,
      err.code,
      err.error_subcode,
      err.fbtrace_id,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export function redirectUri() {
  return `${env().NEXT_PUBLIC_APP_URL}/api/oauth/callback`;
}

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env().INSTAGRAM_APP_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: INSTAGRAM_SCOPES.join(","),
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<IgTokenResponse> {
  const form = new URLSearchParams({
    client_id: env().INSTAGRAM_APP_ID,
    client_secret: env().INSTAGRAM_APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });
  const body = await request<IgTokenResponse | { data: IgTokenResponse[] }>(
    "https://api.instagram.com/oauth/access_token",
    { method: "POST", body: form },
  );
  // A Meta já documentou os dois formatos de resposta; aceitamos ambos.
  return "data" in body ? body.data[0] : body;
}

export function exchangeForLongLivedToken(shortLivedToken: string) {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env().INSTAGRAM_APP_SECRET,
    access_token: shortLivedToken,
  });
  return request<IgLongLivedTokenResponse>(`https://graph.instagram.com/access_token?${params}`);
}

export function refreshLongLivedToken(token: string) {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  return request<IgLongLivedTokenResponse>(`https://graph.instagram.com/refresh_access_token?${params}`);
}

// ---------------------------------------------------------------------------
// Conta e webhooks
// ---------------------------------------------------------------------------

export function getMe(token: string) {
  const fields = "id,user_id,username,name,profile_picture_url,followers_count,account_type";
  return request<IgProfile>(`${graphBase()}/me?fields=${fields}`, { token });
}

export function subscribeToWebhooks(token: string) {
  const params = new URLSearchParams({ subscribed_fields: WEBHOOK_FIELDS.join(",") });
  return request<{ success: boolean }>(`${graphBase()}/me/subscribed_apps?${params}`, {
    method: "POST",
    token,
  });
}

export function unsubscribeFromWebhooks(token: string) {
  return request<{ success: boolean }>(`${graphBase()}/me/subscribed_apps`, { method: "DELETE", token });
}

export async function listMedia(token: string, limit = 24) {
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const body = await request<{ data: IgMedia[] }>(`${graphBase()}/me/media?fields=${fields}&limit=${limit}`, {
    token,
  });
  return body.data;
}

/** Perfil de quem interagiu. Só funciona após o usuário ter enviado uma mensagem para a conta. */
export function getUserProfile(igsid: string, token: string) {
  const fields = "name,username,profile_pic,follower_count,is_user_follow_business,is_business_follow_user";
  return request<IgUserProfile>(`${graphBase()}/${igsid}?fields=${fields}`, { token });
}

// ---------------------------------------------------------------------------
// Mensagens e comentários
// ---------------------------------------------------------------------------

export function sendMessage(token: string, recipient: IgRecipient, message: IgOutgoingMessage) {
  return request<IgSendResponse>(`${graphBase()}/me/messages`, {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, message }),
  });
}

export function replyToComment(token: string, commentId: string, message: string) {
  return request<{ id: string }>(`${graphBase()}/${commentId}/replies`, {
    method: "POST",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}
