import { useState, useEffect } from 'react';
import { dbService } from '../../lib/supabase';
import { Match, TeamMatchStats, Player, PlayerMatchStats } from '../../types';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from 'recharts';
import { Award, Flame, Users, LayoutDashboard, Calendar, Shield, Activity } from 'lucide-react';

export default function TeamDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamStats, setTeamStats] = useState<TeamMatchStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const fixtures = await dbService.getMatches();
        const stats = await dbService.getTeamMatchStats();
        const roster = await dbService.getPlayers();
        const pStats = await dbService.getAllPlayerMatchStats();
        
        // Filter matches to display ONLY Greece National Team fixtures from the team stats sheet
        const nationalFixtures = fixtures.filter(m => m.is_team_match === true);
        const nationalStats = stats.filter(s => nationalFixtures.some(m => m.id === s.match_id));
        const nationalPlayerStats = pStats.filter(ps => nationalFixtures.some(m => m.id === ps.match_id));

        setMatches(nationalFixtures);
        setTeamStats(nationalStats);
        setPlayers(roster);
        setPlayerStats(nationalPlayerStats);
      } catch (err) {
        console.error('Failed to load data for team dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white text-sm flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading team statistics logs...
        </div>
      </div>
    );
  }

  // Calculate team aggregate KPIs
  const wins = matches.filter(m => m.result === 'W').length;
  const draws = matches.filter(m => m.result === 'D').length;
  const losses = matches.filter(m => m.result === 'L').length;
  
  const goalsFor = matches.reduce((sum, m) => sum + m.our_score, 0);
  const goalsAgainst = matches.reduce((sum, m) => sum + m.opp_score, 0);
  const goalDiff = goalsFor - goalsAgainst;

  // Get last 5 matches for team recent form (sorted oldest to newest)
  const recentMatches = [...matches]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-5);

  const avgPossession = teamStats.length > 0
    ? Math.round(teamStats.reduce((sum, s) => sum + s.possession, 0) / teamStats.length)
    : 0;

  // Calculate top goals / assists scorer
  const scorerMap: Record<string, { name: string, goals: number, assists: number }> = {};
  playerStats.forEach(stat => {
    const p = players.find(player => player.id === stat.player_id);
    if (!p) return;
    if (!scorerMap[p.id]) {
      scorerMap[p.id] = { name: p.name, goals: 0, assists: 0 };
    }
    scorerMap[p.id].goals += stat.goals;
    scorerMap[p.id].assists += stat.assists;
  });

  const scorers = Object.values(scorerMap);
  const topScorer = scorers.length > 0 ? [...scorers].sort((a, b) => b.goals - a.goals || b.assists - a.assists)[0] : null;
  const topPlaymaker = scorers.length > 0 ? [...scorers].sort((a, b) => b.assists - a.assists || b.goals - a.goals)[0] : null;

  // Prepare Chart Data
  const chartsData = matches.map(match => {
    const tStat = teamStats.find(s => s.match_id === match.id);
    
    // Sum players xg for this match
    const matchPlayerStats = playerStats.filter(s => s.match_id === match.id);
    const totalMatchxG = Math.round(matchPlayerStats.reduce((sum, s) => sum + s.xg, 0) * 100) / 100;

    return {
      date: match.date,
      opponent: match.opponent,
      possession: tStat ? tStat.possession : 50,
      goals: match.our_score,
      opponentGoals: match.opp_score,
      xg: totalMatchxG || (match.our_score * 0.8 + 0.3), // Fallback if no individual stats loaded yet
    };
  }).sort((a, b) => a.date.localeCompare(b.date));

  // 1. Calculate Squad Average Attributes Radar Data
  const totalPlayers = players.length;
  const avgPace = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.pace, 0) / totalPlayers) : 0;
  const avgShooting = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.shooting, 0) / totalPlayers) : 0;
  const avgPassing = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.passing, 0) / totalPlayers) : 0;
  const avgDribbling = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.dribbling, 0) / totalPlayers) : 0;
  const avgDefending = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.defending, 0) / totalPlayers) : 0;
  const avgPhysical = totalPlayers > 0 ? Math.round(players.reduce((sum, p) => sum + p.base_attributes.physical, 0) / totalPlayers) : 0;

  const squadRadarData = [
    { subject: 'Pace', A: avgPace, fullMark: 100 },
    { subject: 'Shooting', A: avgShooting, fullMark: 100 },
    { subject: 'Passing', A: avgPassing, fullMark: 100 },
    { subject: 'Dribbling', A: avgDribbling, fullMark: 100 },
    { subject: 'Defending', A: avgDefending, fullMark: 100 },
    { subject: 'Physical', A: avgPhysical, fullMark: 100 },
  ];

  // 2. Prepare Squad Maturity Scatter Plot Data (OVR vs Age)
  const scatterData = players.map(p => ({
    name: p.name,
    age: p.age,
    overall: p.overall,
    position: p.position
  }));

  const getPositionColor = (pos: string) => {
    if (pos === 'GK') return '#f97316'; // orange
    if (pos === 'DEF') return '#ef4444'; // red
    if (pos === 'MID') return '#22c55e'; // green
    return '#3b82f6'; // blue
  };

  const CustomScatterTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg shadow-glow-card text-xs space-y-1">
          <p className="font-bold text-white">{data.name}</p>
          <p className="text-primary font-semibold">{data.position} • {data.age} yrs</p>
          <p className="text-zinc-300">OVR: <span className="text-primary font-bold">{data.overall}</span></p>
        </div>
      );
    }
    return null;
  };

  // 3. Prepare Defensive Solidity Data (Conceded goals trend)
  const defenseData = [...chartsData]
    .map(match => ({
      opponent: match.opponent,
      goalsConceded: match.opponentGoals,
      cleanSheet: match.opponentGoals === 0 ? 1 : 0
    }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Team Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Squad summary analytics, match histories, and tactical team performance KPIs.</p>
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Record Card */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Fixture Record</p>
            <p className="text-2xl font-bold text-white">
              {wins}W <span className="text-muted-foreground">•</span> {draws}D <span className="text-muted-foreground">•</span> {losses}L
            </p>
            <p className="text-[10px] text-muted-foreground">GD: <span className={goalDiff >= 0 ? 'text-primary font-bold' : 'text-destructive font-bold'}>{goalDiff >= 0 ? `+${goalDiff}` : goalDiff}</span> ({goalsFor} GF / {goalsAgainst} GA)</p>
            {recentMatches.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[9px] text-muted-foreground font-semibold uppercase mr-1">Form:</span>
                {recentMatches.map((m, idx) => {
                  let bgColor = 'bg-zinc-800 text-zinc-300 border-zinc-700';
                  if (m.result === 'W') {
                    bgColor = 'bg-primary/20 text-primary border-primary/30';
                  } else if (m.result === 'D') {
                    bgColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                  } else if (m.result === 'L') {
                    bgColor = 'bg-destructive/10 text-destructive border-destructive/20';
                  }
                  return (
                    <span 
                      key={m.id || idx}
                      title={`${m.opponent} (${m.our_score}-${m.opp_score})`}
                      className={`h-5 w-5 rounded border ${bgColor} flex items-center justify-center text-[9px] font-black shadow-sm cursor-help`}
                    >
                      {m.result}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 bg-secondary/80 border border-border rounded-lg text-primary">
            <LayoutDashboard className="h-6 w-6" />
          </div>
        </div>

        {/* Possession Card */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Avg Possession</p>
            <p className="text-2xl font-bold text-primary">{avgPossession}%</p>
            <p className="text-[10px] text-muted-foreground">Dominating tempo & control</p>
          </div>
          <div className="p-3 bg-secondary/80 border border-border rounded-lg text-primary">
            <Flame className="h-6 w-6" />
          </div>
        </div>

        {/* Top Scorer Card */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Top Scorer</p>
            <p className="text-md font-bold text-white truncate max-w-[150px]">
              {topScorer && topScorer.goals > 0 ? topScorer.name : 'N/A'}
            </p>
            <p className="text-xs text-primary font-semibold">
              {topScorer && topScorer.goals > 0 ? `${topScorer.goals} Goals (${topScorer.assists} A)` : '-'}
            </p>
          </div>
          <div className="p-3 bg-secondary/80 border border-border rounded-lg text-primary">
            <Award className="h-6 w-6" />
          </div>
        </div>

        {/* Top Playmaker Card */}
        <div className="glass-panel p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase">Top Playmaker</p>
            <p className="text-md font-bold text-white truncate max-w-[150px]">
              {topPlaymaker && topPlaymaker.assists > 0 ? topPlaymaker.name : 'N/A'}
            </p>
            <p className="text-xs text-primary font-semibold">
              {topPlaymaker && topPlaymaker.assists > 0 ? `${topPlaymaker.assists} Assists` : '-'}
            </p>
          </div>
          <div className="p-3 bg-secondary/80 border border-border rounded-lg text-primary">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts - First Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Possession Trend Area Chart */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div>
            <h3 className="text-md font-bold text-white">Possession Dynamics</h3>
            <p className="text-xs text-muted-foreground">Percentage ball control trend across current fixtures.</p>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="possGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                <XAxis dataKey="opponent" tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255, 255, 255, 0.05)" />
                <YAxis domain={[30, 70]} tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255, 255, 255, 0.05)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                  labelClassName="text-white font-bold"
                  itemStyle={{ color: '#22c55e' }}
                />
                <Area type="monotone" dataKey="possession" name="Possession %" stroke="#22c55e" strokeWidth={2.5} fillOpacity={1} fill="url(#possGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Goals vs xG Bar Chart */}
        <div className="glass-panel p-6 rounded-xl space-y-4">
          <div>
            <h3 className="text-md font-bold text-white">Finishing Efficiency</h3>
            <p className="text-xs text-muted-foreground">Goals scored versus Expected Goals (xG) per fixture.</p>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                <XAxis dataKey="opponent" tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255, 255, 255, 0.05)" />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} stroke="rgba(255, 255, 255, 0.05)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                  labelClassName="text-white font-bold"
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="goals" name="Goals Scored" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="xg" name="Expected Goals (xG)" fill="#a1a1aa" opacity={0.6} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Advanced Visual Analytics - Second Row */}
      {totalPlayers > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 3: Squad Maturity Scatter (Overall vs Age) */}
          <div className="glass-panel p-5 rounded-xl space-y-3 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                Squad Maturity (OVR vs. Age)
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Player age versus active dynamic OVR rating.</p>
            </div>
            
            <div className="h-[210px] w-full my-3">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis type="number" dataKey="age" name="Age" domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                  <YAxis type="number" dataKey="overall" name="Overall" domain={['dataMin - 5', 'dataMax + 5']} tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                  <Tooltip content={<CustomScatterTooltip />} />
                  <Scatter name="Players" data={scatterData}>
                    {scatterData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getPositionColor(entry.position)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[8px] uppercase font-bold text-zinc-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f97316]"></span> GK</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ef4444]"></span> DEF</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22c55e]"></span> MID</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#3b82f6]"></span> FWD</span>
            </div>
          </div>

          {/* Chart 4: Squad DNA Average Attributes Radar */}
          <div className="glass-panel p-5 rounded-xl space-y-3 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-primary" />
                Squad Average DNA Profile
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Mean attribute strengths aggregated across all players.</p>
            </div>

            <div className="h-[210px] w-full my-3">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={squadRadarData}>
                  <PolarGrid stroke="rgba(255, 255, 255, 0.06)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#52525b', fontSize: 8 }} axisLine={false} stroke="rgba(255, 255, 255, 0.03)" />
                  <Radar name="Squad Average" dataKey="A" stroke="#22c55e" fill="#22c55e" fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-[8px] uppercase font-bold text-zinc-500">
              Aggregated from {totalPlayers} active players
            </div>
          </div>

          {/* Chart 5: Defensive Solidity Chart */}
          <div className="glass-panel p-5 rounded-xl space-y-3 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                Defensive solidity
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">fixture-by-fixture Goals Conceded tracking.</p>
            </div>

            <div className="h-[210px] w-full my-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={defenseData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis dataKey="opponent" tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                  <YAxis tick={{ fill: '#71717a', fontSize: 9 }} stroke="rgba(255, 255, 255, 0.05)" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }}
                    labelClassName="text-white font-bold text-xs"
                  />
                  <Bar dataKey="goalsConceded" name="Goals Conceded" fill="#ef4444" opacity={0.85} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center text-[8px] uppercase font-bold text-zinc-500">
              Clean Sheets Logged: {matches.filter(m => m.opp_score === 0).length} fixtures
            </div>
          </div>
        </div>
      )}

      {/* Match Results Log */}
      <div className="glass-panel p-6 rounded-xl">
        <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Squad Fixtures Log
        </h3>

        <div className="overflow-x-auto border border-border rounded-lg bg-background/30">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary/60">
                <th className="p-3 text-muted-foreground font-semibold uppercase">Date</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase">Opponent</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Result</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Score</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Possession</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Shots (SOT)</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Fouls</th>
                <th className="p-3 text-muted-foreground font-semibold uppercase text-center">Tactical Layout</th>
              </tr>
            </thead>
            <tbody>
              {matches
                .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
                .map(match => {
                  const tStat = teamStats.find(s => s.match_id === match.id);
                  const resultColor = match.result === 'W' ? 'bg-primary/10 text-primary border border-primary/20' : match.result === 'L' ? 'bg-destructive/10 text-destructive border border-destructive/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  
                  return (
                    <tr key={match.id} className="border-b border-border hover:bg-secondary/20 transition">
                      <td className="p-3 font-semibold text-zinc-300 whitespace-nowrap">{match.date}</td>
                      <td className="p-3 text-white font-semibold flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase">{match.venue}</span>
                        {match.opponent}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resultColor}`}>
                          {match.result}
                        </span>
                      </td>
                      <td className="p-3 text-center text-white font-bold">{match.our_score} - {match.opp_score}</td>
                      <td className="p-3 text-center text-zinc-300 font-medium">{tStat ? `${tStat.possession}%` : '-'}</td>
                      <td className="p-3 text-center text-zinc-400">
                        {tStat ? `${tStat.shots} (${tStat.shots_on_target})` : '-'}
                      </td>
                      <td className="p-3 text-center text-zinc-400">{tStat ? tStat.fouls : '-'}</td>
                      <td className="p-3 text-center text-zinc-300 font-semibold">{tStat ? tStat.formation : '4-3-3'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
