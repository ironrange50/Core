// server/ai/heart/heart-ai.ts
// ============================================================================
// NEUROCORE V2: Heart AI (Code/AI Health)
// SHARED DATA - Shares with System AI
// ============================================================================

import { executeAISystem } from '../core/ai-system-handler';
import { type DeviceMode, type AISystemResult, DEVICE_DEFAULT_MODE, type DeviceClass } from '../core/types';

export interface HeartAIRequest {
  prompt: string;
  deviceClass?: DeviceClass;
  mode?: DeviceMode;
  context?: {
    codeFile?: string;
    errorMessage?: string;
    stackTrace?: string;
  };
}

export interface HeartAIResponse {
  success: boolean;
  answer: string;
  codeBlocks: string[];
  mode: DeviceMode;
  metrics: {
    totalTimeMs: number;
    qualityScore: number;
    totalDomains: number;
  };
  knowledgeAlgorithmLog: string;
}

function extractCodeBlocks(text: string): string[] {
  const regex = /```[\w]*\n([\s\S]*?)```/g;
  const blocks: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export async function executeHeartAI(request: HeartAIRequest): Promise<HeartAIResponse> {
  console.log('[HEART-AI] Starting execution...');

  const mode: DeviceMode = request.mode ||
    (request.deviceClass ? DEVICE_DEFAULT_MODE[request.deviceClass] : 'professional');

  // Build enriched prompt
  let enrichedPrompt = request.prompt;
  if (request.context?.codeFile) {
    enrichedPrompt = `[File: ${request.context.codeFile}]\n\n${enrichedPrompt}`;
  }
  if (request.context?.errorMessage) {
    enrichedPrompt = `[Error: ${request.context.errorMessage}]\n\n${enrichedPrompt}`;
  }
  if (request.context?.stackTrace) {
    enrichedPrompt = `${enrichedPrompt}\n\n[Stack Trace:]\n${request.context.stackTrace}`;
  }

  try {
    const result = await executeAISystem('heart', enrichedPrompt, mode);
    const codeBlocks = extractCodeBlocks(result.finalAnswer);

    return {
      success: true,
      answer: result.finalAnswer,
      codeBlocks,
      mode,
      metrics: {
        totalTimeMs: result.totalTimeMs,
        qualityScore: result.qualityScore,
        totalDomains:
          result.model1Response.routing.totalDomains +
          result.model2Response.routing.totalDomains +
          result.model3Response.routing.totalDomains,
      },
      knowledgeAlgorithmLog: result.knowledgeAlgorithmResult,
    };
  } catch (error: any) {
    console.error('[HEART-AI] Error:', error.message);

    return {
      success: false,
      answer: '// Heart AI error. Manual inspection required.',
      codeBlocks: [],
      mode,
      metrics: { totalTimeMs: 0, qualityScore: 0, totalDomains: 0 },
      knowledgeAlgorithmLog: `Error: ${error.message}`,
    };
  }
}

export async function executeCodeRepair(
  errorMessage: string,
  codeFile: string,
  codeContent: string
): Promise<HeartAIResponse> {
  const prompt = `Fix this error:\n\nError: ${errorMessage}\n\nFile: ${codeFile}\n\n\`\`\`\n${codeContent}\n\`\`\``;
  return executeHeartAI({ prompt, context: { codeFile, errorMessage } });
}

export async function executeCodeOptimize(
  codeFile: string,
  codeContent: string,
  goal: string
): Promise<HeartAIResponse> {
  const prompt = `Optimize for: ${goal}\n\nFile: ${codeFile}\n\n\`\`\`\n${codeContent}\n\`\`\``;
  return executeHeartAI({ prompt, context: { codeFile } });
}
