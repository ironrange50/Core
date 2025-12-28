// server/ai/core/types.ts
// ============================================================================
// NEUROCORE V2: Triple AI Core Types
// Fast Label-Based Routing: Node Labels → Stack Labels → Domain Labels → Agents
// ============================================================================

export type AIType = 'brain' | 'heart' | 'system';
export type DeviceMode = 'standard' | 'professional' | 'advanced';
export type DeviceClass = 'mobile' | 'tablet' | 'laptop' | 'desktop' | 'server';

// Mode limits: Standard (2-1-1), Professional (2-2-2), Advanced (3-3-3)
export const MODE_LIMITS: Record<DeviceMode, { nodes: number; stacks: number; domains: number }> = {
  standard: { nodes: 2, stacks: 1, domains: 1 },      // 2 domains per model
  professional: { nodes: 2, stacks: 2, domains: 2 },  // 4 domains per model
  advanced: { nodes: 3, stacks: 3, domains: 3 },      // 9 domains per model
};

export const DEVICE_DEFAULT_MODE: Record<DeviceClass, DeviceMode> = {
  mobile: 'standard',
  tablet: 'standard',
  laptop: 'professional',
  desktop: 'advanced',
  server: 'advanced',
};

// ============================================================================
// NODE: Most general level - fast keyword triggers
// ============================================================================
export interface AINode {
  id: string;
  aiType: AIType;
  modelSlot: 1 | 2 | 3 | null;
  name: string;
  label: string;                 // FAST LOOKUP LABEL
  description?: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

// ============================================================================
// STACK: Medium specificity
// ============================================================================
export interface AIStack {
  id: string;
  nodeId: string;
  aiType: AIType;
  name: string;
  label: string;                 // FAST LOOKUP LABEL
  description?: string;
  keywords: string[];
  priority: number;
  isActive: boolean;
}

// ============================================================================
// DOMAIN: Most specific
// ============================================================================
export interface AIDomain {
  id: string;
  stackId: string;
  nodeId: string;
  aiType: AIType;
  name: string;
  description?: string;
  keywords: string[];
  systemPrompt?: string;
  priority: number;
  isActive: boolean;
}

// ============================================================================
// MEMORY
// ============================================================================
export interface AIMemory {
  id: string;
  aiType: 'brain' | 'shared';
  domainId?: string;
  content: string;
  context: Record<string, unknown>;
  relevanceScore: number;
  usageCount: number;
}

// ============================================================================
// MODEL CONFIGURATION
// ============================================================================
export interface AIModelConfig {
  id: string;
  aiType: AIType;
  modelSlot: 1 | 2 | 3;
  provider: string;
  modelName: string;
  isPrimary: boolean;
  isBackup: boolean;
  priority: number;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  isActive: boolean;
}

// ============================================================================
// ROUTING
// ============================================================================
export interface SelectedItem {
  id: string;
  label: string;
  name: string;
  score: number;
}

export interface SelectedDomain {
  id: string;
  name: string;
  stackId: string;
  stackLabel: string;
  nodeId: string;
  nodeLabel: string;
  keywords: string[];
  systemPrompt?: string;
  score: number;
}

export interface RoutingResult {
  mode: DeviceMode;
  nodes: SelectedItem[];
  stacks: SelectedItem[];
  domains: SelectedDomain[];
  memories: AIMemory[];
  totalDomains: number;
  confidence: number;
  reasoning: string[];
}

export interface ModelResponse {
  modelSlot: 1 | 2 | 3;
  provider: string;
  modelName: string;
  response: string;
  success: boolean;
  timeMs: number;
  error?: string;
  routing: RoutingResult;
}

export interface AISystemResult {
  aiType: AIType;
  deviceMode: DeviceMode;
  prompt: string;
  model1Response: ModelResponse;
  model2Response: ModelResponse;
  model3Response: ModelResponse;
  knowledgeAlgorithmResult: string;
  finalAnswer: string;
  totalTimeMs: number;
  qualityScore: number;
}

export interface KnowledgeAlgorithmInput {
  aiType: AIType;
  prompt: string;
  responses: ModelResponse[];
}

export interface KnowledgeAlgorithmOutput {
  fusedAnswer: string;
  qualityScore: number;
  reasoning: string[];
  selectedPrimary: 1 | 2 | 3;
  contributionWeights: { model1: number; model2: number; model3: number };
}
