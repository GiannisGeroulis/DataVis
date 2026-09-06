-- =======================================================
-- SUPABASE POSTGRESQL DATABASE SCHEMA (v2.0 with Profiles)
-- Copy and paste this script into the Supabase SQL Editor
-- =======================================================

-- 0. Create PROFILES Table (Scoped to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Senior Tactical Analyst',
    team_name TEXT DEFAULT 'Custom Team',
    avatar_url TEXT,
    color TEXT DEFAULT '#10b981',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1. Create PLAYERS Table
CREATE TABLE IF NOT EXISTS public.players (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    name TEXT NOT NULL,
    position TEXT NOT NULL CHECK (position IN ('GK', 'DEF', 'MID', 'FWD')),
    preferred_role TEXT,
    team_name TEXT DEFAULT 'Greece U17',
    nationality TEXT DEFAULT 'Greece',
    age INTEGER DEFAULT 17,
    avatar_url TEXT,
    number INTEGER,
    base_attributes JSONB NOT NULL,
    overall INTEGER DEFAULT 70,
    form_rating NUMERIC DEFAULT 6.0,
    form_trend TEXT DEFAULT 'stable' CHECK (form_trend IN ('up', 'down', 'stable')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create MATCHES Table
CREATE TABLE IF NOT EXISTS public.matches (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    date TEXT NOT NULL,
    opponent TEXT NOT NULL,
    venue TEXT NOT NULL CHECK (venue IN ('Home', 'Away')),
    result TEXT NOT NULL CHECK (result IN ('W', 'D', 'L')),
    our_score INTEGER NOT NULL,
    opp_score INTEGER NOT NULL,
    is_club BOOLEAN DEFAULT FALSE,
    is_team_match BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create PLAYER MATCH STATS Table
CREATE TABLE IF NOT EXISTS public.player_match_stats (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    player_id TEXT REFERENCES public.players(id) ON DELETE CASCADE,
    match_id TEXT REFERENCES public.matches(id) ON DELETE CASCADE,
    minutes_played INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    shots INTEGER DEFAULT 0,
    shots_on_target INTEGER DEFAULT 0,
    passing_accuracy INTEGER DEFAULT 0,
    passes_completed INTEGER DEFAULT 0,
    passes_attempted INTEGER DEFAULT 0,
    key_passes INTEGER DEFAULT 0,
    xG NUMERIC DEFAULT 0,
    xA NUMERIC DEFAULT 0,
    distance_covered NUMERIC DEFAULT 0,
    duels_won INTEGER DEFAULT 0,
    duels_attempted INTEGER DEFAULT 0,
    tackles INTEGER DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    recoveries INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    goals_conceded INTEGER DEFAULT 0,
    clean_sheet BOOLEAN DEFAULT FALSE,
    match_rating NUMERIC DEFAULT 6.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(player_id, match_id)
);

-- 4. Create TEAM MATCH STATS Table
CREATE TABLE IF NOT EXISTS public.team_match_stats (
    match_id TEXT PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
    profile_id TEXT,
    possession INTEGER DEFAULT 50,
    shots INTEGER DEFAULT 0,
    shots_on_target INTEGER DEFAULT 0,
    fouls INTEGER DEFAULT 10,
    corners INTEGER DEFAULT 5,
    yellow_cards INTEGER DEFAULT 1,
    red_cards INTEGER DEFAULT 0,
    formation TEXT DEFAULT '4-3-3',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create TACTICAL LAYOUTS Table
CREATE TABLE IF NOT EXISTS public.tactical_layouts (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    name TEXT NOT NULL,
    formation TEXT DEFAULT '4-3-3',
    positions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =======================================================
-- SAFE MIGRATION / COLUMN ADDITIONS (For existing databases)
-- =======================================================
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.player_match_stats ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.team_match_stats ADD COLUMN IF NOT EXISTS profile_id TEXT;
ALTER TABLE public.tactical_layouts ADD COLUMN IF NOT EXISTS profile_id TEXT;

-- Create Indexes for fast profile queries
CREATE INDEX IF NOT EXISTS idx_players_profile_id ON public.players(profile_id);
CREATE INDEX IF NOT EXISTS idx_matches_profile_id ON public.matches(profile_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_profile_id ON public.player_match_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_profile_id ON public.team_match_stats(profile_id);
CREATE INDEX IF NOT EXISTS idx_tactical_profile_id ON public.tactical_layouts(profile_id);

-- =======================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =======================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tactical_layouts ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow authenticated profiles access" ON public.profiles;
CREATE POLICY "Allow authenticated profiles access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- Players Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.players;
DROP POLICY IF EXISTS "Allow public write access" ON public.players;
CREATE POLICY "Allow public read access" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.players FOR ALL USING (true) WITH CHECK (true);

-- Matches Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.matches;
DROP POLICY IF EXISTS "Allow public write access" ON public.matches;
CREATE POLICY "Allow public read access" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.matches FOR ALL USING (true) WITH CHECK (true);

-- Player Match Stats Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.player_match_stats;
DROP POLICY IF EXISTS "Allow public write access" ON public.player_match_stats;
CREATE POLICY "Allow public read access" ON public.player_match_stats FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.player_match_stats FOR ALL USING (true) WITH CHECK (true);

-- Team Match Stats Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.team_match_stats;
DROP POLICY IF EXISTS "Allow public write access" ON public.team_match_stats;
CREATE POLICY "Allow public read access" ON public.team_match_stats FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.team_match_stats FOR ALL USING (true) WITH CHECK (true);

-- Tactical Layouts Policies
DROP POLICY IF EXISTS "Allow public read access" ON public.tactical_layouts;
DROP POLICY IF EXISTS "Allow public write access" ON public.tactical_layouts;
CREATE POLICY "Allow public read access" ON public.tactical_layouts FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.tactical_layouts FOR ALL USING (true) WITH CHECK (true);

-- =======================================================
-- 7. OPPONENT TEAMS TABLE
-- =======================================================
CREATE TABLE IF NOT EXISTS public.opponent_teams (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    name TEXT NOT NULL,
    logo_url TEXT,
    country TEXT,
    league TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_opponent_teams_profile_id ON public.opponent_teams(profile_id);
ALTER TABLE public.opponent_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.opponent_teams;
DROP POLICY IF EXISTS "Allow public write access" ON public.opponent_teams;
CREATE POLICY "Allow public read access" ON public.opponent_teams FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.opponent_teams FOR ALL USING (true) WITH CHECK (true);

-- =======================================================
-- 8. WYSCOUT MATCHES TABLE
-- =======================================================
CREATE TABLE IF NOT EXISTS public.wyscout_matches (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    opponent_team_id TEXT NOT NULL REFERENCES public.opponent_teams(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    match_name TEXT NOT NULL,
    competition TEXT,
    duration INTEGER DEFAULT 90,
    scheme TEXT DEFAULT '4-3-3',
    team_analyzed TEXT NOT NULL,
    goals INTEGER DEFAULT 0,
    xg NUMERIC DEFAULT 0,
    shots INTEGER DEFAULT 0,
    shots_on_target INTEGER DEFAULT 0,
    shots_on_target_pct NUMERIC DEFAULT 0,
    passes INTEGER DEFAULT 0,
    passes_accurate INTEGER DEFAULT 0,
    passing_accuracy NUMERIC DEFAULT 0,
    possession NUMERIC DEFAULT 50,
    losses INTEGER DEFAULT 0,
    losses_low INTEGER DEFAULT 0,
    losses_med INTEGER DEFAULT 0,
    losses_high INTEGER DEFAULT 0,
    recoveries INTEGER DEFAULT 0,
    recoveries_low INTEGER DEFAULT 0,
    recoveries_med INTEGER DEFAULT 0,
    recoveries_high INTEGER DEFAULT 0,
    duels INTEGER DEFAULT 0,
    duels_won INTEGER DEFAULT 0,
    duels_won_pct NUMERIC DEFAULT 0,
    opponent_team_name TEXT,
    opponent_goals INTEGER,
    opponent_xg NUMERIC,
    opponent_shots INTEGER,
    opponent_possession NUMERIC,
    -- Wyscout Attacking Metrics
    positional_attacks INTEGER DEFAULT 0,
    positional_attacks_shots INTEGER DEFAULT 0,
    positional_attacks_pct NUMERIC DEFAULT 0,
    counterattacks INTEGER DEFAULT 0,
    counterattacks_shots INTEGER DEFAULT 0,
    counterattacks_pct NUMERIC DEFAULT 0,
    corners INTEGER DEFAULT 0,
    corners_shots INTEGER DEFAULT 0,
    corners_shots_pct NUMERIC DEFAULT 0,
    free_kicks INTEGER DEFAULT 0,
    free_kicks_shots INTEGER DEFAULT 0,
    free_kicks_shots_pct NUMERIC DEFAULT 0,
    penalties INTEGER DEFAULT 0,
    penalties_converted INTEGER DEFAULT 0,
    crosses INTEGER DEFAULT 0,
    crosses_accurate INTEGER DEFAULT 0,
    crosses_acc_pct NUMERIC DEFAULT 0,
    offensive_duels INTEGER DEFAULT 0,
    offensive_duels_won INTEGER DEFAULT 0,
    offensive_duels_won_pct NUMERIC DEFAULT 0,
    offsides INTEGER DEFAULT 0,
    -- Wyscout Defending Metrics
    conceded_goals INTEGER DEFAULT 0,
    shots_against INTEGER DEFAULT 0,
    shots_against_on_target INTEGER DEFAULT 0,
    shots_against_on_target_pct NUMERIC DEFAULT 0,
    defensive_duels INTEGER DEFAULT 0,
    defensive_duels_won INTEGER DEFAULT 0,
    defensive_duels_won_pct NUMERIC DEFAULT 0,
    aerial_duels INTEGER DEFAULT 0,
    aerial_duels_won INTEGER DEFAULT 0,
    aerial_duels_won_pct NUMERIC DEFAULT 0,
    sliding_tackles INTEGER DEFAULT 0,
    sliding_tackles_succ INTEGER DEFAULT 0,
    sliding_tackles_succ_pct NUMERIC DEFAULT 0,
    interceptions INTEGER DEFAULT 0,
    clearances INTEGER DEFAULT 0,
    fouls INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_cards INTEGER DEFAULT 0,
    -- Wyscout Passing Metrics
    forward_passes INTEGER DEFAULT 0,
    forward_passes_acc INTEGER DEFAULT 0,
    forward_passes_pct NUMERIC DEFAULT 0,
    back_passes INTEGER DEFAULT 0,
    back_passes_acc INTEGER DEFAULT 0,
    back_passes_pct NUMERIC DEFAULT 0,
    lateral_passes INTEGER DEFAULT 0,
    lateral_passes_acc INTEGER DEFAULT 0,
    lateral_passes_pct NUMERIC DEFAULT 0,
    long_passes INTEGER DEFAULT 0,
    long_passes_acc INTEGER DEFAULT 0,
    long_passes_pct NUMERIC DEFAULT 0,
    passes_to_final_third INTEGER DEFAULT 0,
    passes_to_final_third_acc INTEGER DEFAULT 0,
    passes_to_final_third_pct NUMERIC DEFAULT 0,
    progressive_passes INTEGER DEFAULT 0,
    progressive_passes_acc INTEGER DEFAULT 0,
    progressive_passes_pct NUMERIC DEFAULT 0,
    smart_passes INTEGER DEFAULT 0,
    smart_passes_acc INTEGER DEFAULT 0,
    smart_passes_pct NUMERIC DEFAULT 0,
    throw_ins INTEGER DEFAULT 0,
    throw_ins_acc INTEGER DEFAULT 0,
    goal_kicks INTEGER DEFAULT 0,
    -- Wyscout Indices & PPDA
    ppda NUMERIC DEFAULT 0,
    match_tempo NUMERIC DEFAULT 0,
    avg_passes_per_possession NUMERIC DEFAULT 0,
    long_pass_pct NUMERIC DEFAULT 0,
    avg_shot_distance NUMERIC DEFAULT 0,
    avg_pass_length NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wyscout_matches_profile_id ON public.wyscout_matches(profile_id);
CREATE INDEX IF NOT EXISTS idx_wyscout_matches_team_id ON public.wyscout_matches(opponent_team_id);
ALTER TABLE public.wyscout_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.wyscout_matches;
DROP POLICY IF EXISTS "Allow public write access" ON public.wyscout_matches;
CREATE POLICY "Allow public read access" ON public.wyscout_matches FOR SELECT USING (true);
CREATE POLICY "Allow public write access" ON public.wyscout_matches FOR ALL USING (true) WITH CHECK (true);

-- Migration helpers for existing databases (adds new columns if not present)
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS positional_attacks INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS positional_attacks_shots INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS positional_attacks_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS counterattacks INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS counterattacks_shots INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS counterattacks_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS corners INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS corners_shots INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS corners_shots_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS free_kicks INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS free_kicks_shots INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS free_kicks_shots_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS penalties INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS penalties_converted INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS crosses INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS crosses_accurate INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS crosses_acc_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS offensive_duels INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS offensive_duels_won INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS offensive_duels_won_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS offsides INTEGER DEFAULT 0;

ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS conceded_goals INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS shots_against INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS shots_against_on_target INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS shots_against_on_target_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS defensive_duels INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS defensive_duels_won INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS defensive_duels_won_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS aerial_duels INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS aerial_duels_won INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS aerial_duels_won_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS sliding_tackles INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS sliding_tackles_succ INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS sliding_tackles_succ_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS interceptions INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS clearances INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS fouls INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS yellow_cards INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS red_cards INTEGER DEFAULT 0;

ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS forward_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS forward_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS forward_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS back_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS back_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS back_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS lateral_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS lateral_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS lateral_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS long_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS long_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS long_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS passes_to_final_third INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS passes_to_final_third_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS passes_to_final_third_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS progressive_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS progressive_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS progressive_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS smart_passes INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS smart_passes_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS smart_passes_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS throw_ins INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS throw_ins_acc INTEGER DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS goal_kicks INTEGER DEFAULT 0;

ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS ppda NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS match_tempo NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS avg_passes_per_possession NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS long_pass_pct NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS avg_shot_distance NUMERIC DEFAULT 0;
ALTER TABLE public.wyscout_matches ADD COLUMN IF NOT EXISTS avg_pass_length NUMERIC DEFAULT 0;

