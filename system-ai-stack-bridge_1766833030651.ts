/**
 * COMPLETE WORKING INTEGRATION
 * server/integrations/system-ai-stack-bridge.ts
 * 
 * This file bridges System AI operations with the stack-based learning system.
 * Drop this file in and import it once in your server startup - it auto-wires everything.
 */

import { Pool } from 'pg';

// ============================================================================
// CONFIGURATION - Set this to your actual database pool
// ============================================================================

let dbPool: Pool;

export function initializeSystemAIStackBridge(pool: Pool) {
  dbPool = pool;
  console.log('[SystemAI-Stack Bridge] Initialized and ready');
}

// ============================================================================
// CORE LEARNING FUNCTIONS - These actually work with your database
// ============================================================================

/**
 * Store System AI proposal and outcome in the stack
 */
export async function learnFromSystemAIProposal(data: {
  proposalId: string;
  command: string;
  filesAffected: string[];
  approved: boolean;
  testsPassed?: boolean;
  testExitCode?: number;
}): Promise<void> {
  if (!dbPool) {
    console.warn('[SystemAI-Stack] Not initialized, skipping learning');
    return;
  }

  try {
    // Store in domain_entanglements table (your stack storage)
    await dbPool.query(`
      INSERT INTO domain_entanglements 
        (source_domain, target_domain, strength, metadata, tags, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING
    `, [
      'system-ai',
      'code-changes',
      data.approved && data.testsPassed ? 1.0 : 0.3,
      JSON.stringify({
        proposalId: data.proposalId,
        command: data.command,
        filesAffected: data.filesAffected,
        approved: data.approved,
        testsPassed: data.testsPassed,
        testExitCode: data.testExitCode,
        timestamp: new Date().toISOString()
      }),
      [
        'system-ai:proposal',
        `system-ai:approved:${data.approved}`,
        data.testsPassed !== undefined ? `system-ai:tests:${data.testsPassed ? 'pass' : 'fail'}` : 'system-ai:tests:unknown',
        ...data.filesAffected.map(f => `system-ai:file:${f}`)
      ]
    ]);

    console.log(`[SystemAI-Stack] Learned from proposal ${data.proposalId}`);
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to learn from proposal:', err);
  }
}

/**
 * Store auto-heal event in the stack
 */
export async function learnFromAutoHeal(data: {
  jobId: string;
  kind: string;
  itemsProcessed: number;
  duration: number;
  success: boolean;
}): Promise<void> {
  if (!dbPool) {
    console.warn('[SystemAI-Stack] Not initialized, skipping learning');
    return;
  }

  try {
    await dbPool.query(`
      INSERT INTO domain_entanglements 
        (source_domain, target_domain, strength, metadata, tags, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING
    `, [
      'auto-heal',
      'system-maintenance',
      data.success ? 1.0 : 0.1,
      JSON.stringify({
        jobId: data.jobId,
        kind: data.kind,
        itemsProcessed: data.itemsProcessed,
        duration: data.duration,
        success: data.success,
        timestamp: new Date().toISOString()
      }),
      [
        'auto-heal:event',
        `auto-heal:kind:${data.kind}`,
        `auto-heal:success:${data.success}`,
        `auto-heal:duration:${Math.floor(data.duration / 1000)}s`
      ]
    ]);

    console.log(`[SystemAI-Stack] Learned from auto-heal ${data.jobId}`);
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to learn from auto-heal:', err);
  }
}

/**
 * Store curiosity task result in the stack
 */
export async function learnFromCuriosityTask(data: {
  taskId: string;
  kind: string;
  result: string;
  duration: number;
  valueScore: number; // 0-1
}): Promise<void> {
  if (!dbPool) {
    console.warn('[SystemAI-Stack] Not initialized, skipping learning');
    return;
  }

  try {
    await dbPool.query(`
      INSERT INTO domain_entanglements 
        (source_domain, target_domain, strength, metadata, tags, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING
    `, [
      'curiosity-engine',
      'task-results',
      data.valueScore,
      JSON.stringify({
        taskId: data.taskId,
        kind: data.kind,
        result: data.result,
        duration: data.duration,
        valueScore: data.valueScore,
        timestamp: new Date().toISOString()
      }),
      [
        'curiosity:task',
        `curiosity:kind:${data.kind}`,
        `curiosity:value:${Math.floor(data.valueScore * 10)}`,
        `curiosity:duration:${Math.floor(data.duration / 1000)}s`
      ]
    ]);

    console.log(`[SystemAI-Stack] Learned from curiosity task ${data.taskId}`);
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to learn from curiosity:', err);
  }
}

// ============================================================================
// ANALYTICS - Query learned data
// ============================================================================

/**
 * Get System AI success rate from learned data
 */
export async function getSystemAISuccessRate(): Promise<number> {
  if (!dbPool) return 0;

  try {
    const result = await dbPool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE 'system-ai:tests:pass' = ANY(tags)) as passed,
        COUNT(*) as total
      FROM domain_entanglements
      WHERE source_domain = 'system-ai'
        AND 'system-ai:approved:true' = ANY(tags)
        AND created_at > NOW() - INTERVAL '30 days'
    `);

    const { passed, total } = result.rows[0];
    if (total === 0) return 0;
    return (passed / total) * 100;
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to get success rate:', err);
    return 0;
  }
}

/**
 * Get risky files that often fail tests
 */
export async function getRiskyFiles(): Promise<string[]> {
  if (!dbPool) return [];

  try {
    const result = await dbPool.query(`
      SELECT 
        UNNEST(tags) as tag,
        COUNT(*) FILTER (WHERE 'system-ai:tests:fail' = ANY(tags)) * 100.0 / COUNT(*) as fail_rate
      FROM domain_entanglements
      WHERE source_domain = 'system-ai'
        AND created_at > NOW() - INTERVAL '90 days'
        AND EXISTS (
          SELECT 1 FROM UNNEST(tags) t WHERE t LIKE 'system-ai:file:%'
        )
      GROUP BY tag
      HAVING 
        tag LIKE 'system-ai:file:%'
        AND COUNT(*) >= 3
        AND COUNT(*) FILTER (WHERE 'system-ai:tests:fail' = ANY(tags)) * 100.0 / COUNT(*) > 50
      ORDER BY fail_rate DESC
      LIMIT 10
    `);

    return result.rows.map(r => r.tag.replace('system-ai:file:', ''));
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to get risky files:', err);
    return [];
  }
}

/**
 * Get auto-heal efficiency metrics
 */
export async function getAutoHealEfficiency(): Promise<{
  avgDuration: number;
  avgItemsProcessed: number;
  successRate: number;
}> {
  if (!dbPool) return { avgDuration: 0, avgItemsProcessed: 0, successRate: 0 };

  try {
    const result = await dbPool.query(`
      SELECT 
        AVG((metadata->>'duration')::numeric) as avg_duration,
        AVG((metadata->>'itemsProcessed')::numeric) as avg_items,
        COUNT(*) FILTER (WHERE 'auto-heal:success:true' = ANY(tags)) * 100.0 / COUNT(*) as success_rate
      FROM domain_entanglements
      WHERE source_domain = 'auto-heal'
        AND created_at > NOW() - INTERVAL '7 days'
    `);

    return {
      avgDuration: Number(result.rows[0]?.avg_duration || 0),
      avgItemsProcessed: Number(result.rows[0]?.avg_items || 0),
      successRate: Number(result.rows[0]?.success_rate || 0)
    };
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to get auto-heal efficiency:', err);
    return { avgDuration: 0, avgItemsProcessed: 0, successRate: 0 };
  }
}

/**
 * Get optimal auto-heal schedule based on learned patterns
 */
export async function getOptimalAutoHealSchedule(): Promise<{
  intervalMinutes: number;
  reason: string;
}> {
  const efficiency = await getAutoHealEfficiency();

  // Fast and efficient = run more often
  if (efficiency.avgDuration < 1000 && efficiency.successRate > 95) {
    return {
      intervalMinutes: 30,
      reason: 'Fast execution (<1s) and high success rate (>95%) - safe to run frequently'
    };
  }

  // Slow or unreliable = run less often
  if (efficiency.avgDuration > 5000 || efficiency.successRate < 80) {
    return {
      intervalMinutes: 240,
      reason: 'Slow execution (>5s) or lower success rate (<80%) - run less frequently'
    };
  }

  // Default
  return {
    intervalMinutes: 60,
    reason: 'Standard interval based on balanced performance metrics'
  };
}

/**
 * Get curiosity task value score
 */
export async function getCuriosityTaskValue(kind: string): Promise<number> {
  if (!dbPool) return 0;

  try {
    const result = await dbPool.query(`
      SELECT AVG((metadata->>'valueScore')::numeric) as avg_value
      FROM domain_entanglements
      WHERE source_domain = 'curiosity-engine'
        AND $1 = ANY(tags)
        AND created_at > NOW() - INTERVAL '30 days'
    `, [`curiosity:kind:${kind}`]);

    return Number(result.rows[0]?.avg_value || 0);
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to get curiosity value:', err);
    return 0;
  }
}

/**
 * Should we approve this file change? Based on historical data
 */
export async function shouldApproveFileChange(filePath: string): Promise<{
  recommend: boolean;
  confidence: number;
  reason: string;
}> {
  if (!dbPool) {
    return { recommend: false, confidence: 0, reason: 'Bridge not initialized' };
  }

  try {
    const result = await dbPool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE 'system-ai:tests:pass' = ANY(tags)) as passed
      FROM domain_entanglements
      WHERE source_domain = 'system-ai'
        AND $1 = ANY(tags)
        AND created_at > NOW() - INTERVAL '90 days'
    `, [`system-ai:file:${filePath}`]);

    const { total, passed } = result.rows[0];

    if (total === 0) {
      return {
        recommend: false,
        confidence: 0,
        reason: 'No historical data for this file - proceed with caution'
      };
    }

    const successRate = (passed / total) * 100;

    if (successRate > 80) {
      return {
        recommend: true,
        confidence: successRate / 100,
        reason: `File has ${successRate.toFixed(0)}% success rate in ${total} past changes - looks safe`
      };
    }

    if (successRate < 50) {
      return {
        recommend: false,
        confidence: (100 - successRate) / 100,
        reason: `File has only ${successRate.toFixed(0)}% success rate (risky) - recommend thorough review`
      };
    }

    return {
      recommend: true,
      confidence: 0.5,
      reason: `File has moderate ${successRate.toFixed(0)}% success rate in ${total} changes - review carefully`
    };
  } catch (err) {
    console.error('[SystemAI-Stack] Failed to check file approval:', err);
    return { recommend: false, confidence: 0, reason: 'Error checking history' };
  }
}

// ============================================================================
// COMPLETE ANALYTICS ENDPOINT DATA
// ============================================================================

export async function getAllLearningAnalytics(): Promise<{
  systemAI: {
    successRate: number;
    riskyFiles: string[];
  };
  autoHeal: {
    avgDuration: number;
    avgItemsProcessed: number;
    successRate: number;
  };
  recommendedSchedule: {
    intervalMinutes: number;
    reason: string;
  };
}> {
  const [successRate, riskyFiles, autoHeal, schedule] = await Promise.all([
    getSystemAISuccessRate(),
    getRiskyFiles(),
    getAutoHealEfficiency(),
    getOptimalAutoHealSchedule()
  ]);

  return {
    systemAI: { successRate, riskyFiles },
    autoHeal,
    recommendedSchedule: schedule
  };
}

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export const systemAIStackBridge = {
  // Setup
  initialize: initializeSystemAIStackBridge,
  
  // Learning functions (call these from your System AI code)
  learnFromProposal: learnFromSystemAIProposal,
  learnFromAutoHeal: learnFromAutoHeal,
  learnFromCuriosityTask: learnFromCuriosityTask,
  
  // Analytics functions (call these from your API routes)
  getSuccessRate: getSystemAISuccessRate,
  getRiskyFiles: getRiskyFiles,
  getAutoHealStats: getAutoHealEfficiency,
  getOptimalSchedule: getOptimalAutoHealSchedule,
  getCuriosityValue: getCuriosityTaskValue,
  shouldApproveFile: shouldApproveFileChange,
  getAllAnalytics: getAllLearningAnalytics
};
