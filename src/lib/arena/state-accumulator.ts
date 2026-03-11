/**
 * State-level sentiment accumulator for Brazil heat map.
 * Accumulates sentiment counts by UF (2-letter state code).
 */

import type { Sentiment } from './types';

export interface StateSentiment {
  count: number;
  positive: number;
  negative: number;
  neutral: number;
}

export type StateBreakdown = Record<string, StateSentiment>;

export class StateAccumulator {
  private stateMap = new Map<string, StateSentiment>();

  addPersona(p: Record<string, any>, sentiment: Sentiment) {
    const state = (p.state || p.estado_br || '').toUpperCase().trim();
    if (!state || state.length !== 2) return;

    if (!this.stateMap.has(state)) {
      this.stateMap.set(state, { count: 0, positive: 0, negative: 0, neutral: 0 });
    }
    const entry = this.stateMap.get(state)!;
    entry.count++;
    entry[sentiment]++;
  }

  toStateBreakdown(): StateBreakdown {
    const result: StateBreakdown = {};
    for (const [state, data] of this.stateMap) {
      result[state] = { ...data };
    }
    return result;
  }
}
