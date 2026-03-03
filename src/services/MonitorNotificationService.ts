import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';

import { useAppStore } from '../store/useAppStore';
import { formatMinutes } from '../utils/timeUtils';

type NativeMonitorModule = {
  syncMonitor: (
    activityLabel: string,
    mode: string,
    targetAtMs: number,
    remainingMs: number,
    todaySitting: string
  ) => Promise<void>;
  stopMonitor: () => Promise<void>;
};

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const nativeMonitorModule = NativeModules.SitAlertAlarmModule as
  | NativeMonitorModule
  | undefined;

const supportsNativeMonitor =
  Platform.OS === 'android' &&
  !isExpoGo &&
  Boolean(nativeMonitorModule?.syncMonitor);

const resolveMonitorPayload = () => {
  const state = useAppStore.getState();
  const now = Date.now();

  let mode = 'IDLE';
  let targetAtMs = 0;
  let remainingMs = 0;

  if (state.killSwitchEnabled) {
    mode = 'OFF';
  } else if (state.alarmActive) {
    mode = 'ALERT';
  } else if (
    state.pendingWalkConfirmationUntil &&
    state.pendingWalkConfirmationUntil > now
  ) {
    mode = 'CONFIRM';
    targetAtMs = state.pendingWalkConfirmationUntil;
  } else if (state.snoozeUntil && state.snoozeUntil > now) {
    mode = 'SNOOZE';
    targetAtMs = state.snoozeUntil;
  } else if (state.walkingSince && state.pausedCountdownRemainingMs !== null) {
    mode = 'PAUSED';
    remainingMs = state.pausedCountdownRemainingMs;
  } else if (state.countdownTargetAt) {
    mode = 'COUNTDOWN';
    targetAtMs = state.countdownTargetAt;
  }

  return {
    activityLabel: state.currentActivityState,
    mode,
    targetAtMs,
    remainingMs,
    todaySitting: formatMinutes(state.todaysSummary.totalSittingMinutes),
  };
};

export const syncMonitoringNotification = async () => {
  if (!supportsNativeMonitor || !nativeMonitorModule) {
    return;
  }

  const payload = resolveMonitorPayload();

  try {
    await nativeMonitorModule.syncMonitor(
      payload.activityLabel,
      payload.mode,
      payload.targetAtMs,
      payload.remainingMs,
      payload.todaySitting
    );
  } catch {
    // Best-effort sync for the ongoing Android notification.
  }
};

export const stopMonitoringNotification = async () => {
  if (!supportsNativeMonitor || !nativeMonitorModule?.stopMonitor) {
    return;
  }

  try {
    await nativeMonitorModule.stopMonitor();
  } catch {
    // Best-effort stop.
  }
};
