import { NEXT_HANDLE, type FlowDefinition, type FlowNode } from "@/types/flow";
import type { Json } from "@/types/database";

/** Índice somente-leitura do grafo do fluxo para navegação O(1). */
export class FlowGraph {
  private readonly nodes = new Map<string, FlowNode>();
  private readonly edges = new Map<string, string>();

  constructor(definition: FlowDefinition) {
    for (const node of definition.nodes) this.nodes.set(node.id, node);
    for (const edge of definition.edges) {
      this.edges.set(`${edge.source}|${edge.sourceHandle ?? NEXT_HANDLE}`, edge.target);
    }
  }

  static fromJson(json: Json): FlowGraph {
    const def = (json ?? {}) as unknown as Partial<FlowDefinition>;
    return new FlowGraph({ nodes: def.nodes ?? [], edges: def.edges ?? [] });
  }

  node(id: string): FlowNode | undefined {
    return this.nodes.get(id);
  }

  next(nodeId: string, handle: string = NEXT_HANDLE): string | null {
    return this.edges.get(`${nodeId}|${handle}`) ?? null;
  }

  trigger(): FlowNode | undefined {
    for (const node of this.nodes.values()) if (node.type === "trigger") return node;
    return undefined;
  }

  /** Primeiro passo executável (o nó ligado à saída do gatilho). */
  entryNodeId(): string | null {
    const trigger = this.trigger();
    return trigger ? this.next(trigger.id) : null;
  }
}
