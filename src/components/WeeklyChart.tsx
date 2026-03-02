import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChartBarDatum } from '../types';
import { formatMinutes } from '../utils/timeUtils';

type WeeklyChartProps = {
  bars: ChartBarDatum[];
};

export default function WeeklyChart({ bars }: WeeklyChartProps) {
  const maxValue = Math.max(1, ...bars.map((bar) => bar.value));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Sitting hours by day</Text>
      <View style={styles.chart}>
        {bars.map((bar) => (
          <View key={bar.label} style={styles.column}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: `${(bar.value / maxValue) * 100}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{bar.label}</Text>
            <Text style={styles.barValue}>{formatMinutes(bar.value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E1A16',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    height: 180,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    width: '100%',
    flex: 1,
    borderRadius: 999,
    backgroundColor: '#F0E1CC',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    minHeight: 4,
    borderRadius: 999,
    backgroundColor: '#D96B2B',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4138',
  },
  barValue: {
    fontSize: 11,
    color: '#7B6A57',
  },
});
