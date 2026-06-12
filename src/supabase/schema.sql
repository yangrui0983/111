-- ============ PPL训练 Supabase Schema v2 ============

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Programs
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'PPL 增肌计划',
  goal TEXT DEFAULT '增肌',
  cycle_start_date TIMESTAMPTZ DEFAULT NOW(),
  current_cycle_week INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workout Templates
CREATE TABLE workout_templates (
  id TEXT PRIMARY KEY,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL,
  estimated_duration_min INTEGER DEFAULT 60,
  notes TEXT
);

-- Exercise Library
CREATE TABLE exercise_library (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  muscle_group TEXT,
  movement_pattern TEXT DEFAULT 'push',
  equipment TEXT DEFAULT 'dumbbell',
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template-Exercise Bridge
CREATE TABLE workout_template_exercises (
  id TEXT PRIMARY KEY,
  workout_template_id TEXT REFERENCES workout_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT REFERENCES exercise_library(id) ON DELETE CASCADE NOT NULL,
  display_name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  min_reps INTEGER DEFAULT 8,
  max_reps INTEGER DEFAULT 12,
  rest_seconds_min INTEGER DEFAULT 60,
  rest_seconds_max INTEGER DEFAULT 90,
  warmup_sets INTEGER DEFAULT 0,
  warmup_percent INTEGER DEFAULT 50,
  is_each_side BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Workout Sessions
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  workout_template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  total_volume REAL DEFAULT 0,
  total_work_sets INTEGER DEFAULT 0,
  cycle_week INTEGER DEFAULT 1,
  is_deload BOOLEAN DEFAULT FALSE,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Session Exercises
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_session_id UUID REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT REFERENCES exercise_library(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  muscle_group_snapshot TEXT,
  order_index INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  was_replaced BOOLEAN DEFAULT FALSE,
  notes TEXT
);

-- Session Sets
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_exercise_id UUID REFERENCES session_exercises(id) ON DELETE CASCADE NOT NULL,
  set_index INTEGER NOT NULL,
  set_type TEXT CHECK (set_type IN ('warmup', 'working')) DEFAULT 'working',
  weight REAL DEFAULT 0,
  reps INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  rpe REAL,
  rest_seconds_planned INTEGER,
  rest_seconds_actual INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- Progression Suggestions
CREATE TABLE progression_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exercise_id TEXT REFERENCES exercise_library(id) ON DELETE CASCADE,
  base_weight REAL NOT NULL,
  suggested_weight REAL NOT NULL,
  increment REAL NOT NULL,
  reason TEXT,
  accepted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

-- User Settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  reminder_enabled BOOLEAN DEFAULT FALSE,
  reminder_time TIME DEFAULT '19:30',
  reminder_interval_days INTEGER DEFAULT 1,
  vibration_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  weight_unit TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg', 'lb')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cycle Events
CREATE TABLE cycle_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  cycle_week INTEGER NOT NULL,
  event_type TEXT CHECK (event_type IN ('week5_action_swap', 'week6_new_cycle', 'week8_deload')),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE progression_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users manage own programs" ON programs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users view templates" ON workout_templates FOR SELECT USING (true);
CREATE POLICY "Users view exercise library" ON exercise_library FOR SELECT USING (true);
CREATE POLICY "Users manage own custom exercises" ON exercise_library FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Users manage own sessions" ON workout_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own session exercises" ON session_exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM workout_sessions ws WHERE ws.id = session_exercises.workout_session_id AND ws.user_id = auth.uid())
);
CREATE POLICY "Users manage own session sets" ON session_sets FOR ALL USING (
  EXISTS (SELECT 1 FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.workout_session_id WHERE se.id = session_sets.session_exercise_id AND ws.user_id = auth.uid())
);
CREATE POLICY "Users manage progression" ON progression_suggestions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage cycle events" ON cycle_events FOR ALL USING (auth.uid() = user_id);
