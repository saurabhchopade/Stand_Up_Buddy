import * as SQLite from 'expo-sqlite';

import { AnalyticsRange, AnalyticsSnapshot, DailySummary } from '../types';
import { createDailySummary } from '../utils/constants';
import { dayKeyFor, formatMinutes } from '../utils/timeUtils';

type ActivityEventRow = {
  id: number;
  kind: string;
  duration_minutes: number;
  activity_state: string | null;
  created_at: number;
  metadata: string | null;
};

type NotificationEventRow = {
  id: number;
  action: string;
  reason: string | null;
  created_at: number;
  metadata: string | null;
};

type BarBucket = {
  key: string;
  label: string;
  value: number;
  alerts: number;
};

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('sitalert.db');
  }

  return databasePromise;
};

export const initializeDatabase = async () => {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      activity_state TEXT,
      created_at INTEGER NOT NULL,
      metadata TEXT
    );
    CREATE TABLE IF NOT EXISTS notification_events (
      id INTEGER PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification_events(created_at);
  `);
};

export const recordActivityEvent = async (
  kind: string,
  durationMinutes: number,
  activityState?: string,
  metadata?: Record<string, unknown>
) => {
  const db = await getDatabase();

  await db.runAsync(
    'INSERT INTO activity_events (kind, duration_minutes, activity_state, created_at, metadata) VALUES (?, ?, ?, ?, ?)',
    kind,
    durationMinutes,
    activityState ?? null,
    Date.now(),
    metadata ? JSON.stringify(metadata) : null
  );
};

export const recordNotificationEvent = async (
  action: string,
  reason?: string | null,
  metadata?: Record<string, unknown>
) => {
  const db = await getDatabase();

  await db.runAsync(
    'INSERT INTO notification_events (action, reason, created_at, metadata) VALUES (?, ?, ?, ?)',
    action,
    reason ?? null,
    Date.now(),
    metadata ? JSON.stringify(metadata) : null
  );
};

const rangeToDays = (range: AnalyticsRange) => {
  switch (range) {
    case 'TODAY':
      return 1;
    case 'WEEK':
      return 7;
    case 'MONTH':
      return 30;
    default:
      return 7;
  }
};

const createBarBuckets = (): BarBucket[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));

    return {
      key: dayKeyFor(date.getTime()),
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      value: 0,
      alerts: 0,
    };
  });

const calculateStreak = (bars: BarBucket[]) => {
  let streak = 0;

  for (let index = bars.length - 1; index >= 0; index -= 1) {
    const bucket = bars[index];
    if (bucket && bucket.value <= 360) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
};

export const getAnalyticsSnapshot = async (
  range: AnalyticsRange,
  liveSummary?: DailySummary
): Promise<AnalyticsSnapshot> => {
  const db = await getDatabase();
  const todayKey = dayKeyFor();
  const since = Date.now() - rangeToDays(range) * 24 * 60 * 60 * 1000;

  const activityRows = await db.getAllAsync<ActivityEventRow>(
    'SELECT * FROM activity_events WHERE created_at >= ? ORDER BY created_at DESC',
    since
  );
  const notificationRows = await db.getAllAsync<NotificationEventRow>(
    'SELECT * FROM notification_events WHERE created_at >= ? ORDER BY created_at DESC',
    since
  );
  const weeklyRows = await db.getAllAsync<ActivityEventRow>(
    'SELECT * FROM activity_events WHERE created_at >= ? ORDER BY created_at DESC',
    Date.now() - 7 * 24 * 60 * 60 * 1000
  );

  const bars = createBarBuckets();
  const barMap = new Map(bars.map((bar) => [bar.key, bar]));
  const heatmap = Array.from({ length: 24 }, () => 0);

  for (const row of weeklyRows) {
    if (row.kind !== 'ALERT_TRIGGERED') {
      continue;
    }

    const bucket = barMap.get(dayKeyFor(row.created_at));
    if (bucket) {
      bucket.value += row.duration_minutes;
      bucket.alerts += 1;
    }

    const hour = new Date(row.created_at).getHours();
    heatmap[hour] = (heatmap[hour] ?? 0) + row.duration_minutes;
  }

  if (liveSummary && liveSummary.dayKey === dayKeyFor()) {
    const todayBucket = bars[bars.length - 1];
    if (todayBucket) {
      todayBucket.value = Math.max(todayBucket.value, liveSummary.totalSittingMinutes);
      todayBucket.alerts = Math.max(todayBucket.alerts, liveSummary.alertsTriggered);
    }
  }

  const alertRows = activityRows.filter((row) => row.kind === 'ALERT_TRIGGERED');
  const triggeredNotifications = notificationRows.filter((row) => row.action === 'TRIGGERED');
  const ignoredNotifications = notificationRows.filter((row) => row.action === 'DISMISSED');
  const todayDbSitting = alertRows
    .filter((row) => dayKeyFor(row.created_at) === todayKey)
    .reduce((total, row) => total + row.duration_minutes, 0);
  const todayDbTriggered = triggeredNotifications.filter(
    (row) => dayKeyFor(row.created_at) === todayKey
  ).length;
  const todayDbIgnored = ignoredNotifications.filter(
    (row) => dayKeyFor(row.created_at) === todayKey
  ).length;
  const liveSittingDelta =
    liveSummary?.dayKey === todayKey
      ? Math.max(0, liveSummary.totalSittingMinutes - todayDbSitting)
      : 0;
  const liveTriggeredDelta =
    liveSummary?.dayKey === todayKey
      ? Math.max(0, liveSummary.alertsTriggered - todayDbTriggered)
      : 0;
  const liveIgnoredDelta =
    liveSummary?.dayKey === todayKey
      ? Math.max(0, liveSummary.alertsIgnored - todayDbIgnored)
      : 0;

  const snapshot: AnalyticsSnapshot = {
    totalSittingMinutes:
      alertRows.reduce((total, row) => total + row.duration_minutes, 0) +
      liveSittingDelta,
    alertsTriggered: triggeredNotifications.length + liveTriggeredDelta,
    alertsIgnored: ignoredNotifications.length + liveIgnoredDelta,
    currentStreakDays: calculateStreak(bars),
    longestStreakMinutes: Math.max(
      liveSummary?.dayKey === todayKey ? liveSummary.longestInactivityMinutes : 0,
      ...alertRows.map((row) => row.duration_minutes),
      0
    ),
    bars,
    heatmap,
  };

  return snapshot;
};

export const getTodaySummary = async (): Promise<DailySummary> => {
  const snapshot = await getAnalyticsSnapshot('TODAY');

  return {
    ...createDailySummary(),
    alertsTriggered: snapshot.alertsTriggered,
    alertsIgnored: snapshot.alertsIgnored,
    totalSittingMinutes: snapshot.totalSittingMinutes,
    longestInactivityMinutes: snapshot.longestStreakMinutes,
  };
};

export const resetDatabase = async () => {
  const db = await getDatabase();

  await db.execAsync(`
    DELETE FROM activity_events;
    DELETE FROM notification_events;
  `);
};

export const describeHeatmapCell = (value: number) =>
  value === 0 ? 'No inactivity' : `${formatMinutes(value)} of seated time`;
