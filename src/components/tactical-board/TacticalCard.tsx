import { useDraggable } from '@dnd-kit/core';
import { Player } from '../../types';
import { User, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TacticalCardProps {
  player: Player;
  isCompact?: boolean;
  onNavigateToPlayer?: (playerId: string) => void;
}

export default function TacticalCard({ player, isCompact = false, onNavigateToPlayer }: TacticalCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `player-${player.id}`,
    data: { player }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 999,
  } : undefined;

  const handleCardClick = (e: React.MouseEvent) => {
    // If the user clicked to view stats and not just start a drag
    if (onNavigateToPlayer) {
      e.stopPropagation();
      onNavigateToPlayer(player.id);
    }
  };

  if (isCompact) {
    // Rendition of player card placed directly on pitch position circles
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={handleCardClick}
        className={`w-20 md:w-24 bg-zinc-950/90 border-2 ${
          isDragging ? 'border-primary opacity-50 scale-105' : 'border-zinc-800 hover:border-primary'
        } rounded-lg p-1.5 text-center shadow-glow-card transition-all cursor-grab active:cursor-grabbing flex flex-col items-center select-none`}
      >
        {/* Dynamic OVR badge top right */}
        <div className="absolute -top-2.5 -right-2 bg-primary text-background text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm border border-zinc-900">
          {player.overall}
        </div>

        <div className="h-9 w-9 rounded-full overflow-hidden border border-border bg-secondary flex-shrink-0 mb-1">
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={player.name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-full w-full p-1.5 text-zinc-500" />
          )}
        </div>

        <p className="text-[10px] font-bold text-white truncate w-full leading-tight">{player.name.split(' ').pop()}</p>
        <p className="text-[8px] text-primary leading-none uppercase font-semibold mt-0.5">{player.position}</p>
      </div>
    );
  }

  // Standard listing rendition (bench list)
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleCardClick}
      className={`flex items-center justify-between p-2.5 bg-background border ${
        isDragging ? 'border-primary opacity-40' : 'border-border hover:border-zinc-700'
      } rounded-lg cursor-grab active:cursor-grabbing hover:bg-secondary/20 transition select-none`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-full overflow-hidden border border-border bg-secondary flex-shrink-0">
          {player.avatar_url ? (
            <img src={player.avatar_url} alt={player.name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-full w-full p-1.5 text-zinc-500" />
          )}
        </div>
        <div className="truncate">
          <p className="font-bold text-xs text-white truncate leading-tight">{player.name}</p>
          <p className="text-[9px] text-muted-foreground">{player.position} • #{player.number}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {player.form_trend === 'up' && <TrendingUp className="h-3 w-3 text-primary" />}
        {player.form_trend === 'down' && <TrendingDown className="h-3 w-3 text-destructive" />}
        {player.form_trend === 'stable' && <Minus className="h-3 w-3 text-muted-foreground" />}
        <span className="text-xs font-black text-primary px-1.5 py-0.5 rounded bg-primary/10">
          {player.overall}
        </span>
      </div>
    </div>
  );
}
