import { useState } from 'react';
import TeamDashboard from './components/analytics/TeamDashboard';
import TacticalBoard from './components/tactical-board/TacticalBoard';
import PlayerProfile from './components/analytics/PlayerProfile';
import CSVUploader from './components/admin/CSVUploader';
import { LayoutDashboard, Target, TrendingUp, Database, Flame, User } from 'lucide-react';

type TabType = 'dashboard' | 'tactics' | 'profile' | 'admin';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  const handleNavigateToPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setActiveTab('profile');
  };

  const navItems = [
    { id: 'dashboard', label: 'Team Dashboard', icon: LayoutDashboard },
    { id: 'tactics', label: 'Tactical Board', icon: Target },
    { id: 'profile', label: 'Player Analytics', icon: TrendingUp },
    { id: 'admin', label: 'CSV Ingestion', icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-zinc-950 border-b md:border-b-0 md:border-r border-border flex flex-col justify-between flex-shrink-0 z-30">
        <div className="p-6">
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary glow-active">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-widest text-white leading-none uppercase">Pitch Analytica</h1>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 block">Tactical Suite v1.0</span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                    isActive
                      ? 'bg-primary text-background shadow-glow-green border border-primary/15'
                      : 'text-muted-foreground hover:bg-secondary/40 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-border bg-black/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-primary font-black border border-border">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-white truncate leading-none">Senior Architect</p>
              <span className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5 block">Tactical Board Admin</span>
            </div>
          </div>
          <span className="h-2 w-2 rounded-full bg-primary glow-active" title="System Live"></span>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 bg-background p-6 md:p-8 overflow-y-auto max-h-screen">
        {activeTab === 'dashboard' && <TeamDashboard />}
        
        {activeTab === 'tactics' && (
          <TacticalBoard onNavigateToPlayer={handleNavigateToPlayer} />
        )}
        
        {activeTab === 'profile' && (
          <PlayerProfile 
            playerId={selectedPlayerId} 
            onNavigateToPlayer={handleNavigateToPlayer} 
          />
        )}
        
        {activeTab === 'admin' && <CSVUploader />}
      </main>
    </div>
  );
}
