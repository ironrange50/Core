/**
 * ENHANCED MIGRATION ROUTES
 * server/routes/migration-enhanced.ts
 * 
 * API routes that support installation → migration → cutover workflow
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { MigrationOrchestrator } from '../services/migration-orchestrator';
import { checkInstallationStatus } from '../services/migration-installer';

const router = Router();

// Store active orchestrators by session
const orchestrators = new Map<string, MigrationOrchestrator>();

function getOrchestrator(sessionId: string, pool: Pool): MigrationOrchestrator {
  if (!orchestrators.has(sessionId)) {
    orchestrators.set(sessionId, new MigrationOrchestrator(pool));
  }
  return orchestrators.get(sessionId)!;
}

// ============================================================================
// INSTALLATION & VERIFICATION ENDPOINTS
// ============================================================================

/**
 * GET /api/migration/check-installation
 * Check if target server has all prerequisites installed
 */
router.get('/check-installation', async (_req: Request, res: Response) => {
  try {
    const status = await checkInstallationStatus();
    
    res.json({
      success: true,
      ready: status.ready,
      requirements: status.requirements,
      missing: status.missing,
      message: status.ready 
        ? 'Target server is ready for migration' 
        : `Missing: ${status.missing.join(', ')}`
    });
  } catch (error: any) {
    console.error('[MIGRATION] Check installation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check installation'
    });
  }
});

/**
 * POST /api/migration/install-prerequisites
 * Install all missing prerequisites on target server
 */
router.post('/install-prerequisites', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }

    const pool = (req as any).dbPool; // Assume pool is attached to request
    const orchestrator = getOrchestrator(sessionId, pool);

    // Start installation (this runs in background)
    orchestrator.install().then(result => {
      console.log('[MIGRATION] Installation result:', result);
    });

    res.json({
      success: true,
      message: 'Installation started. Poll /migration/status for progress.'
    });

  } catch (error: any) {
    console.error('[MIGRATION] Install failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Installation failed'
    });
  }
});

/**
 * GET /api/migration/status/:sessionId
 * Get current migration status including installation progress
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const pool = (req as any).dbPool;
    
    const orchestrator = getOrchestrator(sessionId, pool);
    const state = orchestrator.getState();

    res.json({
      success: true,
      state: {
        phase: state.phase,
        currentStep: state.currentStep,
        installationReady: state.installationReady,
        installationProgress: state.installationProgress,
        migrationProgress: state.migrationProgress,
        errors: state.errors,
        warnings: state.warnings,
        startedAt: state.startedAt,
        completedAt: state.completedAt
      }
    });

  } catch (error: any) {
    console.error('[MIGRATION] Get status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get status'
    });
  }
});

// ============================================================================
// MIGRATION WORKFLOW ENDPOINTS
// ============================================================================

/**
 * POST /api/migration/start
 * Start the migration process (after prerequisites are installed)
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }

    const pool = (req as any).dbPool;
    const orchestrator = getOrchestrator(sessionId, pool);

    // Start migration (runs in background)
    orchestrator.migrate().then(result => {
      console.log('[MIGRATION] Migration result:', result);
    });

    res.json({
      success: true,
      message: 'Migration started. Poll /migration/status for progress.'
    });

  } catch (error: any) {
    console.error('[MIGRATION] Start migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start migration'
    });
  }
});

/**
 * POST /api/migration/cutover
 * Perform cutover to new server (final step)
 */
router.post('/cutover', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ success: false, error: 'sessionId required' });
    }

    const pool = (req as any).dbPool;
    const orchestrator = getOrchestrator(sessionId, pool);

    const result = await orchestrator.cutover();

    if (result.success) {
      // Cleanup orchestrator after successful cutover
      await orchestrator.cleanup();
      orchestrators.delete(sessionId);
    }

    res.json(result);

  } catch (error: any) {
    console.error('[MIGRATION] Cutover failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Cutover failed'
    });
  }
});

/**
 * DELETE /api/migration/cancel/:sessionId
 * Cancel and cleanup migration
 */
router.delete('/cancel/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (orchestrators.has(sessionId)) {
      const orchestrator = orchestrators.get(sessionId)!;
      await orchestrator.cleanup();
      orchestrators.delete(sessionId);
    }

    res.json({
      success: true,
      message: 'Migration cancelled and cleaned up'
    });

  } catch (error: any) {
    console.error('[MIGRATION] Cancel failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel migration'
    });
  }
});

// ============================================================================
// LEGACY ENDPOINTS (for compatibility)
// ============================================================================

router.get('/servers', async (req: Request, res: Response) => {
  // Keep existing servers endpoint for now
  res.json({ success: true, servers: [] });
});

router.post('/jobs', async (req: Request, res: Response) => {
  // Keep existing jobs endpoint for now
  res.json({ success: true, jobId: 'job-' + Date.now() });
});

export default router;
