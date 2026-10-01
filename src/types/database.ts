/**
 * Tipos do banco no formato gerado pelo Supabase CLI.
 * Após criar o projeto, você pode regenerar com:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type MemberRole = "owner" | "admin" | "member";
type AccountStatus = "active" | "expired" | "revoked" | "error";
type AutomationStatus = "draft" | "active" | "paused";
type TriggerType = "comment" | "dm_keyword" | "story_reply" | "default_reply";
type ConversationStatus = "open" | "closed";
type MessageDirection = "inbound" | "outbound";
type MessageSource = "contact" | "automation" | "ai" | "agent" | "comment_reply";
type RunStatus = "running" | "waiting_delay" | "waiting_input" | "completed" | "failed" | "cancelled";
type JobStatus = "pending" | "processing" | "done" | "failed";
type LogLevel = "debug" | "info" | "warn" | "error";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/** Monta Insert/Update a partir do Row: `Req` são as colunas obrigatórias no insert. */
type Table<Row, Req extends keyof Row, Rel extends Relationship[] = []> = {
  Row: Row;
  Insert: Pick<Row, Req> & Partial<Omit<Row, Req>>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Fk<Name extends string, Col extends string, Ref extends string, One extends boolean = false> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: One;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      plans: Table<
        {
          id: string;
          name: string;
          description: string | null;
          price_cents: number;
          currency: string;
          interval: string;
          stripe_price_id: string | null;
          limits: Json;
          features: string[];
          sort_order: number;
          is_active: boolean;
        },
        "id" | "name"
      >;
      organizations: Table<
        {
          id: string;
          name: string;
          slug: string;
          plan_id: string;
          subscription_status: SubscriptionStatus;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          ai_auto_reply_enabled: boolean;
          default_ai_prompt_id: string | null;
          human_takeover_minutes: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        "name" | "slug",
        [Fk<"organizations_plan_id_fkey", "plan_id", "plans">]
      >;
      organization_members: Table<
        { organization_id: string; user_id: string; role: MemberRole; created_at: string },
        "organization_id" | "user_id",
        [
          Fk<"organization_members_organization_id_fkey", "organization_id", "organizations">,
          Fk<"organization_members_user_id_fkey", "user_id", "profiles">,
        ]
      >;
      organization_invitations: Table<
        {
          id: string;
          organization_id: string;
          email: string;
          role: MemberRole;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        },
        "organization_id" | "email",
        [Fk<"organization_invitations_organization_id_fkey", "organization_id", "organizations">]
      >;
      profiles: Table<
        {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        },
        "id"
      >;
      instagram_accounts: Table<
        {
          id: string;
          organization_id: string;
          ig_user_id: string;
          ig_app_scoped_id: string | null;
          username: string;
          name: string | null;
          profile_picture_url: string | null;
          followers_count: number | null;
          access_token_encrypted: string;
          token_expires_at: string | null;
          status: AccountStatus;
          webhook_subscribed: boolean;
          connected_by: string | null;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "ig_user_id" | "username" | "access_token_encrypted",
        [Fk<"instagram_accounts_organization_id_fkey", "organization_id", "organizations">]
      >;
      contacts: Table<
        {
          id: string;
          organization_id: string;
          instagram_account_id: string;
          igsid: string;
          username: string | null;
          name: string | null;
          profile_pic_url: string | null;
          follower_count: number | null;
          is_follower: boolean | null;
          custom_fields: Json;
          last_inbound_at: string | null;
          last_interaction_at: string;
          subscribed: boolean;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "instagram_account_id" | "igsid",
        [Fk<"contacts_instagram_account_id_fkey", "instagram_account_id", "instagram_accounts">]
      >;
      tags: Table<
        { id: string; organization_id: string; name: string; color: string; created_at: string },
        "organization_id" | "name"
      >;
      contact_tags: Table<
        { contact_id: string; tag_id: string; organization_id: string; created_at: string },
        "contact_id" | "tag_id" | "organization_id",
        [
          Fk<"contact_tags_contact_id_fkey", "contact_id", "contacts">,
          Fk<"contact_tags_tag_id_fkey", "tag_id", "tags">,
        ]
      >;
      segments: Table<
        {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          filters: Json;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "name"
      >;
      conversations: Table<
        {
          id: string;
          organization_id: string;
          instagram_account_id: string;
          contact_id: string;
          status: ConversationStatus;
          assigned_to: string | null;
          last_message_at: string;
          last_message_preview: string | null;
          unread_count: number;
          ai_enabled: boolean;
          bot_paused_until: string | null;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "instagram_account_id" | "contact_id",
        [
          Fk<"conversations_contact_id_fkey", "contact_id", "contacts">,
          Fk<"conversations_instagram_account_id_fkey", "instagram_account_id", "instagram_accounts">,
        ]
      >;
      messages: Table<
        {
          id: string;
          organization_id: string;
          conversation_id: string;
          contact_id: string;
          direction: MessageDirection;
          source: MessageSource;
          mid: string | null;
          text: string | null;
          payload: Json;
          automation_id: string | null;
          sent_by: string | null;
          error: string | null;
          created_at: string;
        },
        "organization_id" | "conversation_id" | "contact_id" | "direction" | "source",
        [Fk<"messages_conversation_id_fkey", "conversation_id", "conversations">]
      >;
      comments: Table<
        {
          id: string;
          organization_id: string;
          instagram_account_id: string;
          contact_id: string | null;
          comment_id: string;
          parent_id: string | null;
          media_id: string | null;
          media_product_type: string | null;
          text: string | null;
          replied: boolean;
          private_replied: boolean;
          created_at: string;
        },
        "organization_id" | "instagram_account_id" | "comment_id",
        [Fk<"comments_contact_id_fkey", "contact_id", "contacts">]
      >;
      ai_prompts: Table<
        {
          id: string;
          organization_id: string;
          name: string;
          system_prompt: string;
          model: string;
          temperature: number;
          max_output_tokens: number;
          history_limit: number;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "name" | "system_prompt"
      >;
      automations: Table<
        {
          id: string;
          organization_id: string;
          instagram_account_id: string | null;
          name: string;
          description: string | null;
          status: AutomationStatus;
          trigger_type: TriggerType;
          trigger_config: Json;
          flow: Json;
          priority: number;
          runs_count: number;
          last_run_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        "organization_id" | "name" | "trigger_type",
        [Fk<"automations_instagram_account_id_fkey", "instagram_account_id", "instagram_accounts">]
      >;
      automation_runs: Table<
        {
          id: string;
          organization_id: string;
          automation_id: string;
          contact_id: string;
          conversation_id: string | null;
          status: RunStatus;
          current_node_id: string | null;
          context: Json;
          steps_executed: number;
          error: string | null;
          started_at: string;
          finished_at: string | null;
          updated_at: string;
        },
        "organization_id" | "automation_id" | "contact_id",
        [
          Fk<"automation_runs_automation_id_fkey", "automation_id", "automations">,
          Fk<"automation_runs_contact_id_fkey", "contact_id", "contacts">,
        ]
      >;
      scheduled_jobs: Table<
        {
          id: string;
          organization_id: string | null;
          type: string;
          payload: Json;
          run_at: string;
          status: JobStatus;
          attempts: number;
          max_attempts: number;
          last_error: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        },
        "type"
      >;
      logs: Table<
        {
          id: number;
          organization_id: string | null;
          level: LogLevel;
          source: string;
          event: string;
          message: string;
          metadata: Json;
          created_at: string;
        },
        "source" | "event" | "message"
      >;
      webhook_events: Table<
        {
          id: number;
          organization_id: string | null;
          object: string | null;
          ig_user_id: string | null;
          payload: Json;
          processed_at: string | null;
          error: string | null;
          created_at: string;
        },
        "payload"
      >;
      data_deletion_requests: Table<
        { id: string; confirmation_code: string; ig_user_id: string; status: string; created_at: string },
        "ig_user_id"
      >;
    };
    Views: {
      instagram_accounts_public: {
        Row: {
          id: string;
          organization_id: string;
          ig_user_id: string;
          username: string;
          name: string | null;
          profile_picture_url: string | null;
          followers_count: number | null;
          token_expires_at: string | null;
          status: AccountStatus;
          webhook_subscribed: boolean;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_organization: {
        Args: { org_name: string };
        Returns: Database["public"]["Tables"]["organizations"]["Row"];
      };
      accept_invitation: { Args: { invite_token: string }; Returns: string };
      increment_automation_runs: { Args: { automation: string }; Returns: undefined };
      claim_due_jobs: {
        Args: { batch_size?: number };
        Returns: Database["public"]["Tables"]["scheduled_jobs"]["Row"][];
      };
      dashboard_stats: { Args: { org: string }; Returns: Json };
      contacts_in_segment: {
        Args: { org: string; filters: Json };
        Returns: Database["public"]["Tables"]["contacts"]["Row"][];
        SetofOptions: { from: "*"; to: "contacts"; isOneToOne: false; isSetofReturn: true };
      };
      is_org_member: { Args: { org_id: string }; Returns: boolean };
    };
    Enums: {
      member_role: MemberRole;
      account_status: AccountStatus;
      automation_status: AutomationStatus;
      trigger_type: TriggerType;
      conversation_status: ConversationStatus;
      message_direction: MessageDirection;
      message_source: MessageSource;
      run_status: RunStatus;
      job_status: JobStatus;
      log_level: LogLevel;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
