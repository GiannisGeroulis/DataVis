import { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import { Player, Match, PlayerMatchStats, PlayerBaseAttributes } from '../../types';
import PlayerRadarChart from './PlayerRadarChart';
import FormTrendChart from './FormTrendChart';
import { calculateMatchRating, calculateFormAdjustedAttributes, calculateDynamicOVRAndForm } from '../../lib/ovr-algorithm';
import { Search, User, TrendingUp, TrendingDown, Minus, Calendar, Activity, GitFork } from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend 
} from 'recharts';

interface PlayerProfileProps {
  playerId?: string;
  onNavigateToPlayer?: (playerId: string) => void;
}

export default function PlayerProfile({ playerId }: PlayerProfileProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [playerStats, setPlayerStats] = useState<PlayerMatchStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter mode: greece (default) | club | all
  const [filterMode, setFilterMode] = useState<'all' | 'greece' | 'club'>('greece');
  const [formMatchCount, setFormMatchCount] = useState<number>(5);

  useEffect(() => {
    async function loadData() {
      try {
        const roster = await dbService.getPlayers();
        const fixtures = await dbService.getMatches();
        setPlayers(roster);
        setMatches(fixtures);
        
        if (playerId) {
          setSelectedPlayerId(playerId);
        } else if (roster.length > 0) {
          setSelectedPlayerId(roster[0].id);
        }
      } catch (err) {
        console.error('Failed to load roster/matches in profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [playerId]);

  useEffect(() => {
    if (!selectedPlayerId) return;

    async function loadPlayerStats() {
      try {
        const stats = await dbService.getPlayerMatchStats(selectedPlayerId);
        // Calculate ratings for all stats and save
        const activePlayer = players.find(p => p.id === selectedPlayerId);
        const statsWithRatings = stats.map(s => ({
          ...s,
          match_rating: activePlayer ? calculateMatchRating(s, activePlayer.position) : 6.0
        }));
        setPlayerStats(statsWithRatings);
      } catch (err) {
        console.error('Failed to load stats for player:', selectedPlayerId, err);
      }
    }
    loadPlayerStats();
  }, [selectedPlayerId, players]);

  const activePlayer = players.find(p => p.id === selectedPlayerId);

  // Filter players based on search query
  const filteredPlayers = players.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.position.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter playerStats based on filterMode (Greece vs Club)
  const filteredStats = playerStats.filter(stat => {
    const match = matches.find(m => m.id === stat.match_id);
    if (!match) return true;
    if (filterMode === 'greece') return match.is_club !== true;
    if (filterMode === 'club') return match.is_club === true;
    return true; // 'all'
  });

  // Calculations for KPIs using the filtered dataset
  const statsWithPlaytime = filteredStats.filter(s => s.minutes_played > 0);
  const totalMins = filteredStats.reduce((sum, s) => sum + s.minutes_played, 0);
  const totalGoals = filteredStats.reduce((sum, s) => sum + s.goals, 0);
  const totalAssists = filteredStats.reduce((sum, s) => sum + s.assists, 0);
  const totalKeyPasses = filteredStats.reduce((sum, s) => sum + s.key_passes, 0);
  
  const avgPassAccuracy = statsWithPlaytime.length > 0
    ? Math.round(statsWithPlaytime.reduce((sum, s) => sum + s.passing_accuracy, 0) / statsWithPlaytime.length)
    : 0;

  const totalDistance = filteredStats.reduce((sum, s) => sum + s.distance_covered, 0);
  const avgDistance = statsWithPlaytime.length > 0
    ? Math.round((statsWithPlaytime.reduce((sum, s) => sum + s.distance_covered, 0) / statsWithPlaytime.length) * 10) / 10
    : 0;

  const totalxG = Math.round(filteredStats.reduce((sum, s) => sum + s.xg, 0) * 100) / 100;
  const totalxA = Math.round(filteredStats.reduce((sum, s) => sum + s.xa, 0) * 100) / 100;

  const duelsWon = filteredStats.reduce((sum, s) => sum + s.duels_won, 0);
  const duelsAttempted = filteredStats.reduce((sum, s) => sum + s.duels_attempted, 0);
  const duelSuccessRate = duelsAttempted > 0 ? Math.round((duelsWon / duelsAttempted) * 100) : 0;

  // Defensive KPIs
  const totalTackles = filteredStats.reduce((sum, s) => sum + s.tackles, 0);
  const totalInterceptions = filteredStats.reduce((sum, s) => sum + s.interceptions, 0);

  // GK KPIs
  const totalSaves = filteredStats.reduce((sum, s) => sum + s.saves, 0);
  const goalsConceded = filteredStats.reduce((sum, s) => sum + s.goals_conceded, 0);
  const cleanSheets = filteredStats.filter(s => s.clean_sheet && s.minutes_played >= 45).length;

  // Get last N matches for form dots
  const recentStats = [...filteredStats]
    .map(s => {
      const match = matches.find(m => m.id === s.match_id);
      return { ...s, date: match?.date || '' };
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-formMatchCount);

  // Sort filteredStats chronologically ascending by match date to calculate correct form
  const sortedFilteredStats = [...filteredStats].sort((a, b) => {
    const matchA = matches.find(m => m.id === a.match_id);
    const matchB = matches.find(m => m.id === b.match_id);
    return (matchA?.date || '').localeCompare(matchB?.date || '');
  });

  const { overall: dynamicOVR, form_rating: dynamicFormRating, form_trend: dynamicFormTrend } = activePlayer
    ? calculateDynamicOVRAndForm(activePlayer, sortedFilteredStats, formMatchCount)
    : { overall: 70, form_rating: 6.0, form_trend: 'stable' as const };

  // Calculate form attributes
  const { attributes: adjustedAttributes, modifiers } = activePlayer
    ? calculateFormAdjustedAttributes(activePlayer.base_attributes, dynamicFormRating)
    : { attributes: {} as any, modifiers: {} as any };

  // Prepare Goal Contribution Chart Data
  const contributionsData = [...filteredStats]
    .map(stat => {
      const match = matches.find(m => m.id === stat.match_id);
      if (!match) return null;
      return {
        opponent: match.opponent,
        date: match.date,
        actual: stat.goals + stat.assists,
        expected: Number((stat.xg + stat.xa).toFixed(2)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date));

  // Prepare Passing Efficiency Chart Data
  const passingData = [...filteredStats]
    .map(stat => {
      const match = matches.find(m => m.id === stat.match_id);
      if (!match) return null;
      return {
        opponent: match.opponent,
        date: match.date,
        attempted: stat.passes_attempted,
        completed: stat.passes_completed,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="text-white text-sm flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading player roster profiles...
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
      {/* Sidebar - Roster Navigation */}
      <div className="lg:col-span-1 glass-panel p-4 rounded-xl flex flex-col h-[650px]">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search roster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border pl-9 pr-4 py-2 rounded-lg text-xs text-white focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">No matching players</div>
          ) : (
            filteredPlayers.map(player => (
              <button
                key={player.id}
                onClick={() => setSelectedPlayerId(player.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition text-left ${
                  selectedPlayerId === player.id 
                    ? 'bg-primary/10 border-primary text-white' 
                    : 'bg-background/25 border-border hover:bg-secondary/40 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-zinc-400">
                    {player.avatar_url ? (
                      <img src={player.avatar_url} alt={player.name} className="h-full w-full object-cover" />
                    ) : (
                      player.name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-white">{player.name}</p>
                    <p className="text-[10px] text-zinc-400">{player.position} • #{player.number}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-primary">{player.overall}</div>
                  <div className="text-[8px] text-zinc-500 uppercase tracking-tighter">OVR</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Profile Panel */}
      <div className="lg:col-span-3 space-y-6">
        {!activePlayer ? (
          <div className="glass-panel p-12 rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground h-full">
            <User className="h-16 w-16 text-secondary mb-4" />
            <p className="text-md font-semibold text-white">No Player Profile Selected</p>
            <p className="text-xs mt-1">Please select a player from the roster sidebar to examine their stats.</p>
          </div>
        ) : (
          <>
            {/* Header Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background/20 p-2 rounded-xl border border-border">
              <div className="flex gap-1.5 p-1 bg-background rounded-lg border border-border">
                <button
                  onClick={() => setFilterMode('greece')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterMode === 'greece' ? 'bg-primary text-background' : 'text-zinc-400 hover:text-white'}`}
                >
                  Greece U17 stats
                </button>
                <button
                  onClick={() => setFilterMode('club')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterMode === 'club' ? 'bg-primary text-background' : 'text-zinc-400 hover:text-white'}`}
                >
                  Club stats
                </button>
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${filterMode === 'all' ? 'bg-primary text-background' : 'text-zinc-400 hover:text-white'}`}
                >
                  All Matches
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Player Bio & Radar Card */}
              <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-primary bg-zinc-800">
                      {activePlayer.avatar_url ? (
                        <img src={activePlayer.avatar_url} alt={activePlayer.name} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-full w-full p-2 text-zinc-500" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {activePlayer.name}
                        <span className="text-sm font-normal text-muted-foreground">#{activePlayer.number}</span>
                      </h2>
                      <p className="text-xs text-primary font-semibold">{activePlayer.position} • {activePlayer.preferred_role}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{activePlayer.nationality} • {activePlayer.age} years old</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-black text-primary tracking-tighter">{dynamicOVR}</div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground">OVR Rating</div>
                  </div>
                </div>

                <div className="border-t border-border/80 my-4"></div>

                <h3 className="text-xs font-bold text-white mb-2 uppercase tracking-wider">Attribute Radar</h3>
                <PlayerRadarChart attributes={activePlayer.base_attributes} formRating={dynamicFormRating} />
              </div>

              {/* Performance KPIs & Form Trend */}
              <div className="lg:col-span-2 glass-panel rounded-xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Recent Form Trend
                      </h3>
                      <div className="flex items-center gap-1.5 bg-background/50 px-2 py-1 rounded-lg border border-border">
                        <span className="text-[9px] text-zinc-500 font-bold uppercase">Matches:</span>
                        <select
                          value={formMatchCount}
                          onChange={(e) => setFormMatchCount(Number(e.target.value))}
                          className="bg-transparent text-[10px] font-black text-white focus:outline-none cursor-pointer"
                        >
                          <option className="bg-zinc-950 text-white" value={3}>3</option>
                          <option className="bg-zinc-950 text-white" value={5}>5 (Default)</option>
                          <option className="bg-zinc-950 text-white" value={6}>6</option>
                          <option className="bg-zinc-950 text-white" value={7}>7</option>
                          <option className="bg-zinc-950 text-white" value={10}>10</option>
                          <option className="bg-zinc-950 text-white" value={15}>15</option>
                        </select>
                      </div>
                      {recentStats.length > 0 && (
                        <div className="flex gap-1.5 mt-2 sm:mt-0">
                          {recentStats.map((stat, sIdx) => {
                            const rating = stat.match_rating || 6.0;
                            let bgColor = 'bg-zinc-800 text-zinc-300';
                            let borderColor = 'border-zinc-700';
                            if (rating >= 7.5) {
                              bgColor = 'bg-primary/20 text-primary';
                              borderColor = 'border-primary/30';
                            } else if (rating >= 6.5) {
                              bgColor = 'bg-amber-500/10 text-amber-400';
                              borderColor = 'border-amber-500/20';
                            } else if (rating < 5.5) {
                              bgColor = 'bg-destructive/10 text-destructive';
                              borderColor = 'border-destructive/20';
                            }
                            return (
                              <div
                                key={sIdx}
                                title={`Match Rating: ${rating.toFixed(1)}`}
                                className={`h-7 w-7 rounded-full border ${bgColor} ${borderColor} flex items-center justify-center text-[10px] font-bold shadow-sm`}
                              >
                                {rating.toFixed(1)}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Weighted Recent Form</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-lg font-black text-white">{dynamicFormRating.toFixed(1)}</span>
                        {dynamicFormTrend === 'up' ? (
                          <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded font-black flex items-center"><TrendingUp className="h-3 w-3 mr-0.5" /> UP</span>
                        ) : dynamicFormTrend === 'down' ? (
                          <span className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-1 py-0.5 rounded font-black flex items-center"><TrendingDown className="h-3 w-3 mr-0.5" /> DOWN</span>
                        ) : (
                          <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-1 py-0.5 rounded font-black flex items-center"><Minus className="h-3 w-3 mr-0.5" /> STB</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <FormTrendChart stats={filteredStats} matches={matches} />
                </div>

                <div className="border-t border-border/80 my-4"></div>

                <div>
                  <h3 className="text-xs font-bold text-white mb-3 uppercase tracking-wider">Key Performance Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* General KPIs */}
                    <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">App (Mins)</p>
                      <p className="text-lg font-bold text-white mt-0.5">{statsWithPlaytime.length} <span className="text-[10px] font-normal text-muted-foreground">({totalMins}')</span></p>
                    </div>

                    {activePlayer.position === 'GK' ? (
                      <>
                        <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase">Saves</p>
                          <p className="text-lg font-bold text-white mt-0.5">{totalSaves}</p>
                        </div>
                        <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase">Conceded</p>
                          <p className="text-lg font-bold text-destructive mt-0.5">{goalsConceded}</p>
                        </div>
                        <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                          <p className="text-[10px] text-emerald-400 font-semibold uppercase">Clean Sheets</p>
                          <p className="text-lg font-bold text-primary mt-0.5">{cleanSheets}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase">Goals (xG)</p>
                          <p className="text-lg font-bold text-white mt-0.5">{totalGoals} <span className="text-[10px] font-normal text-muted-foreground font-semibold">({totalxG.toFixed(1)})</span></p>
                        </div>
                        <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase">Assists (xA)</p>
                          <p className="text-lg font-bold text-white mt-0.5">{totalAssists} <span className="text-[10px] font-normal text-muted-foreground font-semibold">({totalxA.toFixed(1)})</span></p>
                        </div>
                        {activePlayer.position === 'DEF' ? (
                          <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Tackles / Int</p>
                            <p className="text-lg font-bold text-white mt-0.5">{totalTackles} / {totalInterceptions}</p>
                          </div>
                        ) : (
                          <div className="bg-background/40 border border-border p-3 rounded-lg text-center">
                            <p className="text-[10px] text-muted-foreground font-semibold uppercase">Key Passes</p>
                            <p className="text-lg font-bold text-white mt-0.5">{totalKeyPasses}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
                    <div className="bg-background/40 border border-border p-2.5 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Pass Comp %</span>
                      <span className="text-xs font-bold text-white">{avgPassAccuracy}%</span>
                    </div>
                    <div className="bg-background/40 border border-border p-2.5 rounded-lg flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Duels Won %</span>
                      <span className="text-xs font-bold text-white">{duelSuccessRate}%</span>
                    </div>
                    <div className="bg-background/40 border border-border p-2.5 rounded-lg flex justify-between items-center col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Avg Distance</span>
                      <span className="text-xs font-bold text-white">{avgDistance} km</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Attributes Modifiers Breakdown */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                Form-Adjusted Attributes Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(activePlayer.base_attributes).map(([key, val]) => {
                  const label = key.toUpperCase();
                  const adjustedVal = adjustedAttributes[key as keyof PlayerBaseAttributes];
                  const mod = modifiers[key as keyof PlayerBaseAttributes];
                  const modColor = mod > 0 ? 'text-primary' : mod < 0 ? 'text-destructive' : 'text-zinc-400';
                  const modText = mod > 0 ? ` (+${mod})` : mod < 0 ? ` (${mod})` : '';

                  return (
                    <div key={key} className="space-y-1.5 p-3 rounded-lg bg-background/30 border border-border">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-zinc-400">{label}</span>
                        <span>
                          <span className="text-white font-black">{adjustedVal}</span>
                          {modText && <span className={`ml-1 font-bold ${modColor}`}>{modText}</span>}
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden border border-zinc-700">
                        <div 
                          className={`h-full ${mod > 0 ? 'bg-primary' : mod < 0 ? 'bg-destructive' : 'bg-zinc-500'} transition-all duration-300`} 
                          style={{ width: `${adjustedVal}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[8px] text-zinc-500 uppercase font-semibold">
                        <span>Base: {val}</span>
                        <span>Max Cap: 99</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Advanced Analytics Section */}
            {activePlayer.position !== 'GK' && filteredStats.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Area Chart: Actual vs Expected Contributions */}
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" />
                    Expected Output Analysis (G+A vs xG+xA)
                  </h3>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={contributionsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                        <XAxis dataKey="opponent" tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                        <YAxis tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                          labelClassName="text-white font-bold text-xs"
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Area type="monotone" dataKey="actual" name="Actual Goal Contribs (G+A)" stroke="#22c55e" fillOpacity={0.15} fill="url(#colorActual)" />
                        <Area type="monotone" dataKey="expected" name="Expected Output (xG+xA)" stroke="#a1a1aa" fillOpacity={0.05} fill="url(#colorExpected)" />
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a1a1aa" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#a1a1aa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Passing Volume & Accuracy */}
                <div className="glass-panel p-5 rounded-xl">
                  <h3 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-1.5">
                    <GitFork className="h-4 w-4 text-primary" />
                    Passing Volume & Efficiency
                  </h3>
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={passingData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                        <XAxis dataKey="opponent" tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                        <YAxis tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                          labelClassName="text-white font-bold text-xs"
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Bar dataKey="attempted" name="Passes Attempted" fill="#52525b" opacity={0.6} radius={[3, 3, 0, 0]} />
                        <Bar dataKey="completed" name="Passes Completed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Match Log History */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Detailed Match Logs
              </h3>

              {filteredStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-border border-dashed rounded-lg text-xs">
                  No match logs found for the selected filter mode.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border rounded-lg bg-background/30">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-secondary/60">
                        <th className="p-3 text-muted-foreground font-semibold uppercase">Date</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase">Opponent</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Mins</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">G / A</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Shots (OT)</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Pass %</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">KP</th>
                        {activePlayer.position === 'GK' ? (
                          <>
                            <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Saves</th>
                            <th className="p-3 text-muted-foreground font-semibold uppercase text-center">GA</th>
                          </>
                        ) : (
                          <>
                            <th className="p-3 text-muted-foreground font-semibold uppercase text-center">xg / xa</th>
                            <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Tkl / Rec</th>
                          </>
                        )}
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Duels Won</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Distance</th>
                        <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Match Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats
                        .map(s => {
                          const m = matches.find(match => match.id === s.match_id);
                          return { ...s, date: m?.date || '', opponent: m?.opponent || 'Unknown', venue: m?.venue || 'Home' };
                        })
                        .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
                        .map(stat => {
                          const rating = stat.match_rating || 6.0;
                          const duelRate = stat.duels_attempted > 0 ? Math.round((stat.duels_won / stat.duels_attempted) * 100) : 0;
                          
                          return (
                            <tr key={stat.id} className="border-b border-border hover:bg-secondary/20 transition">
                              <td className="p-3 font-semibold text-zinc-300 whitespace-nowrap">{stat.date}</td>
                              <td className="p-3 text-white font-semibold flex items-center gap-1">
                                <span className="text-[9px] text-muted-foreground uppercase">{stat.venue === 'Home' ? 'H' : 'A'}</span>
                                {stat.opponent}
                              </td>
                              <td className="p-3 text-center text-zinc-300">{stat.minutes_played}'</td>
                              <td className="p-3 text-center text-zinc-300 font-medium">{stat.goals} / {stat.assists}</td>
                              <td className="p-3 text-center text-zinc-400">
                                {stat.shots} ({stat.shots_on_target})
                              </td>
                              <td className="p-3 text-center text-zinc-300">{stat.passing_accuracy}%</td>
                              <td className="p-3 text-center text-zinc-300 font-medium">{stat.key_passes || '-'}</td>
                              {activePlayer.position === 'GK' ? (
                                <>
                                  <td className="p-3 text-center text-primary font-bold">{stat.saves || '-'}</td>
                                  <td className="p-3 text-center text-destructive">{stat.goals_conceded}</td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 text-center text-zinc-400">{stat.xg.toFixed(2)} / {stat.xa.toFixed(2)}</td>
                                  <td className="p-3 text-center text-zinc-400">{stat.tackles} / {stat.recoveries}</td>
                                </>
                              )}
                              <td className="p-3 text-center text-zinc-400">{duelRate}%</td>
                              <td className="p-3 text-center text-zinc-300">{stat.distance_covered.toFixed(1)}</td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  rating >= 8.0 ? 'bg-primary/20 text-primary border border-primary/20' :
                                  rating >= 7.0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                  rating >= 6.0 ? 'bg-zinc-800 text-zinc-300' :
                                  'bg-destructive/10 text-destructive border border-destructive/20'
                                }`}>
                                  {rating.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
