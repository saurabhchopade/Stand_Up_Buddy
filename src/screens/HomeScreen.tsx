import React, { useEffect, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CountdownRing from '../components/CountdownRing';
import StatusCard from '../components/StatusCard';
import ToggleCard from '../components/ToggleCard';
import { useAppStore } from '../store/useAppStore';
import {
  acknowledgeCurrentAlert,
  toggleSnoozeForMinutes,
  enableMeetingModeForHour,
  setKillSwitch,
  snoozeForMinutes,
} from '../services/ActivityService';
import { formatMinutes, secondsRemaining } from '../utils/timeUtils';

const suppressionLabelMap = {
  KILL_SWITCH: 'Kill switch is on. All reminders are paused.',
  MEETING_MODE: 'Meeting mode is active',
  CALENDAR_BUSY: 'Calendar busy suppression is active',
  NIGHT_RANGE: 'Night mode is suppressing reminders',
  SYSTEM_DND: 'Do Not Disturb suppression is active',
  AT_OFFICE: 'Office location suppression is active',
  SNOOZE_ACTIVE: 'Snooze is delaying the next reminder',
} as const;

export default function HomeScreen() {
  const currentActivityState = useAppStore((state) => state.currentActivityState);
  const latestConfidence = useAppStore((state) => state.latestConfidence);
  const lastMovementAt = useAppStore((state) => state.lastMovementAt);
  const countdownTargetAt = useAppStore((state) => state.countdownTargetAt);
  const pausedCountdownRemainingMs = useAppStore(
    (state) => state.pausedCountdownRemainingMs
  );
  const walkingSince = useAppStore((state) => state.walkingSince);
  const alarmActive = useAppStore((state) => state.alarmActive);
  const manualMeetingModeUntil = useAppStore((state) => state.manualMeetingModeUntil);
  const snoozeUntil = useAppStore((state) => state.snoozeUntil);
  const nightModeOverride = useAppStore((state) => state.nightModeOverride);
  const killSwitchEnabled = useAppStore((state) => state.killSwitchEnabled);
  const lastSuppressionReason = useAppStore((state) => state.lastSuppressionReason);
  const settings = useAppStore((state) => state.settings);
  const todaysSummary = useAppStore((state) => state.todaysSummary);
  const setManualMeetingMode = useAppStore((state) => state.setManualMeetingMode);
  const setNightModeOverride = useAppStore((state) => state.setNightModeOverride);
  const tabBarHeight = useBottomTabBarHeight();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const totalSeconds = settings.alertIntervalMinutes * 60;
  const timerIsPaused =
    walkingSince !== null && pausedCountdownRemainingMs !== null;
  const remainingSeconds =
    timerIsPaused
      ? Math.max(0, Math.ceil(pausedCountdownRemainingMs / 1000))
      : secondsRemaining(countdownTargetAt, now);
  const ringProgress =
    countdownTargetAt || timerIsPaused ? remainingSeconds / totalSeconds : 1;
  const meetingModeActive =
    Boolean(manualMeetingModeUntil) && Number(manualMeetingModeUntil) > now;
  const suppressionMessage = lastSuppressionReason
    ? suppressionLabelMap[lastSuppressionReason]
    : null;
  const todaySittingLabel = formatMinutes(todaysSummary.totalSittingMinutes);

  return (
    <View
      style={styles.screen}
    >
      <View
        style={[
          styles.content,
          {
            paddingBottom: Math.max(12, tabBarHeight - 4),
          },
        ]}>
      {alarmActive ? (
        <View style={styles.alarmPanel}>
          <View style={styles.alarmHeader}>
            <Text style={styles.alarmTitle}>Alarm Active</Text>
            <Text style={styles.alarmCopy}>
              Sound and vibration continue until you act.
            </Text>
          </View>
          <View style={styles.alarmActions}>
            <Pressable
              onPress={() => {
                void acknowledgeCurrentAlert();
              }}
              style={({ pressed }) => [
                styles.alarmButton,
                styles.alarmButtonSecondary,
                pressed && styles.alarmButtonPressed,
              ]}>
              <Text style={styles.alarmButtonSecondaryText}>OK</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void snoozeForMinutes(10);
              }}
              style={({ pressed }) => [
                styles.alarmButton,
                styles.alarmButtonPrimary,
                pressed && styles.alarmButtonPressed,
              ]}>
              <Text style={styles.alarmButtonPrimaryText}>Snooze 10 min</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SitAlert</Text>
          <Text style={styles.title}>Break long sitting streaks before they become your baseline.</Text>
        </View>
        <CountdownRing progress={ringProgress} secondsRemaining={remainingSeconds} />
      </View>

      <StatusCard
        activityState={currentActivityState}
        lastMovementAt={lastMovementAt}
        confidence={latestConfidence}
      />

      <View style={styles.todayStrip}>
        <Text style={styles.todayStripLabel}>Today&apos;s sitting</Text>
        <Text style={styles.todayStripValue}>{todaySittingLabel}</Text>
      </View>

      {timerIsPaused ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Timer paused while walking. Keep walking for 30 seconds to reset it.
          </Text>
        </View>
      ) : null}

      <View style={styles.toggleGrid}>
        <ToggleCard
          icon="calendar-clear"
          label="Meeting Mode"
          caption={meetingModeActive ? 'Ends in about 1 hour' : 'Suppress alerts now'}
          active={meetingModeActive}
          onPress={() => {
            if (meetingModeActive) {
              setManualMeetingMode(false, null);
              return;
            }

            void enableMeetingModeForHour();
          }}
        />
        <ToggleCard
          icon="notifications-off"
          label="Snooze 10"
          caption={
            Boolean(snoozeUntil) && Number(snoozeUntil) > now
              ? 'Tap again to cancel snooze'
              : 'Delay the next reminder'
          }
          active={Boolean(snoozeUntil) && Number(snoozeUntil) > now}
          onPress={() => {
            void toggleSnoozeForMinutes(10);
          }}
        />
        <ToggleCard
          icon="moon"
          label="Disable Night Mode"
          caption="Turn off night suppression"
          active={nightModeOverride}
          onPress={() => {
            setNightModeOverride(!nightModeOverride);
          }}
        />
      </View>

      {suppressionMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{suppressionMessage}</Text>
        </View>
      ) : null}

      <View style={styles.dayAnalytics}>
        <Text style={styles.dayAnalyticsTitle}>Today</Text>
        <View style={styles.dayAnalyticsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Alerts</Text>
            <Text style={styles.metricValue}>{todaysSummary.alertsTriggered}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Ignored</Text>
            <Text style={styles.metricValue}>{todaysSummary.alertsIgnored}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Walk breaks</Text>
            <Text style={styles.metricValue}>{todaysSummary.activeBreaks}</Text>
          </View>
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => {
          void setKillSwitch(!killSwitchEnabled);
        }}
        style={({ pressed }) => [
          styles.killSwitchButton,
          killSwitchEnabled && styles.killSwitchButtonActive,
          pressed && styles.killSwitchButtonPressed,
        ]}>
        <Text
          style={[
            styles.killSwitchLabel,
            killSwitchEnabled && styles.killSwitchLabelActive,
          ]}>
          {killSwitchEnabled ? 'Kill Switch On' : 'Kill Switch'}
        </Text>
        <Text
          style={[
            styles.killSwitchCaption,
            killSwitchEnabled && styles.killSwitchCaptionActive,
          ]}>
          {killSwitchEnabled ? 'All reminders are paused' : 'Turn off all reminders'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6EFE3',
  },
  content: {
    flex: 1,
    padding: 20,
    gap: 8,
  },
  hero: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: '#1F3A2F',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: '#D7F0E1',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#FFF8EE',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  todayStrip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todayStripLabel: {
    color: '#7B6A57',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  todayStripValue: {
    color: '#1E1A16',
    fontSize: 18,
    fontWeight: '800',
  },
  toggleGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  killSwitchButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 2,
  },
  killSwitchButtonActive: {
    backgroundColor: '#D96B2B',
    borderColor: '#D96B2B',
  },
  killSwitchButtonPressed: {
    opacity: 0.92,
  },
  killSwitchLabel: {
    color: '#1E1A16',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  killSwitchLabelActive: {
    color: '#FFF8EE',
  },
  killSwitchCaption: {
    color: '#7B6A57',
    fontSize: 11,
  },
  killSwitchCaptionActive: {
    color: 'rgba(255, 248, 238, 0.82)',
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#F4DEC8',
    borderWidth: 1,
    borderColor: '#E4C4A4',
  },
  bannerText: {
    color: '#67462B',
    fontWeight: '600',
  },
  alarmPanel: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#5A1515',
    gap: 8,
  },
  alarmHeader: {
    gap: 4,
  },
  alarmTitle: {
    color: '#FFF4EE',
    fontSize: 15,
    fontWeight: '800',
  },
  alarmCopy: {
    color: 'rgba(255, 244, 238, 0.84)',
    fontSize: 12,
    lineHeight: 16,
  },
  alarmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  alarmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alarmButtonPrimary: {
    backgroundColor: '#D96B2B',
  },
  alarmButtonSecondary: {
    backgroundColor: '#FFF4EE',
  },
  alarmButtonPressed: {
    opacity: 0.9,
  },
  alarmButtonPrimaryText: {
    color: '#FFF8EE',
    fontWeight: '800',
  },
  alarmButtonSecondaryText: {
    color: '#4B1B13',
    fontWeight: '800',
  },
  dayAnalytics: {
    marginTop: 'auto',
    padding: 12,
    borderRadius: 18,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 10,
  },
  dayAnalyticsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E1A16',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dayAnalyticsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#F6EFE3',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7B6A57',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E1A16',
  },
});
