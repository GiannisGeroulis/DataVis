import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { PlayerBaseAttributes } from '../../types';
import { calculateFormAdjustedAttributes } from '../../lib/ovr-algorithm';

interface PlayerRadarChartProps {
  attributes: PlayerBaseAttributes;
  formRating: number;
}

export default function PlayerRadarChart({ attributes, formRating }: PlayerRadarChartProps) {
  const { attributes: adjusted } = calculateFormAdjustedAttributes(attributes, formRating);

  const data = [
    { subject: 'PAC (Pace)', base: attributes.pace, adjusted: adjusted.pace, fullMark: 100 },
    { subject: 'SHO (Shooting)', base: attributes.shooting, adjusted: adjusted.shooting, fullMark: 100 },
    { subject: 'PAS (Passing)', base: attributes.passing, adjusted: adjusted.passing, fullMark: 100 },
    { subject: 'DRI (Dribbling)', base: attributes.dribbling, adjusted: adjusted.dribbling, fullMark: 100 },
    { subject: 'DEF (Defending)', base: attributes.defending, adjusted: adjusted.defending, fullMark: 100 },
    { subject: 'PHY (Physical)', base: attributes.physical, adjusted: adjusted.physical, fullMark: 100 },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const diff = item.adjusted - item.base;
      const diffText = diff > 0 ? ` (+${diff})` : diff < 0 ? ` (${diff})` : '';
      const diffColor = diff > 0 ? 'text-primary' : diff < 0 ? 'text-destructive' : 'text-zinc-400';

      return (
        <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-lg shadow-glow-card text-xs space-y-1">
          <p className="font-bold text-white uppercase tracking-wider">{item.subject}</p>
          <p className="text-zinc-400">Base Rating: <span className="text-zinc-300 font-bold">{item.base}</span></p>
          <p className="text-zinc-400">
            Form Adjusted: <span className="text-white font-bold">{item.adjusted}</span>
            {diffText && <span className={`ml-1 font-bold ${diffColor}`}>{diffText}</span>}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="rgba(255, 255, 255, 0.08)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 600 }}
          />
          <PolarRadiusAxis 
            angle={30} 
            domain={[0, 100]} 
            tick={{ fill: '#52525b', fontSize: 8 }}
            axisLine={false}
            stroke="rgba(255, 255, 255, 0.05)"
          />
          <Tooltip content={<CustomTooltip />} />
          <Radar
            name="Base Skills"
            dataKey="base"
            stroke="#52525b"
            fill="#52525b"
            fillOpacity={0.15}
          />
          <Radar
            name="Form-Adjusted"
            dataKey="adjusted"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.25}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
