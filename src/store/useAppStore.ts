import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  ActivityState,
  AnalyticsRange,
  AppRuntimeState,
  AppSettings,
  DailySummary,
  PermissionSnapshot,
  SavedLocation,
  SavedLocations,
} from '../types';
import {
  createDailySummary,
  DEFAULT_ACTIVITY_STATE,
  DEFAULT_PERMISSIONS,
  DEFAULT_SETTINGS,
} from '../utils/constants';
import { dayKeyFor } from '../utils/timeUtils';

const freshSummary = (summary: DailySummary) =>
  summary.dayKey === dayKeyFor() ? summary : createDailySummary();

const baseRuntimeState: AppRuntimeState = {
  currentActivityState: DEFAULT_ACTIVITY_STATE,
  latestConfidence: 0,
  alarmActive: false,
  pausedCountdownRemainingMs: null,
  preSnoozeRemainingMs: null,
  pendingWalkConfirmationUntil: null,
  walkingPauseSince: null,
  walkingSince: null,
  stillSince: null,
  lastMovementAt: Date.now(),
  countdownStartedAt: null,
  countdownTargetAt: null,
  lastAlertAt: null,
  lastSuppressionReason: null,
  manualMeetingModeUntil: null,
  snoozeUntil: null,
  nightModeOverride: true,
  killSwitchEnabled: false,
};

interface AppStore extends AppRuntimeState {
  analyticsRange: AnalyticsRange;
  settings: AppSettings;
  locations: SavedLocations;
  permissions: PermissionSnapshot;
  todaysSummary: DailySummary;
  setMotionState: (activityState: ActivityState, confidence: number, timestamp?: number) => void;
  patchRuntime: (patch: Partial<AppRuntimeState>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setSavedLocation: (key: keyof SavedLocations, location: SavedLocation | null) => void;
  setPermission: (key: keyof PermissionSnapshot, value: PermissionSnapshot[keyof PermissionSnapshot]) => void;
  setAnalyticsRange: (range: AnalyticsRange) => void;
  setManualMeetingMode: (enabled: boolean, until?: number | null) => void;
  setSnoozeUntil: (timestamp: number | null) => void;
  setNightModeOverride: (enabled: boolean) => void;
  setKillSwitchEnabled: (enabled: boolean) => void;
  recordAlertTriggered: (durationMinutes: number) => void;
  recordAlertIgnored: () => void;
  recordActiveBreak: () => void;
  hydrateSummary: (summary: Partial<DailySummary>) => void;
  resetAllData: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      ...baseRuntimeState,
      analyticsRange: 'TODAY',
      settings: DEFAULT_SETTINGS,
      locations: {
        home: null,
        office: null,
      },
      permissions: DEFAULT_PERMISSIONS,
      todaysSummary: createDailySummary(),
      setMotionState: (activityState, confidence, timestamp = Date.now()) =>
        set((state) => ({
          currentActivityState: activityState,
          latestConfidence: confidence,
          stillSince:
            activityState === 'STILL'
              ? state.stillSince ?? timestamp
              : state.walkingSince || state.pausedCountdownRemainingMs !== null
                ? state.stillSince
              : null,
          lastMovementAt:
            activityState === 'WALKING'
              ? timestamp
              : state.lastMovementAt,
        })),
      patchRuntime: (patch) => set(() => patch),
      updateSettings: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...patch,
          },
        })),
      setSavedLocation: (key, location) =>
        set((state) => ({
          locations: {
            ...state.locations,
            [key]: location,
          },
        })),
      setPermission: (key, value) =>
        set((state) => ({
          permissions: {
            ...state.permissions,
            [key]: value,
          },
        })),
      setAnalyticsRange: (range) => set(() => ({ analyticsRange: range })),
      setManualMeetingMode: (enabled, until = null) =>
        set(() => ({
          manualMeetingModeUntil: enabled ? until ?? Date.now() + 60 * 60 * 1000 : null,
        })),
      setSnoozeUntil: (timestamp) => set(() => ({ snoozeUntil: timestamp })),
      setNightModeOverride: (enabled) => set(() => ({ nightModeOverride: enabled })),
      setKillSwitchEnabled: (enabled) => set(() => ({ killSwitchEnabled: enabled })),
      recordAlertTriggered: (durationMinutes) =>
        set((state) => {
          const summary = freshSummary(state.todaysSummary);

          return {
            todaysSummary: {
              ...summary,
              alertsTriggered: summary.alertsTriggered + 1,
              totalSittingMinutes: summary.totalSittingMinutes + durationMinutes,
              longestInactivityMinutes: Math.max(
                summary.longestInactivityMinutes,
                durationMinutes
              ),
            },
            lastAlertAt: Date.now(),
          };
        }),
      recordAlertIgnored: () =>
        set((state) => {
          const summary = freshSummary(state.todaysSummary);

          return {
            todaysSummary: {
              ...summary,
              alertsIgnored: summary.alertsIgnored + 1,
            },
          };
        }),
      recordActiveBreak: () =>
        set((state) => {
          const summary = freshSummary(state.todaysSummary);

          return {
            todaysSummary: {
              ...summary,
              activeBreaks: summary.activeBreaks + 1,
            },
          };
        }),
      hydrateSummary: (summary) =>
        set((state) => ({
          todaysSummary: {
            ...freshSummary(state.todaysSummary),
            ...summary,
          },
        })),
      resetAllData: () =>
        set(() => ({
          ...baseRuntimeState,
          analyticsRange: 'TODAY',
          settings: DEFAULT_SETTINGS,
          locations: {
            home: null,
            office: null,
          },
          permissions: DEFAULT_PERMISSIONS,
          todaysSummary: createDailySummary(),
        })),
    }),
    {
      name: 'sitalert.store',
      version: 1,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as AppStore;
        }

        const state = persistedState as Partial<AppStore>;

        return {
          ...state,
          snoozeUntil: null,
          preSnoozeRemainingMs: null,
          pendingWalkConfirmationUntil: null,
          nightModeOverride: true,
          killSwitchEnabled: false,
        } as AppStore;
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        analyticsRange: state.analyticsRange,
        settings: state.settings,
        locations: state.locations,
        permissions: state.permissions,
        todaysSummary: freshSummary(state.todaysSummary),
        manualMeetingModeUntil: state.manualMeetingModeUntil,
        snoozeUntil: state.snoozeUntil,
        nightModeOverride: state.nightModeOverride,
        killSwitchEnabled: state.killSwitchEnabled,
        pausedCountdownRemainingMs: state.pausedCountdownRemainingMs,
        preSnoozeRemainingMs: state.preSnoozeRemainingMs,
        pendingWalkConfirmationUntil: state.pendingWalkConfirmationUntil,
        walkingPauseSince: state.walkingPauseSince,
        walkingSince: state.walkingSince,
      }),
    }
  )
);
