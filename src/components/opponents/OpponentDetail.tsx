import React, { useState, useEffect } from 'react';
import { OpponentTeam, WyscoutMatch } from '../../types';
import { wyscoutService } from '../../lib/supabase';
import { 
  ArrowLeft, 
  Upload, 
  FileSpreadsheet, 
  BarChart3, 
  Calendar, 
  Target, 
  Activity, 
  Shield, 
  Sparkles, 
  Trash2, 
  X, 
  Layers,
  ChevronRight,
  Compass,
  Zap,
  Gauge,
  Timer,
  Crosshair,
  ShieldAlert,
  TrendingUp,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  Line, 
  ComposedChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

interface OpponentDetailProps {
  team: OpponentTeam;
  onBack: () => void;
}

type DetailTab = 'analytics' | 'matches' | 'upload';
type CategoryTab = 'overview' | 'attacking' | 'defending' | 'passing' | 'indices';

const SCHEME_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

export default function OpponentDetail({ team, onBack }: OpponentDetailProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('analytics');
  const [activeCategoryTab, setActiveCategoryTab] = useState<CategoryTab>('overview');
  
  // Match Selection: 'all' for aggregate view, or specific match.id
  const [selectedMatchId, setSelectedMatchId] = useState<string | 'all'>('all');
  const [matches, setMatches] = useState<WyscoutMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // File Upload State
  const [uploadLoading, setUploadLoading] = useState(false);
  const [previewMatches, setPreviewMatches] = useState<WyscoutMatch[]>([]);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await wyscoutService.getMatchesByTeam(team.id);
      setMatches(data);
    } catch (err) {
      console.error("Failed to load Wyscout matches:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, [team.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileList = Array.from(e.target.files);

    setUploadLoading(true);
    setUploadFeedback({ type: null, message: '' });

    try {
      const { matches: parsed, errors, filesProcessed } = await wyscoutService.parseMultipleWyscoutFiles(fileList, team.id, team.name);
      if (errors.length > 0 && parsed.length === 0) {
        setUploadFeedback({ type: 'error', message: errors.join('. ') });
        setPreviewMatches([]);
      } else {
        setPreviewMatches(parsed);
        const errNotice = errors.length > 0 ? ` (Προειδοποιήσεις: ${errors.join(', ')})` : '';
        setUploadFeedback({
          type: 'success',
          message: `Επεξεργάστηκαν ${filesProcessed} αρχεία Wyscout! Αναγνωρίστηκαν ${parsed.length} αγώνες με συγχωνευμένα στατιστικά. Ελέγξτε την προεπισκόπηση και πατήστε Αποθήκευση.${errNotice}`
        });
      }
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: `Σφάλμα ανάγνωσης αρχείων: ${err.message || err}` });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleSaveParsedMatches = async () => {
    if (previewMatches.length === 0) return;
    setUploadLoading(true);
    try {
      await wyscoutService.saveMatches(previewMatches);
      setPreviewMatches([]);
      setUploadFeedback({
        type: 'success',
        message: 'Όλοι οι αγώνες αποθηκεύτηκαν επιτυχώς στη βάση του προφίλ σας!'
      });
      await loadMatches();
      setActiveTab('analytics');
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: 'Σφάλμα κατά την αποθήκευση στη βάση.' });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteMatch = async (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    if (window.confirm('Διαγραφή αυτού του αγώνα;')) {
      await wyscoutService.deleteMatch(matchId, team.id);
      await loadMatches();
      if (selectedMatchId === matchId) {
        setSelectedMatchId('all');
      }
    }
  };

  // Selected Match object
  const selectedMatch = selectedMatchId !== 'all' ? (matches.find(m => m.id === selectedMatchId) || null) : null;
  const isSingleMatch = selectedMatch !== null;

  // ==========================================
  // AGGREGATE METRICS CALCULATIONS (Across all matches)
  // ==========================================
  const totalMatches = matches.length;

  // OVERVIEW AGGREGATES
  const avgXg = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.xg || 0), 0) / totalMatches) * 100) / 100 : 0;
  const avgGoals = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.goals || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgPossession = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.possession || 50), 0) / totalMatches) : 0;
  const avgShots = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.shots || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgShotsOT = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.shots_on_target || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgPassAccuracy = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.passing_accuracy || 0), 0) / totalMatches) : 0;
  const avgDuelsWonPct = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.duels_won_pct || 0), 0) / totalMatches) : 0;

  // ATTACKING AGGREGATES
  const attackingMatches = matches.filter(m => (m.positional_attacks ?? 0) > 0 || (m.counterattacks ?? 0) > 0 || (m.crosses ?? 0) > 0);
  const nAtt = attackingMatches.length || 1;
  const avgPositional = Math.round((attackingMatches.reduce((s, m) => s + (m.positional_attacks || 0), 0) / nAtt) * 10) / 10;
  const avgPositionalShots = Math.round((attackingMatches.reduce((s, m) => s + (m.positional_attacks_shots || 0), 0) / nAtt) * 10) / 10;
  const avgPositionalPct = avgPositional > 0 ? Math.round((avgPositionalShots / avgPositional) * 100) : 0;
  const avgCounter = Math.round((attackingMatches.reduce((s, m) => s + (m.counterattacks || 0), 0) / nAtt) * 10) / 10;
  const avgCounterShots = Math.round((attackingMatches.reduce((s, m) => s + (m.counterattacks_shots || 0), 0) / nAtt) * 10) / 10;
  const avgCounterPct = avgCounter > 0 ? Math.round((avgCounterShots / avgCounter) * 100) : 0;
  const avgCrosses = Math.round((attackingMatches.reduce((s, m) => s + (m.crosses || 0), 0) / nAtt) * 10) / 10;
  const avgCrossesAcc = Math.round((attackingMatches.reduce((s, m) => s + (m.crosses_accurate || 0), 0) / nAtt) * 10) / 10;
  const avgCrossesAccPct = avgCrosses > 0 ? Math.round((avgCrossesAcc / avgCrosses) * 100) : 0;
  const avgOffDuels = Math.round((attackingMatches.reduce((s, m) => s + (m.offensive_duels || 0), 0) / nAtt) * 10) / 10;
  const avgOffDuelsWon = Math.round((attackingMatches.reduce((s, m) => s + (m.offensive_duels_won || 0), 0) / nAtt) * 10) / 10;
  const avgOffDuelsWonPct = avgOffDuels > 0 ? Math.round((avgOffDuelsWon / avgOffDuels) * 100) : 0;
  const avgCorners = Math.round((attackingMatches.reduce((s, m) => s + (m.corners || 0), 0) / nAtt) * 10) / 10;
  const avgCornersShots = Math.round((attackingMatches.reduce((s, m) => s + (m.corners_shots || 0), 0) / nAtt) * 10) / 10;

  // DEFENDING AGGREGATES
  const defendingMatches = matches.filter(m => (m.defensive_duels ?? 0) > 0 || (m.conceded_goals ?? 0) > 0 || (m.interceptions ?? 0) > 0);
  const nDef = defendingMatches.length || 1;
  const avgConcededGoals = Math.round((defendingMatches.reduce((s, m) => s + (m.conceded_goals ?? m.opponent_goals ?? 0), 0) / nDef) * 10) / 10;
  const avgShotsAgainst = Math.round((defendingMatches.reduce((s, m) => s + (m.shots_against ?? m.opponent_shots ?? 0), 0) / nDef) * 10) / 10;
  const avgShotsAgainstOT = Math.round((defendingMatches.reduce((s, m) => s + (m.shots_against_on_target ?? 0), 0) / nDef) * 10) / 10;
  const avgDefDuels = Math.round((defendingMatches.reduce((s, m) => s + (m.defensive_duels || 0), 0) / nDef) * 10) / 10;
  const avgDefDuelsWon = Math.round((defendingMatches.reduce((s, m) => s + (m.defensive_duels_won || 0), 0) / nDef) * 10) / 10;
  const avgDefDuelsWonPct = avgDefDuels > 0 ? Math.round((avgDefDuelsWon / avgDefDuels) * 100) : 0;
  const avgAerialDuels = Math.round((defendingMatches.reduce((s, m) => s + (m.aerial_duels || 0), 0) / nDef) * 10) / 10;
  const avgAerialDuelsWon = Math.round((defendingMatches.reduce((s, m) => s + (m.aerial_duels_won || 0), 0) / nDef) * 10) / 10;
  const avgAerialDuelsWonPct = avgAerialDuels > 0 ? Math.round((avgAerialDuelsWon / avgAerialDuels) * 100) : 0;
  const avgInterceptions = Math.round((defendingMatches.reduce((s, m) => s + (m.interceptions || 0), 0) / nDef) * 10) / 10;
  const avgClearances = Math.round((defendingMatches.reduce((s, m) => s + (m.clearances || 0), 0) / nDef) * 10) / 10;
  const avgFouls = Math.round((defendingMatches.reduce((s, m) => s + (m.fouls || 0), 0) / nDef) * 10) / 10;

  // PASSING AGGREGATES
  const passingMatches = matches.filter(m => (m.forward_passes ?? 0) > 0 || (m.passes ?? 0) > 0);
  const nPass = passingMatches.length || 1;
  const avgPasses = Math.round((passingMatches.reduce((s, m) => s + (m.passes || 0), 0) / nPass));
  const avgForwardPasses = Math.round((passingMatches.reduce((s, m) => s + (m.forward_passes || 0), 0) / nPass) * 10) / 10;
  const avgForwardPassesAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.forward_passes_pct || 0), 0) / nPass);
  const avgProgressive = Math.round((passingMatches.reduce((s, m) => s + (m.progressive_passes || 0), 0) / nPass) * 10) / 10;
  const avgFinalThird = Math.round((passingMatches.reduce((s, m) => s + (m.passes_to_final_third || 0), 0) / nPass) * 10) / 10;
  const avgSmartPasses = Math.round((passingMatches.reduce((s, m) => s + (m.smart_passes || 0), 0) / nPass) * 10) / 10;
  const avgLongPasses = Math.round((passingMatches.reduce((s, m) => s + (m.long_passes || 0), 0) / nPass) * 10) / 10;

  // INDICES AGGREGATES
  const indicesMatches = matches.filter(m => (m.ppda ?? 0) > 0 || (m.match_tempo ?? 0) > 0);
  const nIdx = indicesMatches.length || 1;
  const avgPpda = Math.round((indicesMatches.reduce((s, m) => s + (m.ppda || 0), 0) / nIdx) * 10) / 10;
  const avgTempo = Math.round((indicesMatches.reduce((s, m) => s + (m.match_tempo || 0), 0) / nIdx) * 10) / 10;
  const avgPassesPerPoss = Math.round((indicesMatches.reduce((s, m) => s + (m.avg_passes_per_possession || 0), 0) / nIdx) * 10) / 10;
  const avgShotDist = Math.round((indicesMatches.reduce((s, m) => s + (m.avg_shot_distance || 0), 0) / nIdx) * 10) / 10;
  const avgPassLen = Math.round((indicesMatches.reduce((s, m) => s + (m.avg_pass_length || 0), 0) / nIdx) * 10) / 10;

  // ==========================================
  // DYNAMIC DISPLAY METRICS (Single Match vs Aggregate)
  // ==========================================
  // Overview Tab KPIs
  const displayXg = isSingleMatch ? selectedMatch.xg : avgXg;
  const displayGoals = isSingleMatch ? selectedMatch.goals : avgGoals;
  const displayPossession = isSingleMatch ? selectedMatch.possession : avgPossession;
  const displayShots = isSingleMatch ? selectedMatch.shots : avgShots;
  const displayShotsOT = isSingleMatch ? selectedMatch.shots_on_target : avgShotsOT;
  const displayPassAccuracy = isSingleMatch ? selectedMatch.passing_accuracy : avgPassAccuracy;
  const displayDuelsWonPct = isSingleMatch ? selectedMatch.duels_won_pct : avgDuelsWonPct;

  // Attacking Tab KPIs
  const displayPositional = isSingleMatch ? (selectedMatch.positional_attacks ?? 0) : avgPositional;
  const displayPositionalShots = isSingleMatch ? (selectedMatch.positional_attacks_shots ?? 0) : avgPositionalShots;
  const displayPositionalPct = isSingleMatch 
    ? (displayPositional > 0 ? Math.round((displayPositionalShots / displayPositional) * 100) : 0)
    : avgPositionalPct;
  const displayCounter = isSingleMatch ? (selectedMatch.counterattacks ?? 0) : avgCounter;
  const displayCounterShots = isSingleMatch ? (selectedMatch.counterattacks_shots ?? 0) : avgCounterShots;
  const displayCounterPct = isSingleMatch
    ? (displayCounter > 0 ? Math.round((displayCounterShots / displayCounter) * 100) : 0)
    : avgCounterPct;
  const displayCrosses = isSingleMatch ? (selectedMatch.crosses ?? 0) : avgCrosses;
  const displayCrossesAcc = isSingleMatch ? (selectedMatch.crosses_accurate ?? 0) : avgCrossesAcc;
  const displayCrossesAccPct = isSingleMatch
    ? (selectedMatch.crosses_acc_pct ?? (displayCrosses > 0 ? Math.round((displayCrossesAcc / displayCrosses) * 100) : 0))
    : avgCrossesAccPct;
  const displayOffDuels = isSingleMatch ? (selectedMatch.offensive_duels ?? 0) : avgOffDuels;
  const displayOffDuelsWon = isSingleMatch ? (selectedMatch.offensive_duels_won ?? 0) : avgOffDuelsWon;
  const displayOffDuelsWonPct = isSingleMatch
    ? (selectedMatch.offensive_duels_won_pct ?? (displayOffDuels > 0 ? Math.round((displayOffDuelsWon / displayOffDuels) * 100) : 0))
    : avgOffDuelsWonPct;
  const displayCorners = isSingleMatch ? (selectedMatch.corners ?? 0) : avgCorners;
  const displayCornersShots = isSingleMatch ? (selectedMatch.corners_shots ?? 0) : avgCornersShots;

  // Defending Tab KPIs
  const displayConcededGoals = isSingleMatch ? (selectedMatch.conceded_goals ?? selectedMatch.opponent_goals ?? 0) : avgConcededGoals;
  const displayShotsAgainst = isSingleMatch ? (selectedMatch.shots_against ?? selectedMatch.opponent_shots ?? 0) : avgShotsAgainst;
  const displayShotsAgainstOT = isSingleMatch ? (selectedMatch.shots_against_on_target ?? 0) : avgShotsAgainstOT;
  const displayDefDuels = isSingleMatch ? (selectedMatch.defensive_duels ?? 0) : avgDefDuels;
  const displayDefDuelsWon = isSingleMatch ? (selectedMatch.defensive_duels_won ?? 0) : avgDefDuelsWon;
  const displayDefDuelsWonPct = isSingleMatch
    ? (selectedMatch.defensive_duels_won_pct ?? (displayDefDuels > 0 ? Math.round((displayDefDuelsWon / displayDefDuels) * 100) : 0))
    : avgDefDuelsWonPct;
  const displayAerialDuels = isSingleMatch ? (selectedMatch.aerial_duels ?? 0) : avgAerialDuels;
  const displayAerialDuelsWon = isSingleMatch ? (selectedMatch.aerial_duels_won ?? 0) : avgAerialDuelsWon;
  const displayAerialDuelsWonPct = isSingleMatch
    ? (selectedMatch.aerial_duels_won_pct ?? (displayAerialDuels > 0 ? Math.round((displayAerialDuelsWon / displayAerialDuels) * 100) : 0))
    : avgAerialDuelsWonPct;
  const displayInterceptions = isSingleMatch ? (selectedMatch.interceptions ?? 0) : avgInterceptions;
  const displayClearances = isSingleMatch ? (selectedMatch.clearances ?? 0) : avgClearances;
  const displayFouls = isSingleMatch ? (selectedMatch.fouls ?? 0) : avgFouls;

  // Passing Tab KPIs
  const displayPasses = isSingleMatch ? (selectedMatch.passes ?? 0) : avgPasses;
  const displayForwardPasses = isSingleMatch ? (selectedMatch.forward_passes ?? 0) : avgForwardPasses;
  const displayForwardPassesAcc = isSingleMatch ? (selectedMatch.forward_passes_acc ?? 0) : 0;
  const displayForwardPassesAccPct = isSingleMatch
    ? (selectedMatch.forward_passes_pct ?? (displayForwardPasses > 0 ? Math.round((displayForwardPassesAcc / displayForwardPasses) * 100) : 0))
    : avgForwardPassesAccPct;
  const displayProgressive = isSingleMatch ? (selectedMatch.progressive_passes ?? 0) : avgProgressive;
  const displayFinalThird = isSingleMatch ? (selectedMatch.passes_to_final_third ?? 0) : avgFinalThird;
  const displaySmartPasses = isSingleMatch ? (selectedMatch.smart_passes ?? 0) : avgSmartPasses;
  const displayLongPasses = isSingleMatch ? (selectedMatch.long_passes ?? 0) : avgLongPasses;

  // Indices Tab KPIs
  const displayPpda = isSingleMatch ? (selectedMatch.ppda ?? 0) : avgPpda;
  const displayTempo = isSingleMatch ? (selectedMatch.match_tempo ?? 0) : avgTempo;
  const displayPassesPerPoss = isSingleMatch ? (selectedMatch.avg_passes_per_possession ?? 0) : avgPassesPerPoss;
  const displayShotDist = isSingleMatch ? (selectedMatch.avg_shot_distance ?? 0) : avgShotDist;
  const displayPassLen = isSingleMatch ? (selectedMatch.avg_pass_length ?? 0) : avgPassLen;

  // Dynamic Zones Data (Single Match vs Overall Average)
  const dynamicZoneData = [
    {
      zone: 'Low (Αμυντική Ζώνη)',
      Losses: isSingleMatch ? (selectedMatch.losses_low ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_low || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch.recoveries_low ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_low || 0), 0) / totalMatches) : 0),
    },
    {
      zone: 'Medium (Κέντρο)',
      Losses: isSingleMatch ? (selectedMatch.losses_med ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_med || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch.recoveries_med ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_med || 0), 0) / totalMatches) : 0),
    },
    {
      zone: 'High (Επιθετική Ζώνη)',
      Losses: isSingleMatch ? (selectedMatch.losses_high ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_high || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch.recoveries_high ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_high || 0), 0) / totalMatches) : 0),
    },
  ];

  // ==========================================
  // SINGLE-MATCH SPECIFIC CHARTS DATA
  // ==========================================
  // 1. Overview Single Match: Team vs Opponent (Separate individual bars)
  const h2hMetrics = isSingleMatch ? [
    { label: 'Expected Goals (xG)', teamVal: selectedMatch.xg, oppVal: selectedMatch.opponent_xg ?? 0, decimals: 2, higherIsBetter: true },
    { label: 'Πραγματικά Γκολ', teamVal: selectedMatch.goals, oppVal: selectedMatch.opponent_goals ?? selectedMatch.conceded_goals ?? 0, decimals: 0, higherIsBetter: true },
    { label: 'Τελικές Προσπάθειες', teamVal: selectedMatch.shots, oppVal: selectedMatch.opponent_shots ?? selectedMatch.shots_against ?? 0, decimals: 0, higherIsBetter: true },
    { label: 'Τελικές στην Εστία', teamVal: selectedMatch.shots_on_target, oppVal: selectedMatch.shots_against_on_target ?? 0, decimals: 0, higherIsBetter: true },
    { label: 'Κατοχή Μπάλας (%)', teamVal: selectedMatch.possession, oppVal: selectedMatch.opponent_possession ?? (100 - selectedMatch.possession), unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Ακρίβεια Μεταβιβάσεων (%)', teamVal: selectedMatch.passing_accuracy, oppVal: avgPassAccuracy, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Κερδισμένες Μονομαχίες (%)', teamVal: selectedMatch.duels_won_pct, oppVal: 100 - selectedMatch.duels_won_pct, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Αμυντικές Μονομαχίες Won (%)', teamVal: selectedMatch.defensive_duels_won_pct ?? 0, oppVal: avgDefDuelsWonPct, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Εναέριες Μονομαχίες Won (%)', teamVal: selectedMatch.aerial_duels_won_pct ?? 0, oppVal: avgAerialDuelsWonPct, unit: '%', decimals: 0, higherIsBetter: true },
  ] : [];

  // 2. Overview Single Match: Match vs Season Average (Separate individual bars)
  const matchVsAvgMetrics = isSingleMatch ? [
    { label: 'Expected Goals (xG)', matchVal: selectedMatch.xg, avgVal: avgXg, decimals: 2, higherIsBetter: true },
    { label: 'Πραγματικά Γκολ', matchVal: selectedMatch.goals, avgVal: avgGoals, decimals: 1, higherIsBetter: true },
    { label: 'Τελικές Προσπάθειες', matchVal: selectedMatch.shots, avgVal: avgShots, decimals: 1, higherIsBetter: true },
    { label: 'Τελικές στην Εστία', matchVal: selectedMatch.shots_on_target, avgVal: avgShotsOT, decimals: 1, higherIsBetter: true },
    { label: 'Κατοχή Μπάλας (%)', matchVal: selectedMatch.possession, avgVal: avgPossession, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Ακρίβεια Μεταβιβάσεων (%)', matchVal: selectedMatch.passing_accuracy, avgVal: avgPassAccuracy, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'Κερδισμένες Μονομαχίες (%)', matchVal: selectedMatch.duels_won_pct, avgVal: avgDuelsWonPct, unit: '%', decimals: 0, higherIsBetter: true },
    { label: 'PPDA (Ένταση Πίεσης)', matchVal: selectedMatch.ppda ?? 0, avgVal: avgPpda, decimals: 1, higherIsBetter: false },
    { label: 'Match Tempo (Πάσες/λεπτό)', matchVal: selectedMatch.match_tempo ?? 0, avgVal: avgTempo, decimals: 1, higherIsBetter: true },
  ] : [];

  // 3. Attacking Single Match: Positional vs Counters Breakdown
  const singleMatchAttackingTypes = isSingleMatch ? [
    { type: 'Σετ Επιθέσεις', Total: selectedMatch.positional_attacks ?? 0, withShots: selectedMatch.positional_attacks_shots ?? 0 },
    { type: 'Αντεπιθέσεις', Total: selectedMatch.counterattacks ?? 0, withShots: selectedMatch.counterattacks_shots ?? 0 },
    { type: 'Κόρνερ', Total: selectedMatch.corners ?? 0, withShots: selectedMatch.corners_shots ?? 0 },
  ] : [];

  const singleMatchCrossesDuels = isSingleMatch ? [
    { name: 'Σέντρες', Total: selectedMatch.crosses ?? 0, Accurate: selectedMatch.crosses_accurate ?? 0, Rate: selectedMatch.crosses_acc_pct ?? 0 },
    { name: 'Επιθ. Μονομαχίες', Total: selectedMatch.offensive_duels ?? 0, Accurate: selectedMatch.offensive_duels_won ?? 0, Rate: selectedMatch.offensive_duels_won_pct ?? 0 },
  ] : [];

  // 4. Defending Single Match: Duels & Actions
  const singleMatchDefDuels = isSingleMatch ? [
    { type: 'Αμυντικές', Won: selectedMatch.defensive_duels_won ?? 0, Total: selectedMatch.defensive_duels ?? 0, Rate: selectedMatch.defensive_duels_won_pct ?? 0 },
    { type: 'Εναέριες', Won: selectedMatch.aerial_duels_won ?? 0, Total: selectedMatch.aerial_duels ?? 0, Rate: selectedMatch.aerial_duels_won_pct ?? 0 },
    { type: 'Τάκλιν (Sliding)', Won: selectedMatch.sliding_tackles_succ ?? 0, Total: selectedMatch.sliding_tackles ?? 0, Rate: selectedMatch.sliding_tackles_succ_pct ?? 0 },
  ] : [];

  const singleMatchDefActions = isSingleMatch ? [
    { action: 'Interceptions', count: selectedMatch.interceptions ?? 0 },
    { action: 'Clearances', count: selectedMatch.clearances ?? 0 },
    { action: 'Φάουλ', count: selectedMatch.fouls ?? 0 },
    { action: 'Τελικές Αντιπάλου', count: selectedMatch.shots_against ?? selectedMatch.opponent_shots ?? 0 },
    { action: 'Στην Εστία (Κατά)', count: selectedMatch.shots_against_on_target ?? 0 },
    { action: 'Δεχθέντα Γκολ', count: selectedMatch.conceded_goals ?? selectedMatch.opponent_goals ?? 0 },
  ] : [];

  // 5. Passing Single Match: Direction & Progression
  const singleMatchPassDirection = isSingleMatch ? [
    { direction: 'Forward (Μπροστά)', count: selectedMatch.forward_passes ?? 0, accurate: selectedMatch.forward_passes_acc ?? 0 },
    { direction: 'Lateral (Πλάγια)', count: selectedMatch.lateral_passes ?? 0, accurate: selectedMatch.lateral_passes_acc ?? 0 },
    { direction: 'Back (Πίσω)', count: selectedMatch.back_passes ?? 0, accurate: selectedMatch.back_passes_acc ?? 0 },
    { direction: 'Long (Μακρινές)', count: selectedMatch.long_passes ?? 0, accurate: selectedMatch.long_passes_acc ?? 0 },
  ] : [];

  const singleMatchProgression = isSingleMatch ? [
    { type: 'Progressive Passes', total: selectedMatch.progressive_passes ?? 0, accurate: selectedMatch.progressive_passes_acc ?? 0 },
    { type: 'Passes to Final Third', total: selectedMatch.passes_to_final_third ?? 0, accurate: selectedMatch.passes_to_final_third_acc ?? 0 },
    { type: 'Smart Passes', total: selectedMatch.smart_passes ?? 0, accurate: selectedMatch.smart_passes_acc ?? 0 },
  ] : [];

  // 6. Indices Single Match: Tactical Comparison
  const singleMatchIndicesComparison = isSingleMatch ? [
    { metric: 'PPDA (Πίεση)', Match: selectedMatch.ppda ?? 0, SeasonAvg: avgPpda },
    { metric: 'Tempo (Πάσες/λεπτό)', Match: selectedMatch.match_tempo ?? 0, SeasonAvg: avgTempo },
    { metric: 'Πάσες / Κατοχή', Match: selectedMatch.avg_passes_per_possession ?? 0, SeasonAvg: avgPassesPerPoss },
    { metric: 'Απόσταση Σουτ (m)', Match: selectedMatch.avg_shot_distance ?? 0, SeasonAvg: avgShotDist },
    { metric: 'Μήκος Πάσας (m)', Match: selectedMatch.avg_pass_length ?? 0, SeasonAvg: avgPassLen },
  ] : [];

  // ==========================================
  // TIMELINE CHARTS DATA (For All Matches)
  // ==========================================
  const chronologicalMatches = [...matches].reverse();

  // Helper to extract clean opponent name from fixture string
  const getOpponent = (matchName: string) => {
    const cleanMatch = matchName.replace(/\s*\d+\s*[:\-]\s*\d+\s*$/, '').trim();
    const parts = cleanMatch.split(/\s*-\s*|\s*vs\.?\s*/i);
    if (parts.length >= 2) {
      const p0 = parts[0].trim();
      const p1 = parts[1].trim();
      const tName = team.name.toLowerCase();
      if (p0.toLowerCase().includes(tName) || tName.includes(p0.toLowerCase())) {
        return p1;
      }
      return p0;
    }
    return cleanMatch;
  };

  const overviewTimelineData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 10),
    goals: m.goals,
    xg: m.xg,
    possession: m.possession,
    shots: m.shots,
    shotsOnTarget: m.shots_on_target,
    passAccuracy: m.passing_accuracy,
    duelsWonPct: m.duels_won_pct,
    isSelected: m.id === selectedMatchId
  }));

  const attackingChartData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 8),
    positional: m.positional_attacks || 0,
    positionalShots: m.positional_attacks_shots || 0,
    counter: m.counterattacks || 0,
    counterShots: m.counterattacks_shots || 0,
    crosses: m.crosses || 0,
    crossesAccPct: m.crosses_acc_pct || 0,
    offDuelsWonPct: m.offensive_duels_won_pct || 0,
    isSelected: m.id === selectedMatchId
  }));

  const defendingChartData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 8),
    conceded: m.conceded_goals ?? m.opponent_goals ?? 0,
    shotsAgainst: m.shots_against ?? m.opponent_shots ?? 0,
    shotsAgainstOT: m.shots_against_on_target ?? 0,
    defDuelsPct: m.defensive_duels_won_pct || 0,
    aerialPct: m.aerial_duels_won_pct || 0,
    interceptions: m.interceptions || 0,
    clearances: m.clearances || 0,
    isSelected: m.id === selectedMatchId
  }));

  const passingChartData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 8),
    forward: m.forward_passes || 0,
    back: m.back_passes || 0,
    lateral: m.lateral_passes || 0,
    progressive: m.progressive_passes || 0,
    finalThird: m.passes_to_final_third || 0,
    smart: m.smart_passes || 0,
    long: m.long_passes || 0,
    isSelected: m.id === selectedMatchId
  }));

  const indicesChartData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 8),
    ppda: m.ppda || 0,
    tempo: m.match_tempo || 0,
    passesPerPoss: m.avg_passes_per_possession || 0,
    shotDist: m.avg_shot_distance || 0,
    passLength: m.avg_pass_length || 0,
    isSelected: m.id === selectedMatchId
  }));

  // Reusable Custom Tooltip displaying Opponent, Date & Metrics on hover
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const opponent = data.opponent || data.fullMatch || 'Αντίπαλος';
      return (
        <div className="p-3 rounded-xl bg-zinc-950/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[210px]">
          <div className="border-b border-zinc-800 pb-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Αντίπαλος:</span>
              <span className="text-[10px] text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                {data.fullDate || data.date}
              </span>
            </div>
            <p className="font-black text-white text-sm mt-0.5">
              {opponent}
            </p>
            {data.fullMatch && (
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                {data.fullMatch}
              </p>
            )}
          </div>
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-medium" style={{ color: entry.color || '#a1a1aa' }}>
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color || '#a1a1aa' }} />
                  <span className="truncate max-w-[130px]">{entry.name}:</span>
                </span>
                <span className="font-black text-white">
                  {entry.value !== undefined ? (typeof entry.value === 'number' && !Number.isInteger(entry.value) ? entry.value.toFixed(2) : entry.value) : '-'}
                  {entry.unit || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  // Formations Pie Data (All Matches)
  const formationMap: Record<string, number> = {};
  matches.forEach(m => {
    const s = m.scheme || '4-3-3';
    formationMap[s] = (formationMap[s] || 0) + 1;
  });
  const formationData = Object.entries(formationMap).map(([name, value]) => ({ name, value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Φόρτωση δεδομένων Wyscout...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Navigation & Team Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/80">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-xl bg-zinc-900 border border-border text-zinc-400 hover:text-white hover:border-zinc-700 transition"
            title="Επιστροφή σε όλες τις ομάδες"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden flex items-center justify-center text-primary font-black shadow-md flex-shrink-0">
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} className="h-full w-full object-cover" />
              ) : (
                <Shield className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                  {team.name}
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase">
                  {totalMatches} Αγώνες Wyscout
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {team.league ? `${team.league} • ` : ''}{team.country || 'Scouting Profile'}
              </p>
            </div>
          </div>
        </div>

        {/* Top Tab Controls */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-zinc-900/90 border border-border">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'analytics'
                ? 'bg-primary text-background shadow-glow-green'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Ανάλυση Data</span>
          </button>

          <button
            onClick={() => setActiveTab('matches')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'matches'
                ? 'bg-primary text-background shadow-glow-green'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Λίστα Αγώνων ({totalMatches})</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === 'upload'
                ? 'bg-primary text-background shadow-glow-green'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Ανέβασμα Wyscout</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DATA VISUALISATION (Συνολικά ή Ανά Αγώνα) */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {totalMatches === 0 ? (
            <div className="text-center py-16 glass-panel rounded-2xl border border-border max-w-lg mx-auto p-8 space-y-4">
              <div className="p-3 rounded-2xl bg-primary/10 text-primary inline-block">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white uppercase">Δεν υπάρχουν ακόμη δεδομένα Wyscout</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  Ανεβάστε τα πραγματικά αρχεία Excel ή CSV (Επίθεση, Άμυνα, Πάσες, PPDA) από το Wyscout για αυτή την ομάδα.
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-5 py-2.5 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  <span>Ανέβασμα Αρχείων Wyscout</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* MATCH SELECTOR BAR (Αλλαγή από Συνολικά σε Συγκεκριμένο Αγώνα χωρίς pop-up) */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/90 border border-border">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isSingleMatch ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-zinc-800 text-zinc-300'}`}>
                    <Filter className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                      Επιλογή Πεδίου Δεδομένων
                    </span>
                    <span className="text-xs font-black text-white">
                      {isSingleMatch 
                        ? `Μεμονωμένος Αγώνας: ${selectedMatch.match_name}` 
                        : `Όλοι οι Αγώνες (${totalMatches}) - Γενικά Συγκεντρωτικά Στατιστικά`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedMatchId}
                    onChange={(e) => setSelectedMatchId(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-border text-xs font-bold text-white focus:outline-none focus:border-primary cursor-pointer w-full sm:w-auto"
                  >
                    <option value="all">🌐 Όλοι οι Αγώνες ({totalMatches} ματς - Συνολικά)</option>
                    {matches.map((m) => (
                      <option key={m.id} value={m.id}>
                        ⚽ {m.date} | {m.match_name} ({m.goals}{m.opponent_goals !== undefined ? `-${m.opponent_goals}` : ''})
                      </option>
                    ))}
                  </select>

                  {isSingleMatch && (
                    <button
                      onClick={() => setSelectedMatchId('all')}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0"
                      title="Επαναφορά σε όλους τους αγώνες"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Όλοι οι Αγώνες</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Single Match Active Info Banner */}
              {isSingleMatch && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 via-zinc-900 to-zinc-900 border border-primary/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-primary/40 flex flex-col items-center justify-center text-primary font-black flex-shrink-0">
                      <span className="text-base leading-none">{selectedMatch.goals}</span>
                      <span className="text-[9px] text-zinc-400 leading-none mt-0.5">
                        {selectedMatch.opponent_goals !== undefined ? `vs ${selectedMatch.opponent_goals}` : 'γκολ'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30 uppercase">
                          Επιλεγμένος Αγώνας
                        </span>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">
                          {selectedMatch.date} • {selectedMatch.competition}
                        </span>
                      </div>
                      <h2 className="text-base font-black text-white mt-0.5">
                        {selectedMatch.match_name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-400 mt-1">
                        <span>Σύστημα: <strong className="text-primary">{selectedMatch.scheme}</strong></span>
                        <span>•</span>
                        <span>Διάρκεια: <strong className="text-white">{selectedMatch.duration}'</strong></span>
                        <span>•</span>
                        <span>xG: <strong className="text-emerald-400">{selectedMatch.xg}</strong></span>
                        <span>•</span>
                        <span>Κατοχή: <strong className="text-cyan-400">{selectedMatch.possession}%</strong></span>
                        {selectedMatch.ppda !== undefined && selectedMatch.ppda > 0 && (
                          <>
                            <span>•</span>
                            <span>PPDA: <strong className="text-rose-400">{selectedMatch.ppda}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedMatchId('all')}
                    className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-border text-xs font-bold text-zinc-200 hover:text-white transition flex items-center gap-1.5 self-start md:self-center flex-shrink-0"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Επιστροφή σε Συγκεντρωτικά Στοιχεία</span>
                  </button>
                </div>
              )}

              {/* Category Sub-Navigation */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-zinc-900/80 border border-border">
                <button
                  onClick={() => setActiveCategoryTab('overview')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeCategoryTab === 'overview'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Activity className="h-4 w-4" />
                  <span>Γενική Επισκόπηση</span>
                </button>

                <button
                  onClick={() => setActiveCategoryTab('attacking')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeCategoryTab === 'attacking'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  <span>Επίθεση & Τελικές</span>
                </button>

                <button
                  onClick={() => setActiveCategoryTab('defending')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeCategoryTab === 'defending'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Shield className="h-4 w-4" />
                  <span>Άμυνα & Μονομαχίες</span>
                </button>

                <button
                  onClick={() => setActiveCategoryTab('passing')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeCategoryTab === 'passing'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Compass className="h-4 w-4" />
                  <span>Πάσες & Build-Up</span>
                </button>

                <button
                  onClick={() => setActiveCategoryTab('indices')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeCategoryTab === 'indices'
                      ? 'bg-primary text-background shadow-glow-green'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <Gauge className="h-4 w-4" />
                  <span>Δείκτες & PPDA</span>
                </button>
              </div>

              {/* 1. OVERVIEW SUB-TAB */}
              {activeCategoryTab === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Overview KPIs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        {isSingleMatch ? 'Αγώνας' : 'Αγώνες'}
                      </span>
                      <span className="text-xl font-black text-white mt-1 block truncate">
                        {isSingleMatch ? '1 Αγώνας' : totalMatches}
                      </span>
                      <span className="text-[9px] text-primary font-semibold">
                        {isSingleMatch ? selectedMatch.scheme : 'Σύνολο Αναλύσεων'}
                      </span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        {isSingleMatch ? 'Expected Goals' : 'Μ.Ο. xG'}
                      </span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayXg}</span>
                      <span className="text-[9px] text-zinc-500">{displayShots} ({displayShotsOT} στην εστία)</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        {isSingleMatch ? 'Γκολ' : 'Μ.Ο. Γκολ'}
                      </span>
                      <span className="text-xl font-black text-white mt-1 block">{displayGoals}</span>
                      <span className="text-[9px] text-zinc-500">
                        {isSingleMatch 
                          ? (selectedMatch.opponent_goals !== undefined ? `vs ${selectedMatch.opponent_goals}` : 'Τελικό Σκορ') 
                          : `${(avgGoals / (avgXg || 1)).toFixed(2)}x Ratio`}
                      </span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κατοχή %</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayPossession}%</span>
                      <span className="text-[9px] text-zinc-500">{isSingleMatch ? 'Αγώνα' : 'Μέσος Όρος'}</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες %</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayPassAccuracy}%</span>
                      <span className="text-[9px] text-zinc-500">Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Μονομαχίες %</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayDuelsWonPct}%</span>
                      <span className="text-[9px] text-zinc-500">Κερδισμένες</span>
                    </div>
                  </div>

                  {/* Overview Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      {/* Single Match Chart 1: Team vs Opponent (Separate Individual Bars) */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border/80 pb-3">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Activity className="h-4 w-4 text-primary" />
                              Σύγκριση Αγώνα: {team.name} vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Ανεξάρτητη αναλογική μπάρα ανά στατιστικό</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span className="flex items-center gap-1.5 text-primary">
                              <span className="h-2 w-2 rounded-full bg-primary" />
                              {team.name}
                            </span>
                            <span className="flex items-center gap-1.5 text-zinc-400">
                              <span className="h-2 w-2 rounded-full bg-zinc-600" />
                              Αντίπαλος
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2.5 pr-1">
                          {h2hMetrics.map((item, idx) => {
                            const sum = item.teamVal + item.oppVal;
                            const teamPct = sum > 0 ? (item.teamVal / sum) * 100 : 50;
                            const oppPct = sum > 0 ? (item.oppVal / sum) * 100 : 50;
                            const isTeamAdvantage = item.higherIsBetter ? item.teamVal >= item.oppVal : item.teamVal <= item.oppVal;

                            return (
                              <div key={idx} className="space-y-1 py-1 border-b border-border/30 last:border-0">
                                <div className="flex justify-between items-center text-xs">
                                  <span className={`font-black ${isTeamAdvantage ? 'text-primary' : 'text-zinc-300'}`}>
                                    {item.decimals > 0 ? item.teamVal.toFixed(item.decimals) : item.teamVal}{item.unit || ''}
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                    {item.label}
                                  </span>
                                  <span className={`font-black ${!isTeamAdvantage ? 'text-rose-400' : 'text-zinc-400'}`}>
                                    {item.decimals > 0 ? item.oppVal.toFixed(item.decimals) : item.oppVal}{item.unit || ''}
                                  </span>
                                </div>

                                <div className="h-2 rounded-full bg-zinc-950 overflow-hidden flex gap-0.5 p-0.5 border border-zinc-800">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${isTeamAdvantage ? 'bg-primary' : 'bg-emerald-600/70'}`}
                                    style={{ width: `${Math.max(3, Math.min(97, teamPct))}%` }}
                                  />
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${!isTeamAdvantage ? 'bg-rose-500' : 'bg-zinc-600'}`}
                                    style={{ width: `${Math.max(3, Math.min(97, oppPct))}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Single Match Chart 2: Match vs Season Average (Separate Individual Bars) */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border/80 pb-3">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Target className="h-4 w-4 text-cyan-400" />
                              Απόδοση Αγώνα έναντι Μέσου Όρου Ομάδας
                            </h4>
                            <span className="text-[10px] text-zinc-400">Χωριστή αναλογική μπάρα ανά στατιστικό με απόκλιση</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-bold">
                            <span className="flex items-center gap-1.5 text-cyan-400">
                              <span className="h-2 w-2 rounded-full bg-cyan-400" />
                              Αγώνας
                            </span>
                            <span className="flex items-center gap-1.5 text-amber-400">
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              Μ.Ο.
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 pr-1">
                          {matchVsAvgMetrics.map((item, idx) => {
                            const diff = item.matchVal - item.avgVal;
                            const maxVal = Math.max(item.matchVal, item.avgVal, 0.01);
                            const matchPct = (item.matchVal / maxVal) * 100;
                            const avgPct = (item.avgVal / maxVal) * 100;
                            const isPositive = item.higherIsBetter ? diff >= 0 : diff <= 0;

                            return (
                              <div key={idx} className="space-y-1 py-1 border-b border-border/30 last:border-0">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                                      {item.label}
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-black ${
                                      Math.abs(diff) < 0.01
                                        ? 'bg-zinc-800 text-zinc-400' 
                                        : isPositive 
                                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    }`}>
                                      {diff > 0 ? '+' : ''}{diff.toFixed(item.decimals || 1)}{item.unit || ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-black text-cyan-400">
                                      {item.decimals > 0 ? item.matchVal.toFixed(item.decimals) : item.matchVal}{item.unit || ''}
                                    </span>
                                    <span className="text-[10px] text-zinc-500">vs</span>
                                    <span className="font-bold text-zinc-400">
                                      {item.decimals > 0 ? item.avgVal.toFixed(item.decimals) : item.avgVal}{item.unit || ''}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-cyan-400/80 font-bold w-11 flex-shrink-0">Αγώνας:</span>
                                    <div className="h-1.5 flex-1 rounded-full bg-zinc-950 overflow-hidden">
                                      <div
                                        className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(2, Math.min(100, matchPct))}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-amber-400/80 font-bold w-11 flex-shrink-0">Μ.Ο.:</span>
                                    <div className="h-1.5 flex-1 rounded-full bg-zinc-950 overflow-hidden">
                                      <div
                                        className="h-full bg-amber-400/80 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(2, Math.min(100, avgPct))}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            Εξέλιξη xG & Γκολ Ανά Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύγκριση αναμενόμενων γκολ (xG) και πραγματικών τερμάτων</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={overviewTimelineData}>
                              <defs>
                                <linearGradient id="xgGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Area type="monotone" dataKey="xg" name="xG (Expected)" stroke="#10b981" fillOpacity={1} fill="url(#xgGrad)" strokeWidth={2} />
                              <Line type="monotone" dataKey="goals" name="Πραγματικά Γκολ" stroke="#ffffff" strokeWidth={2} dot={{ r: 4, fill: '#ffffff' }} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Target className="h-4 w-4 text-cyan-400" />
                            Κατοχή Μπάλας & Τελικές Προσπάθειες
                          </h4>
                          <span className="text-[10px] text-zinc-400">Ποσοστό κατοχής (%) και τελικές εντός/εκτός εστίας</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overviewTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="possession" name="Κατοχή (%)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="shots" name="Συνολικές Τελικές" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="shotsOnTarget" name="Εντός Εστίας" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Overview Charts Row 2: Pitch Zones & Scheme */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-border space-y-4">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Compass className="h-4 w-4 text-amber-400" />
                          Απώλειες (Losses) & Ανακτήσεις (Recoveries) ανά Ζώνη
                        </h4>
                        <span className="text-[10px] text-zinc-400">
                          {isSingleMatch ? 'Αποτελέσματα για τον επιλεγμένο αγώνα' : 'Μέσος όρος ανακτήσεων και λαθών σε Low, Medium και High ζώνη'}
                        </span>
                      </div>

                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dynamicZoneData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                            <XAxis type="number" stroke="#71717a" fontSize={10} />
                            <YAxis dataKey="zone" type="category" stroke="#71717a" fontSize={10} width={130} />
                            <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            <Bar dataKey="Recoveries" name="Ανακτήσεις Μπάλας (Recoveries)" fill="#10b981" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Losses" name="Απώλειες Μπάλας (Losses)" fill="#ef4444" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                          <Layers className="h-4 w-4 text-purple-400" />
                          {isSingleMatch ? 'Τακτικό Προφίλ Αγώνα' : 'Τακτικοί Σχηματισμοί (Schemes)'}
                        </h4>
                        <span className="text-[10px] text-zinc-400">
                          {isSingleMatch ? 'Σύστημα και στοιχεία αναμέτρησης' : 'Συχνότητα συστημάτων στα ματς Wyscout'}
                        </span>
                      </div>

                      {isSingleMatch ? (
                        <div className="space-y-3 pt-2 text-xs">
                          <div className="p-3 rounded-xl bg-zinc-900 border border-border flex items-center justify-between">
                            <span className="text-zinc-400 font-bold">Σχηματισμός:</span>
                            <span className="font-black text-primary px-2.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                              {selectedMatch.scheme}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-zinc-900 border border-border flex items-center justify-between">
                            <span className="text-zinc-400 font-bold">Διάρκεια:</span>
                            <span className="font-black text-white">{selectedMatch.duration}' λεπτά</span>
                          </div>
                          <div className="p-3 rounded-xl bg-zinc-900 border border-border flex items-center justify-between">
                            <span className="text-zinc-400 font-bold">Φάουλ:</span>
                            <span className="font-black text-white">{selectedMatch.fouls ?? 0}</span>
                          </div>
                          <div className="p-3 rounded-xl bg-zinc-900 border border-border flex items-center justify-between">
                            <span className="text-zinc-400 font-bold">Κάρτες:</span>
                            <span className="font-bold text-amber-400">
                              🟨 {selectedMatch.yellow_cards ?? 0} {selectedMatch.red_cards ? `🟥 ${selectedMatch.red_cards}` : ''}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="h-48 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={formationData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={70}
                                  innerRadius={42}
                                  label={({ name, percent }: { name?: string; percent?: number }) => `${name || ''} (${(((percent ?? 0) * 100)).toFixed(0)}%)`}
                                  labelLine={false}
                                  fontSize={10}
                                >
                                  {formationData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={SCHEME_COLORS[index % SCHEME_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="flex flex-wrap justify-center gap-2 pt-1 border-t border-border/60">
                            {formationData.map((f, i) => (
                              <span key={f.name} className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-300">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SCHEME_COLORS[i % SCHEME_COLORS.length] }}></span>
                                {f.name}: {f.value}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. ATTACKING SUB-TAB */}
              {activeCategoryTab === 'attacking' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Attacking KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Σετ Επιθέσεις</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPositional}</span>
                      <span className="text-[9px] text-emerald-400 font-semibold">{displayPositionalPct}% με Τελική</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Αντεπιθέσεις</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayCounter}</span>
                      <span className="text-[9px] text-zinc-400">{displayCounterPct}% με Τελική</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Σέντρες (Crosses)</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayCrosses}</span>
                      <span className="text-[9px] text-zinc-400">{displayCrossesAccPct}% Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Επιθ. Μονομαχίες</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayOffDuels}</span>
                      <span className="text-[9px] text-purple-300">{displayOffDuelsWonPct}% Won</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κόρνερ</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayCorners}</span>
                      <span className="text-[9px] text-zinc-400">{displayCornersShots} με Τελική</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">xG</span>
                      <span className="text-xl font-black text-primary mt-1 block">{displayXg}</span>
                      <span className="text-[9px] text-zinc-400">{displayShots} Τελικές</span>
                    </div>
                  </div>

                  {/* Attacking Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            Τύποι Επιθέσεων Αγώνα (Σύνολο & με Τελική)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Οργανωμένες επιθέσεις, αντεπιθέσεις και στατικές φάσεις</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchAttackingTypes}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Συνολικές Ενέργειες" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="withShots" name="Με Τελική Προσπάθεια" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Crosshair className="h-4 w-4 text-cyan-400" />
                            Σέντρες & Επιθετικές Μονομαχίες Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Επιτυχημένες ενέργειες και ποσοστά ευστοχίας</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchCrossesDuels}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο" fill="#71717a" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Accurate" name="Επιτυχημένες" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            Σετ Επιθέσεις vs Αντεπιθέσεις ανά Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συχνότητα και ποσοστό κατάληξης σε τελική προσπάθεια</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={attackingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="positional" name="Σετ Επιθέσεις" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="positionalShots" name="Σετ με Τελική" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="counter" name="Αντεπιθέσεις" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="counterShots" name="Αντεπιθέσεις με Τελική" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Crosshair className="h-4 w-4 text-cyan-400" />
                            Σέντρες & Επιθετικές Μονομαχίες
                          </h4>
                          <span className="text-[10px] text-zinc-400">Ακρίβεια σεντρών και επιτυχία σε 1v1 μονομαχίες</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={attackingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis yAxisId="left" stroke="#71717a" fontSize={10} />
                              <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} unit="%" />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar yAxisId="left" dataKey="crosses" name="Σύνολο Σεντρών" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="crossesAccPct" name="Ακρίβεια Σέντρας %" stroke="#10b981" strokeWidth={2} />
                              <Line yAxisId="right" type="monotone" dataKey="offDuelsWonPct" name="Επιθ. Μονομαχίες Won %" stroke="#ec4899" strokeWidth={2} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. DEFENDING SUB-TAB */}
              {activeCategoryTab === 'defending' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Defending KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Παθητικό Γκολ</span>
                      <span className="text-xl font-black text-rose-400 mt-1 block">{displayConcededGoals}</span>
                      <span className="text-[9px] text-zinc-500">{isSingleMatch ? 'Αγώνα' : 'Ανά Αγώνα'}</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Τελικές Αντιπάλου</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayShotsAgainst}</span>
                      <span className="text-[9px] text-amber-400">{displayShotsAgainstOT} στην Εστία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Αμυντ. Μονομαχίες</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayDefDuelsWonPct}%</span>
                      <span className="text-[9px] text-zinc-400">{displayDefDuels} σύνολο</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Εναέριες Μονομαχίες</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayAerialDuelsWonPct}%</span>
                      <span className="text-[9px] text-zinc-400">{displayAerialDuels} σύνολο</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Επεμβάσεις (Interc.)</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayInterceptions}</span>
                      <span className="text-[9px] text-zinc-500">Κλεψίματα</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Clearances</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayClearances}</span>
                      <span className="text-[9px] text-zinc-500">{displayFouls} Φάουλ</span>
                    </div>
                  </div>

                  {/* Defending Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-400" />
                            Μονομαχίες Αγώνα (Κερδισμένες vs Σύνολο)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Αμυντικές μονομαχίες εδάφους, κεφαλιές και τάκλιν</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchDefDuels}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο Μονομαχιών" fill="#71717a" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Won" name="Κερδισμένες" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-rose-400" />
                            Αμυντικές Ενέργειες & Πίεση Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Επεμβάσεις, καθαρίσματα και πίεση αντιπάλου</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchDefActions}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="action" stroke="#71717a" fontSize={9} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Bar dataKey="count" name="Πλήθος Ενεργειών" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-rose-400" />
                            Παθητικό & Τελικές Αντιπάλου ανά Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Πίεση που δέχεται η άμυνα και αποτελεσματικότητα αντιπάλων</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={defendingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="conceded" name="Παθητικό Γκολ" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="shotsAgainst" name="Τελικές Αντιπάλου" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="shotsAgainstOT" name="Τελικές στην Εστία" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-400" />
                            Επεμβάσεις, Απομακρύνσεις & Ποσοστά Μονομαχιών
                          </h4>
                          <span className="text-[10px] text-zinc-400">Αμυντική σταθερότητα και καθαρίσματα</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={defendingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis yAxisId="left" stroke="#71717a" fontSize={10} />
                              <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={10} unit="%" />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar yAxisId="left" dataKey="interceptions" name="Interceptions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar yAxisId="left" dataKey="clearances" name="Clearances" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                              <Line yAxisId="right" type="monotone" dataKey="defDuelsPct" name="Αμυντ. Μονομαχίες %" stroke="#10b981" strokeWidth={2} />
                              <Line yAxisId="right" type="monotone" dataKey="aerialPct" name="Εναέριες Μονομαχίες %" stroke="#06b6d4" strokeWidth={2} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. PASSING SUB-TAB */}
              {activeCategoryTab === 'passing' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Passing KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPasses}</span>
                      <span className="text-[9px] text-amber-400">{displayPassAccuracy}% Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Προωθητικές (Prog.)</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayProgressive}</span>
                      <span className="text-[9px] text-zinc-400">{isSingleMatch ? 'Αγώνα' : 'Ανά Αγώνα'}</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Προς Final Third</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayFinalThird}</span>
                      <span className="text-[9px] text-zinc-400">Επιθετικό Τρίτο</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Smart Passes</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displaySmartPasses}</span>
                      <span className="text-[9px] text-purple-300">Κάθετες Μεταβιβάσεις</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Μακρινές (Long)</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayLongPasses}</span>
                      <span className="text-[9px] text-zinc-400">Μπαλιές Βάθους</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Forward Passes</span>
                      <span className="text-xl font-black text-primary mt-1 block">{displayForwardPasses}</span>
                      <span className="text-[9px] text-zinc-400">{displayForwardPassesAccPct}% Ακρίβεια</span>
                    </div>
                  </div>

                  {/* Passing Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Compass className="h-4 w-4 text-emerald-400" />
                            Κατανομή Κατεύθυνσης Πασών Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Προς τα εμπρός, πλάγια, πίσω και μακρινές</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchPassDirection}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="direction" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="count" name="Συνολικές Πάσες" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="accurate" name="Εύστοχες Πάσες" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-cyan-400" />
                            Προώθηση & Δημιουργία Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Progressive, Final Third και Smart Passes</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchProgression}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="total" name="Σύνολο" fill="#71717a" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="accurate" name="Επιτυχημένες" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Compass className="h-4 w-4 text-emerald-400" />
                            Κατεύθυνση Πασών (Forward / Back / Lateral)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Προσανατολισμός ανάπτυξης παιχνιδιού</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="forward" name="Μπροστά (Forward)" stackId="a" fill="#10b981" />
                              <Bar dataKey="lateral" name="Πλάγια (Lateral)" stackId="a" fill="#3b82f6" />
                              <Bar dataKey="back" name="Πίσω (Back)" stackId="a" fill="#71717a" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-cyan-400" />
                            Progressive Passes & Πάσες στο Επιθετικό Τρίτο
                          </h4>
                          <span className="text-[10px] text-zinc-400">Δημιουργία ρηγμάτων και είσοδος στην αντίπαλη περιοχή</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="progressive" name="Progressive Passes" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="finalThird" name="Passes to Final Third" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="smart" name="Smart Passes" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. INDICES & PPDA SUB-TAB */}
              {activeCategoryTab === 'indices' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Indices KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">PPDA (Πίεση)</span>
                      <span className="text-xl font-black text-rose-400 mt-1 block">{displayPpda}</span>
                      <span className="text-[9px] text-zinc-500">
                        {displayPpda < 9 ? 'High Press' : displayPpda < 12 ? 'Mid Block' : 'Low Block'}
                      </span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Ρυθμός (Tempo)</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayTempo}</span>
                      <span className="text-[9px] text-zinc-500">Πάσες/λεπτό κατοχής</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες / Κατοχή</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayPassesPerPoss}</span>
                      <span className="text-[9px] text-zinc-500">Μέση Ακολουθία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Απόσταση Σουτ</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayShotDist}m</span>
                      <span className="text-[9px] text-zinc-500">Μέση Απόσταση</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Μήκος Πάσας</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayPassLen}m</span>
                      <span className="text-[9px] text-zinc-500">Μέσο Μήκος</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κατοχή %</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPossession}%</span>
                      <span className="text-[9px] text-primary">{displayPassAccuracy}% Ακρίβεια</span>
                    </div>
                  </div>

                  {/* Indices Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-rose-400" />
                            Τακτικοί Δείκτες Αγώνα vs Μέσος Όρος Ομάδας
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύγκριση PPDA, ρυθμού και αποστάσεων με τα συνήθη επίπεδα</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchIndicesComparison}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="metric" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Match" name="Αγώνας" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="SeasonAvg" name="Μ.Ο. Ομάδας" fill="#71717a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Timer className="h-4 w-4 text-emerald-400" />
                            Επεξήγηση PPDA & Ρυθμού Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Τακτικό αποτύπωμα πίεσης</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-border space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="text-zinc-400">PPDA (Πάσες ανά αμυντική ενέργεια):</span>
                            <span className="font-black text-rose-400">{selectedMatch.ppda ?? '-'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="text-zinc-400">Match Tempo (Πάσες / λεπτό):</span>
                            <span className="font-black text-emerald-400">{selectedMatch.match_tempo ?? '-'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="text-zinc-400">Πάσες ανά Κατοχή:</span>
                            <span className="font-black text-cyan-400">{selectedMatch.avg_passes_per_possession ?? '-'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-400">Μακρινές Μπαλιές %:</span>
                            <span className="font-black text-amber-400">{selectedMatch.long_pass_pct ?? '-'}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-rose-400" />
                            PPDA Ένταση Πίεσης (Pressing Intensity)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Χαμηλότερη τιμή = πιο επιθετικό high pressing</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={indicesChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="ppda" name="PPDA (Πίεση)" fill="#f43f5e" radius={[4, 4, 0, 0]}>
                                {indicesChartData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.isSelected ? '#10b981' : '#f43f5e'} 
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Timer className="h-4 w-4 text-emerald-400" />
                            Ρυθμός Αγώνα (Tempo) & Αποστάσεις (m)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Ταχύτητα κυκλοφορίας και μέσες αποστάσεις σε μέτρα</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={indicesChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="tempo" name="Match Tempo" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Line type="monotone" dataKey="shotDist" name="Μέση Απόσταση Σουτ (m)" stroke="#f59e0b" strokeWidth={2} />
                              <Line type="monotone" dataKey="passLength" name="Μέσο Μήκος Πάσας (m)" stroke="#06b6d4" strokeWidth={2} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: MATCHES LIST (Clicking selects match and switches to Analytics directly - NO POPUP) */}
      {activeTab === 'matches' && (
        <div className="space-y-4 animate-fade-in">
          {matches.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-2xl border border-border p-6">
              <p className="text-xs text-zinc-400">Δεν έχουν καταχωρηθεί αγώνες. Μεταβείτε στην καρτέλα "Ανέβασμα Wyscout" για να προσθέσετε.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-xs font-bold text-zinc-400">
                  Επιλέξτε έναν αγώνα για να δείτε άμεσα όλα τα στατιστικά του στην καρτέλα Ανάλυσης:
                </span>
                {isSingleMatch && (
                  <button
                    onClick={() => {
                      setSelectedMatchId('all');
                      setActiveTab('analytics');
                    }}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Επιστροφή σε Όλους τους Αγώνες</span>
                  </button>
                )}
              </div>

              {matches.map((match) => {
                const isCurrent = match.id === selectedMatchId;
                return (
                  <div
                    key={match.id}
                    onClick={() => {
                      setSelectedMatchId(match.id);
                      setActiveTab('analytics');
                    }}
                    className={`glass-panel p-4 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${
                      isCurrent 
                        ? 'border-primary/80 bg-primary/5 shadow-glow-green' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-xl border flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        isCurrent 
                          ? 'bg-primary text-background border-primary' 
                          : 'bg-zinc-900 border-zinc-700 text-primary'
                      }`}>
                        {match.goals}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-white truncate group-hover:text-primary transition">
                            {match.match_name}
                          </h4>
                          <span className="px-2 py-0.5 rounded bg-zinc-900 border border-border text-[9px] font-bold text-zinc-400 uppercase">
                            {match.scheme}
                          </span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/40 text-[9px] font-black text-primary uppercase flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Επιλεγμένος
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                          <span>{match.date}</span>
                          <span>•</span>
                          <span className="truncate max-w-[200px]">{match.competition}</span>
                        </div>
                      </div>
                    </div>

                    {/* Match Snapshot Metrics */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                      <div className="text-center">
                        <span className="text-[9px] text-zinc-400 block uppercase font-bold">xG</span>
                        <span className="text-xs font-black text-emerald-400">{match.xg}</span>
                      </div>

                      <div className="text-center">
                        <span className="text-[9px] text-zinc-400 block uppercase font-bold">Κατοχή</span>
                        <span className="text-xs font-black text-cyan-400">{match.possession}%</span>
                      </div>

                      <div className="text-center">
                        <span className="text-[9px] text-zinc-400 block uppercase font-bold">Τελικές</span>
                        <span className="text-xs font-black text-white">{match.shots} ({match.shots_on_target})</span>
                      </div>

                      {match.ppda !== undefined && match.ppda > 0 ? (
                        <div className="text-center">
                          <span className="text-[9px] text-zinc-400 block uppercase font-bold">PPDA</span>
                          <span className="text-xs font-black text-rose-400">{match.ppda}</span>
                        </div>
                      ) : (
                        <div className="text-center">
                          <span className="text-[9px] text-zinc-400 block uppercase font-bold">Πάσες %</span>
                          <span className="text-xs font-black text-amber-400">{match.passing_accuracy}%</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pl-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteMatch(e, match.id)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-destructive hover:bg-destructive/10 transition"
                          title="Διαγραφή αγώνα"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <ChevronRight className="h-4 w-4 text-zinc-500 group-hover:text-primary group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WYSCOUT FILE INGESTION (CSV / Excel Multi-File) */}
      {activeTab === 'upload' && (
        <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
          <div className="glass-panel p-8 rounded-2xl border border-border text-center space-y-4">
            <div className="p-3.5 rounded-2xl bg-primary/10 text-primary inline-block">
              <Upload className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                Εισαγωγή Αρχείων Wyscout για την {team.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                Υποστηρίζεται ταυτόχρονο ανέβασμα πολλαπλών αρχείων Excel (<strong>.xlsx, .xls</strong>) ή <strong>.csv</strong>. Το σύστημα αναγνωρίζει αυτόματα τις κατηγορίες (<strong>Επίθεση, Άμυνα, Πάσες, PPDA</strong>) και τα συγχωνεύει ανά αγώνα!
              </p>
            </div>

            {/* Upload Area */}
            <div className="pt-2">
              <label className="border-2 border-dashed border-border hover:border-primary/60 bg-zinc-950/40 hover:bg-zinc-900/40 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition group">
                <FileSpreadsheet className="h-10 w-10 text-primary mb-2 group-hover:scale-110 transition" />
                <span className="text-xs font-bold text-white uppercase">
                  Επιλέξτε ένα ή περισσότερα αρχεία Wyscout
                </span>
                <span className="text-[10px] text-zinc-500 mt-1">
                  Μπορείτε να επιλέξετε ταυτόχρονα και τα 4 αρχεία (.xlsx, .xls ή .csv)
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploadLoading}
                  className="hidden"
                />
              </label>
            </div>

            {uploadLoading && (
              <div className="text-xs font-bold text-primary flex items-center justify-center gap-2 pt-2">
                <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Ανάλυση και συγχώνευση αρχείων Wyscout...
              </div>
            )}

            {uploadFeedback.message && (
              <div className={`p-3 rounded-xl text-xs font-medium ${
                uploadFeedback.type === 'error' ? 'bg-destructive/10 border border-destructive/30 text-destructive' : 'bg-primary/10 border border-primary/30 text-primary'
              }`}>
                {uploadFeedback.message}
              </div>
            )}
          </div>

          {/* Preview of Detected Matches */}
          {previewMatches.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-primary/40 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    Προεπισκόπηση Αναγνωρισμένων Αγώνων ({previewMatches.length})
                  </h4>
                  <span className="text-[10px] text-zinc-400">Ελέγξτε τις γραμμές πριν την οριστική αποθήκευση</span>
                </div>
                <button
                  onClick={handleSaveParsedMatches}
                  disabled={uploadLoading}
                  className="px-5 py-2.5 rounded-xl bg-primary text-background font-black text-xs uppercase tracking-wider hover:bg-primary/90 transition shadow-glow-green flex items-center gap-1.5"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Αποθήκευση στη Βάση</span>
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {previewMatches.map((m, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-zinc-900/80 border border-border flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{m.match_name}</p>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                        <span>{m.date}</span>
                        <span>•</span>
                        <span>{m.scheme}</span>
                        {m.positional_attacks !== undefined && m.positional_attacks > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Επίθεση</span>
                        )}
                        {m.defensive_duels !== undefined && m.defensive_duels > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">Άμυνα</span>
                        )}
                        {m.forward_passes !== undefined && m.forward_passes > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Πάσες</span>
                        )}
                        {m.ppda !== undefined && m.ppda > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">PPDA</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Γκολ (xG)</span>
                        <span className="font-bold text-white">{m.goals} ({m.xg})</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-zinc-400 uppercase block">Κατοχή</span>
                        <span className="font-bold text-cyan-400">{m.possession}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
