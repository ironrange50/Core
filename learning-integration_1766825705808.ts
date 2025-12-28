/**
 * COMPLETE INTEGRATION PACKAGE
 * 
 * This file contains all the integration code needed to connect
 * Boxed Learning Algorithms with your existing systems.
 */

// ============================================================================
// 1. MONITORING INTEGRATION
// ============================================================================

import { BoxedLearningAlgorithm } from './BoxedLearningAlgorithm';

export class LearningMonitoringBridge {
  private engines: Map<string, BoxedLearningAlgorithm> = new Map();
  private metricsHistory: Array<any> = [];
  
  registerEngine(name: string, engine: BoxedLearningAlgorithm) {
    this.engines.set(name, engine);
    console.log(`[LEARNING-MONITOR] Registered ${name}`);
  }
  
  async collectMetrics() {
    const timestamp = new Date();
    const metrics: any = { timestamp, engines: {} };
    
    for (const [name, engine] of this.engines) {
      const engineMetrics = engine.getMetrics();
      metrics.engines[name] = engineMetrics;
      
      // Alert if performance drops
      if (engineMetrics.successRate < 0.7) {
        this.alert('warning', `${name} success rate: ${(engineMetrics.successRate * 100).toFixed(1)}%`);
      }
    }
    
    this.metricsHistory.push(metrics);
    if (this.metricsHistory.length > 1000) {
      this.metricsHistory.shift();
    }
    
    return metrics;
  }
  
  getHealthStatus() {
    const status: any = { learning: { status: 'healthy', engines: {} } };
    
    for (const [name, engine] of this.engines) {
      const metrics = engine.getMetrics();
      let engineStatus = 'healthy';
      
      if (metrics.successRate < 0.6) engineStatus = 'degraded';
      if (metrics.successRate < 0.4) engineStatus = 'critical';
      
      status.learning.engines[name] = {
        status: engineStatus,
        ...metrics,
      };
      
      if (engineStatus === 'critical') status.learning.status = 'critical';
      else if (engineStatus === 'degraded' && status.learning.status === 'healthy') {
        status.learning.status = 'degraded';
      }
    }
    
    return status;
  }
  
  getMetricsHistory(engineName?: string, limit: number = 100) {
    if (!engineName) {
      return this.metricsHistory.slice(-limit);
    }
    
    return this.metricsHistory
      .map((m) => ({
        timestamp: m.timestamp,
        ...m.engines[engineName],
      }))
      .filter((m) => m.successRate !== undefined)
      .slice(-limit);
  }
  
  private alert(severity: string, message: string) {
    console.warn(`[LEARNING-ALERT] ${severity.toUpperCase()}: ${message}`);
    // In production: Send to your existing alert system
  }
}

export const learningMonitor = new LearningMonitoringBridge();

// ============================================================================
// 2. MEMORY STORAGE ADAPTER
// ============================================================================

import { db } from '../lib/db';
import { unifiedMemoryStore } from '../lib/unified-database-schema';
import { eq } from 'drizzle-orm';

export class LearningMemoryAdapter {
  async saveLearningState(engineType: string, state: any) {
    const memoryId = `learning-state-${engineType}`;
    
    try {
      await db.insert(unifiedMemoryStore).values({
        memoryId,
        userId: 'SYSTEM',
        conversationId: `learning-${engineType}`,
        rawInput: JSON.stringify(state),
        isLearningRecord: true,
        healthSnapshot: {
          engineType,
          version: state.version,
          successRate: state.successRate,
          confidence: state.confidence,
        },
        status: 'active',
        coherenceScore: state.confidence,
        confidenceScore: state.successRate,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      }).onConflictDoUpdate({
        target: [unifiedMemoryStore.memoryId],
        set: {
          rawInput: JSON.stringify(state),
          updatedAt: new Date(),
          healthSnapshot: {
            engineType,
            version: state.version,
            successRate: state.successRate,
            confidence: state.confidence,
          },
        },
      });
      
      console.log(`[MEMORY-ADAPTER] Saved ${engineType} state v${state.version}`);
    } catch (error) {
      console.error(`[MEMORY-ADAPTER] Save failed for ${engineType}:`, error);
    }
  }
  
  async loadLearningState(engineType: string) {
    try {
      const memoryId = `learning-state-${engineType}`;
      const result = await db.select()
        .from(unifiedMemoryStore)
        .where(eq(unifiedMemoryStore.memoryId, memoryId))
        .limit(1);
      
      if (result.length === 0) return null;
      
      const state = JSON.parse(result[0].rawInput || '{}');
      console.log(`[MEMORY-ADAPTER] Loaded ${engineType} state v${state.version}`);
      return state;
    } catch (error) {
      console.error(`[MEMORY-ADAPTER] Load failed for ${engineType}:`, error);
      return null;
    }
  }
  
  async storeInsight(engineType: string, insight: any) {
    const memoryId = `learning-insight-${engineType}-${Date.now()}`;
    
    try {
      await db.insert(unifiedMemoryStore).values({
        memoryId,
        userId: 'SYSTEM',
        conversationId: `learning-insights-${engineType}`,
        rawInput: insight.reasoning || 'Learning insight',
        cleanedPrompt: JSON.stringify(insight.proposedChanges),
        isLearningRecord: true,
        healthSnapshot: {
          engineType,
          expectedImprovement: insight.expectedImprovement,
          confidence: insight.confidence,
        },
        coherenceScore: insight.confidence,
        confidenceScore: insight.confidence,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });
      
      console.log(`[MEMORY-ADAPTER] Stored insight for ${engineType}`);
    } catch (error) {
      console.error(`[MEMORY-ADAPTER] Insight storage failed:`, error);
    }
  }
  
  async getLearningInsights(engineType: string, limit: number = 10) {
    try {
      const results = await db.select()
        .from(unifiedMemoryStore)
        .where(eq(unifiedMemoryStore.conversationId, `learning-insights-${engineType}`))
        .orderBy(desc(unifiedMemoryStore.createdAt))
        .limit(limit);
      
      return results.map((r) => ({
        reasoning: r.rawInput,
        changes: JSON.parse(r.cleanedPrompt || '{}'),
        confidence: r.coherenceScore,
        createdAt: r.createdAt,
      }));
    } catch (error) {
      console.error(`[MEMORY-ADAPTER] Failed to get insights:`, error);
      return [];
    }
  }
}

export const learningMemoryAdapter = new LearningMemoryAdapter();

// ============================================================================
// 3. SCHEDULER INTEGRATION
// ============================================================================

import cron from 'node-cron';

export class LearningScheduler {
  private engines: Map<string, BoxedLearningAlgorithm> = new Map();
  
  registerEngine(name: string, engine: BoxedLearningAlgorithm) {
    this.engines.set(name, engine);
  }
  
  start() {
    console.log('[LEARNING-SCHEDULER] Starting scheduled tasks...');
    
    // Hourly: Save state
    cron.schedule('0 * * * *', () => this.saveAllStates());
    
    // Every 6 hours: Performance check
    cron.schedule('0 */6 * * *', () => this.performanceCheck());
    
    // Daily: Collect metrics
    cron.schedule('0 3 * * *', () => this.dailyMetrics());
    
    // Weekly: Cleanup
    cron.schedule('0 4 * * 0', () => this.weeklyCleanup());
    
    console.log('[LEARNING-SCHEDULER] All tasks scheduled');
  }
  
  private async saveAllStates() {
    console.log('[SCHEDULER] Saving learning states...');
    for (const [name, engine] of this.engines) {
      try {
        await engine.saveState();
      } catch (error) {
        console.error(`[SCHEDULER] Failed to save ${name}:`, error);
      }
    }
  }
  
  private async performanceCheck() {
    console.log('[SCHEDULER] Performance check...');
    for (const [name, engine] of this.engines) {
      const metrics = engine.getMetrics();
      if (metrics.successRate < 0.7) {
        console.warn(`[SCHEDULER] ${name} underperforming: ${(metrics.successRate * 100).toFixed(1)}%`);
      }
    }
  }
  
  private async dailyMetrics() {
    console.log('[SCHEDULER] Collecting daily metrics...');
    const metrics = await learningMonitor.collectMetrics();
    console.log('[SCHEDULER] Metrics:', JSON.stringify(metrics, null, 2));
  }
  
  private async weeklyCleanup() {
    console.log('[SCHEDULER] Weekly cleanup...');
    // Cleanup old insights, archived states, etc.
  }
}

export const learningScheduler = new LearningScheduler();

// ============================================================================
// 4. META-MAINTENANCE SYSTEM
// ============================================================================

import { MemoryOptimizerLearning } from './MemoryLearningEngines';

export class MetaMaintenanceSystem {
  private metaOptimizer: MemoryOptimizerLearning;
  private engines: Map<string, BoxedLearningAlgorithm> = new Map();
  
  constructor() {
    this.metaOptimizer = new MemoryOptimizerLearning();
    console.log('[META] Initialized meta-maintenance');
  }
  
  registerEngine(name: string, engine: BoxedLearningAlgorithm) {
    this.engines.set(name, engine);
  }
  
  async maintainLearningStates() {
    console.log('[META] Running meta-maintenance...');
    
    for (const [name, engine] of this.engines) {
      const state = engine.getState();
      const metrics = engine.getMetrics();
      
      // Treat learning state as a memory to optimize
      const stateAsMemory = {
        id: `learning-state-${name}`,
        userId: 'SYSTEM',
        content: JSON.stringify(state),
        coherenceScore: metrics.confidence,
        confidenceScore: metrics.successRate,
        accessCount: metrics.totalIterations,
        lastAccessed: state.lastUpdated,
        createdAt: new Date(),
        metadata: { engineType: name },
      };
      
      const decision = await this.metaOptimizer.optimizeMemory(stateAsMemory, {
        systemHealth: 'good',
      });
      
      console.log(`[META] ${name}: ${decision.action} (confidence: ${decision.confidence.toFixed(2)})`);
      
      // If state is bad, suggest reset
      if ((decision.action === 'delete' || decision.action === 'archive') && metrics.successRate < 0.5) {
        await this.suggestReset(name, metrics);
      }
    }
  }
  
  private async suggestReset(engineName: string, metrics: any) {
    console.warn(`[META] Suggesting reset for ${engineName} (success rate: ${metrics.successRate})`);
    // In production: Create notification for creator to approve
  }
  
  async monitorSynergy() {
    console.log('[META] Monitoring synergy...');
    // Check cross-engine learning effectiveness
  }
  
  start() {
    // Daily meta-maintenance
    cron.schedule('0 2 * * *', async () => {
      await this.maintainLearningStates();
      await this.monitorSynergy();
    });
    
    console.log('[META] Scheduled meta-maintenance');
  }
}

export const metaMaintenance = new MetaMaintenanceSystem();

// ============================================================================
// 5. INITIALIZATION - Put It All Together
// ============================================================================

import { KnowledgeEngineLearning } from './KnowledgeEngineLearning';
import { MemoryAssistantLearning } from './MemoryLearningEngines';
import { CuriosityEngineLearning } from './CuriosityEngineLearning';

// Create engine instances
export const knowledgeEngine = new KnowledgeEngineLearning();
export const memoryOptimizer = new MemoryOptimizerLearning();
export const memoryAssistant = new MemoryAssistantLearning();
export const curiosityEngine = new CuriosityEngineLearning();

/**
 * Initialize all integrations
 */
export function initializeLearningSystem() {
  console.log('[LEARNING] Initializing learning system...');
  
  // Register with monitoring
  learningMonitor.registerEngine('knowledge', knowledgeEngine);
  learningMonitor.registerEngine('memory-optimizer', memoryOptimizer);
  learningMonitor.registerEngine('memory-assistant', memoryAssistant);
  learningMonitor.registerEngine('curiosity', curiosityEngine);
  
  // Register with scheduler
  learningScheduler.registerEngine('knowledge', knowledgeEngine);
  learningScheduler.registerEngine('memory-optimizer', memoryOptimizer);
  learningScheduler.registerEngine('memory-assistant', memoryAssistant);
  learningScheduler.registerEngine('curiosity', curiosityEngine);
  
  // Register with meta-maintenance
  metaMaintenance.registerEngine('knowledge', knowledgeEngine);
  metaMaintenance.registerEngine('memory-optimizer', memoryOptimizer);
  metaMaintenance.registerEngine('memory-assistant', memoryAssistant);
  metaMaintenance.registerEngine('curiosity', curiosityEngine);
  
  // Start scheduler
  learningScheduler.start();
  
  // Start meta-maintenance
  metaMaintenance.start();
  
  console.log('[LEARNING] System initialized successfully');
  
  return {
    knowledgeEngine,
    memoryOptimizer,
    memoryAssistant,
    curiosityEngine,
    learningMonitor,
    learningScheduler,
    metaMaintenance,
  };
}

// ============================================================================
// 6. HEALTH CHECK INTEGRATION
// ============================================================================

/**
 * Add this to your existing /api/health endpoint
 */
export async function getLearningHealth() {
  return {
    learning: learningMonitor.getHealthStatus(),
    metrics: await learningMonitor.collectMetrics(),
  };
}

/**
 * New endpoint for detailed learning metrics
 */
export function getLearningMetrics(engineName?: string, limit?: number) {
  return {
    current: learningMonitor.getHealthStatus(),
    history: learningMonitor.getMetricsHistory(engineName, limit),
  };
}
