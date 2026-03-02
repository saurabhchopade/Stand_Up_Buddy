import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export default function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 8,
  },
  label: {
    fontSize: 12,
    color: '#7B6A57',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E1A16',
  },
  hint: {
    fontSize: 12,
    color: '#7B6A57',
  },
});
