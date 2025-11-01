// Navigation
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

// User
export interface User {
  id: string;
  name: string;
  email?: string;
  created_at: string;
}

// Period (formerly Quarter)
export interface Period {
  id: string;
  user_id: string;
  name: string; // e.g., "Q4 2025" or "2025 Planning Cycle"
  start_date: string; // ISO date string
  end_date: string; // ISO date string
  is_active: boolean; // Only one active period per user
  created_at: string;
  updated_at?: string;
}

// Objectives
export interface Objective {
  id: string;
  user_id: string;
  title: string;
  description: string;
  period: string; // e.g., "Q1 2025" - display name
  period_id: string; // Reference to Period
  created_at: string;
  updated_at?: string;
}

// Weekly Progress
export interface WeeklyProgress {
  week_start_date: string; // ISO date string for Monday
  value: number;
  status?: KeyResultStatus; // Optional while legacy data migrates
  recorded_at: string;
}

// Key Result Status
export type KeyResultStatus = 'on-track' | 'needs-attention' | 'behind';

// Target Mode - how weekly targets are calculated
export type TargetMode = 'linear' | 'manual';

// Key Results
export interface KeyResult {
  id: string;
  user_id: string;
  objective_id: string;
  description: string;
  target_value: number; // Final period target
  unit: string;
  weekly_targets?: number[]; // Target value for each week (length = number of weeks in period)
  target_mode?: TargetMode; // How weekly targets are calculated (default: 'linear')
  weekly_progress: WeeklyProgress[];
  status: KeyResultStatus; // Automatically calculated status
  status_override?: KeyResultStatus;
  status_override_reason?: string;
  created_at: string;
  updated_at?: string;
}

// Progress Update for Check-in
export interface ProgressUpdate {
  key_result_id: string;
  value: number;
  notes?: string;
}

// Reflection (AAR format)
export interface Reflection {
  what_went_well: string;
  what_didnt_go_well: string;
  what_will_i_change: string;
  completed_at: string;
}

// Coaching Message
export interface CoachingMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  meta?: {
    tokensUsed?: number;
    model?: string;
    [key: string]: unknown;
  };
}

// Provider Name
export type ProviderName = 'openai' | 'anthropic' | 'cohere' | 'huggingface' | 'openrouter';

// AI Provider
export interface AiProvider {
  id: string;
  userId: string;
  providerName: ProviderName;
  modelName: string;
  apiKeyEncrypted: string;   // ciphertext; never expose plaintext to client
  isDefault: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// Session Context - structured data for LLM context
export interface SessionContext {
  periodId?: string;
  periodName?: string;
  objectives?: Array<{
    id: string;
    title: string;
    description?: string;
    keyResults?: Array<{
      id: string;
      description: string;
      targetValue: number;
      unit: string;
      currentProgress?: number;
      status?: KeyResultStatus;
    }>;
  }>;
  recentCheckIns?: Array<{
    weekStartDate: string;
    reflection?: Reflection;
  }>;
  [key: string]: unknown;
}

// Coaching Session (extended with new optional fields)
export interface CoachingSession {
  id: string;
  user_id: string;
  messages: CoachingMessage[];
  started_at: string;
  completed_at?: string;
  // New optional fields for backward compatibility
  period_id?: string | null;
  check_in_id?: string | null;
  provider_used?: string;
  model_used?: string;
  status?: 'active' | 'completed' | 'abandoned';
  context_summary?: string | null;
  context_data?: SessionContext;
  created_at?: string;
  updated_at?: string;
}

// Coach Prompt
export interface CoachPrompt {
  id: string;
  userId: string;
  name: string;
  promptText: string;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

// Weekly Check-in
export interface WeeklyCheckIn {
  id: string;
  user_id: string;
  period_id: string;
  week_start_date: string; // ISO date string for Monday
  progress_updates: ProgressUpdate[];
  reflection: Reflection;
  coaching_session?: CoachingSession;
  completed_at: string;
  created_at: string;
}

// User Preferences
export interface UserPreferences {
  check_in_day: number; // 0-6 (Sunday-Saturday)
  check_in_time: string; // HH:mm format
  notifications: boolean;
  dark_mode: 'light' | 'dark' | 'system';
  coaching_style: 'supportive' | 'challenging' | 'balanced';
  coach_prompt?: string; // Custom coach system instruction
}

// App Settings
export interface AppSettings {
  user_id: string;
  user_name: string;
  email: string;
  timezone: string;
  api_key?: string; // Encrypted API key
  preferences: UserPreferences;
}

// Legacy interfaces for backward compatibility during migration
export interface ThemeMode {
  mode: 'light' | 'dark' | 'system';
}

// Type alias for backward compatibility during Quarter → Period migration
export type Quarter = Period;

// =============================================================================
// LLM & Coaching Types (for future tool/workflow support)
// =============================================================================

// Tool Call - for LLM function calling
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

// Tool Definition - for registering available tools
export interface Tool {
  name: string;
  description: string;
  schema: Record<string, unknown>; // JSON Schema for the tool's parameters
  run: (args: Record<string, unknown>, context: SessionContext) => Promise<unknown>;
}

// Chat Message (standardized for LLM providers)
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

// Send to LLM params (for provider adapter)
export interface SendToLLMParams {
  providerName: ProviderName;
  model: string;
  apiKey: string; // plaintext (only inside Edge function)
  messages: ChatMessage[];
  stream?: boolean;
  onChunk?: (delta: string) => void;
  tools?: Tool[];
}

// LLM Response
export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  toolCalls?: ToolCall[];
}
