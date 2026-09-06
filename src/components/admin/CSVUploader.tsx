import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { dbService } from '../../lib/supabase';
import { Player, PlayerMatchStats } from '../../types';
import { Upload, FileText, Download, CheckCircle, AlertTriangle, RefreshCw, UserPlus } from 'lucide-react';

export default function CSVUploader() {
  const [fileType, setFileType] = useState<'player' | 'team'>('player');
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning' | null, message: string }>({ type: null, message: '' });
  const [loading, setLoading] = useState(false);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('auto_create');
  
  // New Player Form State (when Auto-Creating)
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState(10);
  const [newPlayerPosition, setNewPlayerPosition] = useState<'GK' | 'DEF' | 'MID' | 'FWD'>('MID');
  const [newPlayerRole, setNewPlayerRole] = useState('Central Midfielder');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRoster = async () => {
    const roster = await dbService.getPlayers();
    setPlayers(roster);
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseFile(e.target.files[0]);
    }
  };

  // Guess position from Wyscout coordinates
  const guessPosition = (posStr: string): 'GK' | 'DEF' | 'MID' | 'FWD' => {
    const p = String(posStr || '').toUpperCase();
    if (p.includes('GK')) return 'GK';
    if (p.includes('CB') || p.includes('LB') || p.includes('RB') || p.includes('WB') || p.includes('DF')) return 'DEF';
    if (p.includes('MF') || p.includes('DM') || p.includes('AM') || p.includes('CM')) return 'MID';
    if (p.includes('FW') || p.includes('CF') || p.includes('ST') || p.includes('LF') || p.includes('RF') || p.includes('LW') || p.includes('RW')) return 'FWD';
    return 'MID';
  };

  // Guess default role based on position
  const getDefaultRole = (pos: 'GK' | 'DEF' | 'MID' | 'FWD'): string => {
    if (pos === 'GK') return 'Sweeper Keeper';
    if (pos === 'DEF') return 'Central Defender';
    if (pos === 'MID') return 'Central Midfielder';
    return 'Advanced Forward';
  };

  const parseFile = (file: File) => {
    setLoading(true);
    setFeedback({ type: null, message: '' });
    
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCSV = file.name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      setFeedback({ type: 'error', message: 'Supported formats: Excel (.xlsx, .xls) and CSV (.csv).' });
      setLoading(false);
      return;
    }

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);

          setLoading(false);
          if (json.length === 0) {
            setFeedback({ type: 'error', message: 'The Excel sheet appears to be empty.' });
            return;
          }

          const firstRow = json[0] as any;
          const dataHeaders = Object.keys(firstRow || {});
          setHeaders(dataHeaders);
          setParsedData(json);

          // Format detection
          const isWyscoutPlayerFormat = json.length > 0 && 'Total actions / successful' in firstRow;
          const isWyscoutTeamFormat = json.length > 0 && 'Possession, %' in firstRow;

          if (isWyscoutPlayerFormat && fileType === 'player') {
            let guessedName = file.name.replace(/\.(xlsx|xls)$/i, '').replace(/Player stats/i, '').trim();
            const firstPos = firstRow.Position ? String(firstRow.Position).split(',')[0].trim() : 'MID';
            const guessedPos = guessPosition(firstPos);

            setNewPlayerName(guessedName);
            setNewPlayerPosition(guessedPos);
            setNewPlayerRole(getDefaultRole(guessedPos));
            setNewPlayerNumber(1 + Math.floor(Math.random() * 25));

            setFeedback({
              type: 'success',
              message: `Detected Wyscout Excel Player Sheet. Ready to setup profile for new player: "${guessedName}".`
            });
          } else if (isWyscoutTeamFormat && fileType === 'team') {
            setFeedback({
              type: 'success',
              message: `Detected Wyscout Excel Team Sheet. Ready to ingest ${json.length} matches for Greece U17.`
            });
          } else {
            const missingCols = getMissingColumns(dataHeaders, fileType);
            if (missingCols.length > 0) {
              setFeedback({
                type: 'warning',
                message: `Column headers do not match expected standard template or Wyscout schema. Missing headers: ${missingCols.join(', ')}`
              });
            } else {
              setFeedback({
                type: 'success',
                message: `Successfully parsed ${json.length} rows using standard schema.`
              });
            }
          }
        } catch (err: any) {
          setLoading(false);
          setFeedback({ type: 'error', message: `Failed to parse Excel: ${err.message || err}` });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV Parsing using PapaParse
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          setLoading(false);
          if (results.errors.length > 0) {
            setFeedback({ 
              type: 'warning', 
              message: `Parsed file, but found ${results.errors.length} CSV parsing issues. Check formatting.` 
            });
          }
          
          if (results.data.length === 0) {
            setFeedback({ type: 'error', message: 'The CSV file appears to be empty.' });
            return;
          }

          const firstRow = results.data[0] as any;
          const dataHeaders = Object.keys(firstRow || {});
          setHeaders(dataHeaders);
          setParsedData(results.data);

          // Auto-detect format structure
          const isWyscoutPlayerFormat = results.data.length > 0 && 'Total actions / successful' in firstRow;
          const isWyscoutTeamFormat = results.data.length > 0 && 'Possession, %' in firstRow;

          if (isWyscoutPlayerFormat && fileType === 'player') {
            let guessedName = file.name.replace(/\.csv$/i, '').replace(/Player stats/i, '').trim();
            const firstPos = firstRow.Position ? String(firstRow.Position).split(',')[0].trim() : 'MID';
            const guessedPos = guessPosition(firstPos);

            setNewPlayerName(guessedName);
            setNewPlayerPosition(guessedPos);
            setNewPlayerRole(getDefaultRole(guessedPos));
            setNewPlayerNumber(1 + Math.floor(Math.random() * 25));

            setFeedback({
              type: 'success',
              message: `Detected Wyscout CSV Player Sheet. Ready to setup profile for new player: "${guessedName}".`
            });
          } else if (isWyscoutTeamFormat && fileType === 'team') {
            setFeedback({
              type: 'success',
              message: `Detected Wyscout CSV Team Sheet. Ready to ingest ${results.data.length} match records for Greece U17 fixtures.`
            });
          } else {
            const missingCols = getMissingColumns(dataHeaders, fileType);
            if (missingCols.length > 0) {
              setFeedback({
                type: 'warning',
                message: `Column headers do not match expected standard template or Wyscout schema. Missing headers: ${missingCols.join(', ')}`
              });
            } else {
              setFeedback({
                type: 'success',
                message: `Successfully parsed ${results.data.length} rows using standard schema.`
              });
            }
          }
        },
        error: (err) => {
          setLoading(false);
          setFeedback({ type: 'error', message: `Failed to parse file: ${err.message}` });
        }
      });
    }
  };

  const getMissingColumns = (cols: string[], type: 'player' | 'team'): string[] => {
    const requiredPlayerCols = ['player_id', 'match_id', 'minutes_played', 'goals', 'assists'];
    const requiredTeamCols = ['match_id', 'possession', 'shots', 'shots_on_target', 'formation'];
    
    const targets = type === 'player' ? requiredPlayerCols : requiredTeamCols;
    return targets.filter(req => !cols.includes(req));
  };

  const downloadTemplate = () => {
    let csvContent = "";
    let filename = "";

    if (fileType === 'player') {
      filename = "player_match_stats_template.csv";
      csvContent = "player_id,match_id,minutes_played,goals,assists,shots,shots_on_target,passing_accuracy,passes_completed,passes_attempted,key_passes,xG,xA,distance_covered,duels_won,duels_attempted,tackles,interceptions,recoveries,saves,goals_conceded,clean_sheet\n";
      csvContent += "kostoglou,m_2026-03-31_Norway_U17,90,0,0,1,0,85,25,30,1,0.06,0.1,10.2,6,10,2,3,4,0,0,true\n";
    } else {
      filename = "team_match_stats_template.csv";
      csvContent = "match_id,possession,shots,shots_on_target,fouls,corners,yellow_cards,red_cards,formation\n";
      csvContent += "m_2026-03-31_Norway_U17,51,11,2,10,6,1,0,3-4-3\n";
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseOpponentAndScore = (matchName: string, teamName: string) => {
    const parts = matchName.split(" - ");
    let opponent = "Opponent";
    let venue: 'Home' | 'Away' = 'Home';
    let ourScore = 0;
    let oppScore = 0;

    if (parts.length === 2) {
      const homeTeam = parts[0].trim();
      const awayPart = parts[1].trim();
      const awayTeam = awayPart.split(/\s\d/)[0].trim();
      
      const scoreMatch = matchName.match(/\d+:\d+/);
      const scoreStr = scoreMatch ? scoreMatch[0] : "0:0";
      const [homeScore, oppScoreVal] = scoreStr.split(":").map(Number);

      if (awayTeam.includes(teamName) || awayTeam.includes("Greece") || awayTeam.includes("Borussia") || awayTeam.includes("Dortmund")) {
        opponent = homeTeam;
        venue = 'Away';
        ourScore = oppScoreVal;
        oppScore = homeScore;
      } else {
        opponent = awayTeam;
        venue = 'Home';
        ourScore = homeScore;
        oppScore = oppScoreVal;
      }
    }

    return { opponent, venue, ourScore, oppScore };
  };

  const handleUploadSubmit = async () => {
    if (parsedData.length === 0) return;
    setLoading(true);

    try {
      if (fileType === 'player') {
        const isWyscoutFormat = 'Total actions / successful' in parsedData[0];
        let targetId = selectedPlayerId;

        // Auto-create player if option selected
        if (selectedPlayerId === 'auto_create' && isWyscoutFormat) {
          if (!newPlayerName.trim()) {
            throw new Error('Please specify a name for the new player.');
          }

          // Generate Unique ID
          targetId = `p_${newPlayerName.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

          // Calculate average attributes from Wyscout stats to seed FIFA attributes
          const totalMins = parsedData.reduce((sum, row) => sum + Number(row["Minutes played"] ?? 0), 0);
          const totalRows = parsedData.length;
          
          let avgPassAccuracy = 0;
          let passRows = 0;
          parsedData.forEach(row => {
            const att = Number(row["Passes / accurate"] ?? 0);
            const acc = Number(row["_2"] ?? 0);
            if (att > 0) {
              avgPassAccuracy += (acc / att) * 100;
              passRows++;
            }
          });
          const passingAttr = passRows > 0 ? Math.round(avgPassAccuracy / passRows) : 70;

          const totalGoals = parsedData.reduce((sum, row) => sum + Number(row["Goals"] ?? 0), 0);
          const avgShots = totalRows > 0 ? (parsedData.reduce((sum, row) => sum + Number(row["Shots / on target"] ?? 0), 0) / totalRows) : 0;
          const shootingAttr = Math.round(Math.min(99, 50 + (totalGoals * 4) + (avgShots * 5)));

          const avgDistance = totalRows > 0 ? (parsedData.reduce((sum, row) => sum + (Number(row["Minutes played"] ?? 0) * 0.11), 0) / totalRows) : 9.0;
          const paceAttr = Math.round(Math.min(99, 60 + (avgDistance * 1.5)));

          const avgDuelsWon = totalRows > 0 ? (parsedData.reduce((sum, row) => sum + Number(row["_6"] ?? 0), 0) / totalRows) : 0;
          const dribblingAttr = Math.round(Math.min(99, 55 + (avgDuelsWon * 4)));

          const avgInterceptions = totalRows > 0 ? (parsedData.reduce((sum, row) => sum + Number(row["Interceptions"] ?? 0), 0) / totalRows) : 0;
          const defendingAttr = Math.round(Math.min(99, 45 + (avgInterceptions * 10)));

          const physicalAttr = Math.round(Math.min(99, 55 + (totalMins / 300)));

          // Save player
          const newPlayer: Player = {
            id: targetId,
            name: newPlayerName.trim(),
            position: newPlayerPosition,
            preferred_role: newPlayerRole,
            team_name: "Greece U17",
            nationality: "Greece",
            age: 17,
            avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
            number: newPlayerNumber,
            base_attributes: {
              pace: paceAttr,
              shooting: shootingAttr,
              passing: passingAttr,
              dribbling: dribblingAttr,
              defending: defendingAttr,
              physical: physicalAttr
            },
            overall: 70,
            form_rating: 6.0,
            form_trend: 'stable'
          };

          await dbService.savePlayer(newPlayer);
          await loadRoster();
        }

        let formattedStats: PlayerMatchStats[] = [];

        if (isWyscoutFormat) {
          const activePlayer = players.find(p => p.id === targetId) || { team_name: "Greece U17" };
          const teamName = activePlayer.team_name || "Greece U17";

          for (let i = 0; i < parsedData.length; i++) {
            const row = parsedData[i];
            if (!row.Date || !row.Match) continue;

            const dateStr = String(row.Date);
            const matchName = String(row.Match);
            const { opponent, venue, ourScore, oppScore } = parseOpponentAndScore(matchName, teamName);
            const matchId = `m_${dateStr}_${opponent.replace(/\s+/g, '_')}`;

            const isNationalTeam = matchName.includes("Greece U17") || matchName.includes("Greece U16");
            await dbService.saveMatch({
              id: matchId,
              date: dateStr,
              opponent: opponent + (isNationalTeam ? "" : " (Club)"),
              venue,
              result: ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D',
              our_score: ourScore,
              opp_score: oppScore,
              is_club: !isNationalTeam,
              is_team_match: isNationalTeam
            });

            const attemptedPasses = Number(row["Passes / accurate"] ?? 0);
            const accuratePasses = Number(row["_2"] ?? 0);
            const passAccuracy = attemptedPasses > 0 ? Math.round((accuratePasses / attemptedPasses) * 100) : 0;
            
            const duelsAttempted = Number(row["Duels / won"] ?? 0);
            const duelsWon = Number(row["_6"] ?? 0);

            formattedStats.push({
              id: `stats_${targetId}_${matchId}_${Date.now()}_${i}`,
              player_id: targetId,
              match_id: matchId,
              minutes_played: Math.round(Number(row["Minutes played"] ?? 0)),
              goals: Math.round(Number(row["Goals"] ?? 0)),
              assists: Math.round(Number(row["Assists"] ?? 0)),
              shots: Math.round(Number(row["Shots / on target"] ?? 0)),
              shots_on_target: Math.round(Number(row["_1"] ?? 0)),
              passing_accuracy: Math.round(passAccuracy),
              passes_completed: Math.round(accuratePasses),
              passes_attempted: Math.round(attemptedPasses),
              key_passes: Math.round(Number(row["_3"] ?? 0)),
              xg: Number(row["xG"] ?? 0),
              xa: Number(row["Assists"] ?? 0) * 0.15 + Number(row["_3"] ?? 0) * 0.1,
              distance_covered: Number(row["Minutes played"] ?? 0) * 0.11,
              duels_won: Math.round(duelsWon),
              duels_attempted: Math.round(duelsAttempted),
              tackles: Math.floor(duelsWon * 0.3),
              interceptions: Math.round(Number(row["Interceptions"] ?? 0)),
              recoveries: Math.round(Number(row["Recoveries / opp. half"] ?? 0)),
              saves: 0,
              goals_conceded: venue === 'Away' ? 0 : oppScore,
              clean_sheet: oppScore === 0
            });
          }
        } else {
          // Standard CSV
          formattedStats = parsedData.map((row, index) => ({
            id: row.id || `stats_${row.player_id || targetId}_${row.match_id}_${Date.now()}_${index}`,
            player_id: String(row.player_id || targetId),
            match_id: String(row.match_id || ''),
            minutes_played: Math.round(Number(row.minutes_played ?? 0)),
            goals: Math.round(Number(row.goals ?? 0)),
            assists: Math.round(Number(row.assists ?? 0)),
            shots: Math.round(Number(row.shots ?? 0)),
            shots_on_target: Math.round(Number(row.shots_on_target ?? 0)),
            passing_accuracy: Math.round(Number(row.passing_accuracy ?? 0)),
            passes_completed: Math.round(Number(row.passes_completed ?? 0)),
            passes_attempted: Math.round(Number(row.passes_attempted ?? 0)),
            key_passes: Math.round(Number(row.key_passes ?? 0)),
             xg: Number(row.xg ?? row.xG ?? 0),
             xa: Number(row.xa ?? row.xA ?? 0),
            distance_covered: Number(row.distance_covered ?? 0),
            duels_won: Math.round(Number(row.duels_won ?? 0)),
            duels_attempted: Math.round(Number(row.duels_attempted ?? 0)),
            tackles: Math.round(Number(row.tackles ?? 0)),
            interceptions: Math.round(Number(row.interceptions ?? 0)),
            recoveries: Math.round(Number(row.recoveries ?? 0)),
            saves: Math.round(Number(row.saves ?? 0)),
            goals_conceded: Math.round(Number(row.goals_conceded ?? 0)),
            clean_sheet: Boolean(row.clean_sheet === true || row.clean_sheet === 'true' || row.clean_sheet === 1)
          }));
        }

        await dbService.savePlayerMatchStats(formattedStats);
        setFeedback({ 
          type: 'success', 
          message: `Successfully uploaded stats logs. Player OVR ratings recalculated.` 
        });
      } else {
        // Team Stats Upload
        const isWyscoutTeam = 'Possession, %' in parsedData[0];

        for (const row of parsedData) {
          if (isWyscoutTeam) {
            if (!row.Date || !row.Match || row.Team !== "Greece U17") continue;

            const dateStr = String(row.Date);
            const matchName = String(row.Match);
            const { opponent, venue, ourScore, oppScore } = parseOpponentAndScore(matchName, "Greece U17");
            const matchId = `m_${dateStr}_${opponent.replace(/\s+/g, '_')}`;

            await dbService.saveMatch({
              id: matchId,
              date: dateStr,
              opponent,
              venue,
              result: ourScore > oppScore ? 'W' : ourScore < oppScore ? 'L' : 'D',
              our_score: ourScore,
              opp_score: oppScore,
              is_club: false,
              is_team_match: true
            });

            const schemeClean = row.Scheme ? String(row.Scheme).split(" ")[0].trim() : "4-3-3";

            await dbService.saveTeamMatchStats({
              match_id: matchId,
              possession: Math.round(Number(row["Possession, %"] ?? 50)),
              shots: Math.round(Number(row["Shots / on target"] ?? 0)),
              shots_on_target: Math.round(Number(row[""] ?? 0)),
              fouls: 10,
              corners: 5,
              yellow_cards: 1,
              red_cards: 0,
              formation: schemeClean
            });
          } else {
            // Standard Team Stats
            await dbService.saveTeamMatchStats({
              match_id: String(row.match_id || ''),
              possession: Math.round(Number(row.possession ?? 50)),
              shots: Math.round(Number(row.shots ?? 0)),
              shots_on_target: Math.round(Number(row.shots_on_target ?? 0)),
              fouls: Math.round(Number(row.fouls ?? 0)),
              corners: Math.round(Number(row.corners ?? 0)),
              yellow_cards: Math.round(Number(row.yellow_cards ?? 0)),
              red_cards: Math.round(Number(row.red_cards ?? 0)),
              formation: String(row.formation ?? '4-3-3')
            });
          }
        }

        setFeedback({
          type: 'success',
          message: `Successfully ingested ${parsedData.length} team match stats records.`
        });
      }
      setParsedData([]);
      setHeaders([]);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Database upload failed: ${err.message || err}` });
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (confirm("Are you sure you want to reset all data back to the clean Greece roster template?")) {
      setLoading(true);
      await dbService.resetToDefaults();
      setLoading(false);
      setFeedback({ type: 'success', message: 'Database successfully reset.' });
      setParsedData([]);
      setHeaders([]);
      loadRoster();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Data Ingestion Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload match logs via Excel or CSV to dynamically update player overalls, squad forms, and dashboards.</p>
        </div>
        <button 
          onClick={handleResetData}
          disabled={loading}
          className="px-4 py-2 border border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive/10 rounded-lg text-sm transition font-medium flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reset database
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Control and Upload Panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-xl space-y-6">
          <div>
            <label className="text-sm font-semibold text-white block mb-2">Ingestion Mode</label>
            <div className="grid grid-cols-2 gap-2 bg-background p-1 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => { setFileType('player'); setParsedData([]); setFeedback({ type: null, message: '' }); }}
                className={`py-2 text-xs font-semibold rounded-md transition ${fileType === 'player' ? 'bg-primary text-background' : 'text-muted-foreground hover:text-white'}`}
              >
                Player Match Stats
              </button>
              <button
                type="button"
                onClick={() => { setFileType('team'); setParsedData([]); setFeedback({ type: null, message: '' }); }}
                className={`py-2 text-xs font-semibold rounded-md transition ${fileType === 'team' ? 'bg-primary text-background' : 'text-muted-foreground hover:text-white'}`}
              >
                Team Match Stats
              </button>
            </div>
          </div>

          {/* Player Selection Dropdown */}
          {fileType === 'player' && (
            <div>
              <label className="text-xs font-bold text-white block mb-1.5 uppercase tracking-wider">Select Target Player</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 rounded-lg text-xs font-bold text-white focus:outline-none focus:border-primary"
              >
                <option value="auto_create">✨ Auto-Create Player Profile (From File)</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.position})</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" />
              Ingestion Specifications
            </h3>
            <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
              {fileType === 'player' ? (
                <>
                  <li>Supports both standard templates and **Wyscout Player Stats** sheets.</li>
                  <li>Select **Auto-Create** to automatically detect player names and seed profiles from files.</li>
                  <li>FIFA/FM attributes will calculate automatically from match averages.</li>
                </>
              ) : (
                <>
                  <li>Supports standard headers and **Wyscout Team Stats** sheet layout.</li>
                  <li>Wyscout team files will filter Greece U17 matching rows.</li>
                  <li>Updates aggregate team dashboard trends.</li>
                </>
              )}
              <li>File format must be Excel (.xlsx, .xls) or CSV (.csv).</li>
            </ul>
          </div>

          <div className="pt-2">
            <button
              onClick={downloadTemplate}
              className="w-full py-2.5 border border-border hover:border-primary bg-background/50 hover:bg-primary/5 rounded-lg text-xs font-semibold text-white hover:text-primary transition flex items-center justify-center gap-2"
            >
              <Download className="h-3.5 w-3.5" />
              Download Standard Template
            </button>
          </div>

          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="p-3 bg-secondary/80 rounded-full border border-border mb-3 text-muted-foreground">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-white">Drag & drop your Excel/CSV file here</p>
            <p className="text-xs text-muted-foreground mt-1">or click to browse local files</p>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-xl flex flex-col min-h-[350px]">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            Data Stream Parser Preview
            {parsedData.length > 0 && (
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {parsedData.length} records ready
              </span>
            )}
          </h2>

          {feedback.type && (
            <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 border ${
              feedback.type === 'success' ? 'bg-primary/5 border-primary/20 text-primary-foreground' : 
              feedback.type === 'error' ? 'bg-destructive/5 border-destructive/20 text-destructive-foreground' : 
              'bg-amber-500/5 border-amber-500/20 text-amber-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" /> : <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />}
              <div className="text-sm text-foreground">
                <span className="font-semibold block text-white mb-0.5">
                  {feedback.type === 'success' ? 'Validation Passed' : feedback.type === 'error' ? 'Parsing Failed' : 'Validation Warning'}
                </span>
                {feedback.message}
              </div>
            </div>
          )}

          {/* New Player Form (When auto-creating from Wyscout) */}
          {parsedData.length > 0 && selectedPlayerId === 'auto_create' && fileType === 'player' && (
            <div className="mb-6 p-4 bg-background/50 border border-primary/20 rounded-lg space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <UserPlus className="h-4 w-4" />
                Player Profile Creation Setup
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Player Name</label>
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Shirt Number</label>
                  <input
                    type="number"
                    value={newPlayerNumber}
                    onChange={(e) => setNewPlayerNumber(Number(e.target.value))}
                    className="w-full bg-background border border-border px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Position Group</label>
                  <select
                    value={newPlayerPosition}
                    onChange={(e) => {
                      const pos = e.target.value as 'GK' | 'DEF' | 'MID' | 'FWD';
                      setNewPlayerPosition(pos);
                      setNewPlayerRole(getDefaultRole(pos));
                    }}
                    className="w-full bg-background border border-border px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="GK">Goalkeeper (GK)</option>
                    <option value="DEF">Defender (DEF)</option>
                    <option value="MID">Midfielder (MID)</option>
                    <option value="FWD">Forward (FWD)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">Preferred Role Description</label>
                  <input
                    type="text"
                    value={newPlayerRole}
                    onChange={(e) => setNewPlayerRole(e.target.value)}
                    className="w-full bg-background border border-border px-3 py-1.5 rounded text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {parsedData.length === 0 ? (
            <div className="flex-1 border border-border border-dashed rounded-lg flex flex-col items-center justify-center p-8 text-muted-foreground">
              <FileText className="h-10 w-10 text-secondary mb-3" />
              <p className="text-sm font-medium">No file loaded yet</p>
              <p className="text-xs mt-1">Upload your statistics file (Excel or CSV in standard/Wyscout format) to preview data before importing.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between">
              <div className="overflow-x-auto max-h-[220px] border border-border rounded-lg bg-background/50">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-secondary/80">
                      {headers.map(head => (
                        <th key={head} className="p-3 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-border hover:bg-secondary/30 transition">
                        {headers.map(head => (
                          <td key={`${rIdx}-${head}`} className="p-3 font-medium text-white whitespace-nowrap">
                            {typeof row[head] === 'boolean' ? String(row[head]) : row[head]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.length > 10 && (
                  <div className="p-3 text-center text-muted-foreground border-t border-border bg-secondary/20 font-bold">
                    Showing first 10 of {parsedData.length} records.
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => { setParsedData([]); setHeaders([]); setFeedback({ type: null, message: '' }); }}
                  className="px-4 py-2 border border-border hover:bg-secondary rounded-lg text-sm text-white transition font-semibold"
                >
                  Discard
                </button>
                <button
                  onClick={handleUploadSubmit}
                  disabled={loading}
                  className="px-5 py-2 bg-primary hover:bg-primary/95 text-background rounded-lg text-sm font-semibold transition flex items-center gap-2"
                >
                  {loading ? 'Ingesting...' : 'Ingest Stats into Database'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
