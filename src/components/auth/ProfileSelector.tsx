import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserProfile } from '../../types';
import { 
  Users,
  Plus, 
  Trash2, 
  ArrowRight, 
  LogOut, 
  Flame, 
  Sparkles, 
  Check, 
  Calendar,
  X
} from 'lucide-react';

const PRESET_ROLES = [
  'Senior Tactical Analyst',
  'Head Coach',
  'Scouting Director',
  'Performance Specialist',
  'Academy Director',
  'Data Scientist'
];

const PRESET_COLORS = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ef4444', // red
];

export default function ProfileSelector() {
  const { user, profiles, selectProfile, createProfile, deleteProfile, signOut } = useAuth();
  
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form State
  const [profileName, setProfileName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [role, setRole] = useState(PRESET_ROLES[0]);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setCreating(true);
    try {
      await createProfile({
        name: profileName.trim(),
        team_name: teamName.trim() || 'Custom Team',
        role: role,
        color: selectedColor
      });

      setShowModal(false);
      // Reset form
      setProfileName('');
      setTeamName('');
      setRole(PRESET_ROLES[0]);
    } catch (err) {
      console.error("Failed to create profile:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, profileId: string) => {
    e.stopPropagation();
    if (window.confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το προφίλ και όλα τα δεδομένα του;')) {
      setDeletingId(profileId);
      try {
        await deleteProfile(profileId);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[600px] border border-primary/20 rounded-full blur-3xl"></div>
      </div>

      {/* Top Bar */}
      <header className="relative z-10 px-8 py-5 flex items-center justify-between border-b border-border/40 backdrop-blur-md bg-zinc-950/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/25 text-primary glow-active">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-black text-base tracking-widest text-white uppercase leading-none">Pitch Analytica</h1>
            <span className="text-[10px] font-bold text-primary tracking-widest uppercase mt-1 block">Tactical Profile Hub</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white truncate max-w-[200px]">{user?.email || 'Guest Analyst'}</p>
            <span className="text-[10px] text-zinc-400">Συνδεδεμένος Χρήστης</span>
          </div>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-border text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-700 transition"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Αποσύνδεση</span>
          </button>
        </div>
      </header>

      {/* Main Body: Profile Selection */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 md:p-12 max-w-5xl mx-auto w-full">
        <div className="text-center max-w-xl mb-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11px] font-bold uppercase tracking-wider">
            <Users className="h-3.5 w-3.5" /> Χώροι Εργασίας & Προφίλ
          </div>
          <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight">
            Επιλέξτε ή Δημιουργήστε <span className="text-primary glow-text">Προφίλ</span>
          </h2>
          <p className="text-zinc-400 text-xs md:text-sm">
            Κάθε προφίλ διατηρεί εντελώς ξεχωριστά δεδομένα (παίκτες, αγώνες, τακτικές). Μπορείτε να ξεκινήσετε με κενό προφίλ ή με επιλεγμένα δείγματα.
          </p>
        </div>

        {/* Profile Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full mb-8">
          {/* New Profile Trigger Card */}
          <button
            onClick={() => setShowModal(true)}
            className="h-64 rounded-2xl border-2 border-dashed border-border hover:border-primary/60 bg-zinc-950/40 hover:bg-zinc-900/40 transition flex flex-col items-center justify-center p-6 group cursor-pointer text-center relative overflow-hidden"
          >
            <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition duration-300">
              <Plus className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider group-hover:text-primary transition">
              Δημιουργία Νέου Προφίλ
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[200px]">
              Προσθέστε νέα ομάδα, κατηγορία scouting ή κενό χώρο εργασίας.
            </p>
          </button>

          {/* Existing Profiles */}
          {profiles.map((profile: UserProfile) => {
            const color = profile.color || '#10b981';
            const isDeleting = deletingId === profile.id;

            return (
              <div
                key={profile.id}
                onClick={() => selectProfile(profile)}
                className="h-64 glass-panel rounded-2xl p-6 border border-border hover:border-primary/60 transition flex flex-col justify-between group cursor-pointer relative overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div 
                  className="absolute top-0 left-0 right-0 h-1.5 transition duration-300 group-hover:h-2" 
                  style={{ backgroundColor: color }}
                />

                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div 
                      className="h-12 w-12 rounded-xl flex items-center justify-center font-black text-lg text-white border border-white/10 shadow-lg"
                      style={{ backgroundColor: `${color}25`, borderColor: `${color}50` }}
                    >
                      {profile.name.charAt(0).toUpperCase()}
                    </div>

                    <button
                      type="button"
                      title="Διαγραφή Προφίλ"
                      disabled={isDeleting}
                      onClick={(e) => handleDelete(e, profile.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-destructive hover:bg-destructive/10 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="text-base font-extrabold text-white truncate group-hover:text-primary transition">
                    {profile.name}
                  </h3>
                  <p className="text-xs font-semibold text-primary truncate mt-0.5">
                    {profile.team_name}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate mt-1">
                    {profile.role}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-500 text-[10px]">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(profile.created_at || Date.now()).toLocaleDateString('el-GR')}</span>
                  </div>

                  <div className="flex items-center gap-1.5 font-bold text-white group-hover:text-primary transition">
                    <span>Είσοδος</span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {profiles.length === 0 && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold text-center max-w-md">
            👋 Καλώς ήρθατε! Δεν έχετε δημιουργήσει ακόμα κανένα προφίλ. Κάντε κλικ στο παραπάνω κουμπί για να ξεκινήσετε.
          </div>
        )}
      </main>

      {/* Create Profile Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-border p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Δημιουργία Νέου Προφίλ</h3>
                  <span className="text-[10px] text-zinc-400">Ρύθμιση ομάδας και επιλογή δεδομένων</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Όνομα Προφίλ / Workspace *
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="π.χ. Ανάλυση Κ19, Scouting Ακαδημίας"
                  className="w-full bg-zinc-900 border border-border px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Ομάδα / Club
                  </label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="π.χ. Greece U17, My FC"
                    className="w-full bg-zinc-900 border border-border px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Ρόλος
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-zinc-900 border border-border px-3.5 py-2 rounded-xl text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Color Theme */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Χρώμα Επισήμανσης
                </label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`h-7 w-7 rounded-full transition flex items-center justify-center border ${
                        selectedColor === c ? 'scale-110 border-white ring-2 ring-white/20' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {selectedColor === c && <Check className="h-3.5 w-3.5 text-black font-black" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                >
                  Ακύρωση
                </button>
                <button
                  type="submit"
                  disabled={creating || !profileName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green flex items-center gap-2 disabled:opacity-50"
                >
                  {creating ? (
                    <span>Δημιουργία...</span>
                  ) : (
                    <>
                      <span>Δημιουργία & Είσοδος</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 p-4 border-t border-border/40 text-center text-zinc-500 text-xs">
        Pitch Analytica Workspace Architecture • Πλήρης Απομόνωση Δεδομένων Ανά Προφίλ
      </footer>
    </div>
  );
}
