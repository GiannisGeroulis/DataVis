import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { opponentService, wyscoutService } from '../../lib/supabase';
import { OpponentTeam, GlobalOpponentTeam } from '../../types';
import { 
  Shield, 
  Plus, 
  Trash2, 
  ArrowRight, 
  FileSpreadsheet, 
  X, 
  Search,
  Globe,
  Download,
  Check,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface OpponentGridProps {
  onSelectTeam: (team: OpponentTeam) => void;
}

export default function OpponentGrid({ onSelectTeam }: OpponentGridProps) {
  const { activeProfile } = useAuth();
  const [teams, setTeams] = useState<OpponentTeam[]>([]);
  const [teamStats, setTeamStats] = useState<Record<string, { count: number; avgXg: number; avgPoss: number }>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState<'global' | 'manual'>('global');
  const [globalTeams, setGlobalTeams] = useState<GlobalOpponentTeam[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [importingTeamId, setImportingTeamId] = useState<string | null>(null);

  // Manual Creation State
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [league, setLeague] = useState('');
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');

  const loadTeams = async () => {
    setLoading(true);
    try {
      const list = await opponentService.getOpponentTeams();
      setTeams(list);

      // Load stats summary per team
      const statsMap: Record<string, { count: number; avgXg: number; avgPoss: number }> = {};
      for (const t of list) {
        const matches = await wyscoutService.getMatchesByTeam(t.id);
        const count = matches.length;
        const avgXg = count > 0 ? Math.round((matches.reduce((sum, m) => sum + m.xg, 0) / count) * 100) / 100 : 0;
        const avgPoss = count > 0 ? Math.round(matches.reduce((sum, m) => sum + m.possession, 0) / count) : 0;
        statsMap[t.id] = { count, avgXg, avgPoss };
      }
      setTeamStats(statsMap);
    } catch (err) {
      console.error("Failed to load opponent teams:", err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setShowModal(true);
    setModalTab('global');
    setGlobalSearchQuery('');
    loadGlobalTeams();
  };

  const loadGlobalTeams = async () => {
    setLoadingGlobal(true);
    try {
      const gList = await opponentService.getGlobalOpponentTeams();
      setGlobalTeams(gList);
    } catch (err) {
      console.error("Failed to load global opponent teams:", err);
    } finally {
      setLoadingGlobal(false);
    }
  };

  const handleImportGlobalTeam = async (gTeam: GlobalOpponentTeam) => {
    if (!activeProfile?.id) return;
    setImportingTeamId(gTeam.id);
    try {
      const result = await opponentService.importGlobalTeamToProfile(gTeam, activeProfile.id);
      await loadTeams();
      setShowModal(false);
      if (result.team) {
        onSelectTeam(result.team);
      }
    } catch (err) {
      console.error("Failed to import global team:", err);
    } finally {
      setImportingTeamId(null);
    }
  };

  const isTeamInProfile = (teamName: string) => {
    return teams.some(t => t.name.toLowerCase().trim() === teamName.toLowerCase().trim());
  };

  useEffect(() => {
    loadTeams();
  }, [activeProfile?.id]);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showModal]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await opponentService.saveOpponentTeam({
        id: `opp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        profile_id: activeProfile?.id || 'default_profile',
        name: name.trim(),
        logo_url: logoUrl.trim() || undefined,
        league: league.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setShowModal(false);
      setName('');
      setLogoUrl('');
      setLeague('');
      setCountry('');
      setNotes('');
      await loadTeams();
    } catch (err) {
      console.error("Failed to save team:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    if (window.confirm('Είστε βέβαιοι ότι θέλετε να διαγράψετε αυτή την ομάδα και όλους τους αγώνες Wyscout της;')) {
      await opponentService.deleteOpponentTeam(teamId);
      await loadTeams();
    }
  };

  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.league && t.league.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.country && t.country.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredGlobalTeams = globalTeams.filter(gt => 
    gt.name.toLowerCase().includes(globalSearchQuery.toLowerCase()) ||
    (gt.league && gt.league.toLowerCase().includes(globalSearchQuery.toLowerCase())) ||
    (gt.country && gt.country.toLowerCase().includes(globalSearchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
              Αντίπαλες Ομάδες & Scouting
            </h1>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase">
              Pro Analytics
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Επιλέξτε μια ομάδα για να ανεβάσετε δεδομένα αγώνων (Excel/CSV) και να εξερευνήσετε τα τακτικά γραφήματα και τις μετρικές της.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Αναζήτηση ομάδας..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900/90 border border-border pl-8 pr-3 py-1.5 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary w-48 sm:w-60"
            />
          </div>

          <button
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Νέα Ομάδα</span>
          </button>
        </div>
      </div>

      {/* Grid of Teams */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Φόρτωση αντίπαλων ομάδων...
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {/* Card 1: Add Opponent Trigger */}
          <button
            onClick={openModal}
            className="h-64 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-zinc-950/40 hover:bg-zinc-900/30 transition flex flex-col items-center justify-center p-6 group cursor-pointer text-center"
          >
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition duration-300">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider group-hover:text-primary transition">
              Προσθήκη Αντιπάλου
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1 max-w-[180px]">
              Δημιουργήστε νέο φάκελο ομάδας για εισαγωγή και ανάλυση αγώνων.
            </p>
          </button>

          {/* Opponent Team Cards */}
          {filteredTeams.map((team) => {
            const stats = teamStats[team.id] || { count: 0, avgXg: 0, avgPoss: 0 };

            return (
              <div
                key={team.id}
                onClick={() => onSelectTeam(team)}
                className="h-64 glass-panel rounded-2xl p-5 border border-border hover:border-primary/50 transition flex flex-col justify-between group cursor-pointer relative overflow-hidden"
              >
                {/* Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-emerald-400 group-hover:h-1.5 transition-all"></div>

                <div>
                  <div className="flex items-start justify-between mb-3">
                    {/* Team Badge */}
                    <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center text-primary font-black text-lg flex-shrink-0 shadow-md">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full bg-primary/10 text-primary">
                          <Shield className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      title="Διαγραφή Ομάδας"
                      onClick={(e) => handleDeleteTeam(e, team.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-destructive hover:bg-destructive/10 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Team Info */}
                  <h3 className="text-sm font-extrabold text-white truncate group-hover:text-primary transition">
                    {team.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {team.league && (
                      <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-900/90 px-2 py-0.5 rounded border border-border truncate max-w-[120px]">
                        {team.league}
                      </span>
                    )}
                    {team.country && (
                      <span className="text-[10px] text-zinc-400 truncate">
                        {team.country}
                      </span>
                    )}
                  </div>
                </div>

                {/* Team Wyscout Metrics Summary */}
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/60 text-center">
                    <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Αγώνες</span>
                      <span className="text-xs font-black text-white">{stats.count}</span>
                    </div>

                    <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Μ.Ο. xG</span>
                      <span className="text-xs font-black text-emerald-400">{stats.avgXg}</span>
                    </div>

                    <div className="bg-zinc-900/60 p-1.5 rounded-lg border border-border/40">
                      <span className="text-[9px] text-zinc-400 block uppercase font-bold">Κατοχή</span>
                      <span className="text-xs font-black text-white">{stats.avgPoss}%</span>
                    </div>
                  </div>

                  {/* Action Link */}
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-400 group-hover:text-primary transition pt-1">
                    <span className="text-[11px] uppercase tracking-wider flex items-center gap-1">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                      Τακτική Ανάλυση
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && teams.length === 0 && (
        <div className="text-center py-12 glass-panel rounded-2xl border border-border max-w-lg mx-auto p-8 space-y-4">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary inline-block">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase">Δεν υπάρχουν ακόμη αντίπαλες ομάδες</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
              Προσθέστε μια ομάδα για να εισαγάγετε αγώνες και να εξερευνήσετε την αναλυτική τακτική της παρουσίαση.
            </p>
          </div>
          <button
            onClick={openModal}
            className="px-5 py-2.5 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Προσθήκη Πρώτης Ομάδας</span>
          </button>
        </div>
      )}

      {/* Add Opponent Modal (Global Library & Manual Creation) */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-zinc-950 border border-zinc-700/80 shadow-2xl rounded-2xl w-full max-w-2xl relative max-h-[85vh] flex flex-col overflow-hidden my-auto text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Fixed at Top) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90 flex-shrink-0 z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Προσθήκη Αντίπαλης Ομάδας
                  </h3>
                  <span className="text-[11px] text-zinc-400">
                    Επιλέξτε από τη γενική βάση όλων των χρηστών ή δημιουργήστε νέα
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-white p-2 rounded-xl hover:bg-zinc-800 transition"
                title="Κλείσιμο (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation (Fixed under Header) */}
            <div className="px-6 pt-3 pb-2 bg-zinc-950 border-b border-zinc-800/60 flex-shrink-0">
              <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setModalTab('global')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                    modalTab === 'global'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Globe className="h-4 w-4" />
                  <span>Γενική Βάση Ομάδων</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    modalTab === 'global' ? 'bg-background/20 text-background' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {globalTeams.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalTab('manual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition ${
                    modalTab === 'manual'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  <span>Χειροκίνητη Δημιουργία</span>
                </button>
              </div>
            </div>

            {/* TAB 1: GLOBAL DATABASE */}
            {modalTab === 'global' && (
              <div className="p-6 pt-4 flex flex-col flex-1 min-h-0 space-y-3 overflow-hidden">
                {/* Search in Global DB */}
                <div className="relative flex-shrink-0">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Αναζήτηση στη γενική βάση βάσει ονόματος, χώρας ή διοργάνωσης..."
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    className="w-full bg-zinc-900/90 border border-zinc-800 pl-10 pr-4 py-2.5 rounded-xl text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Subtitle / Counter */}
                <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 flex-shrink-0">
                  <span>Διαθέσιμες ομάδες με καταγεγραμμένους αγώνες:</span>
                  <button
                    type="button"
                    onClick={loadGlobalTeams}
                    disabled={loadingGlobal}
                    className="text-primary hover:underline flex items-center gap-1 font-bold"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingGlobal ? 'animate-spin' : ''}`} />
                    Ανανέωση
                  </button>
                </div>

                {/* Global Teams List (Scrollable Area) */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0 custom-scrollbar">
                  {loadingGlobal ? (
                    <div className="flex flex-col items-center justify-center h-48 space-y-2">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                      <span className="text-xs text-zinc-400">Φόρτωση ομάδων από τη γενική βάση...</span>
                    </div>
                  ) : filteredGlobalTeams.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 space-y-2">
                      <p className="text-sm font-bold text-white">Δεν βρέθηκε ομάδα στη γενική βάση</p>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Δεν υπάρχει ομάδα που να ταιριάζει με την αναζήτησή σας. Μπορείτε να τη δημιουργήσετε στην καρτέλα «Χειροκίνητη Δημιουργία».
                      </p>
                      <button
                        type="button"
                        onClick={() => setModalTab('manual')}
                        className="mt-2 px-4 py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-700 transition"
                      >
                        Μετάβαση στη Χειροκίνητη Δημιουργία
                      </button>
                    </div>
                  ) : (
                    filteredGlobalTeams.map((gt) => {
                      const alreadyInProfile = isTeamInProfile(gt.name);
                      const isImporting = importingTeamId === gt.id;

                      return (
                        <div
                          key={gt.id}
                          className="bg-zinc-900/70 p-3.5 rounded-xl border border-zinc-800 hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-11 w-11 rounded-xl bg-zinc-950 border border-zinc-700 overflow-hidden flex items-center justify-center text-primary font-black flex-shrink-0 shadow-sm">
                              {gt.logo_url ? (
                                <img src={gt.logo_url} alt={gt.name} className="h-full w-full object-cover" />
                              ) : (
                                <Shield className="h-5 w-5" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs md:text-sm font-black text-white uppercase truncate">
                                  {gt.name}
                                </h4>
                                {gt.country && (
                                  <span className="text-[10px] text-zinc-400 font-semibold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 truncate">
                                    {gt.country}
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                                {gt.league ? `${gt.league} • ` : ''}
                                <span className="text-primary font-bold">{gt.matchCount || 0} Αγώνες</span>
                                {gt.avgXg ? ` • Μ.Ο. xG: ${gt.avgXg}` : ''}
                                {gt.avgPoss ? ` • Κατοχή: ${gt.avgPoss}%` : ''}
                              </p>
                              {(() => {
                                const cleanNotes = gt.notes?.replace(/<!--\s*WY_EXTRAS:[\s\S]*?-->/g, '').trim();
                                return cleanNotes ? (
                                  <p className="text-[10px] text-zinc-500 truncate mt-0.5 max-w-md italic">
                                    {cleanNotes}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                            {alreadyInProfile ? (
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                                  <Check className="h-3.5 w-3.5" />
                                  Στο Προφίλ σας
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowModal(false);
                                    const existing = teams.find(t => t.name.toLowerCase().trim() === gt.name.toLowerCase().trim());
                                    if (existing) onSelectTeam(existing);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-xs font-bold transition"
                                >
                                  Άνοιγμα
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isImporting}
                                onClick={() => handleImportGlobalTeam(gt)}
                                className="px-3.5 py-2 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green disabled:opacity-50 flex items-center gap-1.5"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Φόρτωση...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-3.5 w-3.5" />
                                    <span>Άμεση Φόρτωση</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MANUAL CREATION FORM */}
            {modalTab === 'manual' && (
              <form onSubmit={handleCreateTeam} className="p-6 pt-4 flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 custom-scrollbar">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                      Όνομα Ομάδας *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="π.χ. Ajax U19, Benfica, Juventus"
                      className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                      URL Εικόνας / Logo (Προαιρετικό)
                    </label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://.../logo.png"
                      className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                        Πρωτάθλημα / Διοργάνωση
                      </label>
                      <input
                        type="text"
                        value={league}
                        onChange={(e) => setLeague(e.target.value)}
                        placeholder="π.χ. UEFA U17 Qual."
                        className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                        Χώρα
                      </label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="π.χ. Norway"
                        className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                      Σημειώσεις Scouting
                    </label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Τακτικά σχόλια, αδυναμίες..."
                      className="w-full bg-zinc-900 border border-zinc-800 px-3.5 py-2 rounded-xl text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-zinc-800 flex items-center justify-end gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  >
                    Ακύρωση
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="px-5 py-2 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {saving ? 'Αποθήκευση...' : 'Προσθήκη Ομάδας'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
