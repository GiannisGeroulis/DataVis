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
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  preferred_role: string; // e.g. "Inside Forward", "Deep-lying Playmaker", "Ball-playing Defender", "Sweeper Keeper"
  team_name: string;
  nationality: string;
  age: number;
  avatar_url: string;
  number: number;
  base_attributes: PlayerBaseAttributes;
  overall: number; // dynamically calculated overall rating
  form_rating: number; // dynamically calculated recent form rating (average match rating)
  form_trend: 'up' | 'down' | 'stable';
}

export interface Match {
  id: string;
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
  player_id: string;
  match_id: string;
  minutes_played: number;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passing_accuracy: number; // percentage (0-100)
  passes_completed: number;
  passes_attempted: number;
  key_passes: number;
  xg: number;
  xa: number;
  distance_covered: number; // in km
  duels_won: number;
  duels_attempted: number;
  tackles: number;
  interceptions: number;
  recoveries: number;
  saves: number;
  goals_conceded: number;
  clean_sheet: boolean;
  match_rating?: number; // calculated rating for this match (3.0 - 10.0)
}

export interface TeamMatchStats {
  match_id: string;
  possession: number; // percentage (0-100)
  shots: number;
  shots_on_target: number;
  fouls: number;
  corners: number;
  yellow_cards: number;
  red_cards: number;
  formation: string; // e.g. "4-3-3", "4-2-3-1"
}

export interface TacticalLayout {
  id: string;
  name: string;
  formation: string; // e.g. "4-3-3", "4-2-3-1"
  positions: Record<string, string>; // Map of positionNodeId -> playerId
}
