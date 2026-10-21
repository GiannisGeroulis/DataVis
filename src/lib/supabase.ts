import { createClient } from '@supabase/supabase-js';
import { 
  Player, 
  Match, 
  PlayerMatchStats, 
  TeamMatchStats, 
  TacticalLayout, 
  UserProfile, 
  ProfileSeedOptions,
  OpponentTeam,
  GlobalOpponentTeam,
  WyscoutMatch
} from '../types';
import { calculateDynamicOVRAndForm } from './ovr-algorithm';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

export const isRealSupabase = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'YOUR_SUPABASE_URL' && 
  supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase = isRealSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;


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
let currentActiveProfileId: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem('fm_active_profile_id') : null;

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
          await supabase.from('wyscout_matches').delete().eq('profile_id', profileId);
          await supabase.from('opponent_teams').delete().eq('profile_id', profileId);
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
// OPPONENT TEAMS SERVICE
// ==========================================

// ==========================================
// OPPONENT TEAMS SERVICE (PURE SUPABASE)
// ==========================================

export const opponentService = {
  getOpponentTeams: async (profileIdOverride?: string): Promise<OpponentTeam[]> => {
    const profileId = profileIdOverride || dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_opponents`;
    let localTeams = getLS<OpponentTeam[]>(storageKey, []);

    if (isRealSupabase && supabase) {
      try {
        // Fetch all opponent teams from Supabase (shared club scouting database)
        const { data, error } = await supabase
          .from('opponent_teams')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data && data.length > 0) {
          // Count Wyscout matches per team in Supabase
          const { data: matchRows } = await supabase
            .from('wyscout_matches')
            .select('opponent_team_id');
          
          const matchCountMap: Record<string, number> = {};
          (matchRows || []).forEach(m => {
            matchCountMap[m.opponent_team_id] = (matchCountMap[m.opponent_team_id] || 0) + 1;
          });

          // Deduplicate teams by name (case-insensitive & trimmed)
          // Keep the team instance that holds the most matches, or the latest created
          const uniqueByName = new Map<string, OpponentTeam>();
          data.forEach(t => {
            const norm = t.name.toLowerCase().trim();
            const count = matchCountMap[t.id] || 0;
            const existing = uniqueByName.get(norm);
            if (!existing) {
              uniqueByName.set(norm, t);
            } else {
              const existingCount = matchCountMap[existing.id] || 0;
              if (count > existingCount || (count === existingCount && (t.created_at || '') > (existing.created_at || ''))) {
                uniqueByName.set(norm, t);
              }
            }
          });

          const deduplicated = Array.from(uniqueByName.values());
          setLS(storageKey, deduplicated);
          return deduplicated;
        }
      } catch (e) {
        console.warn("Supabase getOpponentTeams error:", e);
      }
    }

    return localTeams;
  },

  /**
   * Retrieves all unique opponent teams directly from Supabase across all users/profiles.
   * Includes match counts, xG and possession stats calculated from real Wyscout matches.
   */
  getGlobalOpponentTeams: async (): Promise<GlobalOpponentTeam[]> => {
    if (!isRealSupabase || !supabase) return [];

    try {
      const { data: remoteTeams, error } = await supabase
        .from('opponent_teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !remoteTeams) {
        return [];
      }

      // Fetch match count & summary stats for all teams in Supabase
      const { data: matchesData } = await supabase
        .from('wyscout_matches')
        .select('opponent_team_id, xg, possession');

      const statsMap: Record<string, { count: number; totalXg: number; totalPoss: number }> = {};
      (matchesData || []).forEach((m: any) => {
        if (!statsMap[m.opponent_team_id]) {
          statsMap[m.opponent_team_id] = { count: 0, totalXg: 0, totalPoss: 0 };
        }
        statsMap[m.opponent_team_id].count += 1;
        statsMap[m.opponent_team_id].totalXg += Number(m.xg || 0);
        statsMap[m.opponent_team_id].totalPoss += Number(m.possession || 0);
      });

      const teamsMap = new Map<string, GlobalOpponentTeam>();
      remoteTeams.forEach(t => {
        const norm = t.name.toLowerCase().trim();
        const s = statsMap[t.id];
        const count = s ? s.count : 0;
        const avgXg = count > 0 ? Math.round((s.totalXg / count) * 100) / 100 : 0;
        const avgPoss = count > 0 ? Math.round(s.totalPoss / count) : 0;

        const existing = teamsMap.get(norm);
        if (!existing || count >= (existing.matchCount || 0)) {
          teamsMap.set(norm, {
            ...t,
            matchCount: count,
            avgXg,
            avgPoss
          });
        }
      });

      return Array.from(teamsMap.values());
    } catch (err) {
      console.warn("Supabase getGlobalOpponentTeams error:", err);
      return [];
    }
  },

  /**
   * Directly imports a team from the Global Supabase Database into the user's active profile,
   * along with all its uploaded Wyscout matches from Supabase.
   */
  importGlobalTeamToProfile: async (
    globalTeam: GlobalOpponentTeam,
    targetProfileId: string
  ): Promise<{ team: OpponentTeam; matchesCount: number }> => {
    const newTeamId = `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const teamToSave: OpponentTeam = {
      id: newTeamId,
      profile_id: targetProfileId,
      name: globalTeam.name,
      logo_url: globalTeam.logo_url,
      country: globalTeam.country,
      league: globalTeam.league,
      notes: globalTeam.notes,
      created_at: new Date().toISOString()
    };

    const savedTeam = await opponentService.saveOpponentTeam(teamToSave);

    // Fetch real matches from source global team in Supabase
    if (isRealSupabase && supabase && globalTeam.id) {
      try {
        const { data: matchesToImport, error } = await supabase
          .from('wyscout_matches')
          .select('*')
          .eq('opponent_team_id', globalTeam.id);

        if (!error && matchesToImport && matchesToImport.length > 0) {
          const clonedMatches: WyscoutMatch[] = matchesToImport.map((m, idx) => ({
            ...m,
            id: `wm_${newTeamId}_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
            profile_id: targetProfileId,
            opponent_team_id: newTeamId,
            created_at: new Date().toISOString()
          }));

          await wyscoutService.saveMatches(clonedMatches);
          return { team: savedTeam, matchesCount: clonedMatches.length };
        }
      } catch (err) {
        console.warn("Error fetching remote matches to clone:", err);
      }
    }

    return { team: savedTeam, matchesCount: 0 };
  },

  saveOpponentTeam: async (team: OpponentTeam): Promise<OpponentTeam> => {
    const profileId = team.profile_id || dbService.getProfileScope();
    let teamWithScope: OpponentTeam = {
      ...team,
      id: team.id || `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      profile_id: profileId,
      created_at: team.created_at || new Date().toISOString()
    };

    if (isRealSupabase && supabase) {
      try {
        // Reuse existing team with the same name if one exists in Supabase
        const { data: existingTeams } = await supabase
          .from('opponent_teams')
          .select('*')
          .ilike('name', teamWithScope.name.trim());

        if (existingTeams && existingTeams.length > 0) {
          const matched = existingTeams.find(t => t.id === teamWithScope.id) || existingTeams[0];
          teamWithScope = {
            ...matched,
            ...teamWithScope,
            id: matched.id
          };
        }

        await supabase.from('opponent_teams').upsert(teamWithScope);
      } catch (e) {
        console.warn("Supabase saveOpponentTeam error:", e);
      }
    }

    const storageKey = `fm_p_${profileId}_opponents`;
    const current = getLS<OpponentTeam[]>(storageKey, []);
    const idx = current.findIndex(t => t.id === teamWithScope.id);
    if (idx >= 0) {
      current[idx] = teamWithScope;
    } else {
      current.unshift(teamWithScope);
    }
    setLS(storageKey, current);

    return teamWithScope;
  },

  deleteOpponentTeam: async (teamId: string): Promise<void> => {
    const profileId = dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_opponents`;
    const current = getLS<OpponentTeam[]>(storageKey, []);
    setLS(storageKey, current.filter(t => t.id !== teamId));

    // Clear matches cache for this team
    localStorage.removeItem(`fm_p_${profileId}_wyscout_${teamId}`);

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('wyscout_matches').delete().eq('opponent_team_id', teamId);
        await supabase.from('opponent_teams').delete().eq('id', teamId);
      } catch (e) {
        console.warn("Supabase deleteOpponentTeam error:", e);
      }
    }
  }
};

// Exact base columns originally created in the remote Supabase wyscout_matches table schema
export const BASE_SUPABASE_MATCH_COLUMNS = new Set([
  'id',
  'profile_id',
  'opponent_team_id',
  'date',
  'match_name',
  'competition',
  'duration',
  'scheme',
  'team_analyzed',
  'goals',
  'xg',
  'shots',
  'shots_on_target',
  'shots_on_target_pct',
  'passes',
  'passes_accurate',
  'passing_accuracy',
  'possession',
  'losses',
  'losses_low',
  'losses_med',
  'losses_high',
  'recoveries',
  'recoveries_low',
  'recoveries_med',
  'recoveries_high',
  'duels',
  'duels_won',
  'duels_won_pct',
  'opponent_team_name',
  'opponent_goals',
  'opponent_xg',
  'opponent_shots',
  'opponent_possession',
  'positional_attacks',
  'positional_attacks_shots',
  'positional_attacks_pct',
  'counterattacks',
  'counterattacks_shots',
  'counterattacks_pct',
  'corners',
  'corners_shots',
  'corners_shots_pct',
  'free_kicks',
  'free_kicks_shots',
  'free_kicks_shots_pct',
  'penalties',
  'penalties_converted',
  'crosses',
  'crosses_accurate',
  'crosses_acc_pct',
  'offensive_duels',
  'offensive_duels_won',
  'offensive_duels_won_pct',
  'offsides',
  'conceded_goals',
  'shots_against',
  'shots_against_on_target',
  'shots_against_on_target_pct',
  'defensive_duels',
  'defensive_duels_won',
  'defensive_duels_won_pct',
  'aerial_duels',
  'aerial_duels_won',
  'aerial_duels_won_pct',
  'sliding_tackles',
  'sliding_tackles_succ',
  'sliding_tackles_succ_pct',
  'interceptions',
  'clearances',
  'fouls',
  'yellow_cards',
  'red_cards',
  'forward_passes',
  'forward_passes_acc',
  'forward_passes_pct',
  'back_passes',
  'back_passes_acc',
  'back_passes_pct',
  'lateral_passes',
  'lateral_passes_acc',
  'lateral_passes_pct',
  'long_passes',
  'long_passes_acc',
  'long_passes_pct',
  'passes_to_final_third',
  'passes_to_final_third_acc',
  'passes_to_final_third_pct',
  'progressive_passes',
  'progressive_passes_acc',
  'progressive_passes_pct',
  'smart_passes',
  'smart_passes_acc',
  'smart_passes_pct',
  'throw_ins',
  'throw_ins_acc',
  'goal_kicks',
  'ppda',
  'match_tempo',
  'avg_passes_per_possession',
  'long_pass_pct',
  'avg_shot_distance',
  'avg_pass_length',
  'created_at'
]);

// Full set of supported columns including opponent indices and metrics
export const VALID_SUPABASE_MATCH_COLUMNS = new Set([
  ...BASE_SUPABASE_MATCH_COLUMNS,
  'opponent_shots_on_target',
  'opponent_ppda',
  'opponent_match_tempo',
  'opponent_avg_passes_per_possession',
  'opponent_long_pass_pct',
  'opponent_avg_shot_distance',
  'opponent_avg_pass_length',
  'opponent_passes',
  'opponent_passes_accurate',
  'opponent_passing_accuracy',
  'corners_against',
  'corners_against_shots',
  'corners_against_shots_pct',
  'free_kicks_against',
  'free_kicks_against_shots',
  'free_kicks_against_shots_pct',
  'crosses_against',
  'crosses_against_accurate',
  'crosses_against_acc_pct'
]);

// ==========================================
// TEAM NORMALIZATION & MATCHING HELPERS
// ==========================================

export const TEAM_TRANSLATIONS: Record<string, string[]> = {
  greece: ['greece', 'hellas', 'ελλαδα', 'ελλας', 'εθνικη ελλαδας', 'εθνικη ελλαδος', 'ellada'],
  slovakia: ['slovakia', 'σλοβακια', 'slovensko', 'slovak republic'],
  cyprus: ['cyprus', 'κυπρος'],
  norway: ['norway', 'νορβηγια', 'norge'],
  sweden: ['sweden', 'σουηδια', 'sverige'],
  denmark: ['denmark', 'δανια', 'danmark'],
  finland: ['finland', 'φινλανδια', 'suomi'],
  germany: ['germany', 'γερμανια', 'deutschland'],
  france: ['france', 'γαλλια'],
  italy: ['italy', 'ιταλια', 'italia'],
  spain: ['spain', 'ισπανια', 'espana'],
  portugal: ['portugal', 'πορτογαλια'],
  netherlands: ['netherlands', 'holland', 'ολλανδια', 'nederland'],
  belgium: ['belgium', 'βελγιο'],
  england: ['england', 'αγγλια'],
  scotland: ['scotland', 'σκοτια'],
  wales: ['wales', 'ουαλια'],
  ireland: ['ireland', 'ιρλανδια'],
  poland: ['poland', 'πολωνια', 'polska'],
  ukraine: ['ukraine', 'ουκρανια'],
  czechia: ['czechia', 'czech republic', 'τσεχια'],
  austria: ['austria', 'αυστρια', 'osterreich'],
  switzerland: ['switzerland', 'ελβετια', 'schweiz', 'suisse'],
  croatia: ['croatia', 'κροατια', 'hrvatska'],
  serbia: ['serbia', 'σερβια', 'srbija'],
  romania: ['romania', 'ρουμανια'],
  bulgaria: ['bulgaria', 'βουλγαρια'],
  hungary: ['hungary', 'ουγγαρια', 'magyarorszag'],
  turkey: ['turkey', 'turkiye', 'τουρκια'],
  israel: ['israel', 'ισραηλ'],
  morocco: ['morocco', 'μαροκο', 'maroc'],
  egypt: ['egypt', 'αιγυπτος'],
  paok: ['paok', 'παοκ'],
  olympiacos: ['olympiacos', 'olympiakos', 'ολυμπιακος'],
  panathinaikos: ['panathinaikos', 'παναθηναικος'],
  aek: ['aek', 'αεκ'],
  aris: ['aris', 'αρης']
};

export function normalizeTeamString(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics / accents
    .replace(/\bu[- ]?(\d+)\b/g, 'u$1') // "U-17", "U 17", "Under 17" -> "u17"
    .replace(/\bunder[- ]?(\d+)\b/g, 'u$1')
    .replace(/[^\w\d\u0370-\u03ff]+/g, ' ')
    .trim();
}

export function isSameTeam(nameA: string, nameB: string): boolean {
  const normA = normalizeTeamString(nameA);
  const normB = normalizeTeamString(nameB);

  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  // Check translation dictionary
  for (const list of Object.values(TEAM_TRANSLATIONS)) {
    const aMatches = list.some(t => normA.includes(normalizeTeamString(t)));
    const bMatches = list.some(t => normB.includes(normalizeTeamString(t)));
    if (aMatches && bMatches) {
      const ageA = normA.match(/\bu(\d+)\b/);
      const ageB = normB.match(/\bu(\d+)\b/);
      if (ageA && ageB) {
        return ageA[1] === ageB[1];
      }
      return true;
    }
  }

  // Token overlap (e.g. "Greece" in both)
  const tokensA = normA.split(' ').filter(w => w.length > 2);
  const tokensB = normB.split(' ').filter(w => w.length > 2);
  const common = tokensA.filter(w => tokensB.includes(w));
  if (common.length > 0 && common.some(w => !w.match(/^u\d+$/))) {
    return true;
  }

  return false;
}

export function formatExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const dmy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const year = ymd[1];
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return str;
}

export function swapMatchData(match: WyscoutMatch): WyscoutMatch {
  const currentPoss = match.possession || 50;
  const oppPoss = match.opponent_possession ?? (100 - currentPoss);

  return {
    ...match,
    // Swap Names
    team_analyzed: match.opponent_team_name || 'Opponent',
    opponent_team_name: match.team_analyzed || 'Team Analyzed',

    // Swap Goals & xG
    goals: match.opponent_goals ?? match.conceded_goals ?? 0,
    opponent_goals: match.goals ?? 0,
    conceded_goals: match.goals ?? 0,
    xg: match.opponent_xg ?? 0,
    opponent_xg: match.xg ?? 0,

    // Swap Shots
    shots: match.opponent_shots ?? match.shots_against ?? 0,
    opponent_shots: match.shots ?? 0,
    shots_against: match.shots ?? 0,
    shots_on_target: match.opponent_shots_on_target ?? match.shots_against_on_target ?? 0,
    opponent_shots_on_target: match.shots_on_target ?? 0,
    shots_against_on_target: match.shots_on_target ?? 0,
    shots_on_target_pct: (match.opponent_shots ? Math.round(((match.opponent_shots_on_target || 0) / match.opponent_shots) * 100) : 0),

    // Swap Possession
    possession: oppPoss,
    opponent_possession: currentPoss,

    // Swap Passing
    passes: match.opponent_passes ?? 0,
    opponent_passes: match.passes ?? 0,
    passes_accurate: match.opponent_passes_accurate ?? 0,
    opponent_passes_accurate: match.passes_accurate ?? 0,
    passing_accuracy: match.opponent_passing_accuracy ?? (match.opponent_passes ? Math.round(((match.opponent_passes_accurate || 0) / match.opponent_passes) * 100) : 0),
    opponent_passing_accuracy: match.passing_accuracy ?? 0,

    // Swap Tactical Indices
    ppda: match.opponent_ppda ?? 0,
    opponent_ppda: match.ppda ?? 0,
    match_tempo: match.opponent_match_tempo ?? 0,
    opponent_match_tempo: match.match_tempo ?? 0,
    avg_passes_per_possession: match.opponent_avg_passes_per_possession ?? 0,
    opponent_avg_passes_per_possession: match.avg_passes_per_possession ?? 0,
    long_pass_pct: match.opponent_long_pass_pct ?? 0,
    opponent_long_pass_pct: match.long_pass_pct ?? 0,
    avg_shot_distance: match.opponent_avg_shot_distance ?? 0,
    opponent_avg_shot_distance: match.avg_shot_distance ?? 0,
    avg_pass_length: match.opponent_avg_pass_length ?? 0,
    opponent_avg_pass_length: match.avg_pass_length ?? 0,

    // Swap Set Pieces & Crosses
    corners: match.corners_against ?? 0,
    corners_against: match.corners ?? 0,
    corners_shots: match.corners_against_shots ?? 0,
    corners_against_shots: match.corners_shots ?? 0,
    corners_shots_pct: match.corners_against_shots_pct ?? 0,
    corners_against_shots_pct: match.corners_shots_pct ?? 0,

    free_kicks: match.free_kicks_against ?? 0,
    free_kicks_against: match.free_kicks ?? 0,
    free_kicks_shots: match.free_kicks_against_shots ?? 0,
    free_kicks_against_shots: match.free_kicks_shots ?? 0,
    free_kicks_shots_pct: match.free_kicks_against_shots_pct ?? 0,
    free_kicks_against_shots_pct: match.free_kicks_shots_pct ?? 0,

    crosses: match.crosses_against ?? 0,
    crosses_against: match.crosses ?? 0,
    crosses_accurate: match.crosses_against_accurate ?? 0,
    crosses_against_accurate: match.crosses_accurate ?? 0,
    crosses_acc_pct: match.crosses_against_acc_pct ?? 0,
    crosses_against_acc_pct: match.crosses_acc_pct ?? 0,
  };
}

// ==========================================
// WYSCOUT MATCHES & ANALYTICS SERVICE
// ==========================================

export const wyscoutService = {
  isSameTeam,
  normalizeTeamString,
  swapMatchData,

  swapAndSaveMatch: async (matchId: string, opponentTeamId: string): Promise<WyscoutMatch | null> => {
    const profileId = dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_wyscout_${opponentTeamId}`;
    const current = getLS<WyscoutMatch[]>(storageKey, []);
    const idx = current.findIndex(m => m.id === matchId);
    if (idx === -1) {
      console.warn("swapAndSaveMatch: match not found in local storage", matchId);
      return null;
    }

    const swapped = swapMatchData(current[idx]);
    current[idx] = swapped;
    setLS(storageKey, current);

    // Save directly to Supabase Cloud
    await wyscoutService.saveMatches([swapped]);
    return swapped;
  },
  getMatchesByTeam: async (opponentTeamId: string, profileIdOverride?: string): Promise<WyscoutMatch[]> => {
    const profileId = profileIdOverride || dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_wyscout_${opponentTeamId}`;
    const localMatches = getLS<WyscoutMatch[]>(storageKey, []);

    if (isRealSupabase && supabase) {
      try {
        let { data, error } = await supabase
          .from('wyscout_matches')
          .select('*')
          .eq('opponent_team_id', opponentTeamId)
          .order('date', { ascending: false });
        
        if (!error && data) {
          // If 0 matches found directly by opponentTeamId, check sibling entries with same team name
          let currentTeamNotes: string | null = null;
          const { data: currentTeam } = await supabase
            .from('opponent_teams')
            .select('name, notes')
            .eq('id', opponentTeamId)
            .maybeSingle();

          if (currentTeam?.notes) {
            currentTeamNotes = currentTeam.notes;
          }

          if (data.length === 0 && currentTeam?.name) {
            const { data: siblingTeams } = await supabase
              .from('opponent_teams')
              .select('id, notes')
              .ilike('name', currentTeam.name.trim());

            if (siblingTeams && siblingTeams.length > 0) {
              const siblingIds = siblingTeams.map(s => s.id);
              const { data: siblingMatches } = await supabase
                .from('wyscout_matches')
                .select('*')
                .in('opponent_team_id', siblingIds)
                .order('date', { ascending: false });

              if (siblingMatches && siblingMatches.length > 0) {
                data = siblingMatches;
                if (!currentTeamNotes) {
                  const sWithNotes = siblingTeams.find(s => s.notes);
                  if (sWithNotes?.notes) currentTeamNotes = sWithNotes.notes;
                }
              }
            }
          }

          // Parse metadata extras from opponent_teams.notes if present
          let remoteExtras: Record<string, any> = {};
          if (currentTeamNotes) {
            const matchTag = currentTeamNotes.match(/<!--\s*WY_EXTRAS:\s*([\s\S]*?)\s*-->/);
            if (matchTag && matchTag[1]) {
              try {
                remoteExtras = JSON.parse(matchTag[1]);
              } catch (parseErr) {
                console.warn("Error parsing WY_EXTRAS from team notes:", parseErr);
              }
            }
          }

          // Deduplicate matches by date + match_name and merge with local & remote extras
          const seen = new Set<string>();
          const uniqueMatches: WyscoutMatch[] = [];
          for (const m of ((data || []) as WyscoutMatch[])) {
            const key = `${m.date}_${m.match_name}`;
            if (!seen.has(key)) {
              seen.add(key);
              const local = localMatches.find(lm => lm.id === m.id || (lm.date === m.date && lm.match_name === m.match_name));
              const extras = remoteExtras[key] || {};

              const merged: WyscoutMatch = {
                ...(local || {}),
                ...m,
                opponent_ppda: (m.opponent_ppda !== undefined && m.opponent_ppda !== null && m.opponent_ppda > 0) ? m.opponent_ppda : (local?.opponent_ppda ?? extras.opponent_ppda ?? undefined),
                opponent_match_tempo: (m.opponent_match_tempo !== undefined && m.opponent_match_tempo !== null && m.opponent_match_tempo > 0) ? m.opponent_match_tempo : (local?.opponent_match_tempo ?? extras.opponent_match_tempo ?? undefined),
                opponent_avg_passes_per_possession: (m.opponent_avg_passes_per_possession !== undefined && m.opponent_avg_passes_per_possession !== null && m.opponent_avg_passes_per_possession > 0) ? m.opponent_avg_passes_per_possession : (local?.opponent_avg_passes_per_possession ?? extras.opponent_avg_passes_per_possession ?? undefined),
                opponent_long_pass_pct: (m.opponent_long_pass_pct !== undefined && m.opponent_long_pass_pct !== null && m.opponent_long_pass_pct > 0) ? m.opponent_long_pass_pct : (local?.opponent_long_pass_pct ?? extras.opponent_long_pass_pct ?? undefined),
                opponent_avg_shot_distance: (m.opponent_avg_shot_distance !== undefined && m.opponent_avg_shot_distance !== null && m.opponent_avg_shot_distance > 0) ? m.opponent_avg_shot_distance : (local?.opponent_avg_shot_distance ?? extras.opponent_avg_shot_distance ?? undefined),
                opponent_avg_pass_length: (m.opponent_avg_pass_length !== undefined && m.opponent_avg_pass_length !== null && m.opponent_avg_pass_length > 0) ? m.opponent_avg_pass_length : (local?.opponent_avg_pass_length ?? extras.opponent_avg_pass_length ?? undefined),
                opponent_passes: (m.opponent_passes !== undefined && m.opponent_passes !== null && m.opponent_passes > 0) ? m.opponent_passes : (local?.opponent_passes ?? extras.opponent_passes ?? undefined),
                opponent_passes_accurate: (m.opponent_passes_accurate !== undefined && m.opponent_passes_accurate !== null) ? m.opponent_passes_accurate : (local?.opponent_passes_accurate ?? extras.opponent_passes_accurate ?? undefined),
                opponent_passing_accuracy: (m.opponent_passing_accuracy !== undefined && m.opponent_passing_accuracy !== null) ? m.opponent_passing_accuracy : (local?.opponent_passing_accuracy ?? extras.opponent_passing_accuracy ?? undefined),
                opponent_shots_on_target: (m.opponent_shots_on_target !== undefined && m.opponent_shots_on_target !== null) ? m.opponent_shots_on_target : (local?.opponent_shots_on_target ?? extras.opponent_shots_on_target ?? undefined),
                corners_against: (m.corners_against !== undefined && m.corners_against !== null) ? m.corners_against : (local?.corners_against ?? extras.corners_against ?? undefined),
                corners_against_shots: (m.corners_against_shots !== undefined && m.corners_against_shots !== null) ? m.corners_against_shots : (local?.corners_against_shots ?? extras.corners_against_shots ?? undefined),
                corners_against_shots_pct: (m.corners_against_shots_pct !== undefined && m.corners_against_shots_pct !== null) ? m.corners_against_shots_pct : (local?.corners_against_shots_pct ?? extras.corners_against_shots_pct ?? undefined),
                free_kicks_against: (m.free_kicks_against !== undefined && m.free_kicks_against !== null) ? m.free_kicks_against : (local?.free_kicks_against ?? extras.free_kicks_against ?? undefined),
                free_kicks_against_shots: (m.free_kicks_against_shots !== undefined && m.free_kicks_against_shots !== null) ? m.free_kicks_against_shots : (local?.free_kicks_against_shots ?? extras.free_kicks_against_shots ?? undefined),
                free_kicks_against_shots_pct: (m.free_kicks_against_shots_pct !== undefined && m.free_kicks_against_shots_pct !== null) ? m.free_kicks_against_shots_pct : (local?.free_kicks_against_shots_pct ?? extras.free_kicks_against_shots_pct ?? undefined),
                crosses_against: (m.crosses_against !== undefined && m.crosses_against !== null) ? m.crosses_against : (local?.crosses_against ?? extras.crosses_against ?? undefined),
                crosses_against_accurate: (m.crosses_against_accurate !== undefined && m.crosses_against_accurate !== null) ? m.crosses_against_accurate : (local?.crosses_against_accurate ?? extras.crosses_against_accurate ?? undefined),
                crosses_against_acc_pct: (m.crosses_against_acc_pct !== undefined && m.crosses_against_acc_pct !== null) ? m.crosses_against_acc_pct : (local?.crosses_against_acc_pct ?? extras.crosses_against_acc_pct ?? undefined),
              };
              uniqueMatches.push(merged);
            }
          }

          if (uniqueMatches.length === 0 && localMatches.length > 0) {
            // Auto-sync existing local matches to newly created Supabase table safely
            await wyscoutService.saveMatches(localMatches);
            return localMatches.sort((a, b) => b.date.localeCompare(a.date));
          }

          setLS(storageKey, uniqueMatches);
          return uniqueMatches;
        }
      } catch (e) {
        console.warn("Supabase getMatchesByTeam error:", e);
      }
    }

    return localMatches.sort((a, b) => b.date.localeCompare(a.date));
  },

  saveMatches: async (matches: WyscoutMatch[]): Promise<void> => {
    if (matches.length === 0) return;
    const profileId = matches[0].profile_id || dbService.getProfileScope();
    const opponentTeamId = matches[0].opponent_team_id;

    const storageKey = `fm_p_${profileId}_wyscout_${opponentTeamId}`;
    const current = getLS<WyscoutMatch[]>(storageKey, []);

    // Ensure all matches have valid non-null values for required columns
    const cleanMatches = matches.map(m => ({
      ...m,
      team_analyzed: (m.team_analyzed || '').trim() || 'Team Analyzed',
      profile_id: m.profile_id || profileId,
      opponent_team_id: m.opponent_team_id || opponentTeamId,
      created_at: m.created_at || new Date().toISOString()
    }));

    // Merge non-destructively so category fields are not overwritten
    cleanMatches.forEach(newMatch => {
      const idx = current.findIndex(m => m.id === newMatch.id || (m.date === newMatch.date && m.match_name === newMatch.match_name));
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...newMatch };
      } else {
        current.push(newMatch);
      }
    });

    setLS(storageKey, current);

    // Build extras map for safe persistence (regardless of whether DB has columns)
    const extrasMap: Record<string, any> = {};
    current.forEach(m => {
      const key = `${m.date}_${m.match_name}`;
      extrasMap[key] = {
        opponent_shots_on_target: m.opponent_shots_on_target,
        opponent_ppda: m.opponent_ppda,
        opponent_match_tempo: m.opponent_match_tempo,
        opponent_avg_passes_per_possession: m.opponent_avg_passes_per_possession,
        opponent_long_pass_pct: m.opponent_long_pass_pct,
        opponent_avg_shot_distance: m.opponent_avg_shot_distance,
        opponent_avg_pass_length: m.opponent_avg_pass_length,
        opponent_passes: m.opponent_passes,
        opponent_passes_accurate: m.opponent_passes_accurate,
        opponent_passing_accuracy: m.opponent_passing_accuracy,
        corners_against: m.corners_against,
        corners_against_shots: m.corners_against_shots,
        corners_against_shots_pct: m.corners_against_shots_pct,
        free_kicks_against: m.free_kicks_against,
        free_kicks_against_shots: m.free_kicks_against_shots,
        free_kicks_against_shots_pct: m.free_kicks_against_shots_pct,
        crosses_against: m.crosses_against,
        crosses_against_accurate: m.crosses_against_accurate,
        crosses_against_acc_pct: m.crosses_against_acc_pct,
      };
    });

    if (isRealSupabase && supabase) {
      try {
        // 1. Ensure foreign key opponent_team exists in remote Supabase table before inserting matches
        if (opponentTeamId) {
          const { data: teamCheck } = await supabase
            .from('opponent_teams')
            .select('id')
            .eq('id', opponentTeamId)
            .maybeSingle();

          if (!teamCheck) {
            const allLocalTeams = getLS<OpponentTeam[]>(`fm_p_${profileId}_opponents`, []);
            const localTeam = allLocalTeams.find(t => t.id === opponentTeamId);
            await supabase.from('opponent_teams').upsert({
              id: opponentTeamId,
              profile_id: profileId,
              name: localTeam?.name || matches[0].team_analyzed || 'Opponent Team',
              logo_url: localTeam?.logo_url,
              country: localTeam?.country,
              league: localTeam?.league,
              notes: localTeam?.notes,
              created_at: localTeam?.created_at || new Date().toISOString()
            });
          }
        }

        // 2. Try upserting to Supabase Cloud with all columns
        const sanitizedFull = cleanMatches.map(m => {
          const row: Record<string, any> = {};
          for (const key of VALID_SUPABASE_MATCH_COLUMNS) {
            if ((m as any)[key] !== undefined) {
              row[key] = (m as any)[key];
            }
          }
          if (!row.team_analyzed) {
            row.team_analyzed = 'Team Analyzed';
          }
          return row;
        });

        const { error: fullError } = await supabase.from('wyscout_matches').upsert(sanitizedFull);
        
        // If Supabase schema does not yet have opponent columns, gracefully fall back to base columns
        if (fullError && (fullError.code === 'PGRST204' || fullError.code === '42703' || String(fullError.message || '').includes('column'))) {
          console.warn("Supabase schema does not have opponent columns yet; falling back to base columns and storing extras in team metadata.");
          const sanitizedBase = cleanMatches.map(m => {
            const row: Record<string, any> = {};
            for (const key of BASE_SUPABASE_MATCH_COLUMNS) {
              if ((m as any)[key] !== undefined) {
                row[key] = (m as any)[key];
              }
            }
            if (!row.team_analyzed) {
              row.team_analyzed = 'Team Analyzed';
            }
            return row;
          });
          const { error: baseError } = await supabase.from('wyscout_matches').upsert(sanitizedBase);
          if (baseError) {
            console.error("Supabase base saveMatches error:", baseError.message);
            throw new Error(`Supabase saveMatches: ${baseError.message}`);
          }
        } else if (fullError) {
          console.error("Supabase saveMatches error:", fullError.message, fullError.details);
          throw new Error(`Supabase saveMatches: ${fullError.message}`);
        }

        // 3. Always synchronize extras metadata to opponent_teams.notes so values survive on any device
        if (opponentTeamId) {
          try {
            const { data: teamData } = await supabase
              .from('opponent_teams')
              .select('notes')
              .eq('id', opponentTeamId)
              .maybeSingle();

            const existingNotes = teamData?.notes || '';
            const cleanUserNotes = existingNotes.replace(/<!--\s*WY_EXTRAS:[\s\S]*?-->/g, '').trim();
            const extrasTag = `<!-- WY_EXTRAS: ${JSON.stringify(extrasMap)} -->`;
            const newNotes = cleanUserNotes ? `${cleanUserNotes}\n\n${extrasTag}` : extrasTag;

            await supabase
              .from('opponent_teams')
              .update({ notes: newNotes })
              .eq('id', opponentTeamId);
          } catch (notesErr) {
            console.warn("Could not sync extras to opponent_teams.notes:", notesErr);
          }
        }
      } catch (e: any) {
        console.error("Supabase saveMatches exception:", e);
        throw e;
      }
    }
  },

  deleteMatch: async (matchId: string, opponentTeamId: string): Promise<void> => {
    const profileId = dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_wyscout_${opponentTeamId}`;
    const current = getLS<WyscoutMatch[]>(storageKey, []);
    setLS(storageKey, current.filter(m => m.id !== matchId));

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('wyscout_matches').delete().eq('id', matchId);
      } catch (e) {
        console.warn("Supabase deleteMatch error:", e);
      }
    }
  },

  /**
   * Parses one or multiple uploaded Wyscout files (.xlsx, .xls, or .csv)
   * Automatically recognizes category (Attacking, Defending, Passing, Indices, Overview)
   * and merges matching fixtures.
   */
  parseMultipleWyscoutFiles: async (
    files: File[],
    opponentTeamId: string,
    teamName: string
  ): Promise<{ matches: WyscoutMatch[]; errors: string[]; filesProcessed: number }> => {
    const profileId = dbService.getProfileScope();
    const fixtureMap = new Map<string, Partial<WyscoutMatch>>();
    const errors: string[] = [];
    let filesProcessed = 0;

    const toNum = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      const n = Number(String(val).replace(',', '.').trim());
      return isNaN(n) ? 0 : n;
    };

    for (const file of files) {
      try {
        const isExcel = /\.(xlsx|xls)$/i.test(file.name);
        let rawGrid: any[][] = [];

        if (isExcel) {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        } else {
          rawGrid = await new Promise<any[][]>((resolve, reject) => {
            Papa.parse(file, {
              header: false,
              dynamicTyping: true,
              skipEmptyLines: true,
              complete: (res) => resolve(res.data as any[][]),
              error: (err) => reject(err)
            });
          });
        }

        if (!rawGrid || rawGrid.length < 2) {
          errors.push(`Το αρχείο ${file.name} είναι άδειο ή δεν αναγνωρίστηκε περιεχόμενο.`);
          continue;
        }

        // Find header row (usually row 0)
        const headerRowIndex = rawGrid.findIndex(r => r && r.some(c => String(c).toLowerCase().includes('match') || String(c).toLowerCase().includes('team')));
        if (headerRowIndex === -1) {
          errors.push(`Στο αρχείο ${file.name} δεν βρέθηκαν κεφαλίδες στηλών Wyscout (Match, Team).`);
          continue;
        }

        const headerRow = rawGrid[headerRowIndex];
        const headerStr = headerRow.map((c: any) => String(c || '').toLowerCase()).join(' ');

        const isAttacking = headerStr.includes('positional attack') || headerStr.includes('counterattack') || headerStr.includes('crosses');
        const isDefending = headerStr.includes('conceded goal') || headerStr.includes('defensive duel') || headerStr.includes('sliding tackle');
        const isPassing = headerStr.includes('forward pass') || headerStr.includes('progressive pass') || headerStr.includes('smart pass');
        const isIndices = headerStr.includes('ppda') || headerStr.includes('tempo') || headerStr.includes('shot distance');
        const isOverview = headerStr.includes('losses /') || headerStr.includes('recoveries /');

        const findCol = (terms: string[], defaultIdx: number): number => {
          const idx = headerRow.findIndex((c: any) => {
            const s = String(c || '').toLowerCase().trim();
            return terms.some(t => s === t || s.includes(t));
          });
          return idx >= 0 ? idx : defaultIdx;
        };

        const cDate = findCol(['date', 'ημερομηνία', 'ημερομηνια'], 0);
        const cMatch = findCol(['match', 'αγώνας', 'αγωνας', 'fixture'], 1);
        const cComp = findCol(['competition', 'tournament', 'διοργάνωση', 'διοργανωση', 'comp'], 2);
        const cDuration = findCol(['duration', 'διάρκεια', 'διαρκεια'], 3);
        const cTeam = findCol(['team', 'ομάδα', 'ομαδα', 'team name', 'club'], 4);
        const cScheme = findCol(['scheme', 'formation', 'σύστημα', 'συστημα', 'διάταξη', 'διαταξη'], 5);

        // Filter rows with actual match dates (YYYY-MM-DD or DD/MM/YYYY or Excel serial)
        const matchRows = rawGrid.slice(headerRowIndex + 1).filter((r: any[]) => {
          if (!r || r.length < 3) return false;
          const dateVal = r[cDate];
          if (typeof dateVal === 'number' && dateVal > 30000 && dateVal < 60000) return true;
          const s = String(dateVal || '').trim();
          return /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/.test(s);
        });

        if (matchRows.length === 0) {
          errors.push(`Στο αρχείο ${file.name} δεν βρέθηκαν γραμμές αγώνων με ημερομηνία YYYY-MM-DD.`);
          continue;
        }

        // Group match rows by Date_Match
        const groups = new Map<string, any[][]>();
        matchRows.forEach(r => {
          const dateStr = formatExcelDate(r[cDate]);
          const matchStr = String(r[cMatch] || '').trim();
          const key = `${dateStr}_${matchStr}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(r);
        });

        groups.forEach((rows, fKey) => {
          let targetRow: any[] | undefined;
          let opponentRow: any[] | undefined;

          // 1. Check if any row explicitly represents Opponents
          const explicitOpponent = rows.find(r => {
            const t = normalizeTeamString(String(r[cTeam] || ''));
            return t === 'opponents' || t === 'opponent' || t === 'αντιπαλος' || t === 'αντιπαλοι';
          });

          if (explicitOpponent && rows.length > 1) {
            opponentRow = explicitOpponent;
            targetRow = rows.find(r => r !== explicitOpponent);
          } else {
            // 2. Score rows based on match with teamName (target team)
            const score0 = isSameTeam(teamName, String(rows[0]?.[cTeam] || ''));
            const score1 = rows[1] ? isSameTeam(teamName, String(rows[1]?.[cTeam] || '')) : false;

            if (score0 && !score1) {
              targetRow = rows[0];
              opponentRow = rows[1];
            } else if (!score0 && score1) {
              targetRow = rows[1];
              opponentRow = rows[0];
            } else {
              // 3. Fallback: Check match title (e.g. "Greece U17 - Slovakia U17")
              const matchTitle = String(rows[0]?.[cMatch] || '');
              const cleanTitle = matchTitle.replace(/\s*\d+\s*[:\-]\s*\d+\s*$/, '').trim();
              const parts = cleanTitle.split(/\s*-\s*|\s*vs\.?\s*/i);
              if (parts.length >= 2) {
                const part0IsTarget = isSameTeam(teamName, parts[0]);
                const part1IsTarget = isSameTeam(teamName, parts[1]);
                if (part0IsTarget || part1IsTarget) {
                  const targetPart = part0IsTarget ? parts[0] : parts[1];
                  targetRow = rows.find(r => isSameTeam(targetPart, String(r[cTeam] || '')));
                  opponentRow = rows.find(r => r !== targetRow);
                }
              }

              // 4. Default: first row is target, second row is opponent
              if (!targetRow) {
                targetRow = rows[0];
                opponentRow = rows.find(r => r !== targetRow);
              }
            }
          }

          if (!targetRow) return;

          const dateVal = formatExcelDate(targetRow[cDate]);
          const matchName = String(targetRow[cMatch] || '').trim();
          const competition = String(targetRow[cComp] || 'Wyscout Match').trim();
          const duration = Number(targetRow[cDuration] || 90);
          const rawScheme = String(targetRow[cScheme] || '4-3-3');
          const scheme = rawScheme.split(' ')[0].trim();
          const teamAnalyzed = (String(targetRow[cTeam] || teamName || '').trim()) || 'Team Analyzed';

          // Check if we already have this match in fixtureMap
          const existing: WyscoutMatch = (fixtureMap.get(fKey) as WyscoutMatch) || {
            id: `wm_${opponentTeamId}_${dateVal}_${Math.random().toString(36).substr(2, 5)}`,
            profile_id: profileId,
            opponent_team_id: opponentTeamId,
            date: dateVal,
            match_name: matchName,
            competition,
            duration,
            scheme,
            team_analyzed: teamAnalyzed,
            goals: 0,
            xg: 0,
            shots: 0,
            shots_on_target: 0,
            shots_on_target_pct: 0,
            passes: 0,
            passes_accurate: 0,
            passing_accuracy: 0,
            possession: 50,
            losses: 0,
            losses_low: 0,
            losses_med: 0,
            losses_high: 0,
            recoveries: 0,
            recoveries_low: 0,
            recoveries_med: 0,
            recoveries_high: 0,
            duels: 0,
            duels_won: 0,
            duels_won_pct: 50,
            created_at: new Date().toISOString()
          };

          // Parse score from matchName if available (e.g. "Morocco U17 - Egypt U17 0:2")
          const scoreMatch = matchName.match(/(\d+)\s*[:\-]\s*(\d+)\s*$/);
          if (scoreMatch) {
            const scoreA = parseInt(scoreMatch[1], 10);
            const scoreB = parseInt(scoreMatch[2], 10);
            const cleanTitle = matchName.replace(scoreMatch[0], '').trim();
            const parts = cleanTitle.split(/\s*-\s*|\s*vs\.?\s*/i);
            const isTeamA = parts[0] ? isSameTeam(teamAnalyzed, parts[0]) : true;
            if (existing.goals === undefined || existing.goals === 0) {
              existing.goals = isTeamA ? scoreA : scoreB;
            }
            if (existing.opponent_goals === undefined) {
              existing.opponent_goals = isTeamA ? scoreB : scoreA;
            }
          }

          if (opponentRow) {
            const rawOppName = String(opponentRow[cTeam] || '').trim();
            const normOpp = normalizeTeamString(rawOppName);
            if (!rawOppName || ['opponents', 'opponent', 'αντιπαλος', 'αντιπαλοι'].includes(normOpp)) {
              // Extract opponent name from match title
              const cleanTitle = matchName.replace(/\s*\d+\s*[:\-]\s*\d+\s*$/, '').trim();
              const parts = cleanTitle.split(/\s*-\s*|\s*vs\.?\s*/i);
              if (parts.length >= 2) {
                existing.opponent_team_name = isSameTeam(teamAnalyzed, parts[0]) ? parts[1].trim() : parts[0].trim();
              } else {
                existing.opponent_team_name = 'Opponent';
              }
            } else {
              existing.opponent_team_name = rawOppName;
            }
          } else {
            const cleanTitle = matchName.replace(/\s*\d+\s*[:\-]\s*\d+\s*$/, '').trim();
            const parts = cleanTitle.split(/\s*-\s*|\s*vs\.?\s*/i);
            if (parts.length >= 2) {
              existing.opponent_team_name = isSameTeam(teamAnalyzed, parts[0]) ? parts[1].trim() : parts[0].trim();
            }
          }

          // Category-specific mapping
          if (isAttacking) {
            existing.xg = Math.round(Number(targetRow[6] || 0) * 100) / 100;
            existing.shots = Number(targetRow[7] || 0);
            existing.shots_on_target = Number(targetRow[8] || 0);
            existing.shots_on_target_pct = Number(targetRow[9] || (existing.shots ? Math.round((existing.shots_on_target / existing.shots) * 100) : 0));
            existing.positional_attacks = Number(targetRow[10] || 0);
            existing.positional_attacks_shots = Number(targetRow[11] || 0);
            existing.positional_attacks_pct = Number(targetRow[12] || 0);
            existing.counterattacks = Number(targetRow[13] || 0);
            existing.counterattacks_shots = Number(targetRow[14] || 0);
            existing.counterattacks_pct = Number(targetRow[15] || 0);
            existing.corners = Number(targetRow[16] || 0);
            existing.corners_shots = Number(targetRow[17] || 0);
            existing.corners_shots_pct = Number(targetRow[18] || 0);
            existing.free_kicks = Number(targetRow[19] || 0);
            existing.free_kicks_shots = Number(targetRow[20] || 0);
            existing.free_kicks_shots_pct = Number(targetRow[21] || 0);
            existing.penalties = Number(targetRow[22] || 0);
            existing.penalties_converted = Number(targetRow[23] || 0);
            existing.crosses = Number(targetRow[25] || 0);
            existing.crosses_accurate = Number(targetRow[26] || 0);
            existing.crosses_acc_pct = Number(targetRow[27] || 0);
            existing.offensive_duels = Number(targetRow[28] || 0);
            existing.offensive_duels_won = Number(targetRow[29] || 0);
            existing.offensive_duels_won_pct = Number(targetRow[30] || 0);
            existing.offsides = Number(targetRow[31] || 0);

            if (opponentRow) {
              existing.opponent_xg = Math.round(toNum(opponentRow[6]) * 100) / 100;
              existing.opponent_shots = toNum(opponentRow[7]);
              existing.corners_against = toNum(opponentRow[16]);
              existing.corners_against_shots = toNum(opponentRow[17]);
              existing.corners_against_shots_pct = toNum(opponentRow[18]) || (existing.corners_against ? Math.round((existing.corners_against_shots / existing.corners_against) * 100) : 0);
              existing.free_kicks_against = toNum(opponentRow[19]);
              existing.free_kicks_against_shots = toNum(opponentRow[20]);
              existing.free_kicks_against_shots_pct = toNum(opponentRow[21]) || (existing.free_kicks_against ? Math.round((existing.free_kicks_against_shots / existing.free_kicks_against) * 100) : 0);
              existing.crosses_against = toNum(opponentRow[25]);
              existing.crosses_against_accurate = toNum(opponentRow[26]);
              existing.crosses_against_acc_pct = toNum(opponentRow[27]) || (existing.crosses_against ? Math.round((existing.crosses_against_accurate / existing.crosses_against) * 100) : 0);
            }
          }

          if (isDefending) {
            existing.conceded_goals = Number(targetRow[6] || 0);
            existing.opponent_goals = existing.conceded_goals;
            existing.shots_against = Number(targetRow[7] || 0);
            existing.shots_against_on_target = Number(targetRow[8] || 0);
            existing.shots_against_on_target_pct = Number(targetRow[9] || 0);
            existing.defensive_duels = Number(targetRow[10] || 0);
            existing.defensive_duels_won = Number(targetRow[11] || 0);
            existing.defensive_duels_won_pct = Number(targetRow[12] || 0);
            existing.aerial_duels = Number(targetRow[13] || 0);
            existing.aerial_duels_won = Number(targetRow[14] || 0);
            existing.aerial_duels_won_pct = Number(targetRow[15] || 0);
            existing.sliding_tackles = Number(targetRow[16] || 0);
            existing.sliding_tackles_succ = Number(targetRow[17] || 0);
            existing.sliding_tackles_succ_pct = Number(targetRow[18] || 0);
            existing.interceptions = Number(targetRow[19] || 0);
            existing.clearances = Number(targetRow[20] || 0);
            existing.fouls = Number(targetRow[21] || 0);
            existing.yellow_cards = Number(targetRow[22] || 0);
            existing.red_cards = Number(targetRow[23] || 0);
          }

          if (isPassing) {
            existing.passes = Number(targetRow[6] || 0);
            existing.passes_accurate = Number(targetRow[7] || 0);
            existing.passing_accuracy = Number(targetRow[8] || (existing.passes ? Math.round((existing.passes_accurate / existing.passes) * 100) : 0));
            existing.forward_passes = Number(targetRow[9] || 0);
            existing.forward_passes_acc = Number(targetRow[10] || 0);
            existing.forward_passes_pct = Number(targetRow[11] || 0);
            existing.back_passes = Number(targetRow[12] || 0);
            existing.back_passes_acc = Number(targetRow[13] || 0);
            existing.back_passes_pct = Number(targetRow[14] || 0);
            existing.lateral_passes = Number(targetRow[15] || 0);
            existing.lateral_passes_acc = Number(targetRow[16] || 0);
            existing.lateral_passes_pct = Number(targetRow[17] || 0);
            existing.long_passes = Number(targetRow[18] || 0);
            existing.long_passes_acc = Number(targetRow[19] || 0);
            existing.long_passes_pct = Number(targetRow[20] || 0);
            existing.passes_to_final_third = Number(targetRow[21] || 0);
            existing.passes_to_final_third_acc = Number(targetRow[22] || 0);
            existing.passes_to_final_third_pct = Number(targetRow[23] || 0);
            existing.progressive_passes = Number(targetRow[24] || 0);
            existing.progressive_passes_acc = Number(targetRow[25] || 0);
            existing.progressive_passes_pct = Number(targetRow[26] || 0);
            existing.smart_passes = Number(targetRow[27] || 0);
            existing.smart_passes_acc = Number(targetRow[28] || 0);
            existing.smart_passes_pct = Number(targetRow[29] || 0);
            existing.throw_ins = Number(targetRow[30] || 0);
            existing.throw_ins_acc = Number(targetRow[31] || 0);
            existing.goal_kicks = Number(targetRow[33] || 0);

            if (opponentRow) {
              existing.opponent_passes = toNum(opponentRow[6]) || existing.opponent_passes || 0;
              existing.opponent_passes_accurate = toNum(opponentRow[7]) || existing.opponent_passes_accurate || 0;
              existing.opponent_passing_accuracy = toNum(opponentRow[8]) || (existing.opponent_passes ? Math.round((existing.opponent_passes_accurate / existing.opponent_passes) * 100) : existing.opponent_passing_accuracy || 0);
            }
          }

          if (isIndices) {
            const tempoIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('tempo'));
            const passesPossIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('passes per possession'));
            const longPassIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('long pass'));
            const ppdaIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('ppda'));
            const shotDistIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('shot distance'));
            const passLengthIdx = headerRow.findIndex((c: any) => String(c || '').toLowerCase().includes('pass length'));

            const cTempo = tempoIdx >= 0 ? tempoIdx : 6;
            const cPassesPoss = passesPossIdx >= 0 ? passesPossIdx : 7;
            const cLongPass = longPassIdx >= 0 ? longPassIdx : 8;
            const cPpda = ppdaIdx >= 0 ? ppdaIdx : 9;
            const cShotDist = shotDistIdx >= 0 ? shotDistIdx : 10;
            const cPassLength = passLengthIdx >= 0 ? passLengthIdx : 11;

            existing.match_tempo = toNum(targetRow[cTempo]);
            existing.avg_passes_per_possession = toNum(targetRow[cPassesPoss]);
            existing.long_pass_pct = toNum(targetRow[cLongPass]);
            existing.ppda = toNum(targetRow[cPpda]);
            existing.avg_shot_distance = toNum(targetRow[cShotDist]);
            existing.avg_pass_length = toNum(targetRow[cPassLength]);

            if (opponentRow) {
              existing.opponent_match_tempo = toNum(opponentRow[cTempo]);
              existing.opponent_avg_passes_per_possession = toNum(opponentRow[cPassesPoss]);
              existing.opponent_long_pass_pct = toNum(opponentRow[cLongPass]);
              existing.opponent_ppda = toNum(opponentRow[cPpda]);
              existing.opponent_avg_shot_distance = toNum(opponentRow[cShotDist]);
              existing.opponent_avg_pass_length = toNum(opponentRow[cPassLength]);
            }
          }

          if (isOverview) {
            existing.goals = Number(targetRow[6] ?? existing.goals ?? 0);
            existing.xg = Math.round(Number(targetRow[7] ?? existing.xg ?? 0) * 100) / 100;
            existing.shots = Number(targetRow[8] ?? existing.shots ?? 0);
            existing.shots_on_target = Number(targetRow[9] ?? existing.shots_on_target ?? 0);
            existing.shots_on_target_pct = Number(targetRow[10] ?? 0);
            existing.passes = Number(targetRow[11] ?? existing.passes ?? 0);
            existing.passes_accurate = Number(targetRow[12] ?? existing.passes_accurate ?? 0);
            existing.passing_accuracy = Number(targetRow[13] ?? existing.passing_accuracy ?? 0);
            existing.possession = Number(targetRow[14] ?? existing.possession ?? 50);
            existing.losses = Number(targetRow[15] || 0);
            existing.losses_low = Number(targetRow[16] || 0);
            existing.losses_med = Number(targetRow[17] || 0);
            existing.losses_high = Number(targetRow[18] || 0);
            existing.recoveries = Number(targetRow[19] || 0);
            existing.recoveries_low = Number(targetRow[20] || 0);
            existing.recoveries_med = Number(targetRow[21] || 0);
            existing.recoveries_high = Number(targetRow[22] || 0);
            existing.duels = Number(targetRow[23] || 0);
            existing.duels_won = Number(targetRow[24] || 0);
            existing.duels_won_pct = Number(targetRow[25] || 0);

            if (opponentRow) {
              existing.opponent_goals = Number(opponentRow[6] ?? 0);
              existing.opponent_xg = Math.round(Number(opponentRow[7] ?? 0) * 100) / 100;
              existing.opponent_shots = Number(opponentRow[8] ?? 0);
              existing.opponent_shots_on_target = Number(opponentRow[9] ?? 0);
              existing.opponent_passes = Number(opponentRow[11] ?? existing.opponent_passes ?? 0);
              existing.opponent_passes_accurate = Number(opponentRow[12] ?? existing.opponent_passes_accurate ?? 0);
              existing.opponent_passing_accuracy = Number(opponentRow[13] ?? existing.opponent_passing_accuracy ?? 0);
              existing.opponent_possession = Number(opponentRow[14] ?? (100 - (existing.possession || 50)));
            }
          }

          fixtureMap.set(fKey, existing);
        });

        filesProcessed++;
      } catch (err: any) {
        errors.push(`Σφάλμα επεξεργασίας του ${file.name}: ${err.message || err}`);
      }
    }

    const matches = Array.from(fixtureMap.values()) as WyscoutMatch[];
    matches.sort((a, b) => b.date.localeCompare(a.date));

    return { matches, errors, filesProcessed };
  },

  /**
   * Parses a single uploaded Wyscout file (.xlsx, .xls, or .csv)
   */
  parseWyscoutFile: async (
    file: File, 
    opponentTeamId: string, 
    teamName: string
  ): Promise<{ matches: WyscoutMatch[]; errors: string[] }> => {
    const result = await wyscoutService.parseMultipleWyscoutFiles([file], opponentTeamId, teamName);
    return { matches: result.matches, errors: result.errors };
  },

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
   * Initializes clean profile state (no hardcoded data)
   */
  seedProfileData: async (profileId: string, _options?: ProfileSeedOptions): Promise<void> => {
    setLS(`fm_p_${profileId}_players`, []);
    setLS(`fm_p_${profileId}_matches`, []);
    setLS(`fm_p_${profileId}_player_stats`, []);
    setLS(`fm_p_${profileId}_team_stats`, []);
    setLS(`fm_p_${profileId}_tactical`, []);
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
