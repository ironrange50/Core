// server/ai/core/ai-system-handler.ts
// ============================================================================
// NEUROCORE V2: AI System Handler
// Flow: Prompt → 3 Models (parallel) → Each routes independently →
// Research → 3 Answers → Knowledge Algorithm → Final Answer
// ============================================================================

import { autoRoute, forceRefreshCache } from './auto-router';
import { runKnowledgeAlgorithm } from '../knowledge/algorithms';
import { db } from '../../../src/lib/db';
import { v4 as uuid } from 'uuid';
import {
  type AIType,
  type DeviceMode,
  type AIModelConfig,
  type ModelResponse,
  type RoutingResult,
  type AISystemResult,
  type SelectedDomain,
} from './types';

// ============================================================================
// MODEL CONFIG CACHE
// ============================================================================
let modelConfigCache: Map<string, AIModelConfig[]> = new Map(); // aiType-slot -> configs
let lastConfigRefresh = 0;
const CONFIG_CACHE_TTL_MS = 60000;

async function refreshModelConfig(): Promise<void> {
  const now = Date.now();
  if (now - lastConfigRefresh < CONFIG_CACHE_TTL_MS) return;

  try {
    const result = await db.execute(`
      SELECT id, ai_type, model_slot, provider, model_name, is_primary, is_backup,
             priority, max_tokens, temperature, timeout_ms, is_active
      FROM ai_model_config
      WHERE is_active = true
      ORDER BY ai_type, model_slot, priority DESC
    `);

    modelConfigCache.clear();
    for (const row of result.rows as any[]) {
      const key = `${row.ai_type}-${row.model_slot}`;
      if (!modelConfigCache.has(key)) modelConfigCache.set(key, []);
      modelConfigCache.get(key)!.push({
        id: row.id,
        aiType: row.ai_type,
        modelSlot: row.model_slot,
        provider: row.provider,
        modelName: row.model_name,
        isPrimary: row.is_primary,
        isBackup: row.is_backup,
        priority: row.priority,
        maxTokens: row.max_tokens,
        temperature: row.temperature,
        timeoutMs: row.timeout_ms,
        isActive: row.is_active,
      });
    }

    lastConfigRefresh = now;
    console.log('[AI-HANDLER] Model config refreshed');
  } catch (error) {
    console.error('[AI-HANDLER] Config refresh error:', error);
  }
}

function getModelConfig(aiType: AIType, slot: 1 | 2 | 3): AIModelConfig | null {
  const key = `${aiType}-${slot}`;
  const configs = modelConfigCache.get(key) || [];
  return configs.find(c => c.isPrimary) || configs[0] || null;
}

// ============================================================================
// BUILD CONTEXT PROMPT
// ============================================================================
function buildContextPrompt(
  originalPrompt: string,
  routing: RoutingResult
): string {
  const parts: string[] = [];

  // Context header with routing path
  const pathStr = routing.domains.map(d => `${d.nodeLabel}→${d.stackLabel}→${d.name}`).join(' | ');
  parts.push(`[Context: ${pathStr}]`);

  // System prompts from domains
  const systemPrompts = routing.domains
    .filter(d => d.systemPrompt)
    .map(d => d.systemPrompt!)
    .slice(0, 2);
  
  if (systemPrompts.length > 0) {
    parts.push('');
    parts.push('[Domain Expertise:]');
    parts.push(systemPrompts.join('\n'));
  }

  // Memories
  if (routing.memories.length > 0) {
    parts.push('');
    parts.push('[Relevant Memories:]');
    for (const mem of routing.memories.slice(0, 3)) {
      parts.push(`- ${mem.content.substring(0, 200)}...`);
    }
  }

  // User prompt
  parts.push('');
  parts.push('[User Request:]');
  parts.push(originalPrompt);

  return parts.join('\n');
}

// ============================================================================
// MOCK AI CALL (Replace with actual unified-ai-client)
// ============================================================================
async function callAIModel(
  config: AIModelConfig,
  prompt: string
): Promise<{ text: string; success: boolean }> {
  // TODO: Replace with actual unified-ai-client call
  // This is a placeholder that should integrate with your existing AI client
  
  try {
    // Import your existing unified AI client
    // const { unifiedAiClient } = await import('../unified-ai-client');
    // const response = await unifiedAiClient.generate({
    //   provider: config.provider,
    //   model: config.modelName,
    //   prompt,
    //   maxTokens: config.maxTokens,
    //   temperature: config.temperature,
    //   timeoutMs: config.timeoutMs,
    // });
    // return { text: response.text, success: response.status === 'success' };

    // Placeholder response for testing
    return {
      text: `[${config.provider}/${config.modelName}] Response to: ${prompt.substring(0, 50)}...`,
      success: true,
    };
  } catch (error: any) {
    console.error(`[AI-HANDLER] Model call error:`, error.message);
    return { text: '', success: false };
  }
}

// ============================================================================
// EXECUTE SINGLE MODEL
// ============================================================================
async function executeModel(
  aiType: AIType,
  modelSlot: 1 | 2 | 3,
  prompt: string,
  mode: DeviceMode,
  config: AIModelConfig
): Promise<ModelResponse> {
  const startTime = Date.now();

  try {
    // Step 1: Auto-route for this model
    const routing = await autoRoute(aiType, modelSlot, prompt, mode);

    // Step 2: Build enriched prompt
    const enrichedPrompt = buildContextPrompt(prompt, routing);

    // Step 3: Call AI model
    const response = await callAIModel(config, enrichedPrompt);

    const timeMs = Date.now() - startTime;

    // Log routing decision
    logRoutingDecision(aiType, modelSlot, mode, prompt, routing, timeMs).catch(() => {});

    return {
      modelSlot,
      provider: config.provider,
      modelName: config.modelName,
      response: response.text,
      success: response.success,
      timeMs,
      routing,
    };
  } catch (error: any) {
    const timeMs = Date.now() - startTime;
    console.error(`[AI-HANDLER] Model ${modelSlot} error:`, error.message);

    return {
      modelSlot,
      provider: config.provider,
      modelName: config.modelName,
      response: '',
      success: false,
      timeMs,
      error: error.message,
      routing: {
        mode,
        nodes: [],
        stacks: [],
        domains: [],
        memories: [],
        totalDomains: 0,
        confidence: 0,
        reasoning: ['Error during execution'],
      },
    };
  }
}

// ============================================================================
// LOGGING
// ============================================================================
async function logRoutingDecision(
  aiType: AIType,
  modelSlot: number,
  mode: DeviceMode,
  prompt: string,
  routing: RoutingResult,
  timeMs: number
): Promise<void> {
  try {
    const promptHash = Buffer.from(prompt.substring(0, 100)).toString('base64');
    
    await db.execute(`
      INSERT INTO ai_routing_log (id, ai_type, model_slot, device_mode, prompt_hash,
        selected_nodes, selected_stacks, selected_domains, memories_used,
        routing_time_ms, confidence, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
      `rtlog-${uuid().slice(0, 12)}`,
      aiType,
      modelSlot,
      mode,
      promptHash,
      routing.nodes.map(n => n.label),
      routing.stacks.map(s => s.label),
      routing.domains.map(d => d.name),
      routing.memories.length,
      timeMs,
      routing.confidence,
    ]);
  } catch (error) {
    // Non-critical
  }
}

async function logResponse(result: AISystemResult): Promise<void> {
  try {
    await db.execute(`
      INSERT INTO ai_response_log (id, ai_type, device_mode, prompt_preview,
        model1_response, model1_time_ms, model1_nodes,
        model2_response, model2_time_ms, model2_nodes,
        model3_response, model3_time_ms, model3_nodes,
        knowledge_algorithm_result, final_answer, total_time_ms, quality_score, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
    `, [
      `rsplog-${uuid().slice(0, 12)}`,
      result.aiType,
      result.deviceMode,
      result.prompt.substring(0, 200),
      result.model1Response.response?.substring(0, 1000) || '',
      result.model1Response.timeMs,
      result.model1Response.routing.nodes.map(n => n.label),
      result.model2Response.response?.substring(0, 1000) || '',
      result.model2Response.timeMs,
      result.model2Response.routing.nodes.map(n => n.label),
      result.model3Response.response?.substring(0, 1000) || '',
      result.model3Response.timeMs,
      result.model3Response.routing.nodes.map(n => n.label),
      result.knowledgeAlgorithmResult.substring(0, 1000),
      result.finalAnswer.substring(0, 2000),
      result.totalTimeMs,
      result.qualityScore,
    ]);
  } catch (error) {
    console.error('[AI-HANDLER] Log response error:', error);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================
export async function executeAISystem(
  aiType: AIType,
  prompt: string,
  mode: DeviceMode = 'professional'
): Promise<AISystemResult> {
  const startTime = Date.now();

  await refreshModelConfig();

  // Get model configs
  const config1 = getModelConfig(aiType, 1);
  const config2 = getModelConfig(aiType, 2);
  const config3 = getModelConfig(aiType, 3);

  if (!config1 || !config2 || !config3) {
    throw new Error(`Missing model configuration for AI type: ${aiType}`);
  }

  console.log(`[AI-HANDLER] Executing ${aiType.toUpperCase()} AI in ${mode} mode...`);

  // Execute all 3 models in parallel
  const [model1Response, model2Response, model3Response] = await Promise.all([
    executeModel(aiType, 1, prompt, mode, config1),
    executeModel(aiType, 2, prompt, mode, config2),
    executeModel(aiType, 3, prompt, mode, config3),
  ]);

  console.log(`[AI-HANDLER] All models responded. Running knowledge algorithm...`);

  // Run knowledge algorithm
  const knowledgeResult = runKnowledgeAlgorithm({
    aiType,
    prompt,
    responses: [model1Response, model2Response, model3Response],
  });

  const totalTimeMs = Date.now() - startTime;

  const result: AISystemResult = {
    aiType,
    deviceMode: mode,
    prompt,
    model1Response,
    model2Response,
    model3Response,
    knowledgeAlgorithmResult: knowledgeResult.reasoning.join('\n'),
    finalAnswer: knowledgeResult.fusedAnswer,
    totalTimeMs,
    qualityScore: knowledgeResult.qualityScore,
  };

  // Log (non-blocking)
  logResponse(result).catch(() => {});

  console.log(`[AI-HANDLER] ${aiType.toUpperCase()} complete: ${totalTimeMs}ms, quality: ${(knowledgeResult.qualityScore * 100).toFixed(1)}%`);

  return result;
}

export async function refreshAllCaches(): Promise<void> {
  lastConfigRefresh = 0;
  await refreshModelConfig();
  await forceRefreshCache();
}
