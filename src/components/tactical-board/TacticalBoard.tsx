import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, useDroppable } from '@dnd-kit/core';
import { Player, TacticalLayout } from '../../types';
import { dbService } from '../../lib/supabase';
import SquadList from './SquadList';
import TacticalCard from './TacticalCard';
import { Save, CheckCircle2 } from 'lucide-react';

const FORMATIONS = ['4-3-3', '4-2-3-1', '3-5-2', '4-4-2'] as const;
type FormationType = typeof FORMATIONS[number];

interface NodeCoords {
  id: string;
  label: string;
  top: string;
  left: string;
}

const FORMATION_NODES: Record<FormationType, NodeCoords[]> = {
  '4-3-3': [
    { id: 'GK', label: 'GK', top: '88%', left: '50%' },
    { id: 'LB', label: 'LB', top: '70%', left: '15%' },
    { id: 'LCB', label: 'LCB', top: '74%', left: '38%' },
    { id: 'RCB', label: 'RCB', top: '74%', left: '62%' },
    { id: 'RB', label: 'RB', top: '70%', left: '85%' },
    { id: 'LCM', label: 'LCM', top: '48%', left: '30%' },
    { id: 'CM', label: 'CM', top: '54%', left: '50%' },
    { id: 'RCM', label: 'RCM', top: '48%', left: '70%' },
    { id: 'LW', label: 'LW', top: '22%', left: '20%' },
    { id: 'ST', label: 'ST', top: '16%', left: '50%' },
    { id: 'RW', label: 'RW', top: '22%', left: '80%' },
  ],
  '4-2-3-1': [
    { id: 'GK', label: 'GK', top: '88%', left: '50%' },
    { id: 'LB', label: 'LB', top: '70%', left: '15%' },
    { id: 'LCB', label: 'LCB', top: '74%', left: '38%' },
    { id: 'RCB', label: 'RCB', top: '74%', left: '62%' },
    { id: 'RB', label: 'RB', top: '70%', left: '85%' },
    { id: 'LDM', label: 'LDM', top: '56%', left: '35%' },
    { id: 'RDM', label: 'RDM', top: '56%', left: '65%' },
    { id: 'LAM', label: 'LAM', top: '34%', left: '20%' },
    { id: 'AM', label: 'AM', top: '36%', left: '50%' },
    { id: 'RAM', label: 'RAM', top: '34%', left: '80%' },
    { id: 'ST', label: 'ST', top: '16%', left: '50%' },
  ],
  '3-5-2': [
    { id: 'GK', label: 'GK', top: '88%', left: '50%' },
    { id: 'LCB', label: 'LCB', top: '74%', left: '30%' },
    { id: 'CB', label: 'CB', top: '76%', left: '50%' },
    { id: 'RCB', label: 'RCB', top: '74%', left: '70%' },
    { id: 'LWB', label: 'LWB', top: '48%', left: '12%' },
    { id: 'LCM', label: 'LCM', top: '46%', left: '33%' },
    { id: 'CM', label: 'CM', top: '52%', left: '50%' },
    { id: 'RCM', label: 'RCM', top: '46%', left: '67%' },
    { id: 'RWB', label: 'RWB', top: '48%', left: '88%' },
    { id: 'LST', label: 'LST', top: '18%', left: '38%' },
    { id: 'RST', label: 'RST', top: '18%', left: '62%' },
  ],
  '4-4-2': [
    { id: 'GK', label: 'GK', top: '88%', left: '50%' },
    { id: 'LB', label: 'LB', top: '70%', left: '15%' },
    { id: 'LCB', label: 'LCB', top: '74%', left: '38%' },
    { id: 'RCB', label: 'RCB', top: '74%', left: '62%' },
    { id: 'RB', label: 'RB', top: '70%', left: '85%' },
    { id: 'LM', label: 'LM', top: '44%', left: '16%' },
    { id: 'LCM', label: 'LCM', top: '48%', left: '38%' },
    { id: 'RCM', label: 'RCM', top: '48%', left: '62%' },
    { id: 'RM', label: 'RM', top: '44%', left: '84%' },
    { id: 'LST', label: 'LST', top: '18%', left: '38%' },
    { id: 'RST', label: 'RST', top: '18%', left: '62%' },
  ]
};

interface DroppableNodeProps {
  node: NodeCoords;
  player?: Player;
  onNavigateToPlayer?: (playerId: string) => void;
  onRemovePlayer: (nodeId: string) => void;
}

function DroppableNode({ node, player, onNavigateToPlayer, onRemovePlayer }: DroppableNodeProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `node-${node.id}`,
    data: { nodeId: node.id }
  });

  return (
    <div
      ref={setNodeRef}
      style={{ top: node.top, left: node.left }}
      className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
    >
      {player ? (
        <div className="relative group animate-fade-in">
          {/* Quick Remove Button */}
          <button
            onClick={() => onRemovePlayer(node.id)}
            className="absolute -top-1.5 -left-1.5 bg-destructive hover:bg-red-600 text-white rounded-full h-4 w-4 text-[9px] font-black flex items-center justify-center shadow-lg border border-zinc-950 opacity-0 group-hover:opacity-100 transition duration-200 z-50"
          >
            ×
          </button>
          <TacticalCard player={player} isCompact={true} onNavigateToPlayer={onNavigateToPlayer} />
        </div>
      ) : (
        <div
          className={`h-11 w-11 rounded-full border-2 border-dashed transition flex flex-col items-center justify-center text-[10px] font-black uppercase tracking-wider ${
            isOver 
              ? 'border-primary bg-primary/20 scale-110 text-primary shadow-glow-green' 
              : 'border-pitch-line/40 bg-zinc-950/65 text-muted-foreground hover:border-primary/60'
          }`}
        >
          <span>{node.label}</span>
        </div>
      )}
    </div>
  );
}

// Droppable area to drag players off the pitch (bench)
function DroppableBenchZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'bench-zone'
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 transition rounded-xl ${
        isOver ? 'bg-destructive/10 border-destructive/20 border' : ''
      }`}
    >
      {children}
    </div>
  );
}

interface TacticalBoardProps {
  onNavigateToPlayer?: (playerId: string) => void;
}

export default function TacticalBoard({ onNavigateToPlayer }: TacticalBoardProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [formation, setFormation] = useState<FormationType>('4-3-3');
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [savedLayouts, setSavedLayouts] = useState<TacticalLayout[]>([]);
  const [newLayoutName, setNewLayoutName] = useState('');
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const roster = await dbService.getPlayers();
        setPlayers(roster);

        const layouts = await dbService.getTacticalLayouts();
        setSavedLayouts(layouts);

        if (layouts.length > 0) {
          // Load the first saved layout
          setPositions(layouts[0].positions);
          setFormation(layouts[0].formation as FormationType);
        } else {
          // Default positions map (blank board or seed)
          setPositions({
            "GK": "p11", "LB": "p10", "LCB": "p8", "RCB": "p9", "RB": "p17",
            "LCM": "p3", "CM": "p12", "RCM": "p2", "LW": "p14", "ST": "p1", "RW": "p4"
          });
        }
      } catch (err) {
        console.error('Failed to initialize tactical board:', err);
      }
    }
    loadData();
  }, []);

  const handleDragStart = (event: any) => {
    const activeId = event.active.id;
    const playerId = activeId.replace('player-', '');
    const player = players.find(p => p.id === playerId);
    if (player) {
      setActiveDragPlayer(player);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragPlayer(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const playerId = activeId.replace('player-', '');

    // Dropped back to bench (off pitch)
    if (overId === 'bench-zone') {
      setPositions(prev => {
        const copy = { ...prev };
        const prevKey = Object.keys(copy).find(key => copy[key] === playerId);
        if (prevKey) delete copy[prevKey];
        return copy;
      });
      return;
    }

    // Dropped on a position node
    if (overId.startsWith('node-')) {
      const targetNodeId = overId.replace('node-', '');

      setPositions(prev => {
        const copy = { ...prev };
        
        // Is player already on pitch in another node? Clear their old node
        const prevNodeId = Object.keys(copy).find(key => copy[key] === playerId);
        if (prevNodeId) {
          delete copy[prevNodeId];
        }

        // Swap occupants if target node is occupied
        const occupantId = copy[targetNodeId];
        if (occupantId && prevNodeId) {
          copy[prevNodeId] = occupantId;
        }

        copy[targetNodeId] = playerId;
        return copy;
      });
    }
  };

  const handleRemovePlayer = (nodeId: string) => {
    setPositions(prev => {
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
  };

  const handleFormationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newForm = e.target.value as FormationType;
    setFormation(newForm);
    
    // Auto-adjust layout nodes (clear incompatible positions)
    const allowedNodes = FORMATION_NODES[newForm].map(n => n.id);
    setPositions(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(key => {
        if (!allowedNodes.includes(key)) {
          delete copy[key];
        }
      });
      return copy;
    });
  };

  const handleSaveLayout = async () => {
    if (!newLayoutName.trim()) return;

    const newLayout: TacticalLayout = {
      id: `layout_${Date.now()}`,
      name: newLayoutName.trim(),
      formation,
      positions
    };

    try {
      await dbService.saveTacticalLayout(newLayout);
      setSavedLayouts(prev => [...prev, newLayout]);
      setNewLayoutName('');
      triggerFeedback('Tactical layout saved successfully!');
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  const handleLoadLayout = (layoutId: string) => {
    const layout = savedLayouts.find(l => l.id === layoutId);
    if (layout) {
      setPositions(layout.positions);
      setFormation(layout.formation as FormationType);
      triggerFeedback(`Loaded layout: "${layout.name}"`);
    }
  };

  const handleClearPitch = () => {
    setPositions({});
    triggerFeedback('Pitch cleared.');
  };

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Compute lists of bench vs active players
  const activeOnPitchPlayerIds = new Set(Object.values(positions));
  const benchPlayers = players.filter(p => !activeOnPitchPlayerIds.has(p.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Tactical Suite</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure playstyles, adjust squad positioning, and manage custom team layouts.</p>
        </div>

        {feedback && (
          <div className="bg-primary/10 border border-primary/20 text-primary text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4" />
            {feedback}
          </div>
        )}
      </div>

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Pitch Panel */}
          <div className="lg:col-span-3 glass-panel p-6 rounded-xl flex flex-col space-y-4 h-[670px]">
            {/* Top Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-background/50 border border-border p-3 rounded-lg z-10">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Tactical Formation</span>
                  <select
                    value={formation}
                    onChange={handleFormationChange}
                    className="bg-background border border-border px-3 py-1.5 rounded-md text-xs font-semibold text-white focus:outline-none focus:border-primary"
                  >
                    {FORMATIONS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <span className="text-[9px] uppercase font-bold text-muted-foreground mb-0.5">Saved Templates</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      onChange={(e) => handleLoadLayout(e.target.value)}
                      defaultValue=""
                      className="bg-background border border-border px-3 py-1.5 rounded-md text-xs font-semibold text-white focus:outline-none focus:border-primary min-w-[130px]"
                    >
                      <option value="" disabled>Load Layout...</option>
                      {savedLayouts.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.formation})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Layout Actions */}
              <div className="flex items-center gap-2 self-end">
                <input
                  type="text"
                  placeholder="New layout name..."
                  value={newLayoutName}
                  onChange={(e) => setNewLayoutName(e.target.value)}
                  className="bg-background border border-border px-3 py-1.5 rounded-md text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary w-[140px]"
                />
                <button
                  onClick={handleSaveLayout}
                  disabled={!newLayoutName.trim()}
                  className="p-1.5 bg-primary hover:bg-primary/95 text-background rounded-md text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-40"
                  title="Save current layout"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  onClick={handleClearPitch}
                  className="p-1.5 border border-border bg-background hover:bg-secondary rounded-md text-xs font-semibold text-white hover:text-primary transition"
                  title="Clear pitch"
                >
                  Clear Pitch
                </button>
              </div>
            </div>

            {/* The Football Pitch Vector Layout */}
            <div className="flex-1 pitch-bg rounded-xl border border-pitch-line/20 relative shadow-inner overflow-hidden select-none">
              {/* Pitch Markings */}
              {/* Outer boundary padding */}
              <div className="absolute inset-4 border border-white/20 pointer-events-none"></div>
              
              {/* Midfield circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-28 w-28 rounded-full border border-white/20 pointer-events-none"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-white/20 pointer-events-none"></div>
              {/* Halfway line */}
              <div className="absolute top-1/2 left-4 right-4 h-px bg-white/20 pointer-events-none"></div>

              {/* Opponent Penalty Box (Top) */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-20 w-44 border-b border-x border-white/20 pointer-events-none"></div>
              {/* Goal area box (Top) */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 h-7 w-20 border-b border-x border-white/20 pointer-events-none"></div>

              {/* Our Penalty Box (Bottom) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-20 w-44 border-t border-x border-white/20 pointer-events-none"></div>
              {/* Goal area box (Bottom) */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 h-7 w-20 border-t border-x border-white/20 pointer-events-none"></div>

              {/* Position Droppable Nodes */}
              {FORMATION_NODES[formation].map(node => {
                const playerId = positions[node.id];
                const player = players.find(p => p.id === playerId);
                return (
                  <DroppableNode
                    key={node.id}
                    node={node}
                    player={player}
                    onNavigateToPlayer={onNavigateToPlayer}
                    onRemovePlayer={handleRemovePlayer}
                  />
                );
              })}
            </div>
          </div>

          {/* Squad bench sidebar */}
          <div className="lg:col-span-1 flex flex-col">
            <DroppableBenchZone>
              <SquadList
                availablePlayers={benchPlayers}
                onNavigateToPlayer={onNavigateToPlayer}
              />
            </DroppableBenchZone>
          </div>
        </div>

        {/* Drag Overlay for smooth animation */}
        <DragOverlay>
          {activeDragPlayer ? (
            <div className="opacity-80 scale-105">
              <TacticalCard player={activeDragPlayer} isCompact={true} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
