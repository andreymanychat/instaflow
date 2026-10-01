import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FlowGraph } from "@/server/engine/flow-graph";
import { NODE_EXECUTORS, parseButtonPayload } from "@/server/engine/node-executors";
import { findAccountById, type InstagramAccount } from "@/server/services/instagram-account-service";
import { getOrCreateConversation, type Conversation } from "@/server/services/conversation-service";
import { errorMessage, log } from "@/server/services/logger";
import type { Contact } from "@/server/services/contact-service";
import type { RunContext, RunState, TriggerContext } from "@/server/engine/run-context";
import type { Json, Tables } from "@/types/database";
import { buttonHandle } from "@/types/flow";

/** Proteção contra loops infinitos em fluxos mal desenhados. */
const MAX_STEPS_PER_EXECUTION = 40;

type Automation = Tables<"automations">;

async function persistRun(state: RunState, patch: Partial<Tables<"automation_runs">>) {
  const { data } = await createAdminClient()
    .from("automation_runs")
    .update({ ...patch, context: state.context as unknown as Json })
    .eq("id", state.run.id)
    .select("*")
    .single();
  if (data) state.run = data;
}

/** Executa o fluxo a partir de `startNodeId` até terminar, pausar (delay/botões) ou falhar. */
async function executeFrom(state: RunState, startNodeId: string | null) {
  let nodeId = startNodeId;
  let steps = 0;

  try {
    while (nodeId && steps < MAX_STEPS_PER_EXECUTION) {
      const node = state.graph.node(nodeId);
      if (!node) break;

      const result = await NODE_EXECUTORS[node.type](node, state);
      steps++;

      if (result.kind === "fail") {
        await persistRun(state, {
          status: "failed",
          current_node_id: node.id,
          error: result.error,
          steps_executed: state.run.steps_executed + steps,
          finished_at: new Date().toISOString(),
        });
        return;
      }
      if (result.kind === "halt") {
        await persistRun(state, {
          status: result.status,
          current_node_id: node.id,
          steps_executed: state.run.steps_executed + steps,
          ...(result.status === "completed" ? { finished_at: new Date().toISOString() } : {}),
        });
        return;
      }
      nodeId = state.graph.next(node.id, result.handle);
    }

    if (steps >= MAX_STEPS_PER_EXECUTION) {
      await log({
        organizationId: state.automation.organization_id,
        level: "warn",
        source: "automation",
        event: "max_steps",
        message: `Automação "${state.automation.name}" interrompida: limite de ${MAX_STEPS_PER_EXECUTION} passos (possível loop).`,
      });
    }

    await persistRun(state, {
      status: "completed",
      current_node_id: null,
      steps_executed: state.run.steps_executed + steps,
      finished_at: new Date().toISOString(),
    });
  } catch (error) {
    await persistRun(state, {
      status: "failed",
      error: errorMessage(error),
      finished_at: new Date().toISOString(),
    });
    await log({
      organizationId: state.automation.organization_id,
      level: "error",
      source: "automation",
      event: "run_crashed",
      message: `Erro ao executar "${state.automation.name}": ${errorMessage(error)}`,
      metadata: { run_id: state.run.id },
    });
  }
}

export async function startAutomation(params: {
  automation: Automation;
  account: InstagramAccount;
  contact: Contact;
  conversation?: Conversation;
  trigger: TriggerContext;
}) {
  const { automation, account, contact, trigger } = params;
  const graph = FlowGraph.fromJson(automation.flow);
  const entry = graph.entryNodeId();
  if (!entry) {
    await log({
      organizationId: automation.organization_id,
      level: "warn",
      source: "automation",
      event: "empty_flow",
      message: `Automação "${automation.name}" disparou, mas o gatilho não está ligado a nenhum passo.`,
    });
    return;
  }

  const conversation = params.conversation ?? (await getOrCreateConversation(contact));
  const context: RunContext = { trigger };
  const admin = createAdminClient();

  const { data: run, error } = await admin
    .from("automation_runs")
    .insert({
      organization_id: automation.organization_id,
      automation_id: automation.id,
      contact_id: contact.id,
      conversation_id: conversation.id,
      status: "running",
      current_node_id: entry,
      context: context as unknown as Json,
    })
    .select("*")
    .single();
  if (error) throw error;

  await admin.rpc("increment_automation_runs", { automation: automation.id });
  await log({
    organizationId: automation.organization_id,
    source: "automation",
    event: "run_started",
    message: `"${automation.name}" iniciada para @${contact.username ?? contact.igsid}.`,
    metadata: { run_id: run.id, trigger: trigger.type },
  });

  await executeFrom({ run, automation, graph, account, contact, conversation, context }, entry);
}

/** Carrega tudo o que é necessário para continuar uma execução existente. */
async function loadRunState(runId: string): Promise<RunState | null> {
  const admin = createAdminClient();
  const { data: run } = await admin.from("automation_runs").select("*").eq("id", runId).maybeSingle();
  if (!run) return null;

  const [{ data: automation }, { data: contact }] = await Promise.all([
    admin.from("automations").select("*").eq("id", run.automation_id).single(),
    admin.from("contacts").select("*").eq("id", run.contact_id).single(),
  ]);
  if (!automation || !contact) return null;

  const account = await findAccountById(contact.instagram_account_id);
  if (!account || account.status !== "active") return null;

  const conversation = await getOrCreateConversation(contact);
  return {
    run,
    automation,
    graph: FlowGraph.fromJson(automation.flow),
    account,
    contact,
    conversation,
    context: run.context as unknown as RunContext,
  };
}

/** Chamado pela fila quando um delay longo vence. */
export async function resumeRun(runId: string, nodeId: string) {
  const state = await loadRunState(runId);
  if (!state || state.run.status !== "waiting_delay") return;
  if (state.automation.status !== "active") {
    await persistRun(state, { status: "cancelled", finished_at: new Date().toISOString() });
    return;
  }
  await persistRun(state, { status: "running", current_node_id: nodeId });
  await executeFrom(state, nodeId);
}

/**
 * Clique em resposta rápida / botão postback.
 * Retorna true se o payload pertencia a um fluxo e foi tratado.
 */
export async function handleButtonClick(payload: string, contact: Contact, clickedTitle: string): Promise<boolean> {
  const parsed = parseButtonPayload(payload);
  if (!parsed) return false;

  const state = await loadRunState(parsed.runId);
  if (!state || state.run.contact_id !== contact.id) return false;
  if (state.automation.status !== "active") return true;

  const nextNodeId = state.graph.next(parsed.nodeId, buttonHandle(parsed.buttonId));
  state.context = { ...state.context, trigger: { ...state.context.trigger, type: "button", text: clickedTitle } };

  if (!nextNodeId) {
    await persistRun(state, { status: "completed", finished_at: new Date().toISOString() });
    return true;
  }

  await persistRun(state, { status: "running", current_node_id: nextNodeId, finished_at: null });
  await executeFrom(state, nextNodeId);
  return true;
}

/**
 * Quando o contato digita o texto de um botão em vez de clicar,
 * tratamos como clique no fluxo que está aguardando resposta.
 */
export async function matchTypedButton(contact: Contact, text: string): Promise<boolean> {
  const { data: waiting } = await createAdminClient()
    .from("automation_runs")
    .select("id, automation_id, current_node_id")
    .eq("contact_id", contact.id)
    .eq("status", "waiting_input")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!waiting?.current_node_id) return false;

  const { data: automation } = await createAdminClient()
    .from("automations")
    .select("flow")
    .eq("id", waiting.automation_id)
    .single();
  if (!automation) return false;

  const node = FlowGraph.fromJson(automation.flow).node(waiting.current_node_id);
  if (node?.type !== "message") return false;

  const normalized = text.trim().toLowerCase();
  const button = (node.data as { quickReplies?: { id: string; title: string }[] }).quickReplies?.find(
    (b) => b.title.trim().toLowerCase() === normalized,
  );
  if (!button) return false;

  return handleButtonClick(`r:${waiting.id}:${node.id}:${button.id}`, contact, button.title);
}
