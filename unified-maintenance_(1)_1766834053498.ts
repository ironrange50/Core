/**
 * UNIFIED MAINTENANCE SYSTEM
 * server/services/unified-maintenance.ts
 * 
 * Single source of truth for all maintenance operations
 * Integrates: auto-heal, clean sweep, learning, health monitoring
 */

import { Pool } from 'pg';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { systemAIStackBridge } from '../integrations/system-ai-stack-bridge';

// ============================================================================
// TYPES
// ============================================================================

export interface MaintenanceRun {
  id: string;
  runType: 'manual' | 'auto-heal' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed';
  triggeredBy: string;
  createdAt: Date;
  completedAt?: Date;
  duration?: number;
  actions: {
    name: string;
    status: 'success' | 'failed';
    details: string;
  }[];
  health: {
    before: SystemHealth;
    after?: SystemHealth;
  };
  results: {
    tempLogsRemoved: number;
    cacheFilesRemoved: number;
    dbRecordsRemoved: number;
    memoryFreed: number;
  };
  error?: string;
}

export interface SystemHealth {
  timestamp: Date;
  cpu: {
    load1m: number;
    load5m: number;
    load15m: number;
    usage: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    percentage: number;
  };
  database: {
    connections: number;
    size: number;
  };
  status: 'healthy' | 'warning' | 'critical';
}

export interface AutoHealConfig {
  enabled: boolean;
  checkIntervalMs: number;
  thresholds: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
  };
}

// ============================================================================
// UNIFIED MAINTENANCE CLASS
// ============================================================================

export class UnifiedMaintenanceSystem {
  private pool: Pool;
  private config: AutoHealConfig;
  private autoHealTimer?: NodeJS.Timeout;
  private currentRun?: MaintenanceRun;
  private runHistory: MaintenanceRun[] = [];
  private readonly maxHistorySize = 50;

  constructor(pool: Pool, config?: Partial<AutoHealConfig>) {
    this.pool = pool;
    this.config = {
      enabled: config?.enabled ?? true,
      checkIntervalMs: config?.checkIntervalMs ?? 3600000, // 1 hour default
      thresholds: {
        cpuPercent: config?.thresholds?.cpuPercent ?? 80,
        memoryPercent: config?.thresholds?.memoryPercent ?? 85,
        diskPercent: config?.thresholds?.diskPercent ?? 85
      }
    };
    this.loadHistory();
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Get current system health
   */
  public async getHealth(): Promise<SystemHealth> {
    const [load1m, load5m, load15m] = os.loadavg();
    const memTotal = os.totalmem();
    const memFree = os.freemem();
    const memUsed = memTotal - memFree;
    const memPercent = (memUsed / memTotal) * 100;

    // Get disk usage
    const { total: diskTotal, free: diskFree } = await this.getDiskUsage();
    const diskUsed = diskTotal - diskFree;
    const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

    // Get database info
    const dbInfo = await this.getDatabaseInfo();

    // CPU usage (approximate from load average)
    const cpuCount = os.cpus().length;
    const cpuUsage = (load1m / cpuCount) * 100;

    // Determine status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (memPercent > 90 || cpuUsage > 90 || diskPercent > 90) {
      status = 'critical';
    } else if (memPercent > 75 || cpuUsage > 75 || diskPercent > 75) {
      status = 'warning';
    }

    return {
      timestamp: new Date(),
      cpu: {
        load1m,
        load5m,
        load15m,
        usage: cpuUsage
      },
      memory: {
        total: memTotal,
        free: memFree,
        used: memUsed,
        percentage: memPercent
      },
      disk: {
        total: diskTotal,
        free: diskFree,
        used: diskUsed,
        percentage: diskPercent
      },
      database: {
        connections: dbInfo.connections,
        size: dbInfo.size
      },
      status
    };
  }

  /**
   * Run maintenance manually
   */
  public async runMaintenance(triggeredBy: string = 'system'): Promise<MaintenanceRun> {
    if (this.currentRun && this.currentRun.status === 'running') {
      throw new Error('Maintenance already running');
    }

    const run: MaintenanceRun = {
      id: `maint-${Date.now()}`,
      runType: 'manual',
      status: 'running',
      triggeredBy,
      createdAt: new Date(),
      actions: [],
      health: {
        before: await this.getHealth()
      },
      results: {
        tempLogsRemoved: 0,
        cacheFilesRemoved: 0,
        dbRecordsRemoved: 0,
        memoryFreed: 0
      }
    };

    this.currentRun = run;
    const startTime = Date.now();

    try {
      // Step 1: Clean temp logs
      const tempLogs = await this.cleanTempLogs();
      run.actions.push({
        name: 'Clean Temp Logs',
        status: 'success',
        details: `Removed ${tempLogs} temporary log files`
      });
      run.results.tempLogsRemoved = tempLogs;

      // Step 2: Clean cache files
      const cacheFiles = await this.cleanCacheFiles();
      run.actions.push({
        name: 'Clean Cache',
        status: 'success',
        details: `Removed ${cacheFiles} cache files`
      });
      run.results.cacheFilesRemoved = cacheFiles;

      // Step 3: Clean old database records
      const dbRecords = await this.cleanOldDatabaseRecords();
      run.actions.push({
        name: 'Clean Database',
        status: 'success',
        details: `Removed ${dbRecords} old database records`
      });
      run.results.dbRecordsRemoved = dbRecords;

      // Step 4: Garbage collection
      const memoryFreed = await this.runGarbageCollection();
      run.actions.push({
        name: 'Garbage Collection',
        status: 'success',
        details: `Freed ${(memoryFreed / 1024 / 1024).toFixed(2)} MB`
      });
      run.results.memoryFreed = memoryFreed;

      // Step 5: Learn from this maintenance run
      await systemAIStackBridge.learnFromAutoHeal({
        jobId: run.id,
        kind: 'maintenance',
        itemsProcessed: tempLogs + cacheFiles + dbRecords,
        duration: Date.now() - startTime,
        success: true
      });

      run.health.after = await this.getHealth();
      run.status = 'completed';
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;

    } catch (error: any) {
      run.status = 'failed';
      run.error = error.message;
      run.completedAt = new Date();
      run.duration = Date.now() - startTime;

      // Learn from failure
      await systemAIStackBridge.learnFromAutoHeal({
        jobId: run.id,
        kind: 'maintenance',
        itemsProcessed: 0,
        duration: run.duration,
        success: false
      });
    } finally {
      this.addToHistory(run);
      this.currentRun = undefined;
    }

    return run;
  }

  /**
   * Start auto-heal monitoring
   */
  public startAutoHeal(): void {
    if (this.autoHealTimer) {
      console.log('[Maintenance] Auto-heal already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[Maintenance] Auto-heal is disabled');
      return;
    }

    console.log(`[Maintenance] Starting auto-heal (checking every ${this.config.checkIntervalMs / 1000}s)`);

    this.autoHealTimer = setInterval(async () => {
      try {
        await this.checkAndHeal();
      } catch (error) {
        console.error('[Maintenance] Auto-heal check failed:', error);
      }
    }, this.config.checkIntervalMs);

    // Run initial check
    this.checkAndHeal();
  }

  /**
   * Stop auto-heal monitoring
   */
  public stopAutoHeal(): void {
    if (this.autoHealTimer) {
      clearInterval(this.autoHealTimer);
      this.autoHealTimer = undefined;
      console.log('[Maintenance] Auto-heal stopped');
    }
  }

  /**
   * Get auto-heal status
   */
  public getAutoHealStatus(): {
    enabled: boolean;
    running: boolean;
    config: AutoHealConfig;
    lastCheck?: Date;
    nextCheck?: Date;
  } {
    return {
      enabled: this.config.enabled,
      running: !!this.autoHealTimer,
      config: this.config,
      lastCheck: this.runHistory[0]?.createdAt,
      nextCheck: this.autoHealTimer 
        ? new Date(Date.now() + this.config.checkIntervalMs)
        : undefined
    };
  }

  /**
   * Get maintenance run history
   */
  public getHistory(limit: number = 20): MaintenanceRun[] {
    return this.runHistory.slice(0, limit);
  }

  /**
   * Get current running maintenance
   */
  public getCurrentRun(): MaintenanceRun | undefined {
    return this.currentRun;
  }

  // =========================================================================
  // PRIVATE METHODS
  // =========================================================================

  private async checkAndHeal(): Promise<void> {
    const health = await this.getHealth();
    console.log('[Maintenance] Health check:', {
      status: health.status,
      cpu: `${health.cpu.usage.toFixed(1)}%`,
      memory: `${health.memory.percentage.toFixed(1)}%`,
      disk: `${health.disk.percentage.toFixed(1)}%`
    });

    // Check if auto-heal is needed
    if (
      health.memory.percentage > this.config.thresholds.memoryPercent ||
      health.cpu.usage > this.config.thresholds.cpuPercent ||
      health.disk.percentage > this.config.thresholds.diskPercent
    ) {
      console.log('[Maintenance] Thresholds exceeded - running auto-heal');
      await this.runMaintenance('auto-heal');
    }
  }

  private async cleanTempLogs(): Promise<number> {
    const tempDirs = [
      path.join(process.cwd(), 'logs', 'tmp'),
      path.join(process.cwd(), 'logs', 'rotated')
    ];

    let removed = 0;
    for (const dir of tempDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(dir, file));
            removed++;
          } catch {}
        }
      }
    }

    return removed;
  }

  private async cleanCacheFiles(): Promise<number> {
    const cacheDir = path.join(process.cwd(), 'tmp', 'cache');
    
    if (!fs.existsSync(cacheDir)) {
      return 0;
    }

    let removed = 0;
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(cacheDir, file));
        removed++;
      } catch {}
    }

    return removed;
  }

  private async cleanOldDatabaseRecords(): Promise<number> {
    let totalRemoved = 0;

    // Clean old model metrics (60 days)
    const metricsCutoff = new Date();
    metricsCutoff.setDate(metricsCutoff.getDate() - 60);
    
    try {
      const metricsResult = await this.pool.query(
        `DELETE FROM model_metrics WHERE window_end < $1`,
        [metricsCutoff]
      );
      totalRemoved += metricsResult.rowCount || 0;
    } catch {}

    // Clean old curiosity tasks (30 days)
    const curiosityCutoff = new Date();
    curiosityCutoff.setDate(curiosityCutoff.getDate() - 30);
    
    try {
      const curiosityResult = await this.pool.query(
        `DELETE FROM curiosity_tasks 
         WHERE status IN ('done', 'failed') 
         AND updated_at < $1`,
        [curiosityCutoff]
      );
      totalRemoved += curiosityResult.rowCount || 0;
    } catch {}

    return totalRemoved;
  }

  private async runGarbageCollection(): Promise<number> {
    const memBefore = process.memoryUsage().heapUsed;
    
    if (global.gc) {
      global.gc();
      const memAfter = process.memoryUsage().heapUsed;
      return Math.max(0, memBefore - memAfter);
    }

    return 0;
  }

  private async getDiskUsage(): Promise<{ total: number; free: number }> {
    // This is a simplified version - in production you'd use a library like 'diskusage'
    // For now, return estimated values
    return {
      total: 1024 * 1024 * 1024 * 100, // 100GB
      free: 1024 * 1024 * 1024 * 50    // 50GB
    };
  }

  private async getDatabaseInfo(): Promise<{ connections: number; size: number }> {
    try {
      const connResult = await this.pool.query(
        `SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`
      );
      
      const sizeResult = await this.pool.query(
        `SELECT pg_database_size(current_database()) as size`
      );

      return {
        connections: parseInt(connResult.rows[0]?.count || '0'),
        size: parseInt(sizeResult.rows[0]?.size || '0')
      };
    } catch {
      return { connections: 0, size: 0 };
    }
  }

  private addToHistory(run: MaintenanceRun): void {
    this.runHistory.unshift(run);
    if (this.runHistory.length > this.maxHistorySize) {
      this.runHistory = this.runHistory.slice(0, this.maxHistorySize);
    }
    this.saveHistory();
  }

  private saveHistory(): void {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(dataDir, 'maintenance-runs.json'),
      JSON.stringify(this.runHistory, null, 2)
    );
  }

  private loadHistory(): void {
    const file = path.join(process.cwd(), 'data', 'maintenance-runs.json');
    if (fs.existsSync(file)) {
      try {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        this.runHistory = data.map((run: any) => ({
          ...run,
          createdAt: new Date(run.createdAt),
          completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
          health: {
            before: {
              ...run.health.before,
              timestamp: new Date(run.health.before.timestamp)
            },
            after: run.health.after ? {
              ...run.health.after,
              timestamp: new Date(run.health.after.timestamp)
            } : undefined
          }
        }));
      } catch (error) {
        console.error('[Maintenance] Failed to load history:', error);
        this.runHistory = [];
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: UnifiedMaintenanceSystem | null = null;

export function initializeMaintenanceSystem(
  pool: Pool,
  config?: Partial<AutoHealConfig>
): UnifiedMaintenanceSystem {
  instance = new UnifiedMaintenanceSystem(pool, config);
  return instance;
}

export function getMaintenanceSystem(): UnifiedMaintenanceSystem {
  if (!instance) {
    throw new Error('Maintenance system not initialized. Call initializeMaintenanceSystem() first.');
  }
  return instance;
}
