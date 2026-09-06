import { useState } from 'react';
import { Player } from '../../types';
import TacticalCard from './TacticalCard';
import { Shield, Zap, CircleDot, UserCircle } from 'lucide-react';

interface SquadListProps {
  availablePlayers: Player[];
  onNavigateToPlayer?: (playerId: string) => void;
}

type FilterType = 'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD';

export default function SquadList({ availablePlayers, onNavigateToPlayer }: SquadListProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');

  const filteredPlayers = availablePlayers.filter(p => {
    if (filter === 'ALL') return true;
    return p.position === filter;
  });

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col h-[580px]">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <UserCircle className="h-4 w-4 text-primary" />
          Squad Bench
        </h3>
        <p className="text-[10px] text-muted-foreground leading-normal">Drag and drop players onto designated pitch nodes to update active formations.</p>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-5 gap-1 bg-background p-0.5 rounded-lg border border-border mb-4">
        {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as FilterType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`py-1 text-[9px] font-bold rounded-md transition uppercase tracking-wider ${
              filter === tab ? 'bg-primary text-background' : 'text-muted-foreground hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Bench list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filteredPlayers.map(player => (
          <TacticalCard
            key={player.id}
            player={player}
            onNavigateToPlayer={onNavigateToPlayer}
          />
        ))}

        {filteredPlayers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-border border-dashed rounded-lg flex flex-col items-center justify-center p-4">
            {filter === 'GK' && <Shield className="h-6 w-6 text-zinc-600 mb-1.5" />}
            {filter === 'DEF' && <Shield className="h-6 w-6 text-zinc-600 mb-1.5" />}
            {filter === 'MID' && <CircleDot className="h-6 w-6 text-zinc-600 mb-1.5" />}
            {filter === 'FWD' && <Zap className="h-6 w-6 text-zinc-600 mb-1.5" />}
            {filter === 'ALL' && <UserCircle className="h-6 w-6 text-zinc-600 mb-1.5" />}
            <p className="text-[10px] font-semibold text-zinc-400">No players available</p>
            <p className="text-[8px] text-zinc-500 mt-0.5">All players of this role are on the pitch.</p>
          </div>
        )}
      </div>
    </div>
  );
}
