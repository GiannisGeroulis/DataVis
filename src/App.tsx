import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLanding from './components/auth/AuthLanding';
import OpponentGrid from './components/opponents/OpponentGrid';
import OpponentDetail from './components/opponents/OpponentDetail';
import { OpponentTeam } from './types';
import { 
  Shield, 
  Flame, 
  LogOut, 
  ShieldCheck,
  FileSpreadsheet,
  Cloud
} from 'lucide-react';

function MainWorkspace() {
  const { user, signOut, loading } = useAuth();
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentTeam | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary glow-active inline-block animate-pulse">
            <Flame className="h-8 w-8" />
          </div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Φόρτωση DataVis...
          </p>
        </div>
      </div>
    );
  }

  // 1. If not authenticated, show landing & login screen
  if (!user) {
    return <AuthLanding />;
  }

  const userEmail = user.email || 'coach@datavis.com';
  const initial = userEmail.charAt(0).toUpperCase();
  const displayName = user.user_metadata?.name || userEmail.split('@')[0] || 'Αναλυτής';

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
              <h1 className="font-extrabold text-sm tracking-widest text-white leading-none uppercase">DataVis</h1>
              <span className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1 block">Wyscout Scouting Suite</span>
            </div>
          </div>

          {/* Connected Account Banner */}
          <div className="mb-6 p-3 rounded-xl bg-zinc-900/90 border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-xs text-primary bg-primary/10 border border-primary/25 flex-shrink-0"
              >
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-none capitalize">{displayName}</p>
                <span className="text-[10px] text-zinc-400 truncate flex items-center gap-1 mt-1">
                  <Cloud className="h-2.5 w-2.5 text-emerald-400" />
                  <span>Supabase Cloud</span>
                </span>
              </div>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 glow-active flex-shrink-0" title="Cloud Sync Active" />
          </div>

          {/* Nav Items */}
          <nav className="space-y-1.5">
            <button
              onClick={() => setSelectedOpponent(null)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                selectedOpponent === null
                  ? 'bg-primary text-background shadow-glow-green border border-primary/15'
                  : 'text-muted-foreground hover:bg-secondary/40 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span>Αντίπαλες Ομάδες</span>
              </div>
            </button>

            {selectedOpponent && (
              <div className="pt-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 px-4 mb-1 block">
                  Επιλεγμένη Ομάδα
                </span>
                <div className="px-3 py-2 rounded-lg bg-zinc-900/90 border border-primary/30 flex items-center gap-2 text-xs font-bold text-white">
                  <FileSpreadsheet className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="truncate">{selectedOpponent.name}</span>
                </div>
              </div>
            )}
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
                <p className="text-[11px] font-bold text-white truncate leading-none">Scouting Analyst</p>
                <span className="text-[9px] text-zinc-400 truncate block mt-0.5">{userEmail}</span>
              </div>
            </div>
            <span className="h-2 w-2 rounded-full bg-primary glow-active flex-shrink-0" title="Workspace Active"></span>
          </div>

          <button
            onClick={() => signOut()}
            title="Αποσύνδεση"
            className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-destructive/20 border border-border hover:border-destructive/40 text-xs font-bold text-zinc-300 hover:text-destructive transition flex items-center justify-center gap-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Αποσύνδεση</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main key={user.id} className="flex-1 bg-background p-6 md:p-8 overflow-y-auto max-h-screen">
        {selectedOpponent ? (
          <OpponentDetail 
            team={selectedOpponent} 
            onBack={() => setSelectedOpponent(null)} 
          />
        ) : (
          <OpponentGrid 
            onSelectTeam={(team) => setSelectedOpponent(team)} 
          />
        )}
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
