// server/routes/triple-ai-v2.ts
// ============================================================================
// NEUROCORE V2: Triple AI API Routes
// Brain AI | Heart AI | System AI
// Device Modes: Standard (2-1-1) | Professional (2-2-2) | Advanced (3-3-3)
// ============================================================================

import { Router, Request, Response } from 'express';
import { executeBrainAI, executeBrainAIStandard, executeBrainAIProfessional, executeBrainAIAdvanced } from '../ai/brain/brain-ai';
import { executeHeartAI, executeCodeRepair, executeCodeOptimize } from '../ai/heart/heart-ai';
import { executeSystemAI, executeHealthCheck, executeAutoHeal } from '../ai/system/system-ai';
import { refreshAllCaches } from '../ai/core/ai-system-handler';
import { forceRefreshCache, getAllNodes, getStacksForNode, getDomainsForStack } from '../ai/core/auto-router';
import { type DeviceMode, type DeviceClass, MODE_LIMITS } from '../ai/core/types';

const router = Router();

// ============================================================================
// BRAIN AI ROUTES
// ============================================================================

router.post('/brain/chat', async (req: Request, res: Response) => {
  try {
    const { prompt, mode, deviceClass, userId, conversationId } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt required' });
    }

    const result = await executeBrainAI({
      prompt,
      mode: mode as DeviceMode,
      deviceClass: deviceClass as DeviceClass,
      userId,
      conversationId,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/brain/standard', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    const result = await executeBrainAIStandard(prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/brain/professional', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    const result = await executeBrainAIProfessional(prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/brain/advanced', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });
    const result = await executeBrainAIAdvanced(prompt);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// HEART AI ROUTES
// ============================================================================

router.post('/heart/analyze', async (req: Request, res: Response) => {
  try {
    const { prompt, mode, deviceClass, context } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });

    const result = await executeHeartAI({
      prompt,
      mode: mode as DeviceMode,
      deviceClass: deviceClass as DeviceClass,
      context,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/heart/repair', async (req: Request, res: Response) => {
  try {
    const { errorMessage, codeFile, codeContent } = req.body;
    if (!errorMessage || !codeFile || !codeContent) {
      return res.status(400).json({ success: false, error: 'errorMessage, codeFile, codeContent required' });
    }
    const result = await executeCodeRepair(errorMessage, codeFile, codeContent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/heart/optimize', async (req: Request, res: Response) => {
  try {
    const { codeFile, codeContent, goal } = req.body;
    if (!codeFile || !codeContent || !goal) {
      return res.status(400).json({ success: false, error: 'codeFile, codeContent, goal required' });
    }
    const result = await executeCodeOptimize(codeFile, codeContent, goal);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SYSTEM AI ROUTES
// ============================================================================

router.post('/system/analyze', async (req: Request, res: Response) => {
  try {
    const { prompt, mode, deviceClass, context } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: 'Prompt required' });

    const result = await executeSystemAI({
      prompt,
      mode: mode as DeviceMode,
      deviceClass: deviceClass as DeviceClass,
      context,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/system/health-check', async (req: Request, res: Response) => {
  try {
    const { metrics } = req.body;
    if (!metrics) return res.status(400).json({ success: false, error: 'metrics required' });
    const result = await executeHealthCheck(metrics);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/system/auto-heal', async (req: Request, res: Response) => {
  try {
    const { issue, diagnosticData } = req.body;
    if (!issue || !diagnosticData) {
      return res.status(400).json({ success: false, error: 'issue, diagnosticData required' });
    }
    const result = await executeAutoHeal(issue, diagnosticData);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ADMIN ROUTES
// ============================================================================

router.post('/admin/refresh-cache', async (_req: Request, res: Response) => {
  try {
    await refreshAllCaches();
    await forceRefreshCache();
    res.json({ success: true, message: 'All caches refreshed' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/nodes/:aiType', async (req: Request, res: Response) => {
  try {
    const { aiType } = req.params;
    if (!['brain', 'heart', 'system'].includes(aiType)) {
      return res.status(400).json({ success: false, error: 'Invalid AI type' });
    }
    const nodes = getAllNodes(aiType as any);
    res.json({ success: true, nodes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/stacks/:nodeId', async (req: Request, res: Response) => {
  try {
    const { nodeId } = req.params;
    const stacks = getStacksForNode(nodeId);
    res.json({ success: true, stacks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/domains/:stackId', async (req: Request, res: Response) => {
  try {
    const { stackId } = req.params;
    const domains = getDomainsForStack(stackId);
    res.json({ success: true, domains });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/mode-limits', (_req: Request, res: Response) => {
  res.json({
    success: true,
    modes: {
      standard: { ...MODE_LIMITS.standard, description: '2-1-1 = 2 domains/model', default: 'mobile, tablet' },
      professional: { ...MODE_LIMITS.professional, description: '2-2-2 = 4 domains/model', default: 'laptop' },
      advanced: { ...MODE_LIMITS.advanced, description: '3-3-3 = 9 domains/model', default: 'desktop, server' },
    },
  });
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    version: '2.0.0',
    architecture: {
      brain: { nodes: 18, stacksPerNode: 3, model1: 'DeepSeek V3', model2: 'GPT-4o Mini', model3: 'Claude 3 Haiku' },
      heart: { status: 'shared', description: 'Code/AI Health' },
      system: { status: 'shared', description: 'System Health' },
    },
    modes: {
      standard: '2-1-1 (2 domains)',
      professional: '2-2-2 (4 domains)',
      advanced: '3-3-3 (9 domains)',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
