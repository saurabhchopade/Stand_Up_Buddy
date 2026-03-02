import AsyncStorage from '@react-native-async-storage/async-storage';

import { getTodaySummary, recordActivityEvent, recordNotificationEvent } from '../database/db';
import { useAppStore } from '../store/useAppStore';
import { NotificationActionKey, SuppressionReason } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { isInTimeRange, minutesBetween } from '../utils/timeUtils';
import { isCalendarBusy } from './CalendarService';
import { isAtOfficeLocation } from './LocationService';
import { sendInactivityNotification } from './NotificationService';

type PersistedRuntime = {
  stillSince: number | null;
  lastMovementAt: number | null;
  countdownStartedAt: number | null;
  countdownTargetAt: number | null;
  lastAlertAt: number | null;
};

let evaluationInFlight = false;

const persistRuntime = async () => {
  const {
    stillSince,
    lastMovementAt,
    countdownStartedAt,
    countdownTargetAt,
    lastAlertAt,
  } = useAppStore.getState();
  const payload: PersistedRuntime = {
    stillSince,
    lastMovementAt,
    countdownStartedAt,
    countdownTargetAt,
    lastAlertAt,
  };

  await AsyncStorage.setItem(STORAGE_KEYS.runtime, JSON.stringify(payload));
};

const clearPersistedRuntime = async () => {
  await AsyncStorage.removeItem(STORAGE_KEYS.runtime);
};

const scheduleFromNow = async (startAt: number = Date.now()) => {
  const { settings, patchRuntime, stillSince } = useAppStore.getState();

  patchRuntime({
    stillSince: stillSince ?? startAt,
    countdownStartedAt: startAt,
    countdownTargetAt: startAt + settings.alertIntervalMinutes * 60 * 1000,
    lastSuppressionReason: null,
  });

  await persistRuntime();
};

const resolveSuppressionReason = async (
  referenceTime: number
): Promise<SuppressionReason> => {
  const state = useAppStore.getState();

  if (state.snoozeUntil && referenceTime < state.snoozeUntil) {
    return 'SNOOZE_ACTIVE';
  }

  if (state.manualMeetingModeUntil && referenceTime < state.manualMeetingModeUntil) {
    return 'MEETING_MODE';
  }

  if (await isCalendarBusy(referenceTime)) {
    return 'CALENDAR_BUSY';
  }

  if (isInTimeRange(referenceTime, state.settings.nightModeStart, state.settings.nightModeEnd)) {
    return 'NIGHT_RANGE';
  }

  if (state.settings.doNotDisturbDetectionEnabled) {
    return 'SYSTEM_DND';
  }

  if (await isAtOfficeLocation()) {
    return 'AT_OFFICE';
  }

  if (state.nightModeOverride) {
    return 'NIGHT_OVERRIDE';
  }

  return null;
};

export const hydratePersistedRuntime = async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.runtime);
  if (!raw) {
    const summary = await getTodaySummary();
    useAppStore.getState().hydrateSummary(summary);
    return;
  }

  try {
    const parsed = JSON.parse(raw) as PersistedRuntime;

    useAppStore.getState().patchRuntime({
      stillSince: parsed.stillSince,
      lastMovementAt: parsed.lastMovementAt,
      countdownStartedAt: parsed.countdownStartedAt,
      countdownTargetAt: parsed.countdownTargetAt,
      lastAlertAt: parsed.lastAlertAt,
    });
  } catch {
    await clearPersistedRuntime();
  }

  const summary = await getTodaySummary();
  useAppStore.getState().hydrateSummary(summary);
};

export const handleActivityChange = async (
  nextState: 'STILL' | 'WALKING' | 'RUNNING' | 'IN_VEHICLE',
  confidence: number
) => {
  const state = useAppStore.getState();
  const timestamp = Date.now();

  state.setMotionState(nextState, confidence, timestamp);

  if (nextState === 'WALKING' || nextState === 'RUNNING') {
    if (state.countdownStartedAt) {
      const durationMinutes = minutesBetween(state.stillSince ?? state.countdownStartedAt, timestamp);
      await recordActivityEvent('BREAK', durationMinutes, nextState, {
        source: 'sensor',
      });
      state.recordActiveBreak();
    }

    state.patchRuntime({
      stillSince: null,
      countdownStartedAt: null,
      countdownTargetAt: null,
      lastMovementAt: timestamp,
      lastSuppressionReason: null,
      snoozeUntil: null,
    });
    await clearPersistedRuntime();
    return;
  }

  if (!state.countdownStartedAt) {
    await recordActivityEvent('COUNTDOWN_STARTED', 0, nextState, {
      source: 'sensor',
    });
    await scheduleFromNow(timestamp);
  }
};

export const recalculateCountdown = async () => {
  const { countdownStartedAt } = useAppStore.getState();

  if (!countdownStartedAt) {
    return;
  }

  await scheduleFromNow(countdownStartedAt);
};

export const manualResetTimer = async () => {
  const state = useAppStore.getState();
  const now = Date.now();

  if (state.countdownStartedAt) {
    const durationMinutes = minutesBetween(state.stillSince ?? state.countdownStartedAt, now);
    await recordActivityEvent('MANUAL_RESET', durationMinutes, state.currentActivityState, {
      source: 'manual',
    });
    state.recordActiveBreak();
  }

  state.patchRuntime({
    stillSince: now,
    countdownStartedAt: now,
    countdownTargetAt: now + state.settings.alertIntervalMinutes * 60 * 1000,
    lastMovementAt: now,
    lastSuppressionReason: null,
    snoozeUntil: null,
  });
  await persistRuntime();
};

export const enableMeetingModeForHour = async () => {
  useAppStore.getState().setManualMeetingMode(true, Date.now() + 60 * 60 * 1000);
  await recordNotificationEvent('MEETING_MODE_ENABLED');
};

export const snoozeForMinutes = async (minutes: number = 10) => {
  const now = Date.now();
  const targetAt = now + minutes * 60 * 1000;

  useAppStore.getState().patchRuntime({
    countdownStartedAt: now,
    countdownTargetAt: targetAt,
    snoozeUntil: targetAt,
    lastSuppressionReason: 'SNOOZE_ACTIVE',
  });

  await persistRuntime();
};

export const evaluateInactivity = async () => {
  const state = useAppStore.getState();

  if (evaluationInFlight || !state.countdownTargetAt) {
    return;
  }

  if (Date.now() < state.countdownTargetAt) {
    return;
  }

  evaluationInFlight = true;

  try {
    const now = Date.now();
    const durationMinutes = minutesBetween(state.stillSince ?? state.countdownStartedAt ?? now, now);
    const suppressionReason = await resolveSuppressionReason(now);

    if (suppressionReason) {
      state.patchRuntime({
        countdownStartedAt: now,
        countdownTargetAt: now + 10 * 60 * 1000,
        lastSuppressionReason: suppressionReason,
      });
      await recordNotificationEvent('SUPPRESSED', suppressionReason, {
        durationMinutes,
      });
      await persistRuntime();
      return;
    }

    await sendInactivityNotification(durationMinutes);
    await recordActivityEvent('ALERT_TRIGGERED', durationMinutes, state.currentActivityState, {
      durationMinutes,
    });
    await recordNotificationEvent('TRIGGERED', null, {
      durationMinutes,
    });
    state.recordAlertTriggered(durationMinutes);
    state.patchRuntime({
      countdownStartedAt: now,
      countdownTargetAt: now + state.settings.alertIntervalMinutes * 60 * 1000,
      lastSuppressionReason: null,
      lastAlertAt: now,
    });
    await persistRuntime();
  } finally {
    evaluationInFlight = false;
  }
};

export const handleNotificationAction = async (
  action: NotificationActionKey,
  notificationId?: string
) => {
  switch (action) {
    case 'START_WALK':
      await recordNotificationEvent('START_WALK', null, { notificationId });
      await manualResetTimer();
      return;
    case 'SNOOZE':
      await recordNotificationEvent('SNOOZE', null, { notificationId });
      await snoozeForMinutes(10);
      return;
    case 'IN_MEETING':
      await recordNotificationEvent('IN_MEETING', null, { notificationId });
      await enableMeetingModeForHour();
      return;
    case 'DISMISSED':
      useAppStore.getState().recordAlertIgnored();
      await recordNotificationEvent('DISMISSED', null, { notificationId });
      return;
    case 'OPEN_APP':
    default:
      await recordNotificationEvent('OPEN_APP', null, { notificationId });
  }
};
