import { ActivityState, AppSettings, DailySummary, PermissionSnapshot } from '../types';

export const SENSOR_INTERVAL_MS = 500;
export const ROLLING_SAMPLE_WINDOW = 10;
export const TRANSITION_STREAK_REQUIRED = 15;
export const DEFAULT_LOCATION_RADIUS_METERS = 175;
export const DEFAULT_ACTIVITY_STATE: ActivityState = 'STILL';

export const NOTIFICATION_CHANNEL_ID = 'sitalert_reminders_v3';
export const NOTIFICATION_CATEGORY_ID = 'sitalert_actions';
export const BACKGROUND_TASK_NAME = 'SITALERT_BACKGROUND_MONITOR';
export const REPEATED_ALERT_INTERVAL_MINUTES = 1;

export const STORAGE_KEYS = {
  runtime: 'sitalert.runtime',
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  alertIntervalMinutes: 5,
  walkGoalMinutes: 4,
  waterReminderEnabled: true,
  locationBasedSuppressionEnabled: true,
  meetingDetectionEnabled: true,
  nightModeStart: '23:00',
  nightModeEnd: '06:00',
  doNotDisturbDetectionEnabled: false,
};

export const DEFAULT_PERMISSIONS: PermissionSnapshot = {
  notifications: 'undetermined',
  location: 'undetermined',
  calendar: 'undetermined',
  deviceMotion: 'granted',
};

export const createDailySummary = (): DailySummary => ({
  dayKey: new Date().toDateString(),
  alertsTriggered: 0,
  alertsIgnored: 0,
  activeBreaks: 0,
  totalSittingMinutes: 0,
  longestInactivityMinutes: 0,
});
