import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PlayerMatchStats, Match } from '../../types';

interface FormTrendChartProps {
  stats: PlayerMatchStats[];
  matches: Match[];
}

export default function FormTrendChart({ stats, matches }: FormTrendChartProps) {
  // Map stats chronologically and merge with match info
  const chartData = stats
    .map(stat => {
      const match = matches.find(m => m.id === stat.match_id);
      if (!match) return null;
      return {
        date: match.date,
        matchId: match.id,
        opponent: match.opponent,
        venue: match.venue === 'Home' ? 'H' : 'A',
        result: match.result,
        score: `${match.our_score}-${match.opp_score}`,
        rating: stat.match_rating || 6.0,
        goals: stat.goals,
        assists: stat.assists,
        minutes: stat.minutes_played,
      };
    })
    .filter(Boolean)
    // Sort by date ascending
    .sort((a, b) => a!.date.localeCompare(b!.date));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-glow-card text-xs space-y-1.5">
          <p className="font-bold text-white">
            {data.venue === 'H' ? 'vs' : 'at'} {data.opponent} ({data.venue})
          </p>
          <p className="text-muted-foreground">
            Result: <span className={data.result === 'W' ? 'text-primary font-semibold' : data.result === 'L' ? 'text-destructive font-semibold' : 'text-amber-500 font-semibold'}>
              {data.result} ({data.score})
            </span>
          </p>
          <div className="border-t border-zinc-800 pt-1.5 mt-1 text-[11px] text-zinc-300 space-y-0.5">
            <p>Rating: <span className="text-primary font-bold">{data.rating.toFixed(1)}</span></p>
            <p>Played: {data.minutes} mins</p>
            {(data.goals > 0 || data.assists > 0) && (
              <p className="text-emerald-400 font-semibold">
                {[
                  data.goals > 0 ? `${data.goals} G` : null,
                  data.assists > 0 ? `${data.assists} A` : null,
                ].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center border border-border border-dashed rounded-lg text-muted-foreground text-xs">
        No matches recorded for form tracking.
      </div>
    );
  }

  return (
    <div className="w-full h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(date) => {
              // Convert YYYY-MM-DD to MM/DD
              const parts = date.split('-');
              return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : date;
            }}
            tick={{ fill: '#71717a', fontSize: 10 }}
            stroke="rgba(255, 255, 255, 0.05)"
          />
          <YAxis 
            domain={[3, 10]} 
            ticks={[3, 4, 5, 6, 7, 8, 9, 10]}
            tick={{ fill: '#71717a', fontSize: 10 }}
            stroke="rgba(255, 255, 255, 0.05)"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(34, 197, 94, 0.2)' }} />
          <Line 
            type="monotone" 
            dataKey="rating" 
            stroke="#22c55e" 
            strokeWidth={3}
            dot={{ r: 4, stroke: '#18181b', strokeWidth: 1.5, fill: '#22c55e' }}
            activeDot={{ r: 6, stroke: '#09090b', strokeWidth: 2, fill: '#22c55e' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
