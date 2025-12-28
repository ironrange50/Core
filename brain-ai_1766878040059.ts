// server/ai/brain/brain-ai.ts
// ============================================================================
// NEUROCORE V2: Brain AI (Iracore)
// STANDALONE - Own nodes, stacks, domains, memories, knowledge tree
// 6 Nodes per model, 3 stacks per node, dense domains
// ============================================================================

import { executeAISystem } from '../core/ai-system-handler';
import { type DeviceMode, type AISystemResult, DEVICE_DEFAULT_MODE, type DeviceClass } from '../core/types';

export interface BrainAIRequest {
  prompt: string;
  deviceClass?: DeviceClass;
  mode?: DeviceMode;
  userId?: string;
  conversationId?: string;
}

export interface BrainAIResponse {
  success: boolean;
  answer: string;
  mode: DeviceMode;
  metrics: {
    totalTimeMs: number;
    qualityScore: number;
    totalDomains: number;
    model1: {
      provider: string;
      model: string;
      timeMs: number;
      success: boolean;
      nodes: string[];
      stacks: string[];
      domains: string[];
    };
    model2: {
      provider: string;
      model: string;
      timeMs: number;
      success: boolean;
      nodes: string[];
      stacks: string[];
      domains: string[];
    };
    model3: {
      provider: string;
      model: string;
      timeMs: number;
      success: boolean;
      nodes: string[];
      stacks: string[];
      domains: string[];
    };
  };
  knowledgeAlgorithmLog: string;
}

function extractMetrics(result: AISystemResult): BrainAIResponse['metrics'] {
  return {
    totalTimeMs: result.totalTimeMs,
    qualityScore: result.qualityScore,
    totalDomains: 
      result.model1Response.routing.totalDomains +
      result.model2Response.routing.totalDomains +
      result.model3Response.routing.totalDomains,
    model1: {
      provider: result.model1Response.provider,
      model: result.model1Response.modelName,
      timeMs: result.model1Response.timeMs,
      success: result.model1Response.success,
      nodes: result.model1Response.routing.nodes.map(n => n.label),
      stacks: result.model1Response.routing.stacks.map(s => s.label),
      domains: result.model1Response.routing.domains.map(d => d.name),
    },
    model2: {
      provider: result.model2Response.provider,
      model: result.model2Response.modelName,
      timeMs: result.model2Response.timeMs,
      success: result.model2Response.success,
      nodes: result.model2Response.routing.nodes.map(n => n.label),
      stacks: result.model2Response.routing.stacks.map(s => s.label),
      domains: result.model2Response.routing.domains.map(d => d.name),
    },
    model3: {
      provider: result.model3Response.provider,
      model: result.model3Response.modelName,
      timeMs: result.model3Response.timeMs,
      success: result.model3Response.success,
      nodes: result.model3Response.routing.nodes.map(n => n.label),
      stacks: result.model3Response.routing.stacks.map(s => s.label),
      domains: result.model3Response.routing.domains.map(d => d.name),
    },
  };
}

/**
 * Execute Brain AI
 * Auto-detects device mode or uses provided mode
 */
export async function executeBrainAI(request: BrainAIRequest): Promise<BrainAIResponse> {
  console.log('[BRAIN-AI] Starting execution...');

  // Determine mode
  const mode: DeviceMode = request.mode || 
    (request.deviceClass ? DEVICE_DEFAULT_MODE[request.deviceClass] : 'professional');

  try {
    const result = await executeAISystem('brain', request.prompt, mode);

    return {
      success: true,
      answer: result.finalAnswer,
      mode,
      metrics: extractMetrics(result),
      knowledgeAlgorithmLog: result.knowledgeAlgorithmResult,
    };
  } catch (error: any) {
    console.error('[BRAIN-AI] Error:', error.message);

    return {
      success: false,
      answer: 'Brain AI encountered an error. Please try again.',
      mode,
      metrics: {
        totalTimeMs: 0,
        qualityScore: 0,
        totalDomains: 0,
        model1: { provider: '', model: '', timeMs: 0, success: false, nodes: [], stacks: [], domains: [] },
        model2: { provider: '', model: '', timeMs: 0, success: false, nodes: [], stacks: [], domains: [] },
        model3: { provider: '', model: '', timeMs: 0, success: false, nodes: [], stacks: [], domains: [] },
      },
      knowledgeAlgorithmLog: `Error: ${error.message}`,
    };
  }
}

/**
 * Execute Brain AI in Standard mode (mobile)
 * 2-1-1 = 2 domains per model
 */
export async function executeBrainAIStandard(prompt: string): Promise<BrainAIResponse> {
  return executeBrainAI({ prompt, mode: 'standard' });
}

/**
 * Execute Brain AI in Professional mode (laptop)
 * 2-2-2 = 4 domains per model
 */
export async function executeBrainAIProfessional(prompt: string): Promise<BrainAIResponse> {
  return executeBrainAI({ prompt, mode: 'professional' });
}

/**
 * Execute Brain AI in Advanced mode (desktop/server)
 * 3-3-3 = 9 domains per model
 */
export async function executeBrainAIAdvanced(prompt: string): Promise<BrainAIResponse> {
  return executeBrainAI({ prompt, mode: 'advanced' });
}
