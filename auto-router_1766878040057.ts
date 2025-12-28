// server/ai/core/auto-router.ts
// ============================================================================
// NEUROCORE V2: Fast Label-Based Auto-Router
// Node Labels → Stack Labels → Domain Keywords → Agents
// Device Modes: Standard (2-1-1) | Professional (2-2-2) | Advanced (3-3-3)
// ============================================================================

import { db } from '../../../src/lib/db';
import {
  type AIType,
  type DeviceMode,
  type AINode,
  type AIStack,
  type AIDomain,
  type AIMemory,
  type RoutingResult,
  type SelectedItem,
  type SelectedDomain,
  MODE_LIMITS,
} from './types';

// ============================================================================
// LABEL INDEX - Fast O(1) lookup by label
// ============================================================================
interface LabelIndex {
  nodes: Map<string, AINode>;           // label -> node
  stacks: Map<string, AIStack[]>;       // nodeId -> stacks
  domains: Map<string, AIDomain[]>;     // stackId -> domains
  nodesByModel: Map<number, AINode[]>;  // modelSlot -> nodes
}

let labelIndex: LabelIndex = {
  nodes: new Map(),
  stacks: new Map(),
  domains: new Map(),
  nodesByModel: new Map(),
};

let allNodes: AINode[] = [];
let allStacks: AIStack[] = [];
let allDomains: AIDomain[] = [];
let lastCacheRefresh = 0;
const CACHE_TTL_MS = 60000;

// ============================================================================
// CACHE REFRESH
// ============================================================================
export async function refreshCache(): Promise<void> {
  const now = Date.now();
  if (now - lastCacheRefresh < CACHE_TTL_MS) return;

  try {
    // Load nodes
    const nodesResult = await db.execute(`
      SELECT id, ai_type, model_slot, name, label, description, keywords, priority, is_active
      FROM ai_nodes WHERE is_active = true ORDER BY priority DESC
    `);

    allNodes = (nodesResult.rows as any[]).map(row => ({
      id: row.id,
      aiType: row.ai_type,
      modelSlot: row.model_slot,
      name: row.name,
      label: row.label,
      description: row.description,
      keywords: row.keywords || [],
      priority: row.priority,
      isActive: row.is_active,
    }));

    // Load stacks
    const stacksResult = await db.execute(`
      SELECT id, node_id, ai_type, name, label, description, keywords, priority, is_active
      FROM ai_stacks WHERE is_active = true ORDER BY priority DESC
    `);

    allStacks = (stacksResult.rows as any[]).map(row => ({
      id: row.id,
      nodeId: row.node_id,
      aiType: row.ai_type,
      name: row.name,
      label: row.label,
      description: row.description,
      keywords: row.keywords || [],
      priority: row.priority,
      isActive: row.is_active,
    }));

    // Load domains
    const domainsResult = await db.execute(`
      SELECT id, stack_id, node_id, ai_type, name, description, keywords, system_prompt, priority, is_active
      FROM ai_domains WHERE is_active = true ORDER BY priority DESC
    `);

    allDomains = (domainsResult.rows as any[]).map(row => ({
      id: row.id,
      stackId: row.stack_id,
      nodeId: row.node_id,
      aiType: row.ai_type,
      name: row.name,
      description: row.description,
      keywords: row.keywords || [],
      systemPrompt: row.system_prompt,
      priority: row.priority,
      isActive: row.is_active,
    }));

    // Build label index for fast lookup
    buildLabelIndex();

    lastCacheRefresh = now;
    console.log(`[ROUTER] Cache refreshed: ${allNodes.length} nodes, ${allStacks.length} stacks, ${allDomains.length} domains`);
  } catch (error) {
    console.error('[ROUTER] Cache refresh error:', error);
  }
}

function buildLabelIndex(): void {
  labelIndex = {
    nodes: new Map(),
    stacks: new Map(),
    domains: new Map(),
    nodesByModel: new Map(),
  };

  // Index nodes by label and model slot
  for (const node of allNodes) {
    labelIndex.nodes.set(node.label.toUpperCase(), node);
    
    if (node.modelSlot) {
      if (!labelIndex.nodesByModel.has(node.modelSlot)) {
        labelIndex.nodesByModel.set(node.modelSlot, []);
      }
      labelIndex.nodesByModel.get(node.modelSlot)!.push(node);
    }
  }

  // Index stacks by nodeId
  for (const stack of allStacks) {
    if (!labelIndex.stacks.has(stack.nodeId)) {
      labelIndex.stacks.set(stack.nodeId, []);
    }
    labelIndex.stacks.get(stack.nodeId)!.push(stack);
  }

  // Index domains by stackId
  for (const domain of allDomains) {
    if (!labelIndex.domains.has(domain.stackId)) {
      labelIndex.domains.set(domain.stackId, []);
    }
    labelIndex.domains.get(domain.stackId)!.push(domain);
  }
}

// ============================================================================
// KEYWORD SCORING
// ============================================================================
function scoreByKeywords(prompt: string, keywords: string[], label?: string): number {
  const promptLower = prompt.toLowerCase();
  const words = promptLower.split(/\W+/).filter(w => w.length > 2);
  let score = 0;

  // Label match (highest priority)
  if (label && promptLower.includes(label.toLowerCase())) {
    score += 5;
  }

  // Keyword matches
  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    if (promptLower.includes(kwLower)) {
      score += 2;
    } else if (words.some(w => w.includes(kwLower) || kwLower.includes(w))) {
      score += 1;
    }
  }

  return score;
}

// ============================================================================
// NODE SELECTION (per model)
// ============================================================================
function selectNodes(
  aiType: AIType,
  modelSlot: 1 | 2 | 3,
  prompt: string,
  limit: number
): SelectedItem[] {
  // Get nodes assigned to this model
  const modelNodes = labelIndex.nodesByModel.get(modelSlot) || [];
  const relevantNodes = modelNodes.filter(n => n.aiType === aiType);

  if (relevantNodes.length === 0) {
    // Fallback to all nodes of this type
    const fallbackNodes = allNodes.filter(n => n.aiType === aiType);
    return selectTopItems(fallbackNodes, prompt, limit);
  }

  return selectTopItems(relevantNodes, prompt, limit);
}

function selectTopItems(nodes: AINode[], prompt: string, limit: number): SelectedItem[] {
  const scored = nodes.map(node => ({
    id: node.id,
    label: node.label,
    name: node.name,
    score: scoreByKeywords(prompt, node.keywords, node.label) + (node.priority / 100),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ============================================================================
// STACK SELECTION (within selected nodes)
// ============================================================================
function selectStacks(
  selectedNodes: SelectedItem[],
  prompt: string,
  limitPerNode: number
): SelectedItem[] {
  const results: SelectedItem[] = [];

  for (const node of selectedNodes) {
    const nodeStacks = labelIndex.stacks.get(node.id) || [];
    
    const scored = nodeStacks.map(stack => ({
      id: stack.id,
      label: stack.label,
      name: stack.name,
      score: scoreByKeywords(prompt, stack.keywords, stack.label) + (stack.priority / 100),
    }));

    scored.sort((a, b) => b.score - a.score);
    results.push(...scored.slice(0, limitPerNode));
  }

  return results;
}

// ============================================================================
// DOMAIN SELECTION (within selected stacks)
// ============================================================================
function selectDomains(
  selectedStacks: SelectedItem[],
  selectedNodes: SelectedItem[],
  prompt: string,
  limitPerStack: number
): SelectedDomain[] {
  const results: SelectedDomain[] = [];
  const nodeMap = new Map(selectedNodes.map(n => [n.id, n]));

  for (const stack of selectedStacks) {
    const stackDomains = labelIndex.domains.get(stack.id) || [];
    
    // Find parent node
    const parentStack = allStacks.find(s => s.id === stack.id);
    const nodeId = parentStack?.nodeId || '';
    const node = nodeMap.get(nodeId);

    const scored = stackDomains.map(domain => ({
      id: domain.id,
      name: domain.name,
      stackId: domain.stackId,
      stackLabel: stack.label,
      nodeId: domain.nodeId,
      nodeLabel: node?.label || '',
      keywords: domain.keywords,
      systemPrompt: domain.systemPrompt,
      score: scoreByKeywords(prompt, domain.keywords) + (domain.priority / 100),
    }));

    scored.sort((a, b) => b.score - a.score);
    results.push(...scored.slice(0, limitPerStack));
  }

  return results;
}

// ============================================================================
// MEMORY RETRIEVAL
// ============================================================================
async function getMemories(
  aiType: AIType,
  domainIds: string[],
  limit: number = 5
): Promise<AIMemory[]> {
  if (domainIds.length === 0) return [];

  try {
    const memoryType = aiType === 'brain' ? 'brain' : 'shared';
    
    const result = await db.execute(`
      SELECT id, ai_type, domain_id, content, context, relevance_score, usage_count
      FROM ai_memories 
      WHERE ai_type = $1 
        AND (domain_id = ANY($2) OR domain_id IS NULL)
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY relevance_score DESC, usage_count DESC
      LIMIT $3
    `, [memoryType, domainIds, limit]);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      aiType: row.ai_type,
      domainId: row.domain_id,
      content: row.content,
      context: row.context || {},
      relevanceScore: row.relevance_score,
      usageCount: row.usage_count,
    }));
  } catch (error) {
    console.error('[ROUTER] Memory retrieval error:', error);
    return [];
  }
}

// ============================================================================
// MAIN AUTO-ROUTE FUNCTION
// ============================================================================
export async function autoRoute(
  aiType: AIType,
  modelSlot: 1 | 2 | 3,
  prompt: string,
  mode: DeviceMode
): Promise<RoutingResult> {
  await refreshCache();

  const limits = MODE_LIMITS[mode];
  const reasoning: string[] = [];

  reasoning.push(`[MODE: ${mode.toUpperCase()}] Limits: ${limits.nodes}-${limits.stacks}-${limits.domains}`);

  // Step 1: Select nodes (by label matching)
  const nodes = selectNodes(aiType, modelSlot, prompt, limits.nodes);
  reasoning.push(`[NODES] Selected: ${nodes.map(n => n.label).join(', ')}`);

  // Step 2: Select stacks within nodes (by label matching)
  const stacks = selectStacks(nodes, prompt, limits.stacks);
  reasoning.push(`[STACKS] Selected: ${stacks.map(s => s.label).join(', ')}`);

  // Step 3: Select domains within stacks (by keyword matching)
  const domains = selectDomains(stacks, nodes, prompt, limits.domains);
  reasoning.push(`[DOMAINS] Selected: ${domains.map(d => d.name).join(', ')}`);

  // Step 4: Get memories
  const domainIds = domains.map(d => d.id);
  const memories = await getMemories(aiType, domainIds);
  reasoning.push(`[MEMORIES] Found: ${memories.length}`);

  // Calculate confidence
  const avgScore = domains.length > 0 
    ? domains.reduce((sum, d) => sum + d.score, 0) / domains.length 
    : 0;
  const confidence = Math.min(1, avgScore / 5);

  return {
    mode,
    nodes,
    stacks,
    domains,
    memories,
    totalDomains: domains.length,
    confidence,
    reasoning,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================
export async function forceRefreshCache(): Promise<void> {
  lastCacheRefresh = 0;
  await refreshCache();
}

export function getNodesByLabel(label: string): AINode | undefined {
  return labelIndex.nodes.get(label.toUpperCase());
}

export function getNodesForModel(modelSlot: 1 | 2 | 3): AINode[] {
  return labelIndex.nodesByModel.get(modelSlot) || [];
}

export function getAllNodes(aiType: AIType): AINode[] {
  return allNodes.filter(n => n.aiType === aiType);
}

export function getStacksForNode(nodeId: string): AIStack[] {
  return labelIndex.stacks.get(nodeId) || [];
}

export function getDomainsForStack(stackId: string): AIDomain[] {
  return labelIndex.domains.get(stackId) || [];
}
