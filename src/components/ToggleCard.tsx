import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ToggleCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  caption: string;
  active: boolean;
  onPress: () => void;
};

export default function ToggleCard({
  icon,
  label,
  caption,
  active,
  onPress,
}: ToggleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && styles.cardPressed,
      ]}>
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons
          name={icon}
          size={20}
          color={active ? '#FFF7EE' : '#6B6256'}
        />
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
      <Text style={[styles.caption, active && styles.captionActive]}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FFF8EE',
    borderWidth: 1,
    borderColor: '#E8D9C6',
    gap: 10,
  },
  cardActive: {
    backgroundColor: '#D96B2B',
    borderColor: '#D96B2B',
  },
  cardPressed: {
    opacity: 0.9,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E6D3',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#231D17',
  },
  labelActive: {
    color: '#FFF7EE',
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    color: '#7B6A57',
  },
  captionActive: {
    color: 'rgba(255, 247, 238, 0.82)',
  },
});
