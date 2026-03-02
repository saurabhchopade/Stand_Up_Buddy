import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChartBarDatum } from '../types';

type WeeklyChartProps = {
  bars: ChartBarDatum[];
};

const BAR_TRACK_HEIGHT = 132;

const formatCompactMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h${remainder}m` : `${hours}h`;
};

export default function WeeklyChart({ bars }: WeeklyChartProps) {
  const maxValue = Math.max(60, ...bars.map((bar) => bar.value));

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
                    height:
                      bar.value > 0
                        ? Math.max(4, (bar.value / maxValue) * BAR_TRACK_HEIGHT)
                        : 0,
                  },
                ]}
              />
            </View>
            <Text style={styles.barLabel}>{bar.label}</Text>
            <Text
              style={styles.barValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}>
              {formatCompactMinutes(bar.value)}
            </Text>
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
    minHeight: 180,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    width: '100%',
    height: BAR_TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#F0E1CC',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
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
    width: '100%',
    textAlign: 'center',
  },
});
