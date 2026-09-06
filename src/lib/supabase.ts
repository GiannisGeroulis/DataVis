import { createClient } from '@supabase/supabase-js';
import { Player, Match, PlayerMatchStats, TeamMatchStats, TacticalLayout } from '../types';
import { calculateDynamicOVRAndForm } from './ovr-algorithm';

// Import raw JSON data converted from the Excel files
import rawPlayerStats from '../../player_stats.json';
import rawTeamStats from '../../team_stats.json';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isRealSupabase = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = isRealSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;

// ==========================================
// DYNAMIC SEEDING FROM PARSED EXCEL DATA
// ==========================================

const DB_VERSION = 'v6'; // Trigger migration cache wipe

export const SEED_PLAYERS: Player[] = [
  {
    id: "kostoglou",
    name: "I. Kostoglou",
    position: "MID",
    preferred_role: "Box-to-Box Midfielder",
    team_name: "Greece U17",
    nationality: "Greece",
    age: 17,
    avatar_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=200&auto=format&fit=crop",
    number: 8,
    base_attributes: { pace: 77, shooting: 71, passing: 83, dribbling: 79, defending: 73, physical: 75 },
    overall: 70,
    form_rating: 6.0,
    form_trend: "stable"
  }
];

// Parse excels to extract Match, Team stats, and Player stats logs
const parsedMatches: Match[] = [];
const parsedTeamStats: TeamMatchStats[] = [];
const parsedPlayerStats: PlayerMatchStats[] = [];

// Track matches by ID to avoid duplicates
const matchIdMap = new Set<string>();

// Helper to sanitize Match strings to opponent name
function parseOpponentAndVenue(matchName: string, teamName: string): { opponent: string; venue: 'Home' | 'Away'; ourScore: number; oppScore: number } {
  const parts = matchName.split(" - ");
  let opponent = "Opponent";
  let venue: 'Home' | 'Away' = 'Home';
  let ourScore = 0;
  let oppScore = 0;

  if (parts.length === 2) {
    const homeTeam = parts[0].trim();
    const awayPart = parts[1].trim(); // e.g. "Greece U17 0:1"
    const awayTeam = awayPart.split(/\s\d/)[0].trim();
    
    // Parse score, e.g. "0:1" or "2:3"
    const scoreMatch = matchName.match(/\d+:\d+/);
    const scoreStr = scoreMatch ? scoreMatch[0] : "0:0";
    const [homeScore, oppScoreVal] = scoreStr.split(":").map(Number);

    if (homeTeam.includes(teamName)) {
      opponent = awayTeam;
      venue = 'Home';
      ourScore = homeScore;
      oppScore = oppScoreVal;
    } else {
      opponent = homeTeam;
      venue = 'Away';
      ourScore = oppScoreVal;
      oppScore = homeScore;
    }
  }

  return { opponent, venue, ourScore, oppScore };
}

// 1. Process Team Matches (Greece U17 fixtures)
const validTeamRows = (rawTeamStats as any[]).filter(row => row.Date && String(row.Date).match(/^\d{4}-\d{2}-\d{2}$/));
validTeamRows.forEach(row => {
  const isGreece = row.Team === "Greece U17";
  const { opponent, venue, ourScore, oppScore } = parseOpponentAndVenue(row.Match, "Greece U17");
  const matchId = `m_${row.Date}_${opponent.replace(/\s+/g, '_')}`;

  // Add Match record (only once per fixture)
  if (!matchIdMap.has(matchId)) {
    matchIdMap.add(matchId);
    parsedMatches.push({
      id: matchId,
      date: row.Date,
      opponent,
      venue,
      result: ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D',
      our_score: ourScore,
      opp_score: oppScore,
      is_club: false,
      is_team_match: true
    });
  }

  // Add TeamMatchStats record
  if (isGreece) {
    // Clean scheme, e.g. "3-4-3 (80.91%)" -> "3-4-3"
    const schemeClean = row.Scheme ? String(row.Scheme).split(" ")[0].trim() : "4-3-3";
    
    parsedTeamStats.push({
      match_id: matchId,
      possession: Number(row["Possession, %"] ?? 50),
      shots: Number(row["Shots / on target"] ?? 0),
      shots_on_target: Number(row[""] ?? 0), // column "" represents shots on target
      fouls: 10,
      corners: 5,
      yellow_cards: 1,
      red_cards: 0,
      formation: schemeClean
    });
  }
});

// 2. Process Player Match Logs (Ioannis Kostoglou stats)
const validPlayerRows = (rawPlayerStats as any[]).filter(row => row.Date && String(row.Date).match(/^\d{4}-\d{2}-\d{2}$/));
validPlayerRows.forEach((row, index) => {
  // Determine if it is a National Team match or a Club match (Borussia Dortmund U17/U19)
  const isNationalTeam = row.Match.includes("Greece U17") || row.Match.includes("Greece U16");
  const teamName = isNationalTeam ? "Greece U17" : "Borussia Dortmund U17";
  const { opponent, venue, ourScore, oppScore } = parseOpponentAndVenue(row.Match, teamName);
  const matchId = `m_${row.Date}_${opponent.replace(/\s+/g, '_')}`;

  // If this match isn't in matches list, add it
  if (!matchIdMap.has(matchId)) {
    matchIdMap.add(matchId);
    parsedMatches.push({
      id: matchId,
      date: row.Date,
      opponent: opponent + (isNationalTeam ? "" : " (Club)"),
      venue,
      result: ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D',
      our_score: ourScore,
      opp_score: oppScore,
      is_club: !isNationalTeam,
      is_team_match: isNationalTeam
    });
  }

  // Map to PlayerMatchStats for I. Kostoglou
  const attemptedPasses = Number(row["Passes / accurate"] ?? 0);
  const accuratePasses = Number(row["_2"] ?? 0);
  const passAccuracy = attemptedPasses > 0 ? Math.round((accuratePasses / attemptedPasses) * 100) : 0;
  
  const duelsAttempted = Number(row["Duels / won"] ?? 0);
  const duelsWon = Number(row["_6"] ?? 0);

  parsedPlayerStats.push({
    id: `stats_kostoglou_${matchId}_${index}`,
    player_id: "kostoglou",
    match_id: matchId,
    minutes_played: Number(row["Minutes played"] ?? 0),
    goals: Number(row["Goals"] ?? 0),
    assists: Number(row["Assists"] ?? 0),
    shots: Number(row["Shots / on target"] ?? 0),
    shots_on_target: Number(row["_1"] ?? 0),
    passing_accuracy: passAccuracy,
    passes_completed: accuratePasses,
    passes_attempted: attemptedPasses,
    key_passes: Number(row["_3"] ?? 0),
    xg: Number(row["xG"] ?? 0),
    xa: Number(row["Assists"] ?? 0) * 0.15 + Number(row["_3"] ?? 0) * 0.1, 
    distance_covered: Number(row["Minutes played"] ?? 0) * 0.11, 
    duels_won: duelsWon,
    duels_attempted: duelsAttempted,
    tackles: Math.floor(duelsWon * 0.3),
    interceptions: Number(row["Interceptions"] ?? 0),
    recoveries: Number(row["Recoveries / opp. half"] ?? 0),
    saves: 0,
    goals_conceded: venue === 'Home' ? oppScore : 0, 
    clean_sheet: oppScore === 0
  });
});

// Set starting tactical template for Greece U17 (initially only has Kostoglou)
export const SEED_TACTICAL_LAYOUTS: TacticalLayout[] = [
  {
    id: "l1",
    name: "Greece U17 (Kostoglou Only)",
    formation: "4-3-3",
    positions: {
      "CM": "kostoglou"
    }
  }
];

// Sort matches chronologically
parsedMatches.sort((a, b) => a.date.localeCompare(b.date));

// ==========================================
// DB SERVICE CLIENT WRAPPER (LOCALSTORAGE fallback)
// ==========================================

const LS_KEYS = {
  PLAYERS: 'fm_dashboard_players',
  MATCHES: 'fm_dashboard_matches',
  PLAYER_STATS: 'fm_dashboard_player_stats',
  TEAM_STATS: 'fm_dashboard_team_stats',
  TACTICAL: 'fm_dashboard_tactical_layouts'
};

function getLS<T>(key: string, defaultValue: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return defaultValue;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setLS<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const dbService = {
  /**
   * Initializes the storage. Runs on import.
   */
  init: async () => {
    if (isRealSupabase && supabase) {
      try {
        console.log("Supabase connected. Running database checks and seeding...");
        
        // 1. Check if database is empty. If so, seed it.
        const { data: players, error: pErr } = await supabase.from('players').select('id');
        if (pErr) throw pErr;
        
        if (!players || players.length === 0) {
          console.log("Supabase players empty. Seeding database...");
          await supabase.from('players').upsert(SEED_PLAYERS);
          await supabase.from('matches').upsert(parsedMatches);
          await supabase.from('team_match_stats').upsert(parsedTeamStats);
          await supabase.from('player_match_stats').upsert(parsedPlayerStats);
          await supabase.from('tactical_layouts').upsert(SEED_TACTICAL_LAYOUTS);
          await dbService.recalculateAllPlayerOVRs();
          console.log("Supabase seeding completed successfully!");
        } else {
          // 2. Fix existing matches in Supabase database where is_team_match is false but is_club is false
          const { data: matches, error: mErr } = await supabase.from('matches').select('*').eq('is_team_match', false).eq('is_club', false);
          if (mErr) throw mErr;
          
          if (matches && matches.length > 0) {
            console.log(`Found ${matches.length} matches with incorrect is_team_match = false. Updating...`);
            const updatedMatches = matches.map(m => ({
              ...m,
              is_team_match: true
            }));
            const { error: uErr } = await supabase.from('matches').upsert(updatedMatches);
            if (uErr) throw uErr;
            console.log("Existing matches is_team_match flag successfully updated in Supabase!");
          }
        }
      } catch (err) {
        console.error("Failed to initialize Supabase database:", err);
      }
      return;
    }

    const currentVersion = localStorage.getItem('fm_db_version');
    if (currentVersion !== DB_VERSION) {
      localStorage.removeItem(LS_KEYS.PLAYERS);
      localStorage.removeItem(LS_KEYS.MATCHES);
      localStorage.removeItem(LS_KEYS.PLAYER_STATS);
      localStorage.removeItem(LS_KEYS.TEAM_STATS);
      localStorage.removeItem(LS_KEYS.TACTICAL);
      localStorage.setItem('fm_db_version', DB_VERSION);
    }

    const existingPlayers = getLS<Player[]>(LS_KEYS.PLAYERS, []);
    if (existingPlayers.length === 0) {
      setLS(LS_KEYS.PLAYERS, SEED_PLAYERS);
      setLS(LS_KEYS.MATCHES, parsedMatches);
      setLS(LS_KEYS.TEAM_STATS, parsedTeamStats);
      setLS(LS_KEYS.PLAYER_STATS, parsedPlayerStats);
      setLS(LS_KEYS.TACTICAL, SEED_TACTICAL_LAYOUTS);
      await dbService.recalculateAllPlayerOVRs();
    }
  },

  /**
   * Clears database and resets to seed data (now empty)
   */
  resetToDefaults: async (): Promise<void> => {
    if (isRealSupabase && supabase) {
      try {
        // Delete all rows in order of foreign key dependency
        await supabase.from('player_match_stats').delete().neq('id', '');
        await supabase.from('team_match_stats').delete().neq('match_id', '');
        await supabase.from('matches').delete().neq('id', '');
        await supabase.from('players').delete().neq('id', '');
        await supabase.from('tactical_layouts').delete().neq('id', '');
        
        console.log("Supabase database successfully cleared!");
      } catch (err) {
        console.error("Failed to reset Supabase database:", err);
        throw err;
      }
      return;
    }

    localStorage.removeItem(LS_KEYS.PLAYERS);
    localStorage.removeItem(LS_KEYS.MATCHES);
    localStorage.removeItem(LS_KEYS.TEAM_STATS);
    localStorage.removeItem(LS_KEYS.PLAYER_STATS);
    localStorage.removeItem(LS_KEYS.TACTICAL);
    await dbService.init();
  },

  // ==========================================
  // PLAYERS API
  // ==========================================
  getPlayers: async (): Promise<Player[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('players').select('*');
      if (error) throw error;
      return data as Player[];
    }
    return getLS<Player[]>(LS_KEYS.PLAYERS, []);
  },

  savePlayer: async (player: Player): Promise<void> => {
    if (isRealSupabase && supabase) {
      const { error } = await supabase.from('players').upsert(player);
      if (error) throw error;
      return;
    }
    const players = getLS<Player[]>(LS_KEYS.PLAYERS, []);
    const idx = players.findIndex(p => p.id === player.id);
    if (idx >= 0) {
      players[idx] = player;
    } else {
      players.push(player);
    }
    setLS(LS_KEYS.PLAYERS, players);
  },

  // ==========================================
  // MATCHES API
  // ==========================================
  getMatches: async (): Promise<Match[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('matches').select('*').order('date', { ascending: true });
      if (error) throw error;
      return data as Match[];
    }
    return getLS<Match[]>(LS_KEYS.MATCHES, []).sort((a, b) => a.date.localeCompare(b.date));
  },

  saveMatch: async (match: Match): Promise<void> => {
    if (isRealSupabase && supabase) {
      const { error } = await supabase.from('matches').upsert(match);
      if (error) throw error;
      return;
    }
    const matches = getLS<Match[]>(LS_KEYS.MATCHES, []);
    const idx = matches.findIndex(m => m.id === match.id);
    if (idx >= 0) {
      matches[idx] = match;
    } else {
      matches.push(match);
    }
    setLS(LS_KEYS.MATCHES, matches);
  },

  // ==========================================
  // PLAYER STATS API
  // ==========================================
  getPlayerMatchStats: async (playerId: string): Promise<PlayerMatchStats[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('player_match_stats').select('*').eq('player_id', playerId);
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
    const allStats = getLS<PlayerMatchStats[]>(LS_KEYS.PLAYER_STATS, []);
    return allStats.filter(s => s.player_id === playerId);
  },

  getAllPlayerMatchStats: async (): Promise<PlayerMatchStats[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('player_match_stats').select('*');
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
    return getLS<PlayerMatchStats[]>(LS_KEYS.PLAYER_STATS, []);
  },

  savePlayerMatchStats: async (stats: PlayerMatchStats[]): Promise<void> => {
    if (isRealSupabase && supabase) {
      const { error } = await supabase.from('player_match_stats').upsert(stats);
      if (error) throw error;
      await dbService.recalculateAllPlayerOVRs();
      return;
    }
    const allStats = getLS<PlayerMatchStats[]>(LS_KEYS.PLAYER_STATS, []);
    stats.forEach(newStat => {
      const idx = allStats.findIndex(s => s.id === newStat.id || (s.player_id === newStat.player_id && s.match_id === newStat.match_id));
      if (idx >= 0) {
        allStats[idx] = { ...allStats[idx], ...newStat };
      } else {
        allStats.push(newStat);
      }
    });
    setLS(LS_KEYS.PLAYER_STATS, allStats);
    await dbService.recalculateAllPlayerOVRs();
  },

  // ==========================================
  // TEAM STATS API
  // ==========================================
  getTeamMatchStats: async (): Promise<TeamMatchStats[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('team_match_stats').select('*');
      if (error) throw error;
      return data as TeamMatchStats[];
    }
    return getLS<TeamMatchStats[]>(LS_KEYS.TEAM_STATS, []);
  },

  saveTeamMatchStats: async (stats: TeamMatchStats): Promise<void> => {
    if (isRealSupabase && supabase) {
      const { error } = await supabase.from('team_match_stats').upsert(stats);
      if (error) throw error;
      return;
    }
    const teamStats = getLS<TeamMatchStats[]>(LS_KEYS.TEAM_STATS, []);
    const idx = teamStats.findIndex(ts => ts.match_id === stats.match_id);
    if (idx >= 0) {
      teamStats[idx] = stats;
    } else {
      teamStats.push(stats);
    }
    setLS(LS_KEYS.TEAM_STATS, teamStats);
  },

  // ==========================================
  // TACTICAL LAYOUTS API
  // ==========================================
  getTacticalLayouts: async (): Promise<TacticalLayout[]> => {
    if (isRealSupabase && supabase) {
      const { data, error } = await supabase.from('tactical_layouts').select('*');
      if (error) throw error;
      return data as TacticalLayout[];
    }
    return getLS<TacticalLayout[]>(LS_KEYS.TACTICAL, []);
  },

  saveTacticalLayout: async (layout: TacticalLayout): Promise<void> => {
    if (isRealSupabase && supabase) {
      const { error } = await supabase.from('tactical_layouts').upsert(layout);
      if (error) throw error;
      return;
    }
    const layouts = getLS<TacticalLayout[]>(LS_KEYS.TACTICAL, []);
    const idx = layouts.findIndex(l => l.id === layout.id);
    if (idx >= 0) {
      layouts[idx] = layout;
    } else {
      layouts.push(layout);
    }
    setLS(LS_KEYS.TACTICAL, layouts);
  },

  // ==========================================
  // OVR AND RE-CALCULATION UTILITIES
  // ==========================================
  recalculateAllPlayerOVRs: async (): Promise<void> => {
    if (isRealSupabase && supabase) {
      try {
        const { data: players, error: pErr } = await supabase.from('players').select('*');
        if (pErr) throw pErr;
        const { data: stats, error: sErr } = await supabase.from('player_match_stats').select('*');
        if (sErr) throw sErr;
        const { data: matches, error: mErr } = await supabase.from('matches').select('*');
        if (mErr) throw mErr;

        const matchesList = (matches as Match[] || []);

        for (const p of (players as Player[])) {
          const playerStats = (stats as PlayerMatchStats[]).filter(s => s.player_id === p.id);
          playerStats.sort((a, b) => {
            const dateA = matchesList.find(m => m.id === a.match_id)?.date || '';
            const dateB = matchesList.find(m => m.id === b.match_id)?.date || '';
            return dateA.localeCompare(dateB);
          });
          const updates = calculateDynamicOVRAndForm(p, playerStats);
          const updatedPlayer = { ...p, ...updates };
          await dbService.savePlayer(updatedPlayer);
        }
      } catch (err) {
        console.error("Failed to recalculate player OVR ratings:", err);
      }
      return;
    }

    const players = getLS<Player[]>(LS_KEYS.PLAYERS, []);
    const stats = getLS<PlayerMatchStats[]>(LS_KEYS.PLAYER_STATS, []);
    const matches = getLS<Match[]>(LS_KEYS.MATCHES, []);

    const updatedPlayers = players.map(p => {
      const playerStats = stats.filter(s => s.player_id === p.id);
      playerStats.sort((a, b) => {
        const dateA = matches.find(m => m.id === a.match_id)?.date || '';
        const dateB = matches.find(m => m.id === b.match_id)?.date || '';
        return dateA.localeCompare(dateB);
      });
      const { overall, form_rating, form_trend } = calculateDynamicOVRAndForm(p, playerStats);
      return {
        ...p,
        overall,
        form_rating,
        form_trend
      };
    });

    setLS(LS_KEYS.PLAYERS, updatedPlayers);
  }
};

// Initialize seed data if offline
dbService.init();
