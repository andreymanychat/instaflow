/** Tipos dos payloads da Instagram API com Login do Instagram (Graph API). */

export interface IgWebhookPayload {
  object: "instagram" | string;
  entry: IgWebhookEntry[];
}

export interface IgWebhookEntry {
  /** ID profissional da conta do Instagram que recebeu o evento. */
  id: string;
  time: number;
  messaging?: IgMessagingEvent[];
  changes?: IgChange[];
}

export interface IgMessagingEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    is_unsupported?: boolean;
    quick_reply?: { payload: string };
    reply_to?: { mid?: string; story?: { id: string; url: string } };
    attachments?: { type: string; payload: { url?: string } }[];
  };
  postback?: { mid?: string; title: string; payload: string };
  read?: { mid: string };
  reaction?: { mid: string; action: string; reaction?: string; emoji?: string };
}

export interface IgChange {
  field: "comments" | "live_comments" | "mentions" | string;
  value: IgCommentValue;
}

export interface IgCommentValue {
  id: string;
  text: string;
  parent_id?: string;
  from: { id: string; username: string; self_ig_scoped_id?: string };
  media: { id: string; media_product_type?: string; original_media_id?: string };
}

export interface IgTokenResponse {
  access_token: string;
  user_id: string | number;
  permissions?: string | string[];
}

export interface IgLongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface IgProfile {
  id: string;
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  account_type?: string;
}

export interface IgUserProfile {
  name?: string;
  username?: string;
  profile_pic?: string;
  follower_count?: number;
  is_user_follow_business?: boolean;
  is_business_follow_user?: boolean;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

export type IgRecipient = { id: string } | { comment_id: string };

export type IgButton =
  | { type: "web_url"; url: string; title: string }
  | { type: "postback"; title: string; payload: string };

export type IgOutgoingMessage =
  | { text: string; quick_replies?: { content_type: "text"; title: string; payload: string }[] }
  | {
      attachment: {
        type: "template";
        payload: { template_type: "button"; text: string; buttons: IgButton[] };
      };
    };

export interface IgSendResponse {
  recipient_id: string;
  message_id: string;
}
