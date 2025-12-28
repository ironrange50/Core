// server/ai/index.ts
// ============================================================================
// NEUROCORE V2: Triple AI Exports
// ============================================================================

// Core Types
export * from './core/types';

// Auto-Router
export {
  autoRoute,
  forceRefreshCache,
  getNodesByLabel,
  getNodesForModel,
  getAllNodes,
  getStacksForNode,
  getDomainsForStack,
} from './core/auto-router';

// AI System Handler
export {
  executeAISystem,
  refreshAllCaches,
} from './core/ai-system-handler';

// Knowledge Algorithms
export {
  brainKnowledgeAlgorithm,
  heartKnowledgeAlgorithm,
  systemKnowledgeAlgorithm,
  runKnowledgeAlgorithm,
} from './knowledge/algorithms';

// Brain AI
export {
  executeBrainAI,
  executeBrainAIStandard,
  executeBrainAIProfessional,
  executeBrainAIAdvanced,
  type BrainAIRequest,
  type BrainAIResponse,
} from './brain/brain-ai';

// Heart AI
export {
  executeHeartAI,
  executeCodeRepair,
  executeCodeOptimize,
  type HeartAIRequest,
  type HeartAIResponse,
} from './heart/heart-ai';

// System AI
export {
  executeSystemAI,
  executeHealthCheck,
  executeAutoHeal,
  type SystemAIRequest,
  type SystemAIResponse,
} from './system/system-ai';
