import type {
  User,
  Period,
  Objective,
  KeyResult,
  WeeklyCheckIn,
  ProgressUpdate,
  WeeklyProgress,
  Reflection,
  CoachingSession,
  AppSettings,
} from '../types';

// Storage keys - now user-scoped
const buildPeriodKey = (userId: string) => `@personal_okrs/${userId}/quarters`;

export const STORAGE_KEYS = {
  CURRENT_USER_ID: '@personal_okrs/current_user_id',
  USERS: '@personal_okrs/users',
  PERIODS: buildPeriodKey,
  QUARTERS: buildPeriodKey, // Legacy alias during migration
  OBJECTIVES: (userId: string) => `@personal_okrs/${userId}/objectives`,
  KEY_RESULTS: (userId: string) => `@personal_okrs/${userId}/key_results`,
  CHECK_INS: (userId: string) => `@personal_okrs/${userId}/check_ins`,
  COACHING_SESSIONS: (userId: string) => `@personal_okrs/${userId}/coaching_sessions`,
  SETTINGS: (userId: string) => `@personal_okrs/${userId}/settings`,
  VERSION: '@personal_okrs/version',
} as const;

const CURRENT_VERSION = '2.0.0'; // Bumped for multi-user support

// Debounce helper
let debounceTimers: Record<string, number> = {};

function debounce(
  func: (data: unknown) => void,
  key: string,
  delay: number = 500
): (data: unknown) => void {
  return (data: unknown) => {
    if (debounceTimers[key]) {
      clearTimeout(debounceTimers[key]);
    }
    debounceTimers[key] = window.setTimeout(() => {
      func(data);
      delete debounceTimers[key];
    }, delay);
  };
}

// Generic localStorage wrapper
class Storage<T> {
  private storageKey: string;
  private debouncedSet: (data: unknown) => void;

  constructor(key: string) {
    this.storageKey = key;
    this.debouncedSet = debounce((data: unknown) => {
      this.set(data as T);
    }, key);
  }

  get(): T | null {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error reading ${this.storageKey} from localStorage:`, error);
      return null;
    }
  }

  set(data: T): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Error writing ${this.storageKey} to localStorage:`, error);
      throw new Error(`Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  setDebounced(data: T): void {
    this.debouncedSet(data);
  }

  remove(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.error(`Error removing ${this.storageKey} from localStorage:`, error);
    }
  }

  clear(): void {
    this.remove();
  }
}

// Legacy-to-modern normalization helpers
const normalizePeriod = (data: any): Period => ({
  id: data.id,
  user_id: data.user_id ?? data.userId ?? '',
  name: data.name ?? '',
  start_date: data.start_date ?? data.startDate ?? '',
  end_date: data.end_date ?? data.endDate ?? '',
  is_active: data.is_active ?? data.isActive ?? false,
  created_at: data.created_at ?? data.createdAt ?? new Date().toISOString(),
  updated_at: data.updated_at ?? data.updatedAt,
});

const normalizeObjective = (data: any): Objective => ({
  id: data.id,
  user_id: data.user_id ?? data.userId ?? '',
  title: data.title ?? '',
  description: data.description ?? '',
  period: data.period ?? data.quarter ?? '',
  period_id: data.period_id ?? data.quarterId ?? '',
  created_at: data.created_at ?? data.createdAt ?? new Date().toISOString(),
  updated_at: data.updated_at ?? data.updatedAt,
});

const normalizeWeeklyProgress = (data: any): WeeklyProgress => ({
  week_start_date: data.week_start_date ?? data.weekStartDate ?? '',
  value: data.value ?? 0,
  status: data.status ?? data.weekStatus,
  recorded_at: data.recorded_at ?? data.recordedAt ?? new Date().toISOString(),
});

const normalizeKeyResult = (data: any): KeyResult => ({
  id: data.id,
  user_id: data.user_id ?? data.userId ?? '',
  objective_id: data.objective_id ?? data.objectiveId ?? '',
  description: data.description ?? '',
  target_value: data.target_value ?? data.targetValue ?? 0,
  unit: data.unit ?? '',
  weekly_targets: data.weekly_targets ?? data.weeklyTargets,
  target_mode: data.target_mode ?? data.targetMode,
  weekly_progress: (data.weekly_progress ?? data.weeklyProgress ?? []).map(normalizeWeeklyProgress),
  status: data.status ?? 'on-track',
  status_override: data.status_override ?? data.statusOverride,
  status_override_reason: data.status_override_reason ?? data.statusOverrideReason,
  created_at: data.created_at ?? data.createdAt ?? new Date().toISOString(),
  updated_at: data.updated_at ?? data.updatedAt,
});

const normalizeProgressUpdate = (data: any): ProgressUpdate => ({
  key_result_id: data.key_result_id ?? data.keyResultId ?? '',
  value: data.value ?? 0,
  notes: data.notes,
});

const normalizeReflection = (data: any): Reflection => ({
  what_went_well: data?.what_went_well ?? data?.whatWentWell ?? '',
  what_didnt_go_well: data?.what_didnt_go_well ?? data?.whatDidntGoWell ?? '',
  what_will_i_change: data?.what_will_i_change ?? data?.whatWillIChange ?? '',
  completed_at: data?.completed_at ?? data?.completedAt ?? new Date().toISOString(),
});

const normalizeCheckIn = (data: any): WeeklyCheckIn => ({
  id: data.id,
  user_id: data.user_id ?? data.userId ?? '',
  period_id: data.period_id ?? data.quarterId ?? '',
  week_start_date: data.week_start_date ?? data.weekStartDate ?? '',
  progress_updates: (data.progress_updates ?? data.progressUpdates ?? []).map(normalizeProgressUpdate),
  reflection: data.reflection ? normalizeReflection(data.reflection) : normalizeReflection(null),
  coaching_session: data.coaching_session ?? data.coachingSession,
  completed_at:
    data.completed_at ??
    data.completedAt ??
    data.reflection?.completed_at ??
    data.reflection?.completedAt ??
    new Date().toISOString(),
  created_at: data.created_at ?? data.createdAt ?? new Date().toISOString(),
});

// ========== USER MANAGEMENT ==========

export const getCurrentUserId = (): string | null => {
  return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
};

export const setCurrentUserId = (userId: string): void => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
};

export const getCurrentUser = (): User | null => {
  const userId = getCurrentUserId();
  if (!userId) return null;

  const users = getUsers();
  return users.find(u => u.id === userId) || null;
};

export const setCurrentUser = (userId: string): void => {
  const users = getUsers();
  if (!users.find(u => u.id === userId)) {
    throw new Error(`User ${userId} not found`);
  }
  setCurrentUserId(userId);
};

export const getUsers = (): User[] => {
  const storage = new Storage<User[]>(STORAGE_KEYS.USERS);
  return storage.get() || [];
};

const saveUsers = (users: User[]): void => {
  const storage = new Storage<User[]>(STORAGE_KEYS.USERS);
  storage.set(users);
};

export const initializeUsers = (): void => {
  const existingUsers = getUsers();
  if (existingUsers.length > 0) return; // Already initialized

  const now = new Date().toISOString();
  const users: User[] = [
    {
      id: 'mock-user',
      name: 'Mock User',
      email: 'mock@example.com',
      created_at: now,
    },
    {
      id: 'test-user',
      name: 'Test User',
      created_at: now,
    },
  ];

  saveUsers(users);
  setCurrentUserId('mock-user');
};

// ========== PERIOD MANAGEMENT ==========

export const periodsCRUD = {
  getAll: (userId: string): Period[] => {
    const storage = new Storage<Period[]>(STORAGE_KEYS.PERIODS(userId));
    const periods = storage.get() || [];
    return periods.map(normalizePeriod);
  },

  getById: (userId: string, id: string): Period | undefined => {
    return periodsCRUD.getAll(userId).find(period => period.id === id);
  },

  getActive: (userId: string): Period | null => {
    const periods = periodsCRUD.getAll(userId);
    return periods.find(period => period.is_active) || null;
  },

  create: (userId: string, name: string, startDate: string, endDate: string): Period => {
    const periods = periodsCRUD.getAll(userId);
    const newPeriod: Period = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      name,
      start_date: startDate,
      end_date: endDate,
      is_active: periods.length === 0, // First period is active by default
      created_at: new Date().toISOString(),
    };

    periods.push(newPeriod);
    const storage = new Storage<Period[]>(STORAGE_KEYS.PERIODS(userId));
    storage.set(periods);
    return newPeriod;
  },

  setActive: (userId: string, periodId: string): void => {
    const periods = periodsCRUD.getAll(userId);
    const updated = periods.map(period => ({
      ...period,
      is_active: period.id === periodId,
      updated_at: new Date().toISOString(),
    }));
    const storage = new Storage<Period[]>(STORAGE_KEYS.PERIODS(userId));
    storage.set(updated);
  },

  delete: (userId: string, periodId: string): void => {
    // Check if objectives exist for this period
    const objectives = objectivesCRUD.getAll(userId);
    const hasObjectives = objectives.some(obj => obj.period_id === periodId);

    if (hasObjectives) {
      throw new Error('Cannot delete period with objectives. Delete objectives first.');
    }

    const periods = periodsCRUD.getAll(userId);
    const filtered = periods.filter(period => period.id !== periodId);
    const storage = new Storage<Period[]>(STORAGE_KEYS.PERIODS(userId));
    storage.set(filtered);
  },
};

// Legacy alias for backward compatibility during migration
export const quartersCRUD = periodsCRUD;

// ========== OBJECTIVES CRUD ==========

export const objectivesCRUD = {
  getAll: (userId: string, periodId?: string): Objective[] => {
    const storage = new Storage<Objective[]>(STORAGE_KEYS.OBJECTIVES(userId));
    const objectives = (storage.get() || []).map(normalizeObjective);

    if (periodId) {
      return objectives.filter(obj => obj.period_id === periodId);
    }
    return objectives;
  },

  getById: (userId: string, id: string): Objective | undefined => {
    return objectivesCRUD.getAll(userId).find(obj => obj.id === id);
  },

  create: (userId: string, objective: Objective): void => {
    const objectives = objectivesCRUD.getAll(userId);
    const existingIndex = objectives.findIndex(obj => obj.id === objective.id);
    if (existingIndex !== -1) {
      objectives[existingIndex] = objective;
    } else {
      objectives.push(objective);
    }
    const storage = new Storage<Objective[]>(STORAGE_KEYS.OBJECTIVES(userId));
    storage.set(objectives);
  },

  update: (userId: string, id: string, updates: Partial<Objective>): void => {
    const objectives = objectivesCRUD.getAll(userId);
    const index = objectives.findIndex(obj => obj.id === id);
    if (index !== -1) {
      objectives[index] = { ...objectives[index], ...updates };
      const storage = new Storage<Objective[]>(STORAGE_KEYS.OBJECTIVES(userId));
      storage.set(objectives);
    }
  },

  delete: (userId: string, id: string): { deletedObjectives: number; deletedKeyResults: number } => {
    const objective = objectivesCRUD.getById(userId, id);
    if (!objective) {
      return { deletedObjectives: 0, deletedKeyResults: 0 };
    }

    // Cascade delete: remove all key results first
    const keyResults = keyResultsCRUD.getByObjectiveId(userId, id);
    const deletedKRCount = keyResults.length;

    keyResults.forEach(kr => {
      keyResultsCRUD.delete(userId, kr.id);
    });

    // Delete the objective
    const objectives = objectivesCRUD.getAll(userId);
    const filtered = objectives.filter(obj => obj.id !== id);
    const storage = new Storage<Objective[]>(STORAGE_KEYS.OBJECTIVES(userId));
    storage.set(filtered);

    return { deletedObjectives: 1, deletedKeyResults: deletedKRCount };
  },
};

// ========== KEY RESULTS CRUD ==========

export const keyResultsCRUD = {
  getAll: (userId: string): KeyResult[] => {
    const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
    const keyResults = storage.get() || [];
    return keyResults.map(normalizeKeyResult);
  },

  getById: (userId: string, id: string): KeyResult | undefined => {
    return keyResultsCRUD.getAll(userId).find(kr => kr.id === id);
  },

  getByObjectiveId: (userId: string, objectiveId: string): KeyResult[] => {
    return keyResultsCRUD.getAll(userId).filter(kr => {
      return kr.objective_id === objectiveId;
    });
  },

  create: (userId: string, keyResult: KeyResult): void => {
    const keyResults = keyResultsCRUD.getAll(userId);
    const existingIndex = keyResults.findIndex(kr => kr.id === keyResult.id);
    if (existingIndex !== -1) {
      keyResults[existingIndex] = keyResult;
    } else {
      keyResults.push(keyResult);
    }
    const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
    storage.set(keyResults);
  },

  update: (userId: string, id: string, updates: Partial<KeyResult>): void => {
    const keyResults = keyResultsCRUD.getAll(userId);
    const index = keyResults.findIndex(kr => kr.id === id);
    if (index !== -1) {
      keyResults[index] = { ...keyResults[index], ...updates };
      const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
      storage.set(keyResults);
    }
  },

  delete: (userId: string, id: string): void => {
    const keyResult = keyResultsCRUD.getById(userId, id);
    if (!keyResult) return;

    const keyResults = keyResultsCRUD.getAll(userId);
    const filtered = keyResults.filter(kr => kr.id !== id);
    const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
    storage.set(filtered);
  },

  deleteByObjectiveId: (userId: string, objectiveId: string): void => {
    const keyResults = keyResultsCRUD.getAll(userId);
    const filtered = keyResults.filter(kr => kr.objective_id !== objectiveId);
    const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
    storage.set(filtered);
  },
};

// ========== CHECK-INS CRUD ==========

export const checkInsCRUD = {
  getAll: (userId: string, periodId?: string): WeeklyCheckIn[] => {
    const storage = new Storage<WeeklyCheckIn[]>(STORAGE_KEYS.CHECK_INS(userId));
    const checkIns = (storage.get() || []).map(normalizeCheckIn);

    if (periodId) {
      return checkIns.filter(ci => ci.period_id === periodId);
    }
    return checkIns;
  },

  getById: (userId: string, id: string): WeeklyCheckIn | undefined => {
    return checkInsCRUD.getAll(userId).find(ci => ci.id === id);
  },

  getByWeek: (userId: string, weekStartDate: string): WeeklyCheckIn | undefined => {
    return checkInsCRUD.getAll(userId).find(ci => {
      return ci.week_start_date === weekStartDate;
    });
  },

  create: (userId: string, checkIn: WeeklyCheckIn): void => {
    const checkIns = checkInsCRUD.getAll(userId);
    const existingIndex = checkIns.findIndex(ci => ci.id === checkIn.id);
    if (existingIndex !== -1) {
      checkIns[existingIndex] = checkIn;
    } else {
      checkIns.push(checkIn);
    }
    const storage = new Storage<WeeklyCheckIn[]>(STORAGE_KEYS.CHECK_INS(userId));
    storage.set(checkIns);
  },

  update: (userId: string, id: string, updates: Partial<WeeklyCheckIn>): void => {
    const checkIns = checkInsCRUD.getAll(userId);
    const index = checkIns.findIndex(ci => ci.id === id);
    if (index !== -1) {
      checkIns[index] = { ...checkIns[index], ...updates };
      const storage = new Storage<WeeklyCheckIn[]>(STORAGE_KEYS.CHECK_INS(userId));
      storage.set(checkIns);
    }
  },

  delete: (userId: string, id: string): void => {
    const checkIns = checkInsCRUD.getAll(userId);
    const filtered = checkIns.filter(ci => ci.id !== id);
    const storage = new Storage<WeeklyCheckIn[]>(STORAGE_KEYS.CHECK_INS(userId));
    storage.set(filtered);
  },
};

// ========== COACHING SESSIONS CRUD ==========

export const coachingSessionsCRUD = {
  getAll: (userId: string): CoachingSession[] => {
    const storage = new Storage<CoachingSession[]>(STORAGE_KEYS.COACHING_SESSIONS(userId));
    return storage.get() || [];
  },

  getById: (userId: string, id: string): CoachingSession | undefined => {
    return coachingSessionsCRUD.getAll(userId).find(cs => cs.id === id);
  },

  create: (userId: string, session: CoachingSession): void => {
    const sessions = coachingSessionsCRUD.getAll(userId);
    const existingIndex = sessions.findIndex(cs => cs.id === session.id);
    if (existingIndex !== -1) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }
    const storage = new Storage<CoachingSession[]>(STORAGE_KEYS.COACHING_SESSIONS(userId));
    storage.set(sessions);
  },

  update: (userId: string, id: string, updates: Partial<CoachingSession>): void => {
    const sessions = coachingSessionsCRUD.getAll(userId);
    const index = sessions.findIndex(cs => cs.id === id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates };
      const storage = new Storage<CoachingSession[]>(STORAGE_KEYS.COACHING_SESSIONS(userId));
      storage.set(sessions);
    }
  },

  delete: (userId: string, id: string): void => {
    const sessions = coachingSessionsCRUD.getAll(userId);
    const filtered = sessions.filter(cs => cs.id !== id);
    const storage = new Storage<CoachingSession[]>(STORAGE_KEYS.COACHING_SESSIONS(userId));
    storage.set(filtered);
  },
};

// ========== SETTINGS CRUD ==========

export const settingsCRUD = {
  get: (userId: string): AppSettings | null => {
    const storage = new Storage<AppSettings>(STORAGE_KEYS.SETTINGS(userId));
    return storage.get();
  },

  set: (userId: string, settings: AppSettings): void => {
    const storage = new Storage<AppSettings>(STORAGE_KEYS.SETTINGS(userId));
    storage.set(settings);
  },

  update: (userId: string, updates: Partial<AppSettings>): void => {
    const current = settingsCRUD.get(userId);
    if (current) {
      const storage = new Storage<AppSettings>(STORAGE_KEYS.SETTINGS(userId));
      storage.set({ ...current, ...updates });
    }
  },
};

// ========== EXPORT/IMPORT ==========

export const exportData = (userId: string): string => {
  const periods = periodsCRUD.getAll(userId);
  const data = {
    version: CURRENT_VERSION,
    exportDate: new Date().toISOString(),
    userId,
    periods,
    // Temporary duplication for backward compatibility with older imports
    quarters: periods,
    objectives: objectivesCRUD.getAll(userId),
    keyResults: keyResultsCRUD.getAll(userId),
    checkIns: checkInsCRUD.getAll(userId),
    coachingSessions: coachingSessionsCRUD.getAll(userId),
    settings: settingsCRUD.get(userId),
  };
  return JSON.stringify(data, null, 2);
};

export const importData = (userId: string, jsonString: string): void => {
  try {
    const data = JSON.parse(jsonString);

    if (!data.version) {
      throw new Error('Invalid data format: missing version');
    }

    // Import data for the user
    const periodPayload = data.periods ?? data.quarters;
    if (periodPayload) {
      const storage = new Storage<Period[]>(STORAGE_KEYS.PERIODS(userId));
      storage.set(periodPayload.map(normalizePeriod));
    }
    if (data.objectives) {
      const storage = new Storage<Objective[]>(STORAGE_KEYS.OBJECTIVES(userId));
      storage.set(data.objectives.map(normalizeObjective));
    }
    if (data.keyResults) {
      const storage = new Storage<KeyResult[]>(STORAGE_KEYS.KEY_RESULTS(userId));
      storage.set(data.keyResults.map(normalizeKeyResult));
    }
    if (data.checkIns) {
      const storage = new Storage<WeeklyCheckIn[]>(STORAGE_KEYS.CHECK_INS(userId));
      storage.set(data.checkIns.map(normalizeCheckIn));
    }
    if (data.coachingSessions) {
      const storage = new Storage<CoachingSession[]>(STORAGE_KEYS.COACHING_SESSIONS(userId));
      storage.set(data.coachingSessions);
    }
    if (data.settings) {
      const storage = new Storage<AppSettings>(STORAGE_KEYS.SETTINGS(userId));
      storage.set(data.settings);
    }

    console.log('Data imported successfully');
  } catch (error) {
    console.error('Error importing data:', error);
    throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// ========== DATA MANAGEMENT ==========

export const clearAllData = (userId: string): void => {
  new Storage(STORAGE_KEYS.PERIODS(userId)).clear();
  new Storage(STORAGE_KEYS.OBJECTIVES(userId)).clear();
  new Storage(STORAGE_KEYS.KEY_RESULTS(userId)).clear();
  new Storage(STORAGE_KEYS.CHECK_INS(userId)).clear();
  new Storage(STORAGE_KEYS.COACHING_SESSIONS(userId)).clear();
  new Storage(STORAGE_KEYS.SETTINGS(userId)).clear();
  console.log(`All data cleared for user ${userId}`);
};

export const clearAllDataGlobal = (): void => {
  localStorage.clear();
  console.log('All data cleared globally');
};

// ========== INITIALIZATION ==========

export const initializeApp = (): void => {
  // Initialize users first
  initializeUsers();

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    setCurrentUserId('mock-user');
  }

  // Create default period for current calendar quarter if none exists
  const userId = getCurrentUserId()!;
  const periods = periodsCRUD.getAll(userId);

  if (periods.length === 0) {
    const now = new Date();
    const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);
    const year = now.getFullYear();

    const startMonth = (currentQuarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0);

    periodsCRUD.create(
      userId,
      `Q${currentQuarter} ${year}`,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }

  // Update version
  localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_VERSION);
};
