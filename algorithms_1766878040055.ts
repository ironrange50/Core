// server/ai/knowledge/algorithms.ts
// ============================================================================
// NEUROCORE V2: Knowledge Algorithms
// Brain AI | Heart AI | System AI
// Each takes 3 model responses → Fuses into 1 Final Answer
// ============================================================================

import {
  type AIType,
  type ModelResponse,
  type KnowledgeAlgorithmInput,
  type KnowledgeAlgorithmOutput,
} from '../core/types';

// ============================================================================
// UTILITIES
// ============================================================================
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  return overlap / Math.max(words1.size, words2.size);
}

function calculateResponseQuality(response: ModelResponse): number {
  if (!response.success || !response.response) return 0;
  
  const text = response.response;
  let score = 0.5;
  
  // Length factor
  const length = text.length;
  if (length > 100 && length < 5000) score += 0.2;
  else if (length >= 50) score += 0.1;
  
  // Structure factor
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 2) score += 0.1;
  
  // No error indicators
  if (!text.toLowerCase().includes('error') && 
      !text.toLowerCase().includes('cannot') &&
      !text.toLowerCase().includes('unable')) {
    score += 0.1;
  }
  
  // Response time factor
  if (response.timeMs > 500 && response.timeMs < 10000) score += 0.1;
  
  return Math.min(1, score);
}

// ============================================================================
// BRAIN AI KNOWLEDGE ALGORITHM
// Focus: User-facing quality, coherence, helpfulness
// ============================================================================
export function brainKnowledgeAlgorithm(input: KnowledgeAlgorithmInput): KnowledgeAlgorithmOutput {
  const { responses } = input;
  const reasoning: string[] = [];
  
  const validResponses = responses.filter(r => r.success && r.response?.trim());
  
  if (validResponses.length === 0) {
    return {
      fusedAnswer: 'I apologize, but I was unable to generate a response. Please try again.',
      qualityScore: 0,
      reasoning: ['No valid responses from any model'],
      selectedPrimary: 1,
      contributionWeights: { model1: 0, model2: 0, model3: 0 },
    };
  }
  
  // Score responses
  const scores = validResponses.map(r => ({
    response: r,
    quality: calculateResponseQuality(r),
  }));
  
  // Check coherence
  let coherenceScore = 1;
  if (validResponses.length >= 2) {
    let totalSim = 0;
    let pairs = 0;
    for (let i = 0; i < validResponses.length; i++) {
      for (let j = i + 1; j < validResponses.length; j++) {
        totalSim += calculateSimilarity(validResponses[i].response, validResponses[j].response);
        pairs++;
      }
    }
    coherenceScore = pairs > 0 ? totalSim / pairs : 1;
  }
  reasoning.push(`Coherence: ${(coherenceScore * 100).toFixed(1)}%`);
  
  // Select best response
  scores.sort((a, b) => b.quality - a.quality);
  const primary = scores[0];
  reasoning.push(`Primary: Model ${primary.response.modelSlot} (${(primary.quality * 100).toFixed(1)}%)`);
  
  // Log routing paths used
  for (const r of validResponses) {
    const nodeLabels = r.routing.nodes.map(n => n.label).join('→');
    reasoning.push(`M${r.modelSlot}: ${nodeLabels}`);
  }
  
  // Calculate weights
  const totalQuality = scores.reduce((sum, s) => sum + s.quality, 0);
  const weights = { model1: 0, model2: 0, model3: 0 };
  for (const s of scores) {
    const key = `model${s.response.modelSlot}` as keyof typeof weights;
    weights[key] = totalQuality > 0 ? s.quality / totalQuality : 0;
  }
  
  const qualityScore = (primary.quality + coherenceScore) / 2;
  
  return {
    fusedAnswer: primary.response.response,
    qualityScore,
    reasoning,
    selectedPrimary: primary.response.modelSlot as 1 | 2 | 3,
    contributionWeights: weights,
  };
}

// ============================================================================
// HEART AI KNOWLEDGE ALGORITHM
// Focus: Code accuracy, technical precision
// ============================================================================
export function heartKnowledgeAlgorithm(input: KnowledgeAlgorithmInput): KnowledgeAlgorithmOutput {
  const { responses } = input;
  const reasoning: string[] = [];
  
  const validResponses = responses.filter(r => r.success && r.response?.trim());
  
  if (validResponses.length === 0) {
    return {
      fusedAnswer: '// Unable to generate code fix. Please provide more details.',
      qualityScore: 0,
      reasoning: ['No valid responses from any model'],
      selectedPrimary: 1,
      contributionWeights: { model1: 0, model2: 0, model3: 0 },
    };
  }
  
  // Score with code-specific criteria
  const scores = validResponses.map(r => {
    let quality = calculateResponseQuality(r);
    const text = r.response;
    
    if (text.includes('```')) quality += 0.15;
    if (text.includes('function ') || text.includes('const ') || text.includes('class ')) quality += 0.1;
    if (text.includes('import ') || text.includes('require(')) quality += 0.05;
    if (text.includes('1.') || text.includes('Step ')) quality += 0.05;
    
    return { response: r, quality: Math.min(1, quality) };
  });
  
  scores.sort((a, b) => b.quality - a.quality);
  const primary = scores[0];
  reasoning.push(`Primary code response: Model ${primary.response.modelSlot}`);
  
  // Check consensus
  let consensusBonus = 0;
  if (validResponses.length >= 2) {
    const similarities = [];
    for (let i = 0; i < validResponses.length; i++) {
      for (let j = i + 1; j < validResponses.length; j++) {
        similarities.push(calculateSimilarity(validResponses[i].response, validResponses[j].response));
      }
    }
    const avgSim = similarities.reduce((a, b) => a + b, 0) / similarities.length;
    if (avgSim > 0.3) {
      consensusBonus = 0.1;
      reasoning.push(`Consensus detected: +10%`);
    }
  }
  
  const totalQuality = scores.reduce((sum, s) => sum + s.quality, 0);
  const weights = { model1: 0, model2: 0, model3: 0 };
  for (const s of scores) {
    const key = `model${s.response.modelSlot}` as keyof typeof weights;
    weights[key] = totalQuality > 0 ? s.quality / totalQuality : 0;
  }
  
  return {
    fusedAnswer: primary.response.response,
    qualityScore: Math.min(1, primary.quality + consensusBonus),
    reasoning,
    selectedPrimary: primary.response.modelSlot as 1 | 2 | 3,
    contributionWeights: weights,
  };
}

// ============================================================================
// SYSTEM AI KNOWLEDGE ALGORITHM
// Focus: Diagnostics, actionable recommendations
// ============================================================================
export function systemKnowledgeAlgorithm(input: KnowledgeAlgorithmInput): KnowledgeAlgorithmOutput {
  const { responses } = input;
  const reasoning: string[] = [];
  
  const validResponses = responses.filter(r => r.success && r.response?.trim());
  
  if (validResponses.length === 0) {
    return {
      fusedAnswer: 'System diagnostic unavailable. Manual inspection recommended.',
      qualityScore: 0,
      reasoning: ['No valid responses from any model'],
      selectedPrimary: 1,
      contributionWeights: { model1: 0, model2: 0, model3: 0 },
    };
  }
  
  // Score with system-specific criteria
  const scores = validResponses.map(r => {
    let quality = calculateResponseQuality(r);
    const text = r.response.toLowerCase();
    
    const numberMatches = text.match(/\d+(\.\d+)?(%|ms|mb|gb|kb)?/g);
    if (numberMatches && numberMatches.length >= 2) quality += 0.1;
    
    if (text.includes('healthy') || text.includes('normal') || 
        text.includes('warning') || text.includes('critical')) {
      quality += 0.1;
    }
    
    if (text.includes('recommend') || text.includes('should') || text.includes('action')) {
      quality += 0.1;
    }
    
    return { response: r, quality: Math.min(1, quality) };
  });
  
  scores.sort((a, b) => b.quality - a.quality);
  const primary = scores[0];
  reasoning.push(`Primary diagnostic: Model ${primary.response.modelSlot}`);
  
  // Check severity consensus
  const severityIndicators = ['critical', 'warning', 'healthy', 'normal', 'error'];
  const detectedSeverities = validResponses.map(r => {
    const text = r.response.toLowerCase();
    return severityIndicators.find(s => text.includes(s)) || 'unknown';
  });
  
  const severityConsensus = new Set(detectedSeverities).size === 1;
  if (!severityConsensus) {
    reasoning.push(`Warning: Models disagree on severity`);
  }
  
  const totalQuality = scores.reduce((sum, s) => sum + s.quality, 0);
  const weights = { model1: 0, model2: 0, model3: 0 };
  for (const s of scores) {
    const key = `model${s.response.modelSlot}` as keyof typeof weights;
    weights[key] = totalQuality > 0 ? s.quality / totalQuality : 0;
  }
  
  const qualityScore = severityConsensus ? primary.quality : primary.quality * 0.8;
  
  return {
    fusedAnswer: primary.response.response,
    qualityScore,
    reasoning,
    selectedPrimary: primary.response.modelSlot as 1 | 2 | 3,
    contributionWeights: weights,
  };
}

// ============================================================================
// DISPATCHER
// ============================================================================
export function runKnowledgeAlgorithm(input: KnowledgeAlgorithmInput): KnowledgeAlgorithmOutput {
  switch (input.aiType) {
    case 'brain':
      return brainKnowledgeAlgorithm(input);
    case 'heart':
      return heartKnowledgeAlgorithm(input);
    case 'system':
      return systemKnowledgeAlgorithm(input);
    default:
      throw new Error(`Unknown AI type: ${input.aiType}`);
  }
}
