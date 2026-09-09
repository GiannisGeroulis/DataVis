import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Flame, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Activity, Database, Shield } from 'lucide-react';

export default function AuthLanding() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Παρακαλώ συμπληρώστε όλα τα απαιτούμενα πεδία.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (!res.success) {
        setErrorMessage(res.error || 'Σφάλμα σύνδεσης. Ελέγξτε τα στοιχεία σας.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Απροσδόκητο σφάλμα.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden">
      {/* Background Tactical Pitch Graphic */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] border border-primary/20 rounded-[100px] flex items-center justify-center">
          <div className="w-[300px] h-[300px] rounded-full border border-primary/20"></div>
          <div className="absolute h-full w-[1px] bg-primary/20"></div>
          <div className="absolute w-full h-[1px] bg-primary/20"></div>
        </div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 p-6 flex items-center justify-between border-b border-border/40 backdrop-blur-md bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/25 text-primary glow-active">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-widest text-white uppercase leading-none">DataVis</h1>
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase mt-1 block">Pro Tactical Intelligence</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/80 border border-border text-[11px] font-medium text-zinc-400">
            <span className="h-2 w-2 rounded-full bg-primary glow-active"></span>
            Supabase Auth Cloud
          </div>
        </div>
      </header>

      {/* Hero & Login Section */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 p-6 max-w-7xl mx-auto w-full">
        {/* Left Side: Product Showcase */}
        <div className="flex-1 space-y-6 max-w-xl text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> Next-Gen Football Analytics
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
            Επαγγελματική <span className="text-primary glow-text">Τακτική Ανάλυση</span> & Scouting Suite
          </h2>

          <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
            Διαχειριστείτε όλες τις ομάδες scouting, αναλύσεις συστημάτων και στατιστικά Wyscout με άμεσο συγχρονισμό στο Supabase Cloud.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="glass-panel p-3.5 rounded-xl border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Wyscout Scouting</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Ανάλυση αντιπάλων και στατιστικά αγώνων σε πραγματικό χρόνο.</p>
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-xl border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">OVR & Form Tracker</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Δυναμικοί αλγόριθμοι αξιολόγησης και φυσικής κατάστασης.</p>
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-xl border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Επιλεκτική Φόρτωση</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Κενό ξεκίνημα ή φόρτωση μόνο των δεδομένων που θέλετε.</p>
              </div>
            </div>

            <div className="glass-panel p-3.5 rounded-xl border border-border/80 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase">Supabase Cloud</h4>
                <p className="text-[11px] text-zinc-400 mt-0.5">Ασφαλής πιστοποίηση και αποθήκευση στο cloud.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form Card */}
        <div className="w-full max-w-md">
          <div className="glass-panel p-8 rounded-2xl border border-border shadow-2xl relative">
            {/* Login Header */}
            <div className="mb-6">
              <div className="flex items-center gap-2.5 mb-1.5">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Lock className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Είσοδος στο Σύστημα
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Συνδεθείτε με τον υπάρχοντα λογαριασμό σας DataVis
              </p>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className="p-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="coach@datavis.com"
                    className="w-full bg-zinc-900 border border-border pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Κωδικός Πρόσβασης
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-900 border border-border pl-10 pr-10 py-2.5 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Επεξεργασία...
                  </span>
                ) : (
                  <>
                    <span>Είσοδος στο Σύστημα</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border/80 text-center">
              <p className="text-[10px] text-zinc-500">
                Προστατεύεται από Supabase Auth & PostgreSQL Security
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 p-4 border-t border-border/40 text-center text-zinc-500 text-xs">
        © {new Date().getFullYear()} DataVis Tactical Suite • Supabase Architecture v2.0
      </footer>
    </div>
  );
}
