import { Player, PlayerBaseAttributes, PlayerMatchStats } from '../types';

/**
 * Calculates a match rating (3.0 to 10.0) based on raw match performance statistics.
 */
export function calculateMatchRating(stats: PlayerMatchStats, position: Player['position']): number {
  if (stats.minutes_played === 0) return 0;

  let rating = 6.0;

  // Minutes played weight
  if (stats.minutes_played < 45) {
    rating -= 1.0;
  } else {
    rating += Math.min(0.5, (stats.minutes_played - 45) * 0.01);
  }

  // Attack contributions
  rating += stats.goals * 1.5;
  rating += stats.assists * 1.0;
  rating += stats.key_passes * 0.3;
  rating += stats.shots_on_target * 0.2;

  // Passing efficiency
  if (stats.passing_accuracy >= 90) {
    rating += 0.5;
  } else if (stats.passing_accuracy >= 80) {
    rating += 0.2;
  } else if (stats.passing_accuracy < 60) {
    rating -= 0.4;
  }

  // Defensive & Duel metrics
  if (stats.duels_attempted > 0) {
    const duelSuccess = stats.duels_won / stats.duels_attempted;
    if (duelSuccess >= 0.7) rating += 0.5;
    else if (duelSuccess >= 0.5) rating += 0.2;
    else if (duelSuccess < 0.3) rating -= 0.4;
  }

  rating += stats.tackles * 0.2;
  rating += stats.interceptions * 0.2;
  rating += stats.recoveries * 0.1;

  // Position-specific logic
  if (position === 'GK') {
    rating += stats.saves * 0.6;
    rating -= stats.goals_conceded * 0.5;
    if (stats.clean_sheet && stats.minutes_played >= 60) {
      rating += 1.0;
    }
  } else if (position === 'DEF') {
    rating -= stats.goals_conceded * 0.3;
    if (stats.clean_sheet && stats.minutes_played >= 60) {
      rating += 0.8;
    }
  }

  // Bound the rating between 3.0 and 10.0
  return Math.round(Math.min(10.0, Math.max(3.0, rating)) * 10) / 10;
}

/**
 * Calculates a player's base OVR rating from their attributes and position.
 */
export function calculateBaseOVR(attributes: PlayerBaseAttributes, position: Player['position']): number {
  const { pace, shooting, passing, dribbling, defending, physical } = attributes;

  let ovr = 0;
  switch (position) {
    case 'FWD':
      ovr = pace * 0.20 + shooting * 0.40 + passing * 0.10 + dribbling * 0.20 + physical * 0.10;
      break;
    case 'MID':
      ovr = pace * 0.10 + shooting * 0.10 + passing * 0.35 + dribbling * 0.20 + defending * 0.10 + physical * 0.15;
      break;
    case 'DEF':
      ovr = pace * 0.10 + passing * 0.10 + dribbling * 0.05 + defending * 0.50 + physical * 0.25;
      break;
    case 'GK':
      // For GK, defending represents handling/reflexes and shooting is irrelevant
      ovr = passing * 0.15 + defending * 0.55 + physical * 0.30;
      break;
  }

  return Math.round(ovr);
}

/**
 * Calculates the recent form rating, trend, and dynamic overall rating based on match stats.
 */
export function calculateDynamicOVRAndForm(
  player: Player,
  matchStats: PlayerMatchStats[],
  matchWindow: number = 5
): { overall: number; form_rating: number; form_trend: Player['form_trend'] } {
  const baseOvr = calculateBaseOVR(player.base_attributes, player.position);

  // Filter stats for this player and sort by match date/id to get recent matches
  // Assumes stats are already associated, let's just calculate ratings for the stats provided
  const ratings = matchStats.map(s => calculateMatchRating(s, player.position));

  if (ratings.length === 0) {
    return {
      overall: baseOvr,
      form_rating: 6.0,
      form_trend: 'stable',
    };
  }

  // Form is based on last N matches, weighted towards the most recent matches
  const recentRatings = ratings.slice(-matchWindow);
  
  // Linear weights generation (oldest to newest: 1, 2, 3, ..., N)
  const n = recentRatings.length;
  const weights = Array.from({ length: n }, (_, idx) => idx + 1);
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights = weights.map(w => w / weightSum);

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    weightedSum += recentRatings[i] * normalizedWeights[i];
  }
  const formRating = Math.round(weightedSum * 10) / 10;

  // Determine Form Trend based on recent form rating thresholds
  let formTrend: Player['form_trend'] = 'stable';
  if (formRating >= 7.3) {
    formTrend = 'up';
  } else if (formRating < 5.8) {
    formTrend = 'down';
  }

  // Dynamic OVR modifier
  // Form rating of 6.0 is standard. 
  // OVR bonus scales from -3 (awful form) to +5 (amazing form)
  let ovrModifier = 0;
  if (formRating >= 8.5) {
    ovrModifier = 5;
  } else if (formRating >= 7.8) {
    ovrModifier = 3;
  } else if (formRating >= 7.2) {
    ovrModifier = 1;
  } else if (formRating >= 6.5) {
    ovrModifier = 0;
  } else if (formRating >= 5.5) {
    ovrModifier = -1;
  } else if (formRating >= 4.5) {
    ovrModifier = -2;
  } else {
    ovrModifier = -3;
  }

  const overall = Math.min(99, Math.max(1, baseOvr + ovrModifier));

  return {
    overall,
    form_rating: formRating,
    form_trend: formTrend,
  };
}

/**
 * Calculates form-adjusted player attributes based on their recent form rating.
 */
export function calculateFormAdjustedAttributes(
  attributes: PlayerBaseAttributes,
  formRating: number
): { attributes: PlayerBaseAttributes; modifiers: Record<keyof PlayerBaseAttributes, number> } {
  let modifier = 0;
  if (formRating >= 8.0) {
    modifier = 3;
  } else if (formRating >= 7.2) {
    modifier = 1;
  } else if (formRating >= 6.0) {
    modifier = 0;
  } else if (formRating >= 5.0) {
    modifier = -1;
  } else {
    modifier = -2;
  }

  const adjusted: PlayerBaseAttributes = {
    pace: Math.min(99, Math.max(1, attributes.pace + modifier)),
    shooting: Math.min(99, Math.max(1, attributes.shooting + modifier)),
    passing: Math.min(99, Math.max(1, attributes.passing + modifier)),
    dribbling: Math.min(99, Math.max(1, attributes.dribbling + modifier)),
    defending: Math.min(99, Math.max(1, attributes.defending + modifier)),
    physical: Math.min(99, Math.max(1, attributes.physical + modifier)),
  };

  const modifiers: Record<keyof PlayerBaseAttributes, number> = {
    pace: modifier,
    shooting: modifier,
    passing: modifier,
    dribbling: modifier,
    defending: modifier,
    physical: modifier,
  };

  return { attributes: adjusted, modifiers };
}
