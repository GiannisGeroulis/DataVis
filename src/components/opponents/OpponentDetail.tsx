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
        // AUTOMATICALLY SAVE DIRECTLY TO SUPABASE CLOUD IMMEDIATELY
        await wyscoutService.saveMatches(parsed);
        await loadMatches();
        setPreviewMatches(parsed);

        const errNotice = errors.length > 0 ? ` (Προειδοποιήσεις: ${errors.join(', ')})` : '';
        setUploadFeedback({
          type: 'success',
          message: `Επεξεργάστηκαν ${filesProcessed} αρχεία! Αποθηκεύτηκαν επιτυχώς ${parsed.length} αγώνες. Όλα τα δεδομένα είναι πλέον άμεσα διαθέσιμα για ολόκληρο το τεχνικό επιτελείο.${errNotice}`
        });

        // Switch to analytics automatically after a brief moment so the user sees the live stats
        setTimeout(() => {
          setActiveTab('analytics');
        }, 1500);
      }
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: `Σφάλμα επεξεργασίας/αποθήκευσης αρχείων: ${err.message || err}` });
    } finally {
      setUploadLoading(false);
      e.target.value = '';
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
  const avgOpponentPossession = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.opponent_possession ?? (100 - (m.possession || 50))), 0) / totalMatches) : 0;
  const avgShots = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.shots || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgShotsOT = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.shots_on_target || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgOpponentShots = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.opponent_shots ?? m.shots_against ?? 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgPassAccuracy = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.passing_accuracy || 0), 0) / totalMatches) : 0;
  const avgDuels = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.duels || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgDuelsWon = totalMatches > 0 ? Math.round((matches.reduce((s, m) => s + (m.duels_won || 0), 0) / totalMatches) * 10) / 10 : 0;
  const avgDuelsWonPct = totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.duels_won_pct || 0), 0) / totalMatches) : 0;

  // ATTACKING AGGREGATES
  const attackingMatches = matches.filter(m => (m.positional_attacks ?? 0) > 0 || (m.counterattacks ?? 0) > 0 || (m.crosses ?? 0) > 0 || (m.corners ?? 0) > 0 || (m.free_kicks ?? 0) > 0);
  const nAtt = attackingMatches.length || 1;
  const avgPositional = Math.round((attackingMatches.reduce((s, m) => s + (m.positional_attacks || 0), 0) / nAtt) * 10) / 10;
  const avgPositionalShots = Math.round((attackingMatches.reduce((s, m) => s + (m.positional_attacks_shots || 0), 0) / nAtt) * 10) / 10;
  const avgPositionalPct = avgPositional > 0 ? Math.round((avgPositionalShots / avgPositional) * 100) : 0;
  const avgCrosses = Math.round((attackingMatches.reduce((s, m) => s + (m.crosses || 0), 0) / nAtt) * 10) / 10;
  const avgCrossesAcc = Math.round((attackingMatches.reduce((s, m) => s + (m.crosses_accurate || 0), 0) / nAtt) * 10) / 10;
  const avgCrossesAccPct = avgCrosses > 0 ? Math.round((avgCrossesAcc / avgCrosses) * 100) : 0;
  const avgOffDuels = Math.round((attackingMatches.reduce((s, m) => s + (m.offensive_duels || 0), 0) / nAtt) * 10) / 10;
  const avgOffDuelsWon = Math.round((attackingMatches.reduce((s, m) => s + (m.offensive_duels_won || 0), 0) / nAtt) * 10) / 10;
  const avgOffDuelsWonPct = avgOffDuels > 0 ? Math.round((avgOffDuelsWon / avgOffDuels) * 100) : 0;
  const avgCorners = Math.round((attackingMatches.reduce((s, m) => s + (m.corners || 0), 0) / nAtt) * 10) / 10;
  const avgCornersShots = Math.round((attackingMatches.reduce((s, m) => s + (m.corners_shots || 0), 0) / nAtt) * 10) / 10;
  const avgCornersPct = avgCorners > 0 ? Math.round((avgCornersShots / avgCorners) * 100) : 0;
  const avgFreeKicks = Math.round((attackingMatches.reduce((s, m) => s + (m.free_kicks || 0), 0) / nAtt) * 10) / 10;
  const avgFreeKicksShots = Math.round((attackingMatches.reduce((s, m) => s + (m.free_kicks_shots || 0), 0) / nAtt) * 10) / 10;
  const avgFreeKicksPct = avgFreeKicks > 0 ? Math.round((avgFreeKicksShots / avgFreeKicks) * 100) : 0;

  // DEFENDING AGGREGATES
  const defendingMatches = matches.filter(m => (m.defensive_duels ?? 0) > 0 || (m.conceded_goals ?? 0) > 0 || (m.interceptions ?? 0) > 0 || (m.fouls ?? 0) > 0);
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
  const avgFouls = Math.round((defendingMatches.reduce((s, m) => s + (m.fouls || 0), 0) / nDef) * 10) / 10;
  const avgYellowCards = Math.round((defendingMatches.reduce((s, m) => s + (m.yellow_cards || 0), 0) / nDef) * 10) / 10;

  // Against Aggregates (from opponent in attacking/defending data)
  const avgCornersAgainst = Math.round((matches.reduce((s, m) => s + (m.corners_against ?? 0), 0) / (matches.length || 1)) * 10) / 10;
  const avgCornersAgainstShots = Math.round((matches.reduce((s, m) => s + (m.corners_against_shots ?? 0), 0) / (matches.length || 1)) * 10) / 10;
  const avgCornersAgainstPct = avgCornersAgainst > 0 ? Math.round((avgCornersAgainstShots / avgCornersAgainst) * 100) : 0;
  const avgFreeKicksAgainst = Math.round((matches.reduce((s, m) => s + (m.free_kicks_against ?? 0), 0) / (matches.length || 1)) * 10) / 10;
  const avgFreeKicksAgainstShots = Math.round((matches.reduce((s, m) => s + (m.free_kicks_against_shots ?? 0), 0) / (matches.length || 1)) * 10) / 10;
  const avgFreeKicksAgainstPct = avgFreeKicksAgainst > 0 ? Math.round((avgFreeKicksAgainstShots / avgFreeKicksAgainst) * 100) : 0;

  // PASSING AGGREGATES
  const passingMatches = matches.filter(m => (m.forward_passes ?? 0) > 0 || (m.passes ?? 0) > 0);
  const nPass = passingMatches.length || 1;
  const avgPasses = Math.round((passingMatches.reduce((s, m) => s + (m.passes || 0), 0) / nPass));
  const avgForwardPasses = Math.round((passingMatches.reduce((s, m) => s + (m.forward_passes || 0), 0) / nPass) * 10) / 10;
  const avgForwardPassesAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.forward_passes_pct || (m.forward_passes ? Math.round(((m.forward_passes_acc || 0) / m.forward_passes) * 100) : 0)), 0) / nPass);
  const avgLateralPasses = Math.round((passingMatches.reduce((s, m) => s + (m.lateral_passes || 0), 0) / nPass) * 10) / 10;
  const avgLateralPassesAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.lateral_passes_pct || (m.lateral_passes ? Math.round(((m.lateral_passes_acc || 0) / m.lateral_passes) * 100) : 0)), 0) / nPass);
  const avgBackPasses = Math.round((passingMatches.reduce((s, m) => s + (m.back_passes || 0), 0) / nPass) * 10) / 10;
  const avgBackPassesAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.back_passes_pct || (m.back_passes ? Math.round(((m.back_passes_acc || 0) / m.back_passes) * 100) : 0)), 0) / nPass);
  const avgLongPasses = Math.round((passingMatches.reduce((s, m) => s + (m.long_passes || 0), 0) / nPass) * 10) / 10;
  const avgLongPassesAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.long_passes_pct || (m.long_passes ? Math.round(((m.long_passes_acc || 0) / m.long_passes) * 100) : 0)), 0) / nPass);
  const avgFinalThird = Math.round((passingMatches.reduce((s, m) => s + (m.passes_to_final_third || 0), 0) / nPass) * 10) / 10;
  const avgFinalThirdAccPct = Math.round(passingMatches.reduce((s, m) => s + (m.passes_to_final_third_pct || (m.passes_to_final_third ? Math.round(((m.passes_to_final_third_acc || 0) / m.passes_to_final_third) * 100) : 0)), 0) / nPass);
  const avgGoalKicks = Math.round((passingMatches.reduce((s, m) => s + (m.goal_kicks || 0), 0) / nPass) * 10) / 10;
  const avgThrowIns = Math.round((passingMatches.reduce((s, m) => s + (m.throw_ins || 0), 0) / nPass) * 10) / 10;

  // INDICES AGGREGATES
  const indicesMatches = matches.filter(m => (m.ppda ?? 0) > 0 || (m.match_tempo ?? 0) > 0);
  const nIdx = indicesMatches.length || 1;
  const avgPpda = Math.round((indicesMatches.reduce((s, m) => s + (m.ppda || 0), 0) / nIdx) * 10) / 10;
  
  const oppPpdaMatches = indicesMatches.filter(m => (m.opponent_ppda ?? 0) > 0);
  const avgOpponentPpda = oppPpdaMatches.length > 0 
    ? Math.round((oppPpdaMatches.reduce((s, m) => s + (m.opponent_ppda || 0), 0) / oppPpdaMatches.length) * 10) / 10 
    : 0;

  const avgTempo = Math.round((indicesMatches.reduce((s, m) => s + (m.match_tempo || 0), 0) / nIdx) * 10) / 10;
  const oppTempoMatches = indicesMatches.filter(m => (m.opponent_match_tempo ?? 0) > 0);
  const avgOpponentTempo = oppTempoMatches.length > 0
    ? Math.round((oppTempoMatches.reduce((s, m) => s + (m.opponent_match_tempo || 0), 0) / oppTempoMatches.length) * 10) / 10
    : 0;

  const avgPassesPerPoss = Math.round((indicesMatches.reduce((s, m) => s + (m.avg_passes_per_possession || 0), 0) / nIdx) * 10) / 10;
  const oppPassesPossMatches = indicesMatches.filter(m => (m.opponent_avg_passes_per_possession ?? 0) > 0);
  const avgOpponentPassesPerPoss = oppPassesPossMatches.length > 0
    ? Math.round((oppPassesPossMatches.reduce((s, m) => s + (m.opponent_avg_passes_per_possession || 0), 0) / oppPassesPossMatches.length) * 10) / 10
    : 0;

  const avgLongPassPct = Math.round(indicesMatches.reduce((s, m) => s + (m.long_pass_pct || 0), 0) / nIdx);
  const oppLongPassMatches = indicesMatches.filter(m => (m.opponent_long_pass_pct ?? 0) > 0);
  const avgOpponentLongPassPct = oppLongPassMatches.length > 0
    ? Math.round(oppLongPassMatches.reduce((s, m) => s + (m.opponent_long_pass_pct || 0), 0) / oppLongPassMatches.length)
    : 0;

  const avgShotDist = Math.round((indicesMatches.reduce((s, m) => s + (m.avg_shot_distance || 0), 0) / nIdx) * 10) / 10;
  const oppShotDistMatches = indicesMatches.filter(m => (m.opponent_avg_shot_distance ?? 0) > 0);
  const avgOpponentShotDist = oppShotDistMatches.length > 0
    ? Math.round((oppShotDistMatches.reduce((s, m) => s + (m.opponent_avg_shot_distance || 0), 0) / oppShotDistMatches.length) * 10) / 10
    : 0;

  const avgOpponentPassingAccuracy = Math.round(indicesMatches.reduce((s, m) => s + (m.opponent_passing_accuracy || 75), 0) / nIdx);

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
  const displayDuels = isSingleMatch ? selectedMatch.duels : avgDuels;
  const displayDuelsWon = isSingleMatch ? selectedMatch.duels_won : avgDuelsWon;
  const displayDuelsWonPct = isSingleMatch ? selectedMatch.duels_won_pct : avgDuelsWonPct;
  const displayOpponentPossession = isSingleMatch ? (selectedMatch.opponent_possession ?? (100 - selectedMatch.possession)) : avgOpponentPossession;
  const displayOpponentShots = isSingleMatch ? (selectedMatch.opponent_shots ?? selectedMatch.shots_against ?? 0) : avgOpponentShots;

  // Attacking Tab KPIs
  const displayPositional = isSingleMatch ? (selectedMatch.positional_attacks ?? 0) : avgPositional;
  const displayPositionalShots = isSingleMatch ? (selectedMatch.positional_attacks_shots ?? 0) : avgPositionalShots;
  const displayPositionalPct = isSingleMatch 
    ? (displayPositional > 0 ? Math.round((displayPositionalShots / displayPositional) * 100) : 0)
    : avgPositionalPct;
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
  const displayCornersPct = isSingleMatch
    ? (selectedMatch.corners_shots_pct ?? (displayCorners > 0 ? Math.round((displayCornersShots / displayCorners) * 100) : 0))
    : avgCornersPct;
  const displayFreeKicks = isSingleMatch ? (selectedMatch.free_kicks ?? 0) : avgFreeKicks;
  const displayFreeKicksShots = isSingleMatch ? (selectedMatch.free_kicks_shots ?? 0) : avgFreeKicksShots;
  const displayFreeKicksPct = isSingleMatch
    ? (selectedMatch.free_kicks_shots_pct ?? (displayFreeKicks > 0 ? Math.round((displayFreeKicksShots / displayFreeKicks) * 100) : 0))
    : avgFreeKicksPct;

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
  const displayFouls = isSingleMatch ? (selectedMatch.fouls ?? 0) : avgFouls;
  const displayYellowCards = isSingleMatch ? (selectedMatch.yellow_cards ?? 0) : avgYellowCards;

  const displayCornersAgainst = isSingleMatch ? (selectedMatch.corners_against ?? 0) : avgCornersAgainst;
  const displayCornersAgainstShots = isSingleMatch ? (selectedMatch.corners_against_shots ?? 0) : avgCornersAgainstShots;
  const displayCornersAgainstPct = isSingleMatch
    ? (selectedMatch.corners_against_shots_pct ?? (displayCornersAgainst > 0 ? Math.round((displayCornersAgainstShots / displayCornersAgainst) * 100) : 0))
    : avgCornersAgainstPct;

  const displayFreeKicksAgainst = isSingleMatch ? (selectedMatch.free_kicks_against ?? 0) : avgFreeKicksAgainst;
  const displayFreeKicksAgainstShots = isSingleMatch ? (selectedMatch.free_kicks_against_shots ?? 0) : avgFreeKicksAgainstShots;
  const displayFreeKicksAgainstPct = isSingleMatch
    ? (selectedMatch.free_kicks_against_shots_pct ?? (displayFreeKicksAgainst > 0 ? Math.round((displayFreeKicksAgainstShots / displayFreeKicksAgainst) * 100) : 0))
    : avgFreeKicksAgainstPct;

  // Passing Tab KPIs
  const displayPasses = isSingleMatch ? (selectedMatch.passes ?? 0) : avgPasses;
  const displayForwardPasses = isSingleMatch ? (selectedMatch.forward_passes ?? 0) : avgForwardPasses;
  const displayForwardPassesAccPct = isSingleMatch
    ? (selectedMatch.forward_passes_pct ?? (selectedMatch.forward_passes ? Math.round(((selectedMatch.forward_passes_acc || 0) / selectedMatch.forward_passes) * 100) : 0))
    : avgForwardPassesAccPct;
  const displayLateralPasses = isSingleMatch ? (selectedMatch.lateral_passes ?? 0) : avgLateralPasses;
  const displayLateralPassesAccPct = isSingleMatch
    ? (selectedMatch.lateral_passes_pct ?? (selectedMatch.lateral_passes ? Math.round(((selectedMatch.lateral_passes_acc || 0) / selectedMatch.lateral_passes) * 100) : 0))
    : avgLateralPassesAccPct;
  const displayBackPasses = isSingleMatch ? (selectedMatch.back_passes ?? 0) : avgBackPasses;
  const displayBackPassesAccPct = isSingleMatch
    ? (selectedMatch.back_passes_pct ?? (selectedMatch.back_passes ? Math.round(((selectedMatch.back_passes_acc || 0) / selectedMatch.back_passes) * 100) : 0))
    : avgBackPassesAccPct;
  const displayLongPasses = isSingleMatch ? (selectedMatch.long_passes ?? 0) : avgLongPasses;
  const displayLongPassesAccPct = isSingleMatch
    ? (selectedMatch.long_passes_pct ?? (selectedMatch.long_passes ? Math.round(((selectedMatch.long_passes_acc || 0) / selectedMatch.long_passes) * 100) : 0))
    : avgLongPassesAccPct;
  const displayFinalThird = isSingleMatch ? (selectedMatch.passes_to_final_third ?? 0) : avgFinalThird;
  const displayFinalThirdAccPct = isSingleMatch
    ? (selectedMatch.passes_to_final_third_pct ?? (selectedMatch.passes_to_final_third ? Math.round(((selectedMatch.passes_to_final_third_acc || 0) / selectedMatch.passes_to_final_third) * 100) : 0))
    : avgFinalThirdAccPct;
  const displayGoalKicks = isSingleMatch ? (selectedMatch.goal_kicks ?? 0) : avgGoalKicks;
  const displayThrowIns = isSingleMatch ? (selectedMatch.throw_ins ?? 0) : avgThrowIns;

  // Indices Tab KPIs
  const displayPpda = isSingleMatch ? (selectedMatch.ppda ?? 0) : avgPpda;
  const displayOpponentPpda = isSingleMatch 
    ? (selectedMatch.opponent_ppda ?? 0) 
    : avgOpponentPpda;
  const displayTempo = isSingleMatch ? (selectedMatch.match_tempo ?? 0) : avgTempo;
  const displayOpponentTempo = isSingleMatch 
    ? (selectedMatch.opponent_match_tempo ?? 0) 
    : avgOpponentTempo;
  const displayPassesPerPoss = isSingleMatch ? (selectedMatch.avg_passes_per_possession ?? 0) : avgPassesPerPoss;
  const displayOpponentPassesPerPoss = isSingleMatch 
    ? (selectedMatch.opponent_avg_passes_per_possession ?? 0) 
    : avgOpponentPassesPerPoss;
  const displayOpponentPassAcc = isSingleMatch 
    ? (selectedMatch.opponent_passing_accuracy ?? 75) 
    : avgOpponentPassingAccuracy;

  // Dynamic Zones Data (Single Match vs Overall Average)
  const dynamicZoneData = [
    {
      zone: 'Low (Αμυντική Ζώνη)',
      Losses: isSingleMatch ? (selectedMatch?.losses_low ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_low || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch?.recoveries_low ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_low || 0), 0) / totalMatches) : 0),
    },
    {
      zone: 'Medium (Κέντρο)',
      Losses: isSingleMatch ? (selectedMatch?.losses_med ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_med || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch?.recoveries_med ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_med || 0), 0) / totalMatches) : 0),
    },
    {
      zone: 'High (Επιθετική Ζώνη)',
      Losses: isSingleMatch ? (selectedMatch?.losses_high ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.losses_high || 0), 0) / totalMatches) : 0),
      Recoveries: isSingleMatch ? (selectedMatch?.recoveries_high ?? 0) : (totalMatches > 0 ? Math.round(matches.reduce((s, m) => s + (m.recoveries_high || 0), 0) / totalMatches) : 0),
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

  // 3. Attacking Single Match Breakdown
  const singleMatchAttackingTypes = isSingleMatch ? [
    { type: 'Σετ Επιθέσεις', Total: selectedMatch.positional_attacks ?? 0, withShots: selectedMatch.positional_attacks_shots ?? 0, Rate: selectedMatch.positional_attacks_pct ?? (selectedMatch.positional_attacks ? Math.round(((selectedMatch.positional_attacks_shots || 0) / selectedMatch.positional_attacks) * 100) : 0) },
  ] : [];

  const singleMatchCorners = isSingleMatch ? [
    { name: 'Κόρνερ', Total: selectedMatch.corners ?? 0, withShots: selectedMatch.corners_shots ?? 0, Rate: selectedMatch.corners_shots_pct ?? (selectedMatch.corners ? Math.round(((selectedMatch.corners_shots || 0) / selectedMatch.corners) * 100) : 0) },
  ] : [];

  const singleMatchFreeKicks = isSingleMatch ? [
    { name: 'Free Kicks', Total: selectedMatch.free_kicks ?? 0, withShots: selectedMatch.free_kicks_shots ?? 0, Rate: selectedMatch.free_kicks_shots_pct ?? (selectedMatch.free_kicks ? Math.round(((selectedMatch.free_kicks_shots || 0) / selectedMatch.free_kicks) * 100) : 0) },
  ] : [];

  const singleMatchCrosses = isSingleMatch ? [
    { name: 'Σέντρες', Total: selectedMatch.crosses ?? 0, Accurate: selectedMatch.crosses_accurate ?? 0, Rate: selectedMatch.crosses_acc_pct ?? (selectedMatch.crosses ? Math.round(((selectedMatch.crosses_accurate || 0) / selectedMatch.crosses) * 100) : 0) },
  ] : [];

  const singleMatchOffDuels = isSingleMatch ? [
    { name: 'Επιθ. Μονομαχίες', Total: selectedMatch.offensive_duels ?? 0, Won: selectedMatch.offensive_duels_won ?? 0, Rate: selectedMatch.offensive_duels_won_pct ?? (selectedMatch.offensive_duels ? Math.round(((selectedMatch.offensive_duels_won || 0) / selectedMatch.offensive_duels) * 100) : 0) },
  ] : [];

  // 4. Defending Single Match: Duels & Actions
  const singleMatchDefDuels = isSingleMatch ? [
    { type: 'Αμυντικές', Total: selectedMatch.defensive_duels ?? 0, Won: selectedMatch.defensive_duels_won ?? 0, Rate: selectedMatch.defensive_duels_won_pct ?? 0 },
    { type: 'Εναέριες', Total: selectedMatch.aerial_duels ?? 0, Won: selectedMatch.aerial_duels_won ?? 0, Rate: selectedMatch.aerial_duels_won_pct ?? 0 },
  ] : [];

  const singleMatchAgainstSets = isSingleMatch ? [
    { type: 'Κόρνερ Κατά', Total: selectedMatch.corners_against ?? 0, withShots: selectedMatch.corners_against_shots ?? 0, Rate: selectedMatch.corners_against_shots_pct ?? 0 },
    { type: 'Free Kicks Κατά', Total: selectedMatch.free_kicks_against ?? 0, withShots: selectedMatch.free_kicks_against_shots ?? 0, Rate: selectedMatch.free_kicks_against_shots_pct ?? 0 },
    { type: 'Σέντρες Κατά', Total: selectedMatch.crosses_against ?? 0, Accurate: selectedMatch.crosses_against_accurate ?? 0, Rate: selectedMatch.crosses_against_acc_pct ?? 0 },
  ] : [];

  // 5. Passing Single Match: Direction & Progression
  const singleMatchPassDirection = isSingleMatch ? [
    { direction: 'Forward (Μπροστά)', count: selectedMatch.forward_passes ?? 0, accurate: selectedMatch.forward_passes_acc ?? 0 },
    { direction: 'Lateral (Πλάγια)', count: selectedMatch.lateral_passes ?? 0, accurate: selectedMatch.lateral_passes_acc ?? 0 },
    { direction: 'Back (Πίσω)', count: selectedMatch.back_passes ?? 0, accurate: selectedMatch.back_passes_acc ?? 0 },
    { direction: 'Long (Μακρινές)', count: selectedMatch.long_passes ?? 0, accurate: selectedMatch.long_passes_acc ?? 0 },
  ] : [];

  const singleMatchFinalThird = isSingleMatch ? [
    { type: 'Final Third Πάσες', total: selectedMatch.passes_to_final_third ?? 0, accurate: selectedMatch.passes_to_final_third_acc ?? 0, rate: selectedMatch.passes_to_final_third_pct ?? (selectedMatch.passes_to_final_third ? Math.round(((selectedMatch.passes_to_final_third_acc || 0) / selectedMatch.passes_to_final_third) * 100) : 0) },
  ] : [];

  // 6. Indices Single Match: Tactical Comparison
  const singleMatchIndicesComparison = isSingleMatch ? [
    { metric: 'PPDA (High Press)', Team: selectedMatch.ppda ?? 0, Opponent: selectedMatch.opponent_ppda ?? 0 },
    { metric: 'Match Tempo', Team: selectedMatch.match_tempo ?? 0, Opponent: selectedMatch.opponent_match_tempo ?? 0 },
    { metric: 'Πάσες / Κατοχή', Team: selectedMatch.avg_passes_per_possession ?? 0, Opponent: selectedMatch.opponent_avg_passes_per_possession ?? 0 },
    { metric: 'Long Passes %', Team: selectedMatch.long_pass_pct ?? 0, Opponent: selectedMatch.opponent_long_pass_pct ?? 0 },
    { metric: 'Απόσταση Σουτ (m)', Team: selectedMatch.avg_shot_distance ?? 0, Opponent: selectedMatch.opponent_avg_shot_distance ?? 0 },
  ] : [];

  // ==========================================
  // TIMELINE CHARTS DATA (For All Matches)
  // ==========================================
  const chronologicalMatches = [...matches].reverse();

  // Helper to extract clean opponent name from fixture string
  const getOpponent = (matchName: string, opponentName?: string) => {
    if (opponentName && !['opponents', 'opponent', 'αντιπαλος', 'αντιπαλοι'].includes(opponentName.toLowerCase().trim())) {
      return opponentName;
    }
    const cleanMatch = matchName.replace(/\s*\d+\s*[:\-]\s*\d+\s*$/, '').trim();
    const parts = cleanMatch.split(/\s*-\s*|\s*vs\.?\s*/i);
    if (parts.length >= 2) {
      const p0 = parts[0].trim();
      const p1 = parts[1].trim();
      if (wyscoutService.isSameTeam(team.name, p0)) {
        return p1;
      }
      return p0;
    }
    return cleanMatch;
  };

  const overviewTimelineData = chronologicalMatches.map(m => ({
    date: m.date.slice(5),
    fullDate: m.date,
    opponent: getOpponent(m.match_name, m.opponent_team_name),
    fullMatch: m.match_name,
    match: m.match_name.split('-')[0].trim().slice(0, 10),
    goals: m.goals,
    xg: m.xg,
    possession: m.possession,
    opponentPossession: m.opponent_possession ?? (100 - (m.possession || 50)),
    shots: m.shots,
    shotsOnTarget: m.shots_on_target,
    opponentShots: m.opponent_shots ?? m.shots_against ?? 0,
    opponentShotsOT: m.opponent_shots_on_target ?? m.shots_against_on_target ?? 0,
    passAccuracy: m.passing_accuracy,
    duels: m.duels || 0,
    duelsWon: m.duels_won || 0,
    duelsWonPct: m.duels_won_pct || 0,
    isSelected: m.id === selectedMatchId
  }));

  const attackingChartData = chronologicalMatches.map(m => {
    const pos = m.positional_attacks || 0;
    const posShots = m.positional_attacks_shots || 0;
    const posPct = m.positional_attacks_pct || (pos > 0 ? Math.round((posShots / pos) * 100) : 0);

    const crn = m.corners || 0;
    const crnShots = m.corners_shots || 0;
    const crnPct = m.corners_shots_pct || (crn > 0 ? Math.round((crnShots / crn) * 100) : 0);

    const fk = m.free_kicks || 0;
    const fkShots = m.free_kicks_shots || 0;
    const fkPct = m.free_kicks_shots_pct || (fk > 0 ? Math.round((fkShots / fk) * 100) : 0);

    const crs = m.crosses || 0;
    const crsAcc = m.crosses_accurate || 0;
    const crsPct = m.crosses_acc_pct || (crs > 0 ? Math.round((crsAcc / crs) * 100) : 0);

    const offD = m.offensive_duels || 0;
    const offDWon = m.offensive_duels_won || 0;
    const offDPct = m.offensive_duels_won_pct || (offD > 0 ? Math.round((offDWon / offD) * 100) : 0);

    return {
      date: m.date.slice(5),
      fullDate: m.date,
      opponent: getOpponent(m.match_name, m.opponent_team_name),
      fullMatch: m.match_name,
      match: m.match_name.split('-')[0].trim().slice(0, 8),
      positional: pos,
      positionalShots: posShots,
      positionalPct: posPct,
      positionalRatio: `${posShots}/${pos}`,
      corners: crn,
      cornersShots: crnShots,
      cornersShotsPct: crnPct,
      freeKicks: fk,
      freeKicksShots: fkShots,
      freeKicksShotsPct: fkPct,
      crosses: crs,
      crossesAccurate: crsAcc,
      crossesAccPct: crsPct,
      offensiveDuels: offD,
      offensiveDuelsWon: offDWon,
      offensiveDuelsWonPct: offDPct,
      isSelected: m.id === selectedMatchId
    };
  });

  const defendingChartData = chronologicalMatches.map(m => {
    const defD = m.defensive_duels || 0;
    const defDWon = m.defensive_duels_won || 0;
    const defDPct = m.defensive_duels_won_pct || (defD > 0 ? Math.round((defDWon / defD) * 100) : 0);
    const aerD = m.aerial_duels || 0;
    const aerDWon = m.aerial_duels_won || 0;
    const aerDPct = m.aerial_duels_won_pct || (aerD > 0 ? Math.round((aerDWon / aerD) * 100) : 0);

    const crnA = m.corners_against || 0;
    const crnAShots = m.corners_against_shots || 0;
    const crnAPct = m.corners_against_shots_pct || (crnA > 0 ? Math.round((crnAShots / crnA) * 100) : 0);

    const fkA = m.free_kicks_against || 0;
    const fkAShots = m.free_kicks_against_shots || 0;
    const fkAPct = m.free_kicks_against_shots_pct || (fkA > 0 ? Math.round((fkAShots / fkA) * 100) : 0);

    const crsA = m.crosses_against || 0;
    const crsAAcc = m.crosses_against_accurate || 0;
    const crsAPct = m.crosses_against_acc_pct || (crsA > 0 ? Math.round((crsAAcc / crsA) * 100) : 0);

    return {
      date: m.date.slice(5),
      fullDate: m.date,
      opponent: getOpponent(m.match_name, m.opponent_team_name),
      fullMatch: m.match_name,
      match: m.match_name.split('-')[0].trim().slice(0, 8),
      conceded: m.conceded_goals ?? m.opponent_goals ?? 0,
      shotsAgainst: m.shots_against ?? m.opponent_shots ?? 0,
      shotsAgainstOT: m.shots_against_on_target ?? 0,
      opponentXg: m.opponent_xg ?? 0,
      defensiveDuels: defD,
      defensiveDuelsWon: defDWon,
      defDuelsPct: defDPct,
      aerialDuels: aerD,
      aerialDuelsWon: aerDWon,
      aerialPct: aerDPct,
      cornersAgainst: crnA,
      cornersAgainstShots: crnAShots,
      cornersAgainstShotsPct: crnAPct,
      freeKicksAgainst: fkA,
      freeKicksAgainstShots: fkAShots,
      freeKicksAgainstShotsPct: fkAPct,
      crossesAgainst: crsA,
      crossesAgainstAcc: crsAAcc,
      crossesAgainstAccPct: crsAPct,
      fouls: m.fouls || 0,
      yellowCards: m.yellow_cards || 0,
      isSelected: m.id === selectedMatchId
    };
  });

  const passingChartData = chronologicalMatches.map(m => {
    const passes = m.passes || 0;
    const passesAcc = m.passes_accurate || 0;
    const passingAcc = m.passing_accuracy || (passes > 0 ? Math.round((passesAcc / passes) * 100) : 0);

    const forward = m.forward_passes || 0;
    const forwardAcc = m.forward_passes_acc || 0;
    const forwardPct = m.forward_passes_pct || (forward > 0 ? Math.round((forwardAcc / forward) * 100) : 0);

    const lateral = m.lateral_passes || 0;
    const lateralAcc = m.lateral_passes_acc || 0;
    const lateralPct = m.lateral_passes_pct || (lateral > 0 ? Math.round((lateralAcc / lateral) * 100) : 0);

    const back = m.back_passes || 0;
    const backAcc = m.back_passes_acc || 0;
    const backPct = m.back_passes_pct || (back > 0 ? Math.round((backAcc / back) * 100) : 0);

    const long = m.long_passes || 0;
    const longAcc = m.long_passes_acc || 0;
    const longPct = m.long_passes_pct || (long > 0 ? Math.round((longAcc / long) * 100) : 0);

    const finalThird = m.passes_to_final_third || 0;
    const finalThirdAcc = m.passes_to_final_third_acc || 0;
    const finalThirdPct = m.passes_to_final_third_pct || (finalThird > 0 ? Math.round((finalThirdAcc / finalThird) * 100) : 0);

    return {
      date: m.date.slice(5),
      fullDate: m.date,
      opponent: getOpponent(m.match_name, m.opponent_team_name),
      fullMatch: m.match_name,
      match: m.match_name.split('-')[0].trim().slice(0, 8),
      passes,
      passesAcc,
      passingAcc,
      forward,
      forwardAcc,
      forwardPct,
      lateral,
      lateralAcc,
      lateralPct,
      back,
      backAcc,
      backPct,
      long,
      longAcc,
      longPct,
      finalThird,
      finalThirdAcc,
      finalThirdPct,
      goalKicks: m.goal_kicks || 0,
      throwIns: m.throw_ins || 0,
      isSelected: m.id === selectedMatchId
    };
  });

  const indicesChartData = chronologicalMatches.map(m => {
    const ppda = m.ppda || 0;
    const oppPpda = m.opponent_ppda || 0;

    const tempo = m.match_tempo || 0;
    const oppTempo = m.opponent_match_tempo || 0;

    const passesPerPoss = m.avg_passes_per_possession || 0;
    const oppPassesPerPoss = m.opponent_avg_passes_per_possession || 0;

    const longPassPct = m.long_pass_pct || 0;
    const oppLongPassPct = m.opponent_long_pass_pct || 0;

    const shotDist = m.avg_shot_distance || 0;
    const oppShotDist = m.opponent_avg_shot_distance || 0;

    const passLength = m.avg_pass_length || 0;
    const oppPassLength = m.opponent_avg_pass_length || 0;

    const possession = m.possession || 50;
    const oppPossession = m.opponent_possession ?? (100 - possession);

    const passingAcc = m.passing_accuracy || 0;
    const oppPassingAcc = m.opponent_passing_accuracy || 75;

    return {
      date: m.date.slice(5),
      fullDate: m.date,
      opponent: getOpponent(m.match_name, m.opponent_team_name),
      fullMatch: m.match_name,
      match: m.match_name.split('-')[0].trim().slice(0, 8),
      ppda,
      oppPpda,
      tempo,
      oppTempo,
      passesPerPoss,
      oppPassesPerPoss,
      longPassPct,
      oppLongPassPct,
      shotDist,
      oppShotDist,
      passLength,
      oppPassLength,
      possession,
      oppPossession,
      passingAcc,
      oppPassingAcc,
      isSelected: m.id === selectedMatchId
    };
  });

  // Reusable Custom Tooltip displaying Opponent, Date, Bar Metrics & Contextual Hover Stats (Percentages & xGA)
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const opponent = data.opponent || data.fullMatch || 'Αντίπαλος';
      const payloadKeys = new Set(payload.map((p: any) => p.dataKey));

      // Extra contextual metrics shown on hover (percentages, opponent xG)
      const extraMetrics: { label: string; value: string; color: string }[] = [];

      // Overview Tab Duels
      if (data.duelsWonPct !== undefined && !payloadKeys.has('duelsWonPct') && (payloadKeys.has('duels') || payloadKeys.has('duelsWon'))) {
        extraMetrics.push({ label: 'Ποσοστό Κερδισμένων', value: `${data.duelsWonPct}%`, color: '#ec4899' });
      }

      // Attacking Tab Metrics
      if (data.positionalPct !== undefined && !payloadKeys.has('positionalPct') && (payloadKeys.has('positional') || payloadKeys.has('positionalShots'))) {
        extraMetrics.push({ label: 'Ποσοστό με Τελική', value: `${data.positionalPct}%`, color: '#10b981' });
      }
      if (data.cornersShotsPct !== undefined && !payloadKeys.has('cornersShotsPct') && (payloadKeys.has('corners') || payloadKeys.has('cornersShots'))) {
        extraMetrics.push({ label: 'Ποσοστό με Τελική', value: `${data.cornersShotsPct}%`, color: '#c084fc' });
      }
      if (data.freeKicksShotsPct !== undefined && !payloadKeys.has('freeKicksShotsPct') && (payloadKeys.has('freeKicks') || payloadKeys.has('freeKicksShots'))) {
        extraMetrics.push({ label: 'Ποσοστό με Τελική', value: `${data.freeKicksShotsPct}%`, color: '#f59e0b' });
      }
      if (data.crossesAccPct !== undefined && !payloadKeys.has('crossesAccPct') && (payloadKeys.has('crosses') || payloadKeys.has('crossesAccurate'))) {
        extraMetrics.push({ label: 'Ακρίβεια Σέντρας', value: `${data.crossesAccPct}%`, color: '#06b6d4' });
      }
      if (data.offensiveDuelsWonPct !== undefined && !payloadKeys.has('offensiveDuelsWonPct') && (payloadKeys.has('offensiveDuels') || payloadKeys.has('offensiveDuelsWon'))) {
        extraMetrics.push({ label: 'Ποσοστό Κερδισμένων', value: `${data.offensiveDuelsWonPct}%`, color: '#ec4899' });
      }

      // Defending Tab Metrics
      if (data.defDuelsPct !== undefined && !payloadKeys.has('defDuelsPct') && (payloadKeys.has('defensiveDuels') || payloadKeys.has('defensiveDuelsWon'))) {
        extraMetrics.push({ label: 'Ποσοστό Κερδισμένων', value: `${data.defDuelsPct}%`, color: '#10b981' });
      }
      if (data.aerialPct !== undefined && !payloadKeys.has('aerialPct') && (payloadKeys.has('aerialDuels') || payloadKeys.has('aerialDuelsWon'))) {
        extraMetrics.push({ label: 'Ποσοστό Κερδισμένων', value: `${data.aerialPct}%`, color: '#06b6d4' });
      }
      if (data.cornersAgainstShotsPct !== undefined && !payloadKeys.has('cornersAgainstShotsPct') && (payloadKeys.has('cornersAgainst') || payloadKeys.has('cornersAgainstShots'))) {
        extraMetrics.push({ label: 'Ποσοστό με Τελική', value: `${data.cornersAgainstShotsPct}%`, color: '#f43f5e' });
      }
      if (data.freeKicksAgainstShotsPct !== undefined && !payloadKeys.has('freeKicksAgainstShotsPct') && (payloadKeys.has('freeKicksAgainst') || payloadKeys.has('freeKicksAgainstShots'))) {
        extraMetrics.push({ label: 'Ποσοστό με Τελική', value: `${data.freeKicksAgainstShotsPct}%`, color: '#ef4444' });
      }
      if (data.crossesAgainstAccPct !== undefined && !payloadKeys.has('crossesAgainstAccPct') && (payloadKeys.has('crossesAgainst') || payloadKeys.has('crossesAgainstAcc'))) {
        extraMetrics.push({ label: 'Ακρίβεια Σέντρας Αντιπάλου', value: `${data.crossesAgainstAccPct}%`, color: '#f43f5e' });
      }

      // Defending Tab: Conceded & Shots Against -> show Expected Goals Κατά (Opponent xG) on hover
      if (data.opponentXg !== undefined && (payloadKeys.has('conceded') || payloadKeys.has('shotsAgainst'))) {
        extraMetrics.push({
          label: 'Expected Goals Κατά (xGA)',
          value: typeof data.opponentXg === 'number' ? data.opponentXg.toFixed(2) : data.opponentXg,
          color: '#fbbf24'
        });
      }

      // Passing Tab Metrics
      if (data.passingAcc !== undefined && payloadKeys.has('passes')) {
        extraMetrics.push({ label: 'Ακρίβεια Πασών', value: `${data.passingAcc}%`, color: '#3b82f6' });
      }
      if (data.forwardPct !== undefined && payloadKeys.has('forward')) {
        extraMetrics.push({ label: 'Ακρίβεια Forward Πασών', value: `${data.forwardPct}%`, color: '#10b981' });
      }
      if (data.lateralPct !== undefined && payloadKeys.has('lateral')) {
        extraMetrics.push({ label: 'Ακρίβεια Lateral Πασών', value: `${data.lateralPct}%`, color: '#8b5cf6' });
      }
      if (data.backPct !== undefined && payloadKeys.has('back')) {
        extraMetrics.push({ label: 'Ακρίβεια Back Πασών', value: `${data.backPct}%`, color: '#a1a1aa' });
      }
      if (data.longPct !== undefined && (payloadKeys.has('long') || payloadKeys.has('longAcc'))) {
        extraMetrics.push({ label: 'Ποσοστό Επιτυχίας Long Passes', value: `${data.longPct}%`, color: '#06b6d4' });
      }
      if (data.finalThirdPct !== undefined && (payloadKeys.has('finalThird') || payloadKeys.has('finalThirdAcc'))) {
        extraMetrics.push({ label: 'Ποσοστό Επιτυχίας Final Third', value: `${data.finalThirdPct}%`, color: '#f59e0b' });
      }

      // Indices Tab Metrics
      if (data.ppda !== undefined && payloadKeys.has('ppda')) {
        extraMetrics.push({ label: 'High Press PPDA Ομάδας', value: `${data.ppda}`, color: '#f43f5e' });
      }
      if (data.oppPpda !== undefined && payloadKeys.has('oppPpda')) {
        extraMetrics.push({ label: 'High Press PPDA Αντιπάλου', value: `${data.oppPpda}`, color: '#94a3b8' });
      }
      if (data.longPassPct !== undefined && payloadKeys.has('longPassPct')) {
        extraMetrics.push({ label: 'Ποσοστό Long Passes (Ομάδα)', value: `${data.longPassPct}%`, color: '#f59e0b' });
      }
      if (data.oppLongPassPct !== undefined && payloadKeys.has('oppLongPassPct')) {
        extraMetrics.push({ label: 'Ποσοστό Long Passes (Αντίπαλος)', value: `${data.oppLongPassPct}%`, color: '#94a3b8' });
      }
      if (data.oppTempo !== undefined && payloadKeys.has('oppTempo')) {
        extraMetrics.push({ label: 'Ρυθμός Αντιπάλου', value: `${data.oppTempo}`, color: '#38bdf8' });
      }
      if (data.oppPassesPerPoss !== undefined && payloadKeys.has('oppPassesPerPoss')) {
        extraMetrics.push({ label: 'Πάσες/Κατοχή Αντιπάλου', value: `${data.oppPassesPerPoss}`, color: '#a855f7' });
      }
      if (data.oppShotDist !== undefined && payloadKeys.has('oppShotDist')) {
        extraMetrics.push({ label: 'Απόσταση Σουτ Αντιπάλου', value: `${data.oppShotDist}m`, color: '#f97316' });
      }

      return (
        <div className="p-3 rounded-xl bg-zinc-950/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md text-xs space-y-2 min-w-[220px]">
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

            {extraMetrics.map((em, idx) => (
              <div key={`extra-${idx}`} className="flex items-center justify-between gap-3 text-xs pt-1.5 mt-1.5 border-t border-zinc-800/90">
                <span className="flex items-center gap-1.5 font-bold" style={{ color: em.color }}>
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: em.color }} />
                  <span className="truncate max-w-[140px]">{em.label}:</span>
                </span>
                <span className="font-black px-1.5 py-0.5 rounded text-[11px]" style={{ color: em.color, backgroundColor: `${em.color}18`, border: `1px solid ${em.color}40` }}>
                  {em.value}
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
                        {isSingleMatch ? selectedMatch?.scheme : 'Σύνολο Αναλύσεων'}
                      </span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        {isSingleMatch ? 'Expected Goals' : 'Μ.Ο. xG'}
                      </span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayXg}</span>
                      <span className="text-[9px] text-zinc-500">{displayShots} ({displayShotsOT} εντός | vs {displayOpponentShots})</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                        {isSingleMatch ? 'Γκολ' : 'Μ.Ο. Γκολ'}
                      </span>
                      <span className="text-xl font-black text-white mt-1 block">{displayGoals}</span>
                      <span className="text-[9px] text-zinc-500">
                        {isSingleMatch 
                          ? (selectedMatch?.opponent_goals !== undefined ? `vs ${selectedMatch.opponent_goals}` : 'Τελικό Σκορ') 
                          : `${(avgGoals / (avgXg || 1)).toFixed(2)}x Ratio`}
                      </span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κατοχή %</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayPossession}%</span>
                      <span className="text-[9px] text-zinc-500">vs {displayOpponentPossession}% Αντ.</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες %</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayPassAccuracy}%</span>
                      <span className="text-[9px] text-zinc-500">Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Μονομαχίες %</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayDuelsWonPct}%</span>
                      <span className="text-[9px] text-zinc-500">{displayDuelsWon}/{displayDuels} κερδισμένες</span>
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
                    <div className="space-y-6">
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
                            Κατοχή Μπάλας ({team.name} vs Αντίπαλος)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύγκριση ποσοστού κατοχής ανά αγώνα δίπλα-δίπλα</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overviewTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis domain={[0, 100]} stroke="#71717a" fontSize={10} unit="%" />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="possession" name={`Κατοχή ${team.name} (%)`} fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="opponentPossession" name="Κατοχή Αντιπάλου (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Overview Charts Row 2: Team Shots & Opponent Shots (Separated) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Chart 3: Team Shots */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Target className="h-4 w-4 text-primary" />
                            Τελικές Προσπάθειες & Στην Εστία ({team.name})
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συνολικές τελικές και προσπάθειες στην εστία της ομάδας</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overviewTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="shots" name={`Τελικές ${team.name}`} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="shotsOnTarget" name={`Στην Εστία ${team.name}`} fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart 4: Opponent Shots */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Target className="h-4 w-4 text-rose-400" />
                            Τελικές Προσπάθειες & Στην Εστία Αντιπάλου
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συνολικές τελικές και προσπάθειες στην εστία που δέχτηκε η ομάδα</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overviewTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="opponentShots" name="Τελικές Αντιπάλου" fill="#ef4444" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="opponentShotsOT" name="Στην Εστία Αντιπάλου" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* Overview Charts Row 3: Duels Won (No percentage line, shown on hover) */}
                    <div className="grid grid-cols-1 gap-6">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-purple-400" />
                            Μονομαχίες Αγώνα (Σύνολο & Κερδισμένες)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συνολικές και κερδισμένες μονομαχίες ανά αγώνα (ποσοστό στο hover)</span>
                        </div>

                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={overviewTimelineData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="duels" name="Σύνολο Μονομαχιών" fill="#52525b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="duelsWon" name="Κερδισμένες" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overview Charts Row 4: Pitch Zones & Scheme (Balanced 50/50 Grid, slim bars) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
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
                        <BarChart data={dynamicZoneData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="zone" stroke="#71717a" fontSize={10} />
                          <YAxis stroke="#71717a" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                          <Bar dataKey="Recoveries" name="Ανακτήσεις Μπάλας (Recoveries)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={22} />
                          <Bar dataKey="Losses" name="Απώλειες Μπάλας (Losses)" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={22} />
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

                    {isSingleMatch && selectedMatch ? (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Σετ Επιθέσεις</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPositional}</span>
                      <span className="text-[9px] text-emerald-400 font-semibold">{displayPositionalShots}/{displayPositional} ({displayPositionalPct}%) με Τελική</span>
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
                      <span className="text-[9px] text-emerald-400 font-semibold">{displayCornersShots} με Τελική ({displayCornersPct}%)</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Free Kicks</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayFreeKicks}</span>
                      <span className="text-[9px] text-amber-300 font-semibold">{displayFreeKicksShots} με Τελική ({displayFreeKicksPct}%)</span>
                    </div>
                  </div>

                  {/* Attacking Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            Σετ Επιθέσεις Αγώνα (Σύνολο & με Τελική)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Κατάληξη οργανωμένης επίθεσης σε τελική: {selectedMatch.positional_attacks_shots ?? 0}/{selectedMatch.positional_attacks ?? 0}</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchAttackingTypes}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Συνολικές Σετ Επιθέσεις" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="withShots" name="Με Τελική Προσπάθεια" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Target className="h-4 w-4 text-purple-400" />
                            Στατικές Φάσεις Αγώνα (Κόρνερ & Free Kicks)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Εκτελέσεις και κατάληξη σε τελική προσπάθεια</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...singleMatchCorners, ...singleMatchFreeKicks]}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο Εκτελέσεων" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="withShots" name="Με Τελική" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Crosshair className="h-4 w-4 text-cyan-400" />
                            Σέντρες Αγώνα (Crosses)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύνολο σεντρών, εύστοχες και ποσοστό</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchCrosses}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο Σεντρών" fill="#52525b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Accurate" name="Εύστοχες" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Activity className="h-4 w-4 text-pink-400" />
                            Επιθετικές Μονομαχίες Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύνολο μονομαχιών, κερδισμένες και ποσοστό</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchOffDuels}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο Μονομαχιών" fill="#52525b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Won" name="Κερδισμένες" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Row 1: Set Attacks & Corners */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1: Set Attacks */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Zap className="h-4 w-4 text-primary" />
                              Σετ Επιθέσεις ανά Αγώνα (Σύνολο & με Τελική)
                            </h4>
                            <span className="text-[10px] text-zinc-400">Συχνότητα και ποσοστό κατάληξης σε τελική (π.χ. 10/35)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={attackingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="positional" name="Σετ Επιθέσεις (Σύνολο)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="positionalShots" name="Σετ με Τελική" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Corners */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Target className="h-4 w-4 text-purple-400" />
                              Κόρνερ & Τελικές από Κόρνερ ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο κερδισμένων κόρνερ, τελικές (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={attackingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="corners" name="Κόρνερ" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="cornersShots" name="Τελικές από Κόρνερ" fill="#c084fc" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Free Kicks & Crosses */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 3: Free Kicks */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-400" />
                              Free Kicks (Φάουλ) & Τελικές ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Εκτελέσεις φάουλ, τελικές προσπάθειες (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={attackingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="freeKicks" name="Free Kicks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="freeKicksShots" name="Τελικές από Free Kicks" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 4: Crosses */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Crosshair className="h-4 w-4 text-cyan-400" />
                              Σέντρες (Crosses) ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο σεντρών, εύστοχες (ποσοστό ακρίβειας στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={attackingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="crosses" name="Σύνολο Σεντρών" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="crossesAccurate" name="Εύστοχες Σέντρες" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Offensive Duels */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Activity className="h-4 w-4 text-pink-400" />
                              Επιθετικές Μονομαχίες ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο επιθετικών μονομαχιών, κερδισμένες (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={attackingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="offensiveDuels" name="Σύνολο Επιθ. Μονομαχιών" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="offensiveDuelsWon" name="Κερδισμένες Μονομαχίες" fill="#f472b6" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. DEFENDING SUB-TAB */}
              {activeCategoryTab === 'defending' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Defending KPIs: 8 Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                      <span className="text-[9px] text-zinc-400">{displayDefDuelsWon}/{displayDefDuels} κερδισμένες</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Εναέριες Μονομαχίες</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayAerialDuelsWonPct}%</span>
                      <span className="text-[9px] text-zinc-400">{displayAerialDuelsWon}/{displayAerialDuels} κερδισμένες</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κόρνερ Κατά</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayCornersAgainst}</span>
                      <span className="text-[9px] text-zinc-400">{displayCornersAgainstShots} με Τελική ({displayCornersAgainstPct}%)</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Free Kicks Κατά</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayFreeKicksAgainst}</span>
                      <span className="text-[9px] text-zinc-400">{displayFreeKicksAgainstShots} με Τελική ({displayFreeKicksAgainstPct}%)</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Φάουλ</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayFouls}</span>
                      <span className="text-[9px] text-zinc-500">{isSingleMatch ? 'Αγώνα' : 'Μ.Ο. Αγώνα'}</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κίτρινες Κάρτες</span>
                      <span className="text-xl font-black text-amber-300 mt-1 block">{displayYellowCards}</span>
                      <span className="text-[9px] text-zinc-500">{isSingleMatch ? 'Αγώνα' : 'Μ.Ο. Αγώνα'}</span>
                    </div>
                  </div>

                  {/* Defending Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-400" />
                            Αμυντικές & Εναέριες Μονομαχίες Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύνολο και κερδισμένες μονομαχίες</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchDefDuels}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο Μονομαχιών" fill="#52525b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Won" name="Κερδισμένες" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <ShieldAlert className="h-4 w-4 text-rose-400" />
                            Στατικές Φάσεις & Σέντρες Κατά της Ομάδας
                          </h4>
                          <span className="text-[10px] text-zinc-400">Κόρνερ, Free Kicks και Σέντρες που δέχτηκε η ομάδα</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchAgainstSets}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Total" name="Σύνολο" fill="#52525b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="withShots" name="Με Τελική (Στατικές)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Accurate" name="Εύστοχες (Σέντρες)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Row 1: Duels (Defensive & Aerial) */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1: Defensive Duels */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Shield className="h-4 w-4 text-emerald-400" />
                              Αμυντικές Μονομαχίες ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο αμυντικών μονομαχιών, κερδισμένες και ποσοστό (%)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={defendingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="defensiveDuels" name="Σύνολο Αμυντ. Μονομαχιών" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="defensiveDuelsWon" name="Κερδισμένες" fill="#10b981" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Aerial Duels */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Activity className="h-4 w-4 text-cyan-400" />
                              Εναέριες Μονομαχίες ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο εναέριων μονομαχιών, κερδισμένες (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={defendingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="aerialDuels" name="Σύνολο Εναέριων" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="aerialDuelsWon" name="Κερδισμένες Εναέριες" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Corners Against & Free Kicks Against */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 3: Corners Against */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4 text-purple-400" />
                              Κόρνερ Κατά της Ομάδας ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Συνολικά κόρνερ αντιπάλου, τελικές που δέχτηκε η ομάδα (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={defendingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="cornersAgainst" name="Κόρνερ Κατά" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="cornersAgainstShots" name="με Τελική Αντιπάλου" fill="#c084fc" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 4: Free Kicks Against */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-400" />
                              Free Kicks Κατά της Ομάδας ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Συνολικά φάουλ αντιπάλου, τελικές που δέχτηκε η ομάδα (ποσοστό στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={defendingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="freeKicksAgainst" name="Free Kicks Κατά" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="freeKicksAgainstShots" name="με Τελική Αντιπάλου" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Crosses Against & Conceded / Shots Against */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 5: Crosses Against */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Crosshair className="h-4 w-4 text-cyan-400" />
                              Σέντρες (Crosses) Κατά της Ομάδας ανά Αγώνα
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύνολο σεντρών αντιπάλου, εύστοχες (ποσοστό ακρίβειας στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={defendingChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="crossesAgainst" name="Σέντρες Κατά" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="crossesAgainstAcc" name="Εύστοχες Κατά" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 6: Conceded & Shots Against */}
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
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. PASSING SUB-TAB */}
              {activeCategoryTab === 'passing' && (
                <div className="space-y-6 animate-fade-in">
                  {/* Passing KPIs (8 cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPasses}</span>
                      <span className="text-[9px] text-amber-400 font-bold">{displayPassAccuracy}% Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Forward Passes</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayForwardPasses}</span>
                      <span className="text-[9px] text-emerald-300 font-bold">{displayForwardPassesAccPct}% Επιτυχία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Lateral Passes</span>
                      <span className="text-xl font-black text-blue-400 mt-1 block">{displayLateralPasses}</span>
                      <span className="text-[9px] text-blue-300 font-bold">{displayLateralPassesAccPct}% Επιτυχία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Back Passes</span>
                      <span className="text-xl font-black text-zinc-300 mt-1 block">{displayBackPasses}</span>
                      <span className="text-[9px] text-zinc-400 font-bold">{displayBackPassesAccPct}% Επιτυχία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Long Passes</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayLongPasses}</span>
                      <span className="text-[9px] text-cyan-300 font-bold">{displayLongPassesAccPct}% Επιτυχία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Final Third Passes</span>
                      <span className="text-xl font-black text-amber-400 mt-1 block">{displayFinalThird}</span>
                      <span className="text-[9px] text-amber-300 font-bold">{displayFinalThirdAccPct}% Επιτυχία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Goal Kicks</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayGoalKicks}</span>
                      <span className="text-[9px] text-purple-300">Ελεύθερα {isSingleMatch ? 'Αγώνα' : 'Μ.Ο.'}</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πλάγια Άουτ</span>
                      <span className="text-xl font-black text-rose-400 mt-1 block">{displayThrowIns}</span>
                      <span className="text-[9px] text-rose-300">Throw-ins {isSingleMatch ? 'Αγώνα' : 'Μ.Ο.'}</span>
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
                            <TrendingUp className="h-4 w-4 text-amber-400" />
                            Πάσες στο Επιθετικό Τρίτο (Final Third)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συνολικές, επιτυχημένες και ποσοστό επιτυχίας</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchFinalThird}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="type" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="total" name="Σύνολο Final Third" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="accurate" name="Επιτυχημένες" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Chart 1: Passes, Forward passes, Lateral passes, Back passes side-by-side */}
                      <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Compass className="h-4 w-4 text-emerald-400" />
                            Κατανομή Μεταβιβάσεων ανά Αγώνα (Passes, Forward, Lateral, Back)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Μπάρες δίπλα-δίπλα ανά αγώνα (ποσοστά επιτυχίας στο hover)</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="passes" name="Συνολικές Πάσες" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="forward" name="Forward Passes" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="lateral" name="Lateral Passes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="back" name="Back Passes" fill="#71717a" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart 2: Long Passes (Total vs Accurate, % on hover) */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Layers className="h-4 w-4 text-cyan-400" />
                            Μακρινές Μεταβιβάσεις (Long Passes) ανά Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Σύνολο long passes & επιτυχημένες (ποσοστό επιτυχίας στο hover)</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="long" name="Σύνολο Long Passes" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="longAcc" name="Επιτυχημένες Long" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Chart 3: Final Third passes (Total vs Accurate, % on hover) */}
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-amber-400" />
                            Πάσες στο Επιθετικό Τρίτο (Final Third) ανά Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Συνολικές και επιτυχημένες πάσες (ποσοστό επιτυχίας στο hover)</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={passingChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip content={<CustomChartTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="finalThird" name="Σύνολο Final Third" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="finalThirdAcc" name="Επιτυχημένες Final Third" fill="#10b981" radius={[4, 4, 0, 0]} />
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
                  {/* Indices KPIs (8 cards) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">PPDA High Press (Ομάδα)</span>
                      <span className="text-xl font-black text-rose-400 mt-1 block">{displayPpda}</span>
                      <span className="text-[9px] text-zinc-400">Ένταση Πίεσης Ψηλά</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">PPDA High Press (Αντίπαλος)</span>
                      <span className="text-xl font-black text-slate-300 mt-1 block">{displayOpponentPpda}</span>
                      <span className="text-[9px] text-zinc-400">Πίεση Ψηλά Αντιπάλου</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Ρυθμός / Tempo (Ομάδα)</span>
                      <span className="text-xl font-black text-emerald-400 mt-1 block">{displayTempo}</span>
                      <span className="text-[9px] text-zinc-400">Πάσες/λεπτό κατοχής</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Ρυθμός / Tempo (Αντίπαλος)</span>
                      <span className="text-xl font-black text-sky-400 mt-1 block">{displayOpponentTempo}</span>
                      <span className="text-[9px] text-zinc-400">Πάσες/λεπτό αντιπάλου</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες / Κατοχή (Ομάδα)</span>
                      <span className="text-xl font-black text-cyan-400 mt-1 block">{displayPassesPerPoss}</span>
                      <span className="text-[9px] text-zinc-400">Μέση Ακολουθία</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Πάσες / Κατοχή (Αντίπαλος)</span>
                      <span className="text-xl font-black text-purple-400 mt-1 block">{displayOpponentPassesPerPoss}</span>
                      <span className="text-[9px] text-zinc-400">Ακολουθία Αντιπάλου</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κατοχή & Ακρίβεια (Ομάδα)</span>
                      <span className="text-xl font-black text-white mt-1 block">{displayPossession}%</span>
                      <span className="text-[9px] text-emerald-400 font-bold">{displayPassAccuracy}% Ακρίβεια</span>
                    </div>

                    <div className="glass-panel p-3.5 rounded-xl border border-border text-center">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Κατοχή & Ακρίβεια (Αντίπαλος)</span>
                      <span className="text-xl font-black text-zinc-300 mt-1 block">{displayOpponentPossession}%</span>
                      <span className="text-[9px] text-sky-400 font-bold">{displayOpponentPassAcc}% Ακρίβεια</span>
                    </div>
                  </div>

                  {/* Indices Charts: Single Match vs Aggregate */}
                  {isSingleMatch ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-rose-400" />
                            Τακτικοί Δείκτες Αγώνα (Ομάδα vs Αντίπαλος)
                          </h4>
                          <span className="text-[10px] text-zinc-400">Άμεση σύγκριση PPDA High Press, ρυθμού, ακολουθιών και αποστάσεων</span>
                        </div>
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={singleMatchIndicesComparison}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                              <XAxis dataKey="metric" stroke="#71717a" fontSize={10} />
                              <YAxis stroke="#71717a" fontSize={10} />
                              <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                              <Bar dataKey="Team" name={team.name} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Opponent" name="Αντίπαλος" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                            <Timer className="h-4 w-4 text-emerald-400" />
                            Επεξήγηση PPDA High Press & Ρυθμού Αγώνα
                          </h4>
                          <span className="text-[10px] text-zinc-400">Τακτικό αποτύπωμα πίεσης</span>
                        </div>
                        <div className="p-4 rounded-xl bg-zinc-900 border border-border space-y-3 text-xs">
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="text-zinc-400">PPDA High Press (Πάσες ανά ενέργεια):</span>
                            <span className="font-black text-rose-400">{selectedMatch.ppda ?? '-'}</span>
                          </div>
                          <div className="flex justify-between items-center pb-2 border-b border-border/60">
                            <span className="text-zinc-400">PPDA High Press Αντιπάλου:</span>
                            <span className="font-black text-slate-300">{selectedMatch.opponent_ppda ?? '-'}</span>
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
                    <div className="space-y-6">
                      {/* Row 1: PPDA High Press & Match Tempo */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 1: PPDA High Press (Team vs Opponent) */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Gauge className="h-4 w-4 text-rose-400" />
                              PPDA Ένταση Πίεσης (High Press) - Ομάδα vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Χαμηλότερη τιμή = πιο επιθετικό high pressing (τιμές στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={indicesChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="ppda" name="High Press PPDA Ομάδας" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="oppPpda" name="High Press PPDA Αντιπάλου" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 2: Match Tempo (Team vs Opponent) */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Timer className="h-4 w-4 text-emerald-400" />
                              Ρυθμός Αγώνα (Match Tempo) - Ομάδα vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Πάσες ανά λεπτό καθαρής κατοχής για κάθε ομάδα</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={indicesChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="tempo" name="Tempo Ομάδας" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="oppTempo" name="Tempo Αντιπάλου" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Passes per Possession & Long Passes % */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 3: Passes per Possession (Team vs Opponent) */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Activity className="h-4 w-4 text-cyan-400" />
                              Πάσες ανά Κατοχή - Ομάδα vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Μέσο μήκος ακολουθίας μεταβιβάσεων ανά κατοχή</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={indicesChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="passesPerPoss" name="Πάσες/Κατοχή Ομάδας" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="oppPassesPerPoss" name="Πάσες/Κατοχή Αντιπάλου" fill="#a855f7" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Chart 4: Long Passes % (Team vs Opponent) */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-amber-400" />
                              Ποσοστό Μακρινών Μεταβιβάσεων (Long Passes %) - Ομάδα vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Σύγκριση άμεσου παιχνιδιού (ποσοστά στο hover)</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={indicesChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="longPassPct" name="Long Passes % Ομάδας" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="oppLongPassPct" name="Long Passes % Αντιπάλου" fill="#64748b" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>

                      {/* Row 3: Average Shot Distance & Tactical Insight Panel */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart 5: Average Shot Distance (Team vs Opponent) */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Target className="h-4 w-4 text-rose-400" />
                              Μέση Απόσταση Σουτ (Average Shot Distance - m) - Ομάδα vs Αντίπαλος
                            </h4>
                            <span className="text-[10px] text-zinc-400">Μέση απόσταση εκτέλεσης σε μέτρα</span>
                          </div>
                          <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={indicesChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} />
                                <YAxis stroke="#71717a" fontSize={10} />
                                <Tooltip content={<CustomChartTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                                <Bar dataKey="shotDist" name="Απόσταση Σουτ Ομάδας (m)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="oppShotDist" name="Απόσταση Σουτ Αντιπάλου (m)" fill="#f97316" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Card 6: Tactical Pressing & Tempo Insights */}
                        <div className="glass-panel p-5 rounded-2xl border border-border space-y-4 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Shield className="h-4 w-4 text-primary" />
                              Τακτικό Αποτύπωμα High Press & Ρυθμού
                            </h4>
                            <span className="text-[10px] text-zinc-400">Ερμηνεία δεικτών πίεσης Wyscout</span>
                          </div>
                          <div className="p-4 rounded-xl bg-zinc-900 border border-border space-y-2.5 text-xs">
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-zinc-400">Κλίμακα PPDA High Press:</span>
                              <span className="font-bold text-rose-400">&lt; 9.0 (Επιθετικό High Press)</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-zinc-400">Μ.Ο. PPDA High Press:</span>
                              <span className="font-bold text-white">{avgPpda} (Ομάδα) vs {avgOpponentPpda} (Αντίπαλος)</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-zinc-400">Μ.Ο. Match Tempo (Πάσες/λεπτό):</span>
                              <span className="font-bold text-emerald-400">{avgTempo} (Ομάδα) vs {avgOpponentTempo} (Αντίπαλος)</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-zinc-400">Μ.Ο. Πάσες ανά Κατοχή:</span>
                              <span className="font-bold text-cyan-400">{avgPassesPerPoss} (Ομάδα) vs {avgOpponentPassesPerPoss} (Αντίπαλος)</span>
                            </div>
                            <div className="flex justify-between items-center pb-2 border-b border-border/60">
                              <span className="text-zinc-400">Μ.Ο. Long Passes %:</span>
                              <span className="font-bold text-amber-400">{avgLongPassPct}% (Ομάδα) vs {avgOpponentLongPassPct}% (Αντίπαλος)</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-zinc-400">Μ.Ο. Απόσταση Σουτ (m):</span>
                              <span className="font-bold text-rose-300">{avgShotDist}m (Ομάδα) vs {avgOpponentShotDist}m (Αντίπαλος)</span>
                            </div>
                          </div>
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
