import { createClient } from '@supabase/supabase-js';
import { Player, Match, PlayerMatchStats, TeamMatchStats, TacticalLayout, UserProfile, ProfileSeedOptions } from '../types';
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
// SAMPLE DATA DEFINITIONS (FOR OPTIONAL SEEDING)
// ==========================================

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
    const awayPart = parts[1].trim();
    const awayTeam = awayPart.split(/\s\d/)[0].trim();
    
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

  if (isGreece) {
    const schemeClean = row.Scheme ? String(row.Scheme).split(" ")[0].trim() : "4-3-3";
    parsedTeamStats.push({
      match_id: matchId,
      possession: Number(row["Possession, %"] ?? 50),
      shots: Number(row["Shots / on target"] ?? 0),
      shots_on_target: Number(row[""] ?? 0),
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
  const isNationalTeam = row.Match.includes("Greece U17") || row.Match.includes("Greece U16");
  const teamName = isNationalTeam ? "Greece U17" : "Borussia Dortmund U17";
  const { opponent, venue, ourScore, oppScore } = parseOpponentAndVenue(row.Match, teamName);
  const matchId = `m_${row.Date}_${opponent.replace(/\s+/g, '_')}`;

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

parsedMatches.sort((a, b) => a.date.localeCompare(b.date));

export const SAMPLE_DATASET = {
  players: SEED_PLAYERS,
  matches: parsedMatches,
  playerStats: parsedPlayerStats,
  teamStats: parsedTeamStats,
  tacticalLayouts: SEED_TACTICAL_LAYOUTS
};

// ==========================================
// STORAGE HELPERS (LOCALSTORAGE FALLBACK)
// ==========================================

function getLS<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

function setLS<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("LocalStorage write failed:", e);
  }
}

// Active Profile ID state
let currentActiveProfileId: string | null = localStorage.getItem('fm_active_profile_id') || null;

// Track if remote Supabase schema supports 'profile_id' column
let remoteSupportsProfileId: boolean | null = null;
let remoteSupportsProfilesTable: boolean | null = null;

// ==========================================
// PROFILE SERVICE
// ==========================================

export const profileService = {
  getActiveProfileId: (): string | null => {
    return currentActiveProfileId || localStorage.getItem('fm_active_profile_id');
  },

  setActiveProfileId: (id: string | null): void => {
    currentActiveProfileId = id;
    if (id) {
      localStorage.setItem('fm_active_profile_id', id);
    } else {
      localStorage.removeItem('fm_active_profile_id');
    }
  },

  getProfiles: async (userId?: string): Promise<UserProfile[]> => {
    const storageKey = `fm_profiles_${userId || 'guest'}`;
    const localProfiles = getLS<UserProfile[]>(storageKey, []);

    if (isRealSupabase && supabase && remoteSupportsProfilesTable !== false) {
      try {
        let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (userId) {
          query = query.eq('user_id', userId);
        }
        const { data, error } = await query;
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
            remoteSupportsProfilesTable = false;
          } else {
            console.warn("Error fetching Supabase profiles, using local fallback:", error.message);
          }
          return localProfiles;
        }
        remoteSupportsProfilesTable = true;
        if (data && data.length > 0) {
          setLS(storageKey, data);
          return data as UserProfile[];
        }
      } catch (err) {
        console.warn("Supabase profiles query error:", err);
      }
    }

    return localProfiles;
  },

  createProfile: async (
    profile: UserProfile, 
    seedOptions: ProfileSeedOptions = { includePlayers: false, includeMatches: false, includePlayerStats: false, includeTactics: false }
  ): Promise<UserProfile> => {
    const profileWithMeta: UserProfile = {
      ...profile,
      id: profile.id || `prof_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      created_at: profile.created_at || new Date().toISOString()
    };

    const storageKey = `fm_profiles_${profile.user_id || 'guest'}`;
    const existing = getLS<UserProfile[]>(storageKey, []);
    const updated = [profileWithMeta, ...existing.filter(p => p.id !== profileWithMeta.id)];
    setLS(storageKey, updated);

    // If Supabase is connected, try to store profile
    if (isRealSupabase && supabase && remoteSupportsProfilesTable !== false) {
      try {
        const { error } = await supabase.from('profiles').upsert(profileWithMeta);
        if (error) {
          if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
            remoteSupportsProfilesTable = false;
          } else {
            console.warn("Could not insert profile to Supabase (using local):", error.message);
          }
        }
      } catch (err) {
        console.warn("Supabase createProfile error:", err);
      }
    }

    // Set active profile to newly created one
    profileService.setActiveProfileId(profileWithMeta.id);

    // Perform selective data seeding for this new profile
    await dbService.seedProfileData(profileWithMeta.id, seedOptions);

    return profileWithMeta;
  },

  deleteProfile: async (profileId: string, userId?: string): Promise<void> => {
    const storageKey = `fm_profiles_${userId || 'guest'}`;
    const existing = getLS<UserProfile[]>(storageKey, []);
    setLS(storageKey, existing.filter(p => p.id !== profileId));

    // Clear profile-specific data from local storage
    localStorage.removeItem(`fm_p_${profileId}_players`);
    localStorage.removeItem(`fm_p_${profileId}_matches`);
    localStorage.removeItem(`fm_p_${profileId}_player_stats`);
    localStorage.removeItem(`fm_p_${profileId}_team_stats`);
    localStorage.removeItem(`fm_p_${profileId}_tactical`);

    if (profileService.getActiveProfileId() === profileId) {
      profileService.setActiveProfileId(null);
    }

    if (isRealSupabase && supabase && remoteSupportsProfilesTable !== false) {
      try {
        await supabase.from('profiles').delete().eq('id', profileId);
        if (remoteSupportsProfileId !== false) {
          await supabase.from('player_match_stats').delete().eq('profile_id', profileId);
          await supabase.from('team_match_stats').delete().eq('profile_id', profileId);
          await supabase.from('matches').delete().eq('profile_id', profileId);
          await supabase.from('players').delete().eq('profile_id', profileId);
          await supabase.from('tactical_layouts').delete().eq('profile_id', profileId);
        }
      } catch (err) {
        console.warn("Supabase deleteProfile error:", err);
      }
    }
  }
};

// ==========================================
// DB SERVICE (SCOPED TO ACTIVE PROFILE)
// ==========================================

export const dbService = {
  /**
   * Helper to get active profile ID, or a fallback default
   */
  getProfileScope: (): string => {
    return profileService.getActiveProfileId() || 'default_profile';
  },

  /**
   * Seeds only the specific data items requested by the user for a profile
   */
  seedProfileData: async (profileId: string, options: ProfileSeedOptions): Promise<void> => {
    // If completely blank (all false), write empty datasets
    if (!options.includePlayers && !options.includeMatches && !options.includePlayerStats && !options.includeTactics) {
      setLS(`fm_p_${profileId}_players`, []);
      setLS(`fm_p_${profileId}_matches`, []);
      setLS(`fm_p_${profileId}_player_stats`, []);
      setLS(`fm_p_${profileId}_team_stats`, []);
      setLS(`fm_p_${profileId}_tactical`, []);
      return;
    }

    // 1. Players
    if (options.includePlayers) {
      const playersToSeed = SAMPLE_DATASET.players.map(p => ({
        ...p,
        id: `${p.id}_${profileId}`,
        profile_id: profileId
      }));
      setLS(`fm_p_${profileId}_players`, playersToSeed);

      if (isRealSupabase && supabase) {
        try {
          const payload = remoteSupportsProfileId === false ? playersToSeed.map(({ profile_id: _, ...c }) => c) : playersToSeed;
          await supabase.from('players').upsert(payload);
        } catch (e) {
          console.warn("Could not seed players to Supabase:", e);
        }
      }
    } else {
      setLS(`fm_p_${profileId}_players`, []);
    }

    // 2. Matches
    if (options.includeMatches) {
      const matchesToSeed = SAMPLE_DATASET.matches.map(m => ({
        ...m,
        id: `${m.id}_${profileId}`,
        profile_id: profileId
      }));
      setLS(`fm_p_${profileId}_matches`, matchesToSeed);

      if (isRealSupabase && supabase) {
        try {
          const payload = remoteSupportsProfileId === false ? matchesToSeed.map(({ profile_id: _, ...c }) => c) : matchesToSeed;
          await supabase.from('matches').upsert(payload);
        } catch (e) {
          console.warn("Could not seed matches to Supabase:", e);
        }
      }
    } else {
      setLS(`fm_p_${profileId}_matches`, []);
    }

    // 3. Stats (Player & Team)
    if (options.includePlayerStats && options.includeMatches && options.includePlayers) {
      const pStatsToSeed = SAMPLE_DATASET.playerStats.map(s => ({
        ...s,
        id: `${s.id}_${profileId}`,
        player_id: `kostoglou_${profileId}`,
        match_id: `${s.match_id}_${profileId}`,
        profile_id: profileId
      }));
      const tStatsToSeed = SAMPLE_DATASET.teamStats.map(ts => ({
        ...ts,
        match_id: `${ts.match_id}_${profileId}`,
        profile_id: profileId
      }));

      setLS(`fm_p_${profileId}_player_stats`, pStatsToSeed);
      setLS(`fm_p_${profileId}_team_stats`, tStatsToSeed);

      if (isRealSupabase && supabase) {
        try {
          const pPayload = remoteSupportsProfileId === false ? pStatsToSeed.map(({ profile_id: _, ...c }) => c) : pStatsToSeed;
          const tPayload = remoteSupportsProfileId === false ? tStatsToSeed.map(({ profile_id: _, ...c }) => c) : tStatsToSeed;
          await supabase.from('team_match_stats').upsert(tPayload);
          await supabase.from('player_match_stats').upsert(pPayload);
        } catch (e) {
          console.warn("Could not seed stats to Supabase:", e);
        }
      }
    } else {
      setLS(`fm_p_${profileId}_player_stats`, []);
      setLS(`fm_p_${profileId}_team_stats`, []);
    }

    // 4. Tactics
    if (options.includeTactics) {
      const tacticalToSeed = SAMPLE_DATASET.tacticalLayouts.map(t => ({
        ...t,
        id: `${t.id}_${profileId}`,
        profile_id: profileId,
        positions: options.includePlayers ? { "CM": `kostoglou_${profileId}` } : {}
      }));
      setLS(`fm_p_${profileId}_tactical`, tacticalToSeed);

      if (isRealSupabase && supabase) {
        try {
          const payload = remoteSupportsProfileId === false ? tacticalToSeed.map(({ profile_id: _, ...c }) => c) : tacticalToSeed;
          await supabase.from('tactical_layouts').upsert(payload);
        } catch (e) {
          console.warn("Could not seed tactical to Supabase:", e);
        }
      }
    } else {
      setLS(`fm_p_${profileId}_tactical`, []);
    }

    if (options.includePlayers && options.includePlayerStats) {
      await dbService.recalculateAllPlayerOVRs(profileId);
    }
  },

  init: async () => {
    return;
  },

  resetToDefaults: async (): Promise<void> => {
    const profileId = dbService.getProfileScope();
    localStorage.removeItem(`fm_p_${profileId}_players`);
    localStorage.removeItem(`fm_p_${profileId}_matches`);
    localStorage.removeItem(`fm_p_${profileId}_team_stats`);
    localStorage.removeItem(`fm_p_${profileId}_player_stats`);
    localStorage.removeItem(`fm_p_${profileId}_tactical`);

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        await supabase.from('player_match_stats').delete().eq('profile_id', profileId);
        await supabase.from('team_match_stats').delete().eq('profile_id', profileId);
        await supabase.from('matches').delete().eq('profile_id', profileId);
        await supabase.from('players').delete().eq('profile_id', profileId);
        await supabase.from('tactical_layouts').delete().eq('profile_id', profileId);
      } catch (err) {
        console.warn("Reset Supabase failed:", err);
      }
    }
  },

  // ==========================================
  // PLAYERS API
  // ==========================================
  getPlayers: async (profileIdOverride?: string): Promise<Player[]> => {
    const profileId = profileIdOverride || dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('players').select('*').eq('profile_id', profileId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          } else {
            console.warn("Supabase getPlayers error:", error.message);
          }
        } else if (data) {
          setLS(`fm_p_${profileId}_players`, data);
          return data as Player[];
        }
      } catch (e) {
        console.warn("Supabase query error:", e);
      }
    }

    return getLS<Player[]>(`fm_p_${profileId}_players`, []);
  },

  savePlayer: async (player: Player): Promise<void> => {
    const profileId = player.profile_id || dbService.getProfileScope();
    const playerWithScope: Player = { ...player, profile_id: profileId };

    const players = getLS<Player[]>(`fm_p_${profileId}_players`, []);
    const idx = players.findIndex(p => p.id === playerWithScope.id);
    if (idx >= 0) {
      players[idx] = playerWithScope;
    } else {
      players.push(playerWithScope);
    }
    setLS(`fm_p_${profileId}_players`, players);

    if (isRealSupabase && supabase) {
      try {
        const payload = remoteSupportsProfileId === false 
          ? { ...playerWithScope, profile_id: undefined } 
          : playerWithScope;
        const { error } = await supabase.from('players').upsert(payload);
        if (error && (error.code === 'PGRST204' || error.message?.includes('profile_id'))) {
          remoteSupportsProfileId = false;
          const { profile_id: _, ...clean } = playerWithScope;
          await supabase.from('players').upsert(clean);
        }
      } catch (err) {
        console.warn("Supabase savePlayer error:", err);
      }
    }
  },

  // ==========================================
  // MATCHES API
  // ==========================================
  getMatches: async (profileIdOverride?: string): Promise<Match[]> => {
    const profileId = profileIdOverride || dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('matches').select('*').eq('profile_id', profileId).order('date', { ascending: true });
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          }
        } else if (data) {
          setLS(`fm_p_${profileId}_matches`, data);
          return data as Match[];
        }
      } catch (e) {
        console.warn("Supabase getMatches error:", e);
      }
    }

    return getLS<Match[]>(`fm_p_${profileId}_matches`, []).sort((a, b) => a.date.localeCompare(b.date));
  },

  saveMatch: async (match: Match): Promise<void> => {
    const profileId = match.profile_id || dbService.getProfileScope();
    const matchWithScope: Match = { ...match, profile_id: profileId };

    const matches = getLS<Match[]>(`fm_p_${profileId}_matches`, []);
    const idx = matches.findIndex(m => m.id === matchWithScope.id);
    if (idx >= 0) {
      matches[idx] = matchWithScope;
    } else {
      matches.push(matchWithScope);
    }
    setLS(`fm_p_${profileId}_matches`, matches);

    if (isRealSupabase && supabase) {
      try {
        const payload = remoteSupportsProfileId === false ? { ...matchWithScope, profile_id: undefined } : matchWithScope;
        const { error } = await supabase.from('matches').upsert(payload);
        if (error && (error.code === 'PGRST204' || error.message?.includes('profile_id'))) {
          remoteSupportsProfileId = false;
          const { profile_id: _, ...clean } = matchWithScope;
          await supabase.from('matches').upsert(clean);
        }
      } catch (err) {
        console.warn("Supabase saveMatch error:", err);
      }
    }
  },

  // ==========================================
  // PLAYER STATS API
  // ==========================================
  getPlayerMatchStats: async (playerId: string): Promise<PlayerMatchStats[]> => {
    const profileId = dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('player_match_stats')
          .select('*')
          .eq('player_id', playerId)
          .eq('profile_id', profileId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          }
        } else if (data) {
          return data as PlayerMatchStats[];
        }
      } catch (e) {
        console.warn("Supabase getPlayerMatchStats error:", e);
      }
    }

    const allStats = getLS<PlayerMatchStats[]>(`fm_p_${profileId}_player_stats`, []);
    return allStats.filter(s => s.player_id === playerId);
  },

  getAllPlayerMatchStats: async (): Promise<PlayerMatchStats[]> => {
    const profileId = dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('player_match_stats')
          .select('*')
          .eq('profile_id', profileId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          }
        } else if (data) {
          setLS(`fm_p_${profileId}_player_stats`, data);
          return data as PlayerMatchStats[];
        }
      } catch (e) {
        console.warn("Supabase getAllPlayerMatchStats error:", e);
      }
    }

    return getLS<PlayerMatchStats[]>(`fm_p_${profileId}_player_stats`, []);
  },

  savePlayerMatchStats: async (stats: PlayerMatchStats[]): Promise<void> => {
    const profileId = dbService.getProfileScope();
    const statsWithScope = stats.map(s => ({ ...s, profile_id: s.profile_id || profileId }));

    const allStats = getLS<PlayerMatchStats[]>(`fm_p_${profileId}_player_stats`, []);
    statsWithScope.forEach(newStat => {
      const idx = allStats.findIndex(s => s.id === newStat.id || (s.player_id === newStat.player_id && s.match_id === newStat.match_id));
      if (idx >= 0) {
        allStats[idx] = { ...allStats[idx], ...newStat };
      } else {
        allStats.push(newStat);
      }
    });
    setLS(`fm_p_${profileId}_player_stats`, allStats);

    if (isRealSupabase && supabase) {
      try {
        const payload = remoteSupportsProfileId === false 
          ? statsWithScope.map(({ profile_id: _, ...s }) => s)
          : statsWithScope;
        await supabase.from('player_match_stats').upsert(payload);
      } catch (e) {
        console.warn("Supabase savePlayerMatchStats error:", e);
      }
    }

    await dbService.recalculateAllPlayerOVRs(profileId);
  },

  // ==========================================
  // TEAM STATS API
  // ==========================================
  getTeamMatchStats: async (): Promise<TeamMatchStats[]> => {
    const profileId = dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('team_match_stats').select('*').eq('profile_id', profileId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          }
        } else if (data) {
          setLS(`fm_p_${profileId}_team_stats`, data);
          return data as TeamMatchStats[];
        }
      } catch (e) {
        console.warn("Supabase getTeamMatchStats error:", e);
      }
    }

    return getLS<TeamMatchStats[]>(`fm_p_${profileId}_team_stats`, []);
  },

  saveTeamMatchStats: async (stats: TeamMatchStats): Promise<void> => {
    const profileId = stats.profile_id || dbService.getProfileScope();
    const statsWithScope: TeamMatchStats = { ...stats, profile_id: profileId };

    const teamStats = getLS<TeamMatchStats[]>(`fm_p_${profileId}_team_stats`, []);
    const idx = teamStats.findIndex(ts => ts.match_id === statsWithScope.match_id);
    if (idx >= 0) {
      teamStats[idx] = statsWithScope;
    } else {
      teamStats.push(statsWithScope);
    }
    setLS(`fm_p_${profileId}_team_stats`, teamStats);

    if (isRealSupabase && supabase) {
      try {
        const payload = remoteSupportsProfileId === false ? { ...statsWithScope, profile_id: undefined } : statsWithScope;
        await supabase.from('team_match_stats').upsert(payload);
      } catch (e) {
        console.warn("Supabase saveTeamMatchStats error:", e);
      }
    }
  },

  // ==========================================
  // TACTICAL LAYOUTS API
  // ==========================================
  getTacticalLayouts: async (): Promise<TacticalLayout[]> => {
    const profileId = dbService.getProfileScope();

    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        const { data, error } = await supabase.from('tactical_layouts').select('*').eq('profile_id', profileId);
        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('profile_id')) {
            remoteSupportsProfileId = false;
          }
        } else if (data) {
          setLS(`fm_p_${profileId}_tactical`, data);
          return data as TacticalLayout[];
        }
      } catch (e) {
        console.warn("Supabase getTacticalLayouts error:", e);
      }
    }

    return getLS<TacticalLayout[]>(`fm_p_${profileId}_tactical`, []);
  },

  saveTacticalLayout: async (layout: TacticalLayout): Promise<void> => {
    const profileId = layout.profile_id || dbService.getProfileScope();
    const layoutWithScope: TacticalLayout = { ...layout, profile_id: profileId };

    const layouts = getLS<TacticalLayout[]>(`fm_p_${profileId}_tactical`, []);
    const idx = layouts.findIndex(l => l.id === layoutWithScope.id);
    if (idx >= 0) {
      layouts[idx] = layoutWithScope;
    } else {
      layouts.push(layoutWithScope);
    }
    setLS(`fm_p_${profileId}_tactical`, layouts);

    if (isRealSupabase && supabase) {
      try {
        const payload = remoteSupportsProfileId === false ? { ...layoutWithScope, profile_id: undefined } : layoutWithScope;
        await supabase.from('tactical_layouts').upsert(payload);
      } catch (e) {
        console.warn("Supabase saveTacticalLayout error:", e);
      }
    }
  },

  // ==========================================
  // OVR AND RE-CALCULATION UTILITIES
  // ==========================================
  recalculateAllPlayerOVRs: async (profileIdParam?: string): Promise<void> => {
    const profileId = profileIdParam || dbService.getProfileScope();
    const players = await dbService.getPlayers(profileId);
    const stats = getLS<PlayerMatchStats[]>(`fm_p_${profileId}_player_stats`, []);
    const matches = await dbService.getMatches(profileId);

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

    setLS(`fm_p_${profileId}_players`, updatedPlayers);
    if (isRealSupabase && supabase && remoteSupportsProfileId !== false) {
      try {
        await supabase.from('players').upsert(updatedPlayers);
      } catch (e) {
        console.warn("Supabase recalculateAllPlayerOVRs error:", e);
      }
    }
  }
};
