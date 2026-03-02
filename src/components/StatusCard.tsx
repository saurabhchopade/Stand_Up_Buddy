import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActivityState } from '../types';
import { formatElapsed } from '../utils/timeUtils';

type StatusCardProps = {
  activityState: ActivityState;
  lastMovementAt: number | null;
  confidence: number;
};

const stateColorMap: Record<ActivityState, string> = {
  STILL: '#B64D2F',
  WALKING: '#2F8A56',
  IN_VEHICLE: '#9A6B18',
};

export default function StatusCard({
  activityState,
  lastMovementAt,
  confidence,
}: StatusCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Current state</Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: stateColorMap[activityState],
            },
          ]}>
          <Text style={styles.badgeText}>{activityState.replace('_', ' ')}</Text>
        </View>
      </View>
      <Text style={styles.value}>Last movement {formatElapsed(lastMovementAt)} ago</Text>
      <Text style={styles.subtle}>
        Sensor confidence {Math.round(confidence * 100)}%
      </Text>
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
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: '#7B6A57',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: '#201B16',
  },
  subtle: {
    fontSize: 13,
    color: '#7B6A57',
  },
});
