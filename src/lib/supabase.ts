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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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
    const localTeams = getLS<OpponentTeam[]>(storageKey, []);

    if (isRealSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('opponent_teams')
          .select('*')
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          if (data.length === 0 && localTeams.length > 0) {
            // Auto-sync existing local teams to Supabase
            await supabase.from('opponent_teams').upsert(localTeams);
            return localTeams;
          }
          setLS(storageKey, data);
          return data as OpponentTeam[];
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
    const teamWithScope: OpponentTeam = {
      ...team,
      id: team.id || `opp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      profile_id: profileId,
      created_at: team.created_at || new Date().toISOString()
    };

    const storageKey = `fm_p_${profileId}_opponents`;
    const current = getLS<OpponentTeam[]>(storageKey, []);
    const idx = current.findIndex(t => t.id === teamWithScope.id);
    if (idx >= 0) {
      current[idx] = teamWithScope;
    } else {
      current.unshift(teamWithScope);
    }
    setLS(storageKey, current);

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('opponent_teams').upsert(teamWithScope);
      } catch (e) {
        console.warn("Supabase saveOpponentTeam error:", e);
      }
    }

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

// ==========================================
// WYSCOUT MATCHES & ANALYTICS SERVICE
// ==========================================

export const wyscoutService = {
  getMatchesByTeam: async (opponentTeamId: string, profileIdOverride?: string): Promise<WyscoutMatch[]> => {
    const profileId = profileIdOverride || dbService.getProfileScope();
    const storageKey = `fm_p_${profileId}_wyscout_${opponentTeamId}`;
    const localMatches = getLS<WyscoutMatch[]>(storageKey, []);

    if (isRealSupabase && supabase) {
      try {
        const { data, error } = await supabase
          .from('wyscout_matches')
          .select('*')
          .eq('profile_id', profileId)
          .eq('opponent_team_id', opponentTeamId)
          .order('date', { ascending: false });
        
        if (!error && data) {
          if (data.length === 0 && localMatches.length > 0) {
            // Auto-sync existing local matches to newly created Supabase table
            await supabase.from('wyscout_matches').upsert(localMatches);
            return localMatches.sort((a, b) => b.date.localeCompare(a.date));
          }
          setLS(storageKey, data);
          return data as WyscoutMatch[];
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

    matches.forEach(newMatch => {
      const idx = current.findIndex(m => m.id === newMatch.id || (m.date === newMatch.date && m.match_name === newMatch.match_name));
      if (idx >= 0) {
        current[idx] = newMatch;
      } else {
        current.push(newMatch);
      }
    });

    setLS(storageKey, current);

    if (isRealSupabase && supabase) {
      try {
        await supabase.from('wyscout_matches').upsert(matches);
      } catch (e) {
        console.warn("Supabase saveMatches error:", e);
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
    const normalizedTargetName = teamName.toLowerCase().trim();
    const fixtureMap = new Map<string, Partial<WyscoutMatch>>();
    const errors: string[] = [];
    let filesProcessed = 0;

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

        // Filter rows with actual match dates (YYYY-MM-DD)
        const matchRows = rawGrid.slice(headerRowIndex + 1).filter((r: any[]) => 
          r && r.length > 3 && String(r[0] || '').trim().match(/^\d{4}[-/]\d{2}[-/]\d{2}/)
        );

        if (matchRows.length === 0) {
          errors.push(`Στο αρχείο ${file.name} δεν βρέθηκαν γραμμές αγώνων με ημερομηνία YYYY-MM-DD.`);
          continue;
        }

        // Group match rows by Date_Match
        const groups = new Map<string, any[][]>();
        matchRows.forEach(r => {
          const key = `${String(r[0]).trim()}_${String(r[1] || '').trim()}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(r);
        });

        groups.forEach((rows, fKey) => {
          // Find target row
          let targetRow = rows.find(r => {
            const t = String(r[4] || '').toLowerCase();
            return t.includes(normalizedTargetName) || normalizedTargetName.includes(t);
          });

          if (!targetRow) {
            // If not matching teamName, pick row that isn't Greece/Opponents or fallback to first
            targetRow = rows.find(r => {
              const t = String(r[4] || '').toLowerCase();
              return !t.includes('greece') && !t.includes('opponents');
            }) || rows[0];
          }

          const opponentRow = rows.find(r => r !== targetRow);

          const dateVal = String(targetRow[0]).trim();
          const matchName = String(targetRow[1]).trim();
          const competition = String(targetRow[2] || 'Wyscout Match').trim();
          const duration = Number(targetRow[3] || 90);
          const rawScheme = String(targetRow[5] || '4-3-3');
          const scheme = rawScheme.split(' ')[0].trim();
          const teamAnalyzed = String(targetRow[4] || teamName).trim();

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
            const parts = matchName.replace(scoreMatch[0], '').split(/\s+-\s+/);
            const isTeamA = parts[0] ? teamAnalyzed.toLowerCase().includes(parts[0].trim().toLowerCase()) : true;
            if (existing.goals === undefined || existing.goals === 0) {
              existing.goals = isTeamA ? scoreA : scoreB;
            }
            if (existing.opponent_goals === undefined) {
              existing.opponent_goals = isTeamA ? scoreB : scoreA;
            }
          }

          if (opponentRow) {
            existing.opponent_team_name = String(opponentRow[4] || '').trim();
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
              existing.opponent_xg = Math.round(Number(opponentRow[6] || 0) * 100) / 100;
              existing.opponent_shots = Number(opponentRow[7] || 0);
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
          }

          if (isIndices) {
            existing.match_tempo = Number(targetRow[6] || 0);
            existing.avg_passes_per_possession = Number(targetRow[7] || 0);
            existing.long_pass_pct = Number(targetRow[8] || 0);
            existing.ppda = Number(targetRow[9] || 0);
            existing.avg_shot_distance = Number(targetRow[10] || 0);
            existing.avg_pass_length = Number(targetRow[11] || 0);
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
