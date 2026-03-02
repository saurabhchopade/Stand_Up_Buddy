import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import CountdownRing from '../components/CountdownRing';
import StatCard from '../components/StatCard';
import StatusCard from '../components/StatusCard';
import ToggleCard from '../components/ToggleCard';
import { useAppStore } from '../store/useAppStore';
import {
  enableMeetingModeForHour,
  manualResetTimer,
  snoozeForMinutes,
} from '../services/ActivityService';
import { formatMinutes, secondsRemaining } from '../utils/timeUtils';

const suppressionLabelMap = {
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
  const manualMeetingModeUntil = useAppStore((state) => state.manualMeetingModeUntil);
  const snoozeUntil = useAppStore((state) => state.snoozeUntil);
  const nightModeOverride = useAppStore((state) => state.nightModeOverride);
  const lastSuppressionReason = useAppStore((state) => state.lastSuppressionReason);
  const settings = useAppStore((state) => state.settings);
  const todaysSummary = useAppStore((state) => state.todaysSummary);
  const setManualMeetingMode = useAppStore((state) => state.setManualMeetingMode);
  const setNightModeOverride = useAppStore((state) => state.setNightModeOverride);
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
  const remainingSeconds = secondsRemaining(countdownTargetAt, now);
  const ringProgress = countdownTargetAt ? remainingSeconds / totalSeconds : 1;
  const meetingModeActive =
    Boolean(manualMeetingModeUntil) && Number(manualMeetingModeUntil) > now;
  const suppressionMessage = lastSuppressionReason
    ? suppressionLabelMap[lastSuppressionReason]
    : null;
  const miniSummary = useMemo(
    () => [
      {
        label: 'Alerts',
        value: String(todaysSummary.alertsTriggered),
        hint: 'Triggered today',
      },
      {
        label: 'Breaks',
        value: String(todaysSummary.activeBreaks),
        hint: 'Active resets',
      },
      {
        label: 'Sitting',
        value: formatMinutes(todaysSummary.totalSittingMinutes),
        hint: 'Accumulated',
      },
    ],
    [todaysSummary]
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>SitAlert</Text>
          <Text style={styles.title}>Break long sitting streaks before they become your baseline.</Text>
          <Text style={styles.subtitle}>
            Sensor tracking stays active in the background and only interrupts when your suppression rules allow it.
          </Text>
        </View>
        <CountdownRing progress={ringProgress} secondsRemaining={remainingSeconds} />
      </View>

      <StatusCard
        activityState={currentActivityState}
        lastMovementAt={lastMovementAt}
        confidence={latestConfidence}
      />

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
          caption="Delay the next reminder"
          active={Boolean(snoozeUntil) && Number(snoozeUntil) > now}
          onPress={() => {
            void snoozeForMinutes(10);
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

      <View style={styles.summarySection}>
        <Text style={styles.sectionTitle}>Today&apos;s snapshot</Text>
        <View style={styles.summaryRow}>
          {miniSummary.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint}
            />
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => {
          void manualResetTimer();
        }}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}>
        <Text style={styles.primaryButtonText}>I&apos;m Moving!</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F6EFE3',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  hero: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: '#1F3A2F',
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
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
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
  },
  subtitle: {
    color: 'rgba(255, 248, 238, 0.75)',
    fontSize: 14,
    lineHeight: 21,
  },
  toggleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#F4DEC8',
    borderWidth: 1,
    borderColor: '#E4C4A4',
  },
  bannerText: {
    color: '#67462B',
    fontWeight: '600',
  },
  summarySection: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E1A16',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D96B2B',
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: '#FFF8EE',
    fontSize: 18,
    fontWeight: '800',
  },
});
