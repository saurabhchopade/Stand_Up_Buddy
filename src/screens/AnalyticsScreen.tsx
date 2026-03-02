import React, { useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import StatCard from '../components/StatCard';
import WeeklyChart from '../components/WeeklyChart';
import { describeHeatmapCell, getAnalyticsSnapshot } from '../database/db';
import { useAppStore } from '../store/useAppStore';
import { AnalyticsRange, AnalyticsSnapshot } from '../types';
import { formatMinutes } from '../utils/timeUtils';

const emptySnapshot: AnalyticsSnapshot = {
  totalSittingMinutes: 0,
  alertsTriggered: 0,
  alertsIgnored: 0,
  currentStreakDays: 0,
  longestStreakMinutes: 0,
  bars: Array.from({ length: 7 }, (_, index) => ({
    label: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] ?? 'Day',
    value: 0,
    alerts: 0,
  })),
  heatmap: Array.from({ length: 24 }, () => 0),
};

const rangeOptions: AnalyticsRange[] = ['TODAY', 'WEEK', 'MONTH'];

const hourLabel = (hour: number) => {
  const normalized = hour % 12 || 12;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${normalized}${suffix}`;
};

export default function AnalyticsScreen() {
  const analyticsRange = useAppStore((state) => state.analyticsRange);
  const setAnalyticsRange = useAppStore((state) => state.setAnalyticsRange);
  const todaysSummary = useAppStore((state) => state.todaysSummary);
  const settings = useAppStore((state) => state.settings);
  const tabBarHeight = useBottomTabBarHeight();
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(emptySnapshot);

  useEffect(() => {
    let mounted = true;

    const loadSnapshot = async () => {
      const nextSnapshot = await getAnalyticsSnapshot(analyticsRange, todaysSummary);
      if (mounted) {
        setSnapshot(nextSnapshot);
      }
    };

    void loadSnapshot();

    return () => {
      mounted = false;
    };
  }, [analyticsRange, todaysSummary]);

  const heatmapMax = useMemo(() => Math.max(1, ...snapshot.heatmap), [snapshot.heatmap]);
  const longestStreakProgress = Math.min(
    1,
    snapshot.longestStreakMinutes / Math.max(1, settings.alertIntervalMinutes)
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom: tabBarHeight + 18,
        },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>
          Review sitting load, ignored alerts, and the hours where long sedentary stretches cluster.
        </Text>
      </View>

      <View style={styles.segmented}>
        {rangeOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => setAnalyticsRange(option)}
            style={({ pressed }) => [
              styles.segment,
              analyticsRange === option && styles.segmentActive,
              pressed && styles.segmentPressed,
            ]}>
            <Text
              style={[
                styles.segmentText,
                analyticsRange === option && styles.segmentTextActive,
              ]}>
              {option === 'TODAY' ? 'Today' : option === 'WEEK' ? 'This Week' : 'This Month'}
            </Text>
          </Pressable>
        ))}
      </View>

      <WeeklyChart bars={snapshot.bars} />

      <View style={styles.statsGrid}>
        <StatCard label="Total sitting" value={formatMinutes(snapshot.totalSittingMinutes)} />
        <StatCard label="Alerts triggered" value={String(snapshot.alertsTriggered)} />
        <StatCard label="Alerts ignored" value={String(snapshot.alertsIgnored)} />
        <StatCard label="Goal streak" value={`${snapshot.currentStreakDays} days`} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Worst hours across the week</Text>
        <View style={styles.heatmap}>
          {snapshot.heatmap.map((value, hour) => {
            const intensity = value / heatmapMax;
            return (
              <View key={hour} style={styles.heatCellWrap}>
                <View
                  accessibilityLabel={describeHeatmapCell(value)}
                  style={[
                    styles.heatCell,
                    {
                      backgroundColor: `rgba(217, 107, 43, ${0.12 + intensity * 0.88})`,
                    },
                  ]}
                />
                <Text style={styles.heatLabel}>{hourLabel(hour)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Longest inactivity streak</Text>
        <Text style={styles.streakValue}>{formatMinutes(snapshot.longestStreakMinutes)}</Text>
        <Text style={styles.streakHint}>
          Compared against your {settings.alertIntervalMinutes}-minute alert interval.
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(6, longestStreakProgress * 100)}%`,
              },
            ]}
          />
        </View>
      </View>
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
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1E1A16',
  },
  subtitle: {
    color: '#6C6358',
    lineHeight: 21,
  },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#EDE0CF',
  },
  segment: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFF8EE',
  },
  segmentPressed: {
    opacity: 0.9,
  },
  segmentText: {
    color: '#6C6358',
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#1E1A16',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  panel: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 14,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E1A16',
  },
  heatmap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heatCellWrap: {
    width: '15.5%',
    gap: 6,
  },
  heatCell: {
    aspectRatio: 1,
    borderRadius: 12,
  },
  heatLabel: {
    fontSize: 10,
    color: '#6C6358',
    textAlign: 'center',
  },
  streakValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E1A16',
  },
  streakHint: {
    color: '#6C6358',
  },
  progressTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: '#F0E1CC',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#D96B2B',
  },
});
