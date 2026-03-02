export type ActivityState = 'STILL' | 'WALKING' | 'IN_VEHICLE';
export type AnalyticsRange = 'TODAY' | 'WEEK' | 'MONTH';
export type PermissionState = 'granted' | 'denied' | 'undetermined';
export type NotificationActionKey =
  | 'STOP_ALARM'
  | 'START_WALK'
  | 'SNOOZE'
  | 'IN_MEETING'
  | 'OPEN_APP'
  | 'DISMISSED';
export type SuppressionReason =
  | 'MEETING_MODE'
  | 'CALENDAR_BUSY'
  | 'NIGHT_RANGE'
  | 'SYSTEM_DND'
  | 'AT_OFFICE'
  | 'SNOOZE_ACTIVE'
  | null;

export interface MotionSample {
  x: number;
  y: number;
  z: number;
  timestamp: number;
  magnitude: number;
  netMagnitude: number;
}

export interface MotionInsight {
  averageNet: number;
  peakNet: number;
  variance: number;
  stepCount: number;
}

export interface SavedLocation {
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  manualAddress?: string;
  savedAt: number;
}

export interface SavedLocations {
  home: SavedLocation | null;
  office: SavedLocation | null;
}

export interface AppSettings {
  alertIntervalMinutes: number;
  walkGoalMinutes: number;
  waterReminderEnabled: boolean;
  locationBasedSuppressionEnabled: boolean;
  meetingDetectionEnabled: boolean;
  nightModeStart: string;
  nightModeEnd: string;
  doNotDisturbDetectionEnabled: boolean;
}

export interface PermissionSnapshot {
  notifications: PermissionState;
  location: PermissionState;
  calendar: PermissionState;
  deviceMotion: PermissionState;
}

export interface DailySummary {
  dayKey: string;
  alertsTriggered: number;
  alertsIgnored: number;
  activeBreaks: number;
  totalSittingMinutes: number;
  longestInactivityMinutes: number;
}

export interface AppRuntimeState {
  currentActivityState: ActivityState;
  latestConfidence: number;
  alarmActive: boolean;
  pausedCountdownRemainingMs: number | null;
  preSnoozeRemainingMs: number | null;
  pendingWalkConfirmationUntil: number | null;
  walkingPauseSince: number | null;
  walkingSince: number | null;
  stillSince: number | null;
  lastMovementAt: number | null;
  countdownStartedAt: number | null;
  countdownTargetAt: number | null;
  lastAlertAt: number | null;
  lastSuppressionReason: SuppressionReason;
  manualMeetingModeUntil: number | null;
  snoozeUntil: number | null;
  nightModeOverride: boolean;
}

export interface ChartBarDatum {
  label: string;
  value: number;
  alerts: number;
}

export interface AnalyticsSnapshot {
  totalSittingMinutes: number;
  alertsTriggered: number;
  alertsIgnored: number;
  currentStreakDays: number;
  longestStreakMinutes: number;
  bars: ChartBarDatum[];
  heatmap: number[];
}
