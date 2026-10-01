"use client";

import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ArrowLeft, Loader2, Pause, Play, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveAutomation, setAutomationStatus } from "@/server/actions/automation-actions";
import { AutomationStatusBadge } from "@/components/automations/automation-status-badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { NODE_TYPES } from "./flow-nodes";
import { ADDABLE_NODES, NODE_CATALOG, shortId } from "./node-catalog";
import { EditorContext, type EditorLookups, type TriggerDetails } from "./editor-context";
import { NodeConfig } from "./node-config";
import type { Enums } from "@/types/database";
import type { FlowDefinition, FlowNodeType, MessageNodeData } from "@/types/flow";
import { buttonHandle, NEXT_HANDLE } from "@/types/flow";

type EditorNode = Node<Record<string, unknown>, FlowNodeType>;

type Props = {
  automationId: string;
  status: Enums<"automation_status">;
  initialDetails: TriggerDetails;
  initialFlow: FlowDefinition;
  lookups: EditorLookups;
};

/** Saídas válidas de cada nó — usado para remover conexões órfãs quando botões são apagados. */
function validHandles(node: EditorNode): string[] {
  switch (node.type) {
    case "condition":
      return ["true", "false"];
    case "message": {
      const data = node.data as unknown as MessageNodeData;
      return data.quickReplies.length ? data.quickReplies.map((b) => buttonHandle(b.id)) : [NEXT_HANDLE];
    }
    default:
      return [NEXT_HANDLE];
  }
}

function toEditorNodes(flow: FlowDefinition): EditorNode[] {
  return flow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
    deletable: n.type !== "trigger",
  }));
}

function toEditorEdges(flow: FlowDefinition): Edge[] {
  return flow.edges.map((e) => ({ ...e, sourceHandle: e.sourceHandle ?? NEXT_HANDLE, animated: true }));
}

function EditorCanvas({ automationId, status: initialStatus, initialDetails, initialFlow, lookups }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(toEditorNodes(initialFlow));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEditorEdges(initialFlow));
  const [details, setDetails] = useState(initialDetails);
  const [status, setStatus] = useState(initialStatus);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [toggling, startToggling] = useTransition();
  const { screenToFlowPosition } = useReactFlow();
  const isMobile = useIsMobile();

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;
  const markDirty = useCallback(() => setDirty(true), []);

  // Aviso ao sair com alterações não salvas
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const handle = connection.sourceHandle ?? NEXT_HANDLE;
      setEdges((current) =>
        addEdge(
          { ...connection, id: `e-${shortId()}`, sourceHandle: handle, animated: true },
          // cada saída tem no máximo uma conexão: a nova substitui a anterior
          current.filter((e) => !(e.source === connection.source && (e.sourceHandle ?? NEXT_HANDLE) === handle)),
        ),
      );
      markDirty();
    },
    [setEdges, markDirty],
  );

  const addNode = (type: FlowNodeType) => {
    const id = `${type}-${shortId()}`;
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const node: EditorNode = {
      id,
      type,
      // pequeno deslocamento em cascata para nós adicionados em sequência não ficarem sobrepostos
      position: { x: center.x - 128 + (nodes.length % 5) * 24, y: center.y - 60 + (nodes.length % 5) * 24 },
      data: NODE_CATALOG[type].defaultData() as unknown as Record<string, unknown>,
    };

    setNodes((current) => [...current.map((n) => ({ ...n, selected: false })), { ...node, selected: true }]);
    // Conecta automaticamente ao nó selecionado quando a saída "next" dele está livre
    if (selectedNode && validHandles(selectedNode).includes(NEXT_HANDLE) && !edges.some((e) => e.source === selectedNode.id && e.sourceHandle === NEXT_HANDLE)) {
      setEdges((current) => [...current, { id: `e-${shortId()}`, source: selectedNode.id, target: id, sourceHandle: NEXT_HANDLE, animated: true }]);
    }
    setSelectedId(id);
    markDirty();
  };

  const updateNodeData = (id: string, data: Record<string, unknown>) => {
    setNodes((current) => current.map((n) => (n.id === id ? { ...n, data } : n)));
    const node = nodes.find((n) => n.id === id);
    if (node) {
      const allowed = validHandles({ ...node, data });
      setEdges((current) => current.filter((e) => e.source !== id || allowed.includes(e.sourceHandle ?? NEXT_HANDLE)));
    }
    markDirty();
  };

  const deleteNode = (id: string) => {
    setNodes((current) => current.filter((n) => n.id !== id));
    setEdges((current) => current.filter((e) => e.source !== id && e.target !== id));
    setSelectedId(null);
    markDirty();
  };

  const buildFlow = (): FlowDefinition => ({
    nodes: nodes.map((n) => ({ id: n.id, type: n.type as FlowNodeType, position: n.position, data: n.data as never })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? NEXT_HANDLE })),
  });

  const save = useCallback(
    (onSaved?: () => void) =>
      startSaving(async () => {
        const result = await saveAutomation(automationId, { details, flow: buildFlow() });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setDirty(false);
        toast.success("Automação salva.");
        onSaved?.();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildFlow lê o estado atual
    [automationId, details, nodes, edges],
  );

  // Ctrl/Cmd + S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  const toggleStatus = () => {
    const next = status === "active" ? "paused" : "active";
    const run = () =>
      startToggling(async () => {
        const result = await setAutomationStatus(automationId, next);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setStatus(next);
        toast.success(next === "active" ? "Automação ativada!" : "Automação pausada.");
      });
    if (dirty && next === "active") save(run);
    else run();
  };

  const contextValue = useMemo(() => ({ lookups, details }), [lookups, details]);

  const panel = selectedNode && (
    <NodeConfig
      node={selectedNode}
      details={details}
      onDetailsChange={(d) => {
        setDetails(d);
        markDirty();
      }}
      onDataChange={(data) => updateNodeData(selectedNode.id, data)}
    />
  );

  return (
    <EditorContext.Provider value={contextValue}>
      <div className="flex h-svh flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar">
            <Link href="/automations">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <Input
            value={details.name}
            onChange={(e) => {
              setDetails({ ...details, name: e.target.value });
              markDirty();
            }}
            className="h-9 w-full max-w-xs font-medium sm:w-64"
            aria-label="Nome da automação"
          />
          <AutomationStatusBadge status={status} />
          {dirty && <Badge variant="outline">Não salvo</Badge>}
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="size-4" /> Passo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {ADDABLE_NODES.map((meta) => (
                  <DropdownMenuItem key={meta.type} onClick={() => addNode(meta.type)} className="items-start gap-3 py-2">
                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-white ${meta.accent}`}>
                      <meta.icon className="size-3.5" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{meta.label}</span>
                      <span className="block text-xs text-muted-foreground">{meta.description}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={() => save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar
            </Button>
            <Button size="sm" onClick={toggleStatus} disabled={toggling || saving} variant={status === "active" ? "secondary" : "default"}>
              {status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
              {status === "active" ? "Pausar" : "Ativar"}
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              onNodesChange={(changes) => {
                onNodesChange(changes);
                if (changes.some((c) => c.type === "position" || c.type === "remove")) markDirty();
              }}
              onEdgesChange={(changes) => {
                onEdgesChange(changes);
                if (changes.some((c) => c.type === "remove")) markDirty();
              }}
              onConnect={onConnect}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              onNodesDelete={(deleted) => deleted.some((n) => n.id === selectedId) && setSelectedId(null)}
              deleteKeyCode={["Delete", "Backspace"]}
              fitView
              fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ animated: true }}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
              {!isMobile && <MiniMap pannable zoomable className="!bg-muted" />}
            </ReactFlow>
          </div>

          {!isMobile && selectedNode && (
            <aside className="flex w-96 shrink-0 flex-col border-l bg-background">
              <PanelHeader node={selectedNode} onDelete={() => deleteNode(selectedNode.id)} />
              <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            </aside>
          )}
        </div>
      </div>

      {isMobile && (
        <Sheet open={Boolean(selectedNode)} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto">
            {selectedNode && (
              <>
                <SheetHeader>
                  <SheetTitle>{NODE_CATALOG[selectedNode.type as FlowNodeType].label}</SheetTitle>
                  <SheetDescription>{NODE_CATALOG[selectedNode.type as FlowNodeType].description}</SheetDescription>
                </SheetHeader>
                <div className="px-4 pb-6">{panel}</div>
                {selectedNode.type !== "trigger" && (
                  <div className="px-4 pb-6">
                    <Button variant="destructive" className="w-full" onClick={() => deleteNode(selectedNode.id)}>
                      <Trash2 className="size-4" /> Excluir passo
                    </Button>
                  </div>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>
      )}
    </EditorContext.Provider>
  );
}

function PanelHeader({ node, onDelete }: { node: EditorNode; onDelete: () => void }) {
  const meta = NODE_CATALOG[node.type as FlowNodeType];
  return (
    <div className="flex items-center gap-2 border-b px-4 py-3">
      <span className={`flex size-7 items-center justify-center rounded-md text-white ${meta.accent}`}>
        <meta.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{meta.label}</p>
        <p className="truncate text-xs text-muted-foreground">{meta.description}</p>
      </div>
      {node.type !== "trigger" && (
        <Button variant="ghost" size="icon" aria-label="Excluir passo" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function AutomationEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}
