// ── Arena Module Barrel Export ────────────────────────────────────────────────

// Types
export type {
  Phase,
  Sentiment,
  ArchetypeResult,
  CommentResult,
  ClusterResult,
  SimulationResult,
  IdeologicalPoint,
  Quadrant,
  QuadrantResult,
  RegionResult,
  GenerationResult,
  EducationResult,
  PoliticalFigure,
  PoliticalFigureDetection,
  IntensityBand,
  EnhancedSimulationResult,
} from './types';

// Constants
export {
  CLUSTERS,
  MACRO_COLORS,
  MACRO_GROUPS,
  ARCHETYPES,
  BASE_DISTRIBUTION,
  TOPICS,
  TOPIC_DISTRIBUTIONS,
  ARCHETYPE_SCORERS,
  ARCHETYPE_TO_POLITICAL,
} from './constants';

// Engine
export {
  normalize,
  pickRandom,
  shuffle,
  detectTopics,
  getTopicDistribution,
  simulatePersonaSentiment,
  toPersonaContext,
  mapPersona,
  runSimulation,
  buildPersonasForAI,
} from './engine';

// AI Comments
export {
  generateAIComments,
  generateOpenAIComments,
  generateFallbackComments,
} from './ai-comments';

// 2D Analysis
export {
  computeIntensity,
  modulateByEducation,
  classifyQuadrant,
  detectQuestionPolarity,
  detectPoliticalFigures,
  adjustSentimentForPoliticalFigure,
  simulate2DSentiment,
  analyzeQuadrants,
  analyzeRegions,
  analyzeGenerations,
  analyzeEducation,
  buildIdeologicalScatter,
  computeIntensityCorrelation,
  runEnhancedSimulation,
} from './analysis-2d';

export type { QuestionPolarity } from './analysis-2d';

// Data-Driven Persona Sentiment
export { computePersonaSentiment } from './persona-sentiment';

// Quick Answer (Yes/No columns)
export { detectQuickAnswer, runQuickAnswer, classifyQuickPersona } from './quick-answer';
export type { QuickAnswerMatch, QuickAnswerResult } from './quick-answer';

// Segment breakdowns
export { computeAllSegments, SegmentAccumulator } from './segments';
export type { SegmentItem, AllSegments } from './segments';
