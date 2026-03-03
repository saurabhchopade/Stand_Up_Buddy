import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type CountdownRingProps = {
  progress: number;
  secondsRemaining: number;
};

const RADIUS = 68;
const STROKE_WIDTH = 14;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const formatCountdown = (secondsRemaining: number) => {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function CountdownRing({
  progress,
  secondsRemaining,
}: CountdownRingProps) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = CIRCUMFERENCE * (1 - boundedProgress);

  return (
    <View style={styles.wrapper}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#E3D4BF"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#D96B2B"
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={styles.content}>
        <Text style={styles.kicker}>Next alert</Text>
        <Text style={styles.value}>{formatCountdown(secondsRemaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SIZE,
    height: SIZE,
  },
  content: {
    position: 'absolute',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 13,
    color: 'rgba(255, 248, 238, 0.78)',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  value: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF8EE',
  },
});
