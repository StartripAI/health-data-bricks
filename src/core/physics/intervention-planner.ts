/**
 * Health Data Bricks - Intervention Planner
 *
 * Implements the Principle of Least Action for minimal health interventions.
 * Finds the sparse set of actions that move health state toward optimal.
 *
 * Physics: a* = argmin ||S_now + M·a - S_optimal||² + λ||a||₁
 * Key Property: L1 regularization induces sparsity (do 2 things, not 50)
 */

// ============================================================================
// Types
// ============================================================================

export interface Action {
  id: string;
  name: string;
  category: string;
  cost: number;           // Effort required (0-1)
  duration: number;       // Minutes
  effects: ActionEffect[];
}

export interface ActionEffect {
  dimension: string;      // Health dimension affected
  magnitude: number;      // Expected change (-1 to 1)
  confidence: number;     // How sure we are (0-1)
  timeToEffect: number;   // Minutes until effect manifests
}

export interface InterventionPlan {
  actions: PlannedAction[];
  expectedGap: number;
  totalCost: number;
  activeCount: number;
  explanation: string[];
}

export interface PlannedAction {
  action: Action;
  weight: number;         // How strongly recommended (0-1)
  priority: number;       // Order of importance
  expectedImpact: Record<string, number>;
}

// ============================================================================
// Default Action Library
// ============================================================================

export const DEFAULT_ACTIONS: Action[] = [
  // Physical Activity
  {
    id: 'walk_15min',
    name: '15-minute walk',
    category: 'activity',
    cost: 0.2,
    duration: 15,
    effects: [
      { dimension: 'cardiovascular', magnitude: 0.3, confidence: 0.9, timeToEffect: 5 },
      { dimension: 'energy', magnitude: 0.2, confidence: 0.8, timeToEffect: 15 },
      { dimension: 'stress', magnitude: -0.2, confidence: 0.7, timeToEffect: 10 },
    ],
  },
  {
    id: 'hiit_20min',
    name: '20-minute HIIT workout',
    category: 'activity',
    cost: 0.6,
    duration: 20,
    effects: [
      { dimension: 'cardiovascular', magnitude: 0.6, confidence: 0.9, timeToEffect: 5 },
      { dimension: 'metabolic', magnitude: 0.4, confidence: 0.8, timeToEffect: 30 },
      { dimension: 'stress', magnitude: -0.3, confidence: 0.7, timeToEffect: 20 },
      { dimension: 'energy', magnitude: -0.2, confidence: 0.6, timeToEffect: 0 },
    ],
  },
  {
    id: 'stretch_10min',
    name: '10-minute stretching',
    category: 'activity',
    cost: 0.1,
    duration: 10,
    effects: [
      { dimension: 'stress', magnitude: -0.2, confidence: 0.8, timeToEffect: 5 },
      { dimension: 'recovery', magnitude: 0.15, confidence: 0.7, timeToEffect: 10 },
    ],
  },

  // Recovery
  {
    id: 'power_nap',
    name: '20-minute power nap',
    category: 'recovery',
    cost: 0.3,
    duration: 25,
    effects: [
      { dimension: 'energy', magnitude: 0.4, confidence: 0.8, timeToEffect: 25 },
      { dimension: 'stress', magnitude: -0.3, confidence: 0.7, timeToEffect: 25 },
      { dimension: 'recovery', magnitude: 0.2, confidence: 0.6, timeToEffect: 25 },
    ],
  },
  {
    id: 'sleep_8hr',
    name: 'Full 8-hour sleep',
    category: 'recovery',
    cost: 0.1,
    duration: 480,
    effects: [
      { dimension: 'energy', magnitude: 0.8, confidence: 0.9, timeToEffect: 480 },
      { dimension: 'recovery', magnitude: 0.9, confidence: 0.9, timeToEffect: 480 },
      { dimension: 'stress', magnitude: -0.5, confidence: 0.8, timeToEffect: 480 },
      { dimension: 'cardiovascular', magnitude: 0.2, confidence: 0.7, timeToEffect: 480 },
    ],
  },

  // Stress Management
  {
    id: 'breathwork_5min',
    name: '5-minute breathwork',
    category: 'stress',
    cost: 0.05,
    duration: 5,
    effects: [
      { dimension: 'stress', magnitude: -0.3, confidence: 0.9, timeToEffect: 2 },
      { dimension: 'cardiovascular', magnitude: -0.1, confidence: 0.8, timeToEffect: 2 },
    ],
  },
  {
    id: 'meditation_10min',
    name: '10-minute meditation',
    category: 'stress',
    cost: 0.15,
    duration: 10,
    effects: [
      { dimension: 'stress', magnitude: -0.4, confidence: 0.85, timeToEffect: 5 },
      { dimension: 'energy', magnitude: 0.1, confidence: 0.6, timeToEffect: 10 },
    ],
  },
  {
    id: 'cold_shower',
    name: '2-minute cold shower',
    category: 'stress',
    cost: 0.4,
    duration: 5,
    effects: [
      { dimension: 'energy', magnitude: 0.5, confidence: 0.8, timeToEffect: 2 },
      { dimension: 'stress', magnitude: -0.2, confidence: 0.7, timeToEffect: 5 },
      { dimension: 'recovery', magnitude: 0.1, confidence: 0.6, timeToEffect: 30 },
    ],
  },

  // Nutrition
  {
    id: 'hydrate',
    name: 'Drink 500ml water',
    category: 'nutrition',
    cost: 0.02,
    duration: 1,
    effects: [
      { dimension: 'energy', magnitude: 0.1, confidence: 0.7, timeToEffect: 15 },
      { dimension: 'metabolic', magnitude: 0.05, confidence: 0.6, timeToEffect: 30 },
    ],
  },
  {
    id: 'healthy_meal',
    name: 'Balanced meal',
    category: 'nutrition',
    cost: 0.2,
    duration: 30,
    effects: [
      { dimension: 'energy', magnitude: 0.3, confidence: 0.8, timeToEffect: 60 },
      { dimension: 'metabolic', magnitude: 0.2, confidence: 0.7, timeToEffect: 120 },
    ],
  },

  // Social
  {
    id: 'social_call',
    name: 'Call a friend',
    category: 'social',
    cost: 0.15,
    duration: 15,
    effects: [
      { dimension: 'stress', magnitude: -0.25, confidence: 0.7, timeToEffect: 5 },
      { dimension: 'energy', magnitude: 0.15, confidence: 0.6, timeToEffect: 15 },
    ],
  },

  // Digital
  {
    id: 'digital_detox_1hr',
    name: '1-hour digital detox',
    category: 'digital',
    cost: 0.3,
    duration: 60,
    effects: [
      { dimension: 'stress', magnitude: -0.2, confidence: 0.7, timeToEffect: 30 },
      { dimension: 'energy', magnitude: 0.1, confidence: 0.5, timeToEffect: 60 },
    ],
  },
];

// ============================================================================
// Intervention Planner
// ============================================================================

export interface PlannerConfig {
  lambda: number;           // Sparsity regularization (higher = fewer actions)
  maxActions: number;       // Maximum actions to recommend
  costWeight: number;       // How much to penalize high-cost actions
  actions: Action[];
}

export const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  lambda: 0.1,
  maxActions: 5,
  costWeight: 0.3,
  actions: DEFAULT_ACTIONS,
};

export class InterventionPlanner {
  private config: PlannerConfig;
  private causalMatrix: Map<string, Map<string, number>> = new Map();

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
    this.buildCausalMatrix();
  }

  /**
   * Plan interventions to move from current state to target
   *
   * Implements: a* = argmin ||S + M·a - S*||² + λ||a||₁
   */
  plan(
    currentState: Record<string, number>,
    targetState: Record<string, number>,
    constraints?: {
      maxCost?: number;
      maxDuration?: number;
      excludeCategories?: string[];
    }
  ): InterventionPlan {
    const gap = this.calculateGap(currentState, targetState);
    const dimensions = Object.keys(gap);

    // Filter available actions
    let availableActions = [...this.config.actions];
    if (constraints?.excludeCategories) {
      availableActions = availableActions.filter(
        a => !constraints.excludeCategories!.includes(a.category)
      );
    }
    if (constraints?.maxDuration) {
      availableActions = availableActions.filter(
        a => a.duration <= constraints.maxDuration!
      );
    }

    // Calculate action scores using gradient descent approximation
    const actionScores = this.scoreActions(availableActions, gap, constraints?.maxCost);

    // Select top actions (sparsity via selection)
    const selectedActions = actionScores
      .filter(a => a.score > 0.1)
      .slice(0, this.config.maxActions);

    // Calculate expected outcomes
    let predictedGap = { ...gap };
    const plannedActions: PlannedAction[] = [];
    const explanations: string[] = [];

    for (let i = 0; i < selectedActions.length; i++) {
      const { action, score } = selectedActions[i];
      const impact = this.calculateImpact(action, dimensions);

      // Update predicted gap
      for (const dim of dimensions) {
        predictedGap[dim] -= impact[dim] || 0;
      }

      plannedActions.push({
        action,
        weight: score,
        priority: i + 1,
        expectedImpact: impact,
      });

      // Generate explanation
      const mainEffect = action.effects.reduce((best, e) =>
        Math.abs(e.magnitude) > Math.abs(best.magnitude) ? e : best
      );
      explanations.push(
        `${action.name}: Primarily affects ${mainEffect.dimension} ` +
        `(${mainEffect.magnitude > 0 ? '+' : ''}${(mainEffect.magnitude * 100).toFixed(0)}%)`
      );
    }

    // Calculate final gap
    const expectedGap = Object.values(predictedGap)
      .map(v => v * v)
      .reduce((a, b) => a + b, 0);

    return {
      actions: plannedActions,
      expectedGap: Math.sqrt(expectedGap),
      totalCost: plannedActions.reduce((sum, a) => sum + a.action.cost, 0),
      activeCount: plannedActions.length,
      explanation: explanations,
    };
  }

  /**
   * Get recommended single action for quick improvement
   */
  quickWin(
    currentState: Record<string, number>,
    targetState: Record<string, number>
  ): PlannedAction | null {
    const plan = this.plan(currentState, targetState, {
      maxCost: 0.3,
      maxDuration: 15,
    });

    return plan.actions[0] || null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildCausalMatrix(): void {
    // Build action → dimension effect matrix
    for (const action of this.config.actions) {
      const effects = new Map<string, number>();
      for (const effect of action.effects) {
        effects.set(effect.dimension, effect.magnitude * effect.confidence);
      }
      this.causalMatrix.set(action.id, effects);
    }
  }

  private calculateGap(
    current: Record<string, number>,
    target: Record<string, number>
  ): Record<string, number> {
    const gap: Record<string, number> = {};
    const allDims = new Set([...Object.keys(current), ...Object.keys(target)]);

    for (const dim of allDims) {
      gap[dim] = (target[dim] || 0) - (current[dim] || 0);
    }

    return gap;
  }

  private scoreActions(
    actions: Action[],
    gap: Record<string, number>,
    maxCost?: number
  ): Array<{ action: Action; score: number }> {
    const scores: Array<{ action: Action; score: number }> = [];

    for (const action of actions) {
      // Skip if over cost budget
      if (maxCost !== undefined && action.cost > maxCost) continue;

      let benefit = 0;
      let totalWeight = 0;

      // Calculate how much this action reduces the gap
      for (const effect of action.effects) {
        const dimGap = gap[effect.dimension] || 0;

        // Benefit if effect direction matches gap direction
        if ((dimGap > 0 && effect.magnitude > 0) || (dimGap < 0 && effect.magnitude < 0)) {
          benefit += Math.min(Math.abs(dimGap), Math.abs(effect.magnitude)) * effect.confidence;
        } else if (Math.abs(effect.magnitude) > Math.abs(dimGap) * 2) {
          // Penalty if effect overshoots significantly
          benefit -= 0.1 * Math.abs(effect.magnitude) * effect.confidence;
        }

        totalWeight += effect.confidence;
      }

      // Normalize and apply regularization
      if (totalWeight > 0) {
        benefit /= totalWeight;
      }

      // L1-like sparsity penalty
      const sparsityPenalty = this.config.lambda;

      // Cost penalty
      const costPenalty = this.config.costWeight * action.cost;

      const score = Math.max(0, benefit - sparsityPenalty - costPenalty);
      scores.push({ action, score });
    }

    // Sort by score
    return scores.sort((a, b) => b.score - a.score);
  }

  private calculateImpact(
    action: Action,
    dimensions: string[]
  ): Record<string, number> {
    const impact: Record<string, number> = {};

    for (const dim of dimensions) {
      const effect = action.effects.find(e => e.dimension === dim);
      impact[dim] = effect ? effect.magnitude * effect.confidence : 0;
    }

    return impact;
  }
}

// ============================================================================
// Export convenience functions
// ============================================================================

export function createInterventionPlanner(config?: Partial<PlannerConfig>): InterventionPlanner {
  return new InterventionPlanner(config);
}

export function getQuickWin(
  planner: InterventionPlanner,
  currentState: Record<string, number>,
  optimalState: Record<string, number>
): PlannedAction | null {
  return planner.quickWin(currentState, optimalState);
}
