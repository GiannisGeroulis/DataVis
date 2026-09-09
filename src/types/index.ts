export interface UserProfile {
  id: string;
  user_id?: string;
  name: string;
  role: string;
  team_name: string;
  avatar_url?: string;
  color?: string;
  created_at?: string;
}

export interface ProfileSeedOptions {
  includePlayers: boolean;
  includeMatches: boolean;
  includePlayerStats: boolean;
  includeTactics: boolean;
}

export interface OpponentTeam {
  id: string;
  profile_id: string;
  name: string;
  logo_url?: string;
  country?: string;
  league?: string;
  notes?: string;
  created_at?: string;
}

export interface GlobalOpponentTeam extends OpponentTeam {
  matchCount?: number;
  avgXg?: number;
  avgPoss?: number;
}

export interface WyscoutMatch {
  id: string;
  profile_id: string;
  opponent_team_id: string;
  date: string;
  match_name: string;
  competition: string;
  duration: number;
  scheme: string; // e.g. "4-3-3"
  team_analyzed: string; // The team this row describes
  goals: number;
  xg: number;
  shots: number;
  shots_on_target: number;
  shots_on_target_pct: number;
  passes: number;
  passes_accurate: number;
  passing_accuracy: number;
  possession: number;
  losses: number;
  losses_low: number;
  losses_med: number;
  losses_high: number;
  recoveries: number;
  recoveries_low: number;
  recoveries_med: number;
  recoveries_high: number;
  duels: number;
  duels_won: number;
  duels_won_pct: number;

  // --- ATTACKING METRICS ---
  positional_attacks?: number;
  positional_attacks_shots?: number;
  positional_attacks_pct?: number;
  counterattacks?: number;
  counterattacks_shots?: number;
  counterattacks_pct?: number;
  corners?: number;
  corners_shots?: number;
  corners_shots_pct?: number;
  free_kicks?: number;
  free_kicks_shots?: number;
  free_kicks_shots_pct?: number;
  penalties?: number;
  penalties_converted?: number;
  crosses?: number;
  crosses_accurate?: number;
  crosses_acc_pct?: number;
  offensive_duels?: number;
  offensive_duels_won?: number;
  offensive_duels_won_pct?: number;
  offsides?: number;

  // --- DEFENDING METRICS ---
  conceded_goals?: number;
  shots_against?: number;
  shots_against_on_target?: number;
  shots_against_on_target_pct?: number;
  defensive_duels?: number;
  defensive_duels_won?: number;
  defensive_duels_won_pct?: number;
  aerial_duels?: number;
  aerial_duels_won?: number;
  aerial_duels_won_pct?: number;
  sliding_tackles?: number;
  sliding_tackles_succ?: number;
  sliding_tackles_succ_pct?: number;
  interceptions?: number;
  clearances?: number;
  fouls?: number;
  yellow_cards?: number;
  red_cards?: number;

  // --- PASSING & BUILD-UP METRICS ---
  forward_passes?: number;
  forward_passes_acc?: number;
  forward_passes_pct?: number;
  back_passes?: number;
  back_passes_acc?: number;
  back_passes_pct?: number;
  lateral_passes?: number;
  lateral_passes_acc?: number;
  lateral_passes_pct?: number;
  long_passes?: number;
  long_passes_acc?: number;
  long_passes_pct?: number;
  passes_to_final_third?: number;
  passes_to_final_third_acc?: number;
  passes_to_final_third_pct?: number;
  progressive_passes?: number;
  progressive_passes_acc?: number;
  progressive_passes_pct?: number;
  smart_passes?: number;
  smart_passes_acc?: number;
  smart_passes_pct?: number;
  throw_ins?: number;
  throw_ins_acc?: number;
  goal_kicks?: number;

  // --- INDICES & TACTICAL KPIS ---
  ppda?: number; // Passes Allowed Per Defensive Action
  match_tempo?: number; // passes per minute
  avg_passes_per_possession?: number;
  long_pass_pct?: number;
  avg_shot_distance?: number; // in meters
  avg_pass_length?: number; // in meters

  // Optional opponent metrics in the same fixture
  opponent_team_name?: string;
  opponent_goals?: number;
  opponent_xg?: number;
  opponent_shots?: number;
  opponent_shots_on_target?: number;
  opponent_possession?: number;
  opponent_ppda?: number;
  opponent_match_tempo?: number;
  opponent_avg_passes_per_possession?: number;
  opponent_long_pass_pct?: number;
  opponent_avg_shot_distance?: number;
  opponent_avg_pass_length?: number;
  opponent_passes?: number;
  opponent_passes_accurate?: number;
  opponent_passing_accuracy?: number;
  corners_against?: number;
  corners_against_shots?: number;
  corners_against_shots_pct?: number;
  free_kicks_against?: number;
  free_kicks_against_shots?: number;
  free_kicks_against_shots_pct?: number;
  crosses_against?: number;
  crosses_against_accurate?: number;
  crosses_against_acc_pct?: number;
  created_at?: string;
}

// Legacy types retained for backwards compatibility
export interface PlayerBaseAttributes {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

export interface Player {
  id: string;
  profile_id?: string;
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  preferred_role: string;
  team_name: string;
  nationality: string;
  age: number;
  avatar_url: string;
  number: number;
  base_attributes: PlayerBaseAttributes;
  overall: number;
  form_rating: number;
  form_trend: 'up' | 'down' | 'stable';
}

export interface Match {
  id: string;
  profile_id?: string;
  date: string;
  opponent: string;
  venue: 'Home' | 'Away';
  result: 'W' | 'D' | 'L';
  our_score: number;
  opp_score: number;
  is_club?: boolean;
  is_team_match?: boolean;
}

export interface PlayerMatchStats {
  id: string;
  profile_id?: string;
  player_id: string;
  match_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passing_accuracy: number;
  passes_completed: number;
  passes_attempted: number;
  key_passes: number;
  xg: number;
  xa: number;
  distance_covered: number;
  duels_won: number;
  duels_attempted: number;
  tackles: number;
  interceptions: number;
  recoveries: number;
  saves: number;
  goals_conceded: number;
  clean_sheet: boolean;
  match_rating?: number;
}

export interface TeamMatchStats {
  match_id: string;
  profile_id?: string;
  possession: number;
  shots: number;
  shots_on_target: number;
  fouls: number;
  corners: number;
  yellow_cards: number;
  red_cards: number;
  formation: string;
}

export interface TacticalLayout {
  id: string;
  profile_id?: string;
  name: string;
  formation: string;
  positions: Record<string, string>;
}
