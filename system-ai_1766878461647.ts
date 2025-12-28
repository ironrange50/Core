// server/ai/system/system-ai.ts
// ============================================================================
// NEUROCORE V2: System AI (System Health)
// SHARED DATA - Shares with Heart AI
// ============================================================================

import { executeAISystem } from '../core/ai-system-handler';
import { type DeviceMode, DEVICE_DEFAULT_MODE, type DeviceClass } from '../core/types';

export interface SystemAIRequest {
  prompt: string;
  deviceClass?: DeviceClass;
  mode?: DeviceMode;
  context?: {
    healthMetrics?: Record<string, number>;
    systemLogs?: string[];
    errorLogs?: string[];
  };
}

export interface SystemAIResponse {
  success: boolean;
  answer: string;
  recommendations: string[];
  severity: 'healthy' | 'warning' | 'critical' | 'unknown';
  mode: DeviceMode;
  metrics: {
    totalTimeMs: number;
    qualityScore: number;
    totalDomains: number;
  };
  knowledgeAlgorithmLog: string;
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[\d]+[.)]\s/.test(trimmed) ||
        /^[-*•]\s/.test(trimmed) ||
        trimmed.toLowerCase().includes('recommend') ||
        trimmed.toLowerCase().includes('should')) {
      recommendations.push(trimmed.replace(/^[\d]+[.)]\s|^[-*•]\s/, ''));
    }
  }

  return recommendations.slice(0, 10);
}

function detectSeverity(text: string): SystemAIResponse['severity'] {
  const lower = text.toLowerCase();
  if (lower.includes('critical') || lower.includes('emergency')) return 'critical';
  if (lower.includes('warning') || lower.includes('attention')) return 'warning';
  if (lower.includes('healthy') || lower.includes('normal')) return 'healthy';
  return 'unknown';
}

export async function executeSystemAI(request: SystemAIRequest): Promise<SystemAIResponse> {
  console.log('[SYSTEM-AI] Starting execution...');

  const mode: DeviceMode = request.mode ||
    (request.deviceClass ? DEVICE_DEFAULT_MODE[request.deviceClass] : 'professional');

  // Build enriched prompt
  let enrichedPrompt = request.prompt;
  if (request.context?.healthMetrics) {
    const metricsStr = Object.entries(request.context.healthMetrics)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    enrichedPrompt = `[Metrics: ${metricsStr}]\n\n${enrichedPrompt}`;
  }
  if (request.context?.errorLogs?.length) {
    enrichedPrompt = `${enrichedPrompt}\n\n[Errors:]\n${request.context.errorLogs.slice(0, 5).join('\n')}`;
  }

  try {
    const result = await executeAISystem('system', enrichedPrompt, mode);
    const recommendations = extractRecommendations(result.finalAnswer);
    const severity = detectSeverity(result.finalAnswer);

    return {
      success: true,
      answer: result.finalAnswer,
      recommendations,
      severity,
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
    console.error('[SYSTEM-AI] Error:', error.message);

    return {
      success: false,
      answer: 'System AI diagnostic failed.',
      recommendations: ['Check system logs manually'],
      severity: 'unknown',
      mode,
      metrics: { totalTimeMs: 0, qualityScore: 0, totalDomains: 0 },
      knowledgeAlgorithmLog: `Error: ${error.message}`,
    };
  }
}

export async function executeHealthCheck(
  metrics: Record<string, number>
): Promise<SystemAIResponse> {
  const prompt = `Analyze system health:\n\n${Object.entries(metrics).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
  return executeSystemAI({ prompt, context: { healthMetrics: metrics } });
}

export async function executeAutoHeal(
  issue: string,
  diagnosticData: Record<string, unknown>
): Promise<SystemAIResponse> {
  const prompt = `Auto-heal issue: ${issue}\n\nDiagnostic:\n${JSON.stringify(diagnosticData, null, 2)}`;
  return executeSystemAI({ prompt });
}
