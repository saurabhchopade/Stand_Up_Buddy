import AsyncStorage from '@react-native-async-storage/async-storage';

import { getTodaySummary, recordActivityEvent, recordNotificationEvent } from '../database/db';
import { useAppStore } from '../store/useAppStore';
import { NotificationActionKey, SuppressionReason } from '../types';
import {
  GO_FOR_WALK_CONFIRMATION_SECONDS,
  QUALIFIED_WALK_SECONDS,
  REPEATED_ALERT_INTERVAL_MINUTES,
  SNOOZE_DURATION_MINUTES,
  STORAGE_KEYS,
  WALKING_PAUSE_GRACE_SECONDS,
} from '../utils/constants';
import { isInTimeRange, minutesBetween } from '../utils/timeUtils';
import { startAlarmLoop, stopAlarmLoop } from './AlarmService';
import { isCalendarBusy } from './CalendarService';
import { isAtOfficeLocation } from './LocationService';
import { sendInactivityNotification } from './NotificationService';

type PersistedRuntime = {
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
};

let evaluationInFlight = false;

const persistRuntime = async () => {
  const {
    pausedCountdownRemainingMs,
    preSnoozeRemainingMs,
    pendingWalkConfirmationUntil,
    walkingPauseSince,
    walkingSince,
    stillSince,
    lastMovementAt,
    countdownStartedAt,
    countdownTargetAt,
    lastAlertAt,
  } = useAppStore.getState();
  const payload: PersistedRuntime = {
    pausedCountdownRemainingMs,
    preSnoozeRemainingMs,
    pendingWalkConfirmationUntil,
    walkingPauseSince,
    walkingSince,
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

const markCurrentAlertIgnored = async (
  reason: string,
  notificationId?: string
) => {
  useAppStore.getState().recordAlertIgnored();
  await recordNotificationEvent('DISMISSED', reason, {
    notificationId,
  });
};

const beginGoForWalkConfirmation = async () => {
  const state = useAppStore.getState();
  const now = Date.now();
  const confirmationDeadline = now + GO_FOR_WALK_CONFIRMATION_SECONDS * 1000;

  await stopAlarmLoop();

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: confirmationDeadline,
    walkingPauseSince: null,
    countdownStartedAt: now,
    countdownTargetAt: confirmationDeadline,
    lastSuppressionReason: null,
    snoozeUntil: null,
  });

  await persistRuntime();
};

const completeQualifiedWalk = async (timestamp: number = Date.now()) => {
  const state = useAppStore.getState();

  if (!state.walkingSince) {
    return false;
  }

  if (timestamp - state.walkingSince < QUALIFIED_WALK_SECONDS * 1000) {
    return false;
  }

  await stopAlarmLoop();

  if (state.countdownStartedAt) {
    const durationMinutes = minutesBetween(
      state.stillSince ?? state.countdownStartedAt,
      timestamp
    );
    await recordActivityEvent('BREAK', durationMinutes, 'WALKING', {
      source: 'sensor',
      qualifiedWalkSeconds: QUALIFIED_WALK_SECONDS,
    });
    state.recordActiveBreak();
  }

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
    stillSince: null,
    countdownStartedAt: null,
    countdownTargetAt: null,
    lastMovementAt: timestamp,
    lastSuppressionReason: null,
    snoozeUntil: null,
  });
  await clearPersistedRuntime();
  return true;
};

const scheduleFromNow = async (startAt: number = Date.now()) => {
  const { settings, patchRuntime, stillSince } = useAppStore.getState();

  patchRuntime({
    stillSince: stillSince ?? startAt,
    countdownStartedAt: startAt,
    countdownTargetAt: startAt + settings.alertIntervalMinutes * 60 * 1000,
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
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

  if (
    !state.nightModeOverride &&
    isInTimeRange(referenceTime, state.settings.nightModeStart, state.settings.nightModeEnd)
  ) {
    return 'NIGHT_RANGE';
  }

  if (state.settings.doNotDisturbDetectionEnabled) {
    return 'SYSTEM_DND';
  }

  if (await isAtOfficeLocation()) {
    return 'AT_OFFICE';
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
      pausedCountdownRemainingMs: parsed.pausedCountdownRemainingMs,
      preSnoozeRemainingMs: parsed.preSnoozeRemainingMs,
      pendingWalkConfirmationUntil: parsed.pendingWalkConfirmationUntil,
      walkingPauseSince: parsed.walkingPauseSince,
      walkingSince: parsed.walkingSince,
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
  nextState: 'STILL' | 'WALKING' | 'IN_VEHICLE',
  confidence: number
) => {
  const state = useAppStore.getState();
  const timestamp = Date.now();

  state.setMotionState(nextState, confidence, timestamp);

  if (nextState === 'WALKING') {
    if (!state.walkingSince) {
      await stopAlarmLoop();

      const pausedRemainingMs =
        state.pausedCountdownRemainingMs ??
        (state.countdownTargetAt
          ? Math.max(0, state.countdownTargetAt - timestamp)
          : null);

      state.patchRuntime({
        pausedCountdownRemainingMs: pausedRemainingMs,
        preSnoozeRemainingMs: null,
        pendingWalkConfirmationUntil: null,
        walkingPauseSince: null,
        walkingSince: timestamp,
        countdownTargetAt: null,
        lastSuppressionReason: null,
      });
      await persistRuntime();
      return;
    }

    if (state.walkingPauseSince) {
      state.patchRuntime({
        pendingWalkConfirmationUntil: null,
        walkingPauseSince: null,
      });
    }

    await completeQualifiedWalk(timestamp);
    if (useAppStore.getState().walkingSince) {
      await persistRuntime();
    }
    return;
  }

  if (state.walkingSince) {
    if (nextState === 'STILL') {
      if (!state.walkingPauseSince) {
        state.patchRuntime({
          walkingPauseSince: timestamp,
          lastSuppressionReason: null,
        });
        await persistRuntime();
      }
      return;
    }

    if (state.pausedCountdownRemainingMs !== null) {
      state.patchRuntime({
        pausedCountdownRemainingMs: null,
        preSnoozeRemainingMs: null,
        pendingWalkConfirmationUntil: null,
        walkingPauseSince: null,
        walkingSince: null,
        countdownTargetAt: timestamp + state.pausedCountdownRemainingMs,
        lastSuppressionReason: null,
      });
      await persistRuntime();
      return;
    }

    state.patchRuntime({
      walkingPauseSince: null,
      walkingSince: null,
    });
    await persistRuntime();
  }

  if (nextState === 'STILL' && !state.countdownStartedAt) {
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
  await stopAlarmLoop();

  if (state.countdownStartedAt) {
    const durationMinutes = minutesBetween(state.stillSince ?? state.countdownStartedAt, now);
    await recordActivityEvent('MANUAL_RESET', durationMinutes, state.currentActivityState, {
      source: 'manual',
    });
    state.recordActiveBreak();
  }

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
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
  await stopAlarmLoop();
  useAppStore.getState().patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
  });
  useAppStore.getState().setManualMeetingMode(true, Date.now() + 60 * 60 * 1000);
  await recordNotificationEvent('MEETING_MODE_ENABLED');
};

const applySnoozeForMinutes = async (minutes: number = SNOOZE_DURATION_MINUTES) => {
  const state = useAppStore.getState();
  const now = Date.now();
  const targetAt = now + minutes * 60 * 1000;
  const preSnoozeRemainingMs =
    state.pausedCountdownRemainingMs ??
    (state.countdownTargetAt ? Math.max(0, state.countdownTargetAt - now) : null);

  await stopAlarmLoop();

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
    countdownStartedAt: now,
    countdownTargetAt: targetAt,
    snoozeUntil: targetAt,
    lastSuppressionReason: 'SNOOZE_ACTIVE',
  });

  await persistRuntime();
};

export const cancelSnooze = async () => {
  const state = useAppStore.getState();
  const now = Date.now();
  const restoredRemainingMs =
    state.preSnoozeRemainingMs ??
    state.settings.alertIntervalMinutes * 60 * 1000;

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
    countdownStartedAt: now,
    countdownTargetAt: now + restoredRemainingMs,
    snoozeUntil: null,
    lastSuppressionReason: null,
  });

  await persistRuntime();
};

export const toggleSnoozeForMinutes = async (
  minutes: number = SNOOZE_DURATION_MINUTES
) => {
  const { snoozeUntil } = useAppStore.getState();
  const now = Date.now();

  if (snoozeUntil && snoozeUntil > now) {
    await cancelSnooze();
    return;
  }

  await applySnoozeForMinutes(minutes);
};

export const snoozeForMinutes = async (minutes: number = SNOOZE_DURATION_MINUTES) => {
  await applySnoozeForMinutes(minutes);
};

export const acknowledgeCurrentAlert = async () => {
  const state = useAppStore.getState();
  const now = Date.now();

  await stopAlarmLoop();

  state.patchRuntime({
    pausedCountdownRemainingMs: null,
    preSnoozeRemainingMs: null,
    pendingWalkConfirmationUntil: null,
    walkingPauseSince: null,
    walkingSince: null,
    countdownStartedAt: now,
    countdownTargetAt: now + state.settings.alertIntervalMinutes * 60 * 1000,
    lastSuppressionReason: null,
    snoozeUntil: null,
  });

  await persistRuntime();
};

export const evaluateInactivity = async () => {
  const state = useAppStore.getState();

  if (state.pendingWalkConfirmationUntil) {
    const now = Date.now();

    if (now < state.pendingWalkConfirmationUntil) {
      return;
    }

    if (!state.walkingSince && state.currentActivityState !== 'WALKING') {
      await markCurrentAlertIgnored('WALK_NOT_STARTED');
    }

    state.patchRuntime({
      pendingWalkConfirmationUntil: null,
    });
    await persistRuntime();
  }

  if (state.currentActivityState === 'WALKING') {
    const completedWalk = await completeQualifiedWalk();
    if (completedWalk) {
      return;
    }
  }

  if (
    state.walkingSince &&
    state.walkingPauseSince &&
    state.pausedCountdownRemainingMs !== null
  ) {
    const now = Date.now();

    if (now - state.walkingPauseSince >= WALKING_PAUSE_GRACE_SECONDS * 1000) {
      state.patchRuntime({
        pausedCountdownRemainingMs: null,
        preSnoozeRemainingMs: null,
        pendingWalkConfirmationUntil: null,
        walkingPauseSince: null,
        walkingSince: null,
        countdownTargetAt: now + state.pausedCountdownRemainingMs,
        lastSuppressionReason: null,
      });
      await persistRuntime();
    }

    return;
  }

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
        pausedCountdownRemainingMs: null,
        pendingWalkConfirmationUntil: null,
        walkingPauseSince: null,
        countdownStartedAt: now,
        countdownTargetAt:
          now + state.settings.alertIntervalMinutes * 60 * 1000,
        lastSuppressionReason: suppressionReason,
      });
      await recordNotificationEvent('SUPPRESSED', suppressionReason, {
        durationMinutes,
      });
      await persistRuntime();
      return;
    }

    await sendInactivityNotification(durationMinutes);
    await startAlarmLoop();
    await recordActivityEvent('ALERT_TRIGGERED', durationMinutes, state.currentActivityState, {
      durationMinutes,
    });
    await recordNotificationEvent('TRIGGERED', null, {
      durationMinutes,
    });
    state.recordAlertTriggered(durationMinutes);
    state.patchRuntime({
      pausedCountdownRemainingMs: null,
      preSnoozeRemainingMs: null,
      pendingWalkConfirmationUntil: null,
      walkingPauseSince: null,
      countdownStartedAt: now,
      countdownTargetAt: now + REPEATED_ALERT_INTERVAL_MINUTES * 60 * 1000,
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
    case 'STOP_ALARM':
      await recordNotificationEvent('STOP_ALARM', null, { notificationId });
      await acknowledgeCurrentAlert();
      return;
    case 'START_WALK':
      await recordNotificationEvent('START_WALK', null, { notificationId });
      await beginGoForWalkConfirmation();
      return;
    case 'SNOOZE':
      await markCurrentAlertIgnored('SNOOZED', notificationId);
      await recordNotificationEvent('SNOOZE', null, { notificationId });
      await snoozeForMinutes(SNOOZE_DURATION_MINUTES);
      return;
    case 'IN_MEETING':
      await recordNotificationEvent('IN_MEETING', null, { notificationId });
      await enableMeetingModeForHour();
      return;
    case 'DISMISSED':
      await markCurrentAlertIgnored('USER_DISMISSED', notificationId);
      return;
    case 'OPEN_APP':
    default:
      await recordNotificationEvent('OPEN_APP', null, { notificationId });
  }
};
