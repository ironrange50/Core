/**
 * UNIFIED MAINTENANCE ROUTES
 * server/routes/maintenance-unified.ts
 * 
 * API endpoints for the unified maintenance system
 */

import { Router, Request, Response } from 'express';
import { requireCreator } from '../middleware/requireCreator';
import { getMaintenanceSystem } from '../services/unified-maintenance';

const router = Router();

// ============================================================================
// HEALTH ENDPOINTS
// ============================================================================

/**
 * GET /api/maintenance/health
 * Get current system health
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const health = await system.getHealth();
    
    res.json({
      success: true,
      health
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get health failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get health'
    });
  }
});

// ============================================================================
// MAINTENANCE RUN ENDPOINTS
// ============================================================================

/**
 * GET /api/maintenance/runs
 * Get maintenance run history
 */
router.get('/runs', (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const runs = system.getHistory(50);
    
    res.json({
      success: true,
      runs: runs.map(run => ({
        id: run.id,
        runType: run.runType,
        status: run.status,
        triggeredBy: run.triggeredBy,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        duration: run.duration,
        actionsCompleted: run.actions.filter(a => a.status === 'success').length,
        actionsFailed: run.actions.filter(a => a.status === 'failed').length,
        results: run.results,
        error: run.error
      }))
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get runs failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get runs'
    });
  }
});

/**
 * GET /api/maintenance/runs/:id
 * Get detailed info about a specific run
 */
router.get('/runs/:id', (req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const runs = system.getHistory(100);
    const run = runs.find(r => r.id === req.params.id);
    
    if (!run) {
      return res.status(404).json({
        success: false,
        error: 'Run not found'
      });
    }
    
    res.json({
      success: true,
      run: {
        ...run,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString()
      }
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get run failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get run'
    });
  }
});

/**
 * POST /api/maintenance/trigger
 * Manually trigger a maintenance run
 */
router.post('/trigger', requireCreator, async (req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const user = (req as any).user;
    const triggeredBy = user?.id || user?.email || 'admin';
    
    const run = await system.runMaintenance(triggeredBy);
    
    res.json({
      success: true,
      run: {
        id: run.id,
        runType: run.runType,
        status: run.status,
        triggeredBy: run.triggeredBy,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString(),
        duration: run.duration,
        actionsCompleted: run.actions.filter(a => a.status === 'success').length,
        actionsFailed: run.actions.filter(a => a.status === 'failed').length,
        results: run.results
      }
    });
  } catch (error: any) {
    console.error('[Maintenance API] Trigger failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to trigger maintenance'
    });
  }
});

/**
 * GET /api/maintenance/current
 * Get currently running maintenance (if any)
 */
router.get('/current', (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const current = system.getCurrentRun();
    
    if (!current) {
      return res.json({
        success: true,
        running: false,
        run: null
      });
    }
    
    res.json({
      success: true,
      running: true,
      run: {
        id: current.id,
        runType: current.runType,
        status: current.status,
        triggeredBy: current.triggeredBy,
        createdAt: current.createdAt.toISOString(),
        actions: current.actions
      }
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get current failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get current run'
    });
  }
});

// ============================================================================
// AUTO-HEAL ENDPOINTS
// ============================================================================

/**
 * GET /api/maintenance/auto-heal/status
 * Get auto-heal status
 */
router.get('/auto-heal/status', (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const status = system.getAutoHealStatus();
    
    res.json({
      success: true,
      ...status,
      lastCheck: status.lastCheck?.toISOString(),
      nextCheck: status.nextCheck?.toISOString()
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get auto-heal status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get auto-heal status'
    });
  }
});

/**
 * POST /api/maintenance/auto-heal/start
 * Start auto-heal monitoring
 */
router.post('/auto-heal/start', requireCreator, (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    system.startAutoHeal();
    const status = system.getAutoHealStatus();
    
    res.json({
      success: true,
      message: 'Auto-heal started',
      ...status,
      lastCheck: status.lastCheck?.toISOString(),
      nextCheck: status.nextCheck?.toISOString()
    });
  } catch (error: any) {
    console.error('[Maintenance API] Start auto-heal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start auto-heal'
    });
  }
});

/**
 * POST /api/maintenance/auto-heal/stop
 * Stop auto-heal monitoring
 */
router.post('/auto-heal/stop', requireCreator, (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    system.stopAutoHeal();
    const status = system.getAutoHealStatus();
    
    res.json({
      success: true,
      message: 'Auto-heal stopped',
      ...status
    });
  } catch (error: any) {
    console.error('[Maintenance API] Stop auto-heal failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop auto-heal'
    });
  }
});

// ============================================================================
// STATUS ENDPOINT (Combined info)
// ============================================================================

/**
 * GET /api/maintenance/status
 * Get overall maintenance system status
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const system = getMaintenanceSystem();
    const [health, autoHealStatus] = await Promise.all([
      system.getHealth(),
      Promise.resolve(system.getAutoHealStatus())
    ]);
    
    const currentRun = system.getCurrentRun();
    const recentRuns = system.getHistory(5);
    
    res.json({
      success: true,
      health,
      autoHeal: {
        ...autoHealStatus,
        lastCheck: autoHealStatus.lastCheck?.toISOString(),
        nextCheck: autoHealStatus.nextCheck?.toISOString()
      },
      currentRun: currentRun ? {
        id: currentRun.id,
        status: currentRun.status,
        createdAt: currentRun.createdAt.toISOString()
      } : null,
      recentRuns: recentRuns.map(run => ({
        id: run.id,
        runType: run.runType,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        duration: run.duration
      }))
    });
  } catch (error: any) {
    console.error('[Maintenance API] Get status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get status'
    });
  }
});

export default router;
