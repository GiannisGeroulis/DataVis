import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLanding from './components/auth/AuthLanding';
import DataVisLogo from './components/common/DataVisLogo';
import { OpponentTeam } from './types';
import { 
  Shield, 
  LogOut, 
  FileSpreadsheet,
  Loader2
} from 'lucide-react';

const OpponentGrid = lazy(() => import('./components/opponents/OpponentGrid'));
const OpponentDetail = lazy(() => import('./components/opponents/OpponentDetail'));

function MainWorkspace() {
  const { user, signOut, loading } = useAuth();
  const [selectedOpponent, setSelectedOpponent] = useState<OpponentTeam | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary glow-active inline-block animate-pulse">
            <DataVisLogo className="h-8 w-8" />
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
          <div className="flex items-center gap-2.5 mb-8">
            <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary glow-active">
              <DataVisLogo className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-widest text-white leading-none uppercase">DataVis</h1>
            </div>
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
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-7 w-7 rounded-lg bg-zinc-900 flex items-center justify-center text-primary font-black text-xs border border-border flex-shrink-0">
                {initial}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate leading-none capitalize">{displayName}</p>
                <span className="text-[9px] text-zinc-500 truncate block mt-0.5">{userEmail}</span>
              </div>
            </div>
            <span className="h-2 w-2 rounded-full bg-emerald-500 glow-active flex-shrink-0" title="Ενεργή σύνδεση"></span>
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
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
            <Loader2 className="h-7 w-7 text-primary animate-spin" />
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
              Φόρτωση αναλυτικών στοιχείων...
            </span>
          </div>
        }>
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
        </Suspense>
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
