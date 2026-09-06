import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLanding from './components/auth/AuthLanding';
import ProfileSelector from './components/auth/ProfileSelector';
import TeamDashboard from './components/analytics/TeamDashboard';
import TacticalBoard from './components/tactical-board/TacticalBoard';
import PlayerProfile from './components/analytics/PlayerProfile';
import CSVUploader from './components/admin/CSVUploader';
import { 
  LayoutDashboard, 
  Target, 
  TrendingUp, 
  Database, 
  Flame, 
  RefreshCw, 
  LogOut, 
  ShieldCheck 
} from 'lucide-react';

type TabType = 'dashboard' | 'tactics' | 'profile' | 'admin';

function MainWorkspace() {
  const { user, activeProfile, selectProfile, signOut, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary glow-active inline-block animate-pulse">
            <Flame className="h-8 w-8" />
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Φόρτωση Pitch Analytica...
          </p>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, show landing & login screen
  if (!user) {
    return <AuthLanding />;
  }

  // 2. If authenticated but no active profile selected, show profile hub
  if (!activeProfile) {
    return <ProfileSelector />;
  }

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

  const profileColor = activeProfile.color || '#10b981';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-zinc-950 border-b md:border-b-0 md:border-r border-border flex flex-col justify-between flex-shrink-0 z-30">
        <div className="p-6">
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/20 text-primary glow-active">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-widest text-white leading-none uppercase">Pitch Analytica</h1>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1 block">Tactical Suite v2.0</span>
            </div>
          </div>

          {/* Active Profile Banner */}
          <div className="mb-6 p-3 rounded-xl bg-zinc-900/90 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-xs text-white border border-white/10 flex-shrink-0"
                style={{ backgroundColor: `${profileColor}30`, borderColor: profileColor }}
              >
                {activeProfile.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-none">{activeProfile.name}</p>
                <span className="text-[10px] text-zinc-400 truncate block mt-0.5">{activeProfile.team_name}</span>
              </div>
            </div>
            <button
              onClick={() => selectProfile(null as any)}
              title="Αλλαγή Προφίλ"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition flex-shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
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

        {/* Sidebar Footer User Info & Actions */}
        <div className="p-4 border-t border-border bg-black/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-primary font-black border border-border flex-shrink-0">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-white truncate leading-none">{activeProfile.role}</p>
                <span className="text-[9px] text-zinc-400 truncate block mt-0.5">{user.email || 'Analyst'}</span>
              </div>
            </div>
            <span className="h-2 w-2 rounded-full bg-primary glow-active flex-shrink-0" title="Workspace Active"></span>
          </div>

          <div className="flex gap-2 pt-1 border-t border-border/40">
            <button
              onClick={() => selectProfile(null as any)}
              className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-border text-[10px] font-bold text-zinc-300 hover:text-white transition flex items-center justify-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Αλλαγή Προφίλ</span>
            </button>
            <button
              onClick={() => signOut()}
              title="Αποσύνδεση"
              className="py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-destructive/20 border border-border hover:border-destructive/40 text-[10px] font-bold text-zinc-400 hover:text-destructive transition flex items-center justify-center"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace (Keyed by activeProfile.id so profile data isolates completely) */}
      <main key={activeProfile.id} className="flex-1 bg-background p-6 md:p-8 overflow-y-auto max-h-screen">
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

export default function App() {
  return (
    <AuthProvider>
      <MainWorkspace />
    </AuthProvider>
  );
}
