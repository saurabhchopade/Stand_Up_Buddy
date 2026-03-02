import React, { useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { resetDatabase } from '../database/db';
import { usePermissions } from '../hooks/usePermissions';
import { manualResetTimer, recalculateCountdown } from '../services/ActivityService';
import { saveCurrentLocation } from '../services/LocationService';
import { useAppStore } from '../store/useAppStore';
import { formatClockLabel } from '../utils/timeUtils';

type DiscreteSliderProps = {
  label: string;
  values: number[];
  suffix: string;
  currentValue: number;
  onChange: (value: number) => void;
};

function DiscreteSlider({
  label,
  values,
  suffix,
  currentValue,
  onChange,
}: DiscreteSliderProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.rowBetween}>
        <Text style={styles.panelTitle}>{label}</Text>
        <Text style={styles.valueBadge}>
          {currentValue}
          {suffix}
        </Text>
      </View>
      <View style={styles.sliderRow}>
        {values.map((value) => {
          const active = value === currentValue;
          return (
            <Pressable
              key={value}
              onPress={() => onChange(value)}
              style={({ pressed }) => [
                styles.sliderTick,
                active && styles.sliderTickActive,
                pressed && styles.sliderTickPressed,
              ]}>
              <Text
                style={[
                  styles.sliderTickText,
                  active && styles.sliderTickTextActive,
                ]}>
                {value}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const settings = useAppStore((state) => state.settings);
  const locations = useAppStore((state) => state.locations);
  const permissions = useAppStore((state) => state.permissions);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const resetAllData = useAppStore((state) => state.resetAllData);
  const { requestCalendarAccess, requestLocationAccess } = usePermissions();
  const tabBarHeight = useBottomTabBarHeight();
  const [savingLocation, setSavingLocation] = useState<'home' | 'office' | null>(null);

  const alertIntervalOptions = useMemo(
    () => [1,3, 5, 15, 20, 30, 40, 50, 60, 75, 90],
    []
  );
  const walkGoalOptions = useMemo(
    () => Array.from({ length: 10 }, (_, index) => index + 1),
    []
  );
  const nightStartOptions = ['21:00', '22:00', '23:00', '00:00'];
  const nightEndOptions = ['05:00', '06:00', '07:00', '08:00'];

  const locationSummary = (label: string, value: typeof locations.home) => {
    if (!value) {
      return `${label} not set`;
    }

    return `${label}: ${value.latitude.toFixed(3)}, ${value.longitude.toFixed(3)}`;
  };

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
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Tune how aggressively SitAlert intervenes, and which contexts should silence notifications.
        </Text>
      </View>

      <DiscreteSlider
        label="Alert interval"
        values={alertIntervalOptions}
        suffix="m"
        currentValue={settings.alertIntervalMinutes}
        onChange={(value) => {
          updateSettings({ alertIntervalMinutes: value });
          void recalculateCountdown();
        }}
      />

      <DiscreteSlider
        label="Walk duration goal"
        values={walkGoalOptions}
        suffix="m"
        currentValue={settings.walkGoalMinutes}
        onChange={(value) => {
          updateSettings({ walkGoalMinutes: value });
        }}
      />

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Water reminder</Text>
            <Text style={styles.helper}>Adds a hydration prompt every 60 minutes.</Text>
          </View>
          <Switch
            value={settings.waterReminderEnabled}
            onValueChange={(value) => updateSettings({ waterReminderEnabled: value })}
            trackColor={{ false: '#D5C5AF', true: '#D96B2B' }}
            thumbColor="#FFF8EE"
          />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Saved locations</Text>
        <Text style={styles.helper}>
          Current MVP saves your live GPS coordinates. Manual address geocoding can be layered on next.
        </Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Location-Based Suppression</Text>
            <Text style={styles.helper}>
              Turn off office-location suppression while keeping saved GPS pins.
            </Text>
          </View>
          <Switch
            value={settings.locationBasedSuppressionEnabled}
            onValueChange={(value) =>
              updateSettings({ locationBasedSuppressionEnabled: value })
            }
            trackColor={{ false: '#D5C5AF', true: '#D96B2B' }}
            thumbColor="#FFF8EE"
          />
        </View>
        <Text style={styles.locationText}>{locationSummary('Home', locations.home)}</Text>
        <Pressable
          onPress={async () => {
            setSavingLocation('home');
            if (permissions.location !== 'granted') {
              await requestLocationAccess();
            }
            await saveCurrentLocation('home', 'Home');
            setSavingLocation(null);
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
          <Text style={styles.secondaryButtonText}>
            {savingLocation === 'home' ? 'Saving...' : 'Set Home from GPS'}
          </Text>
        </Pressable>
        <Text style={styles.locationText}>{locationSummary('Office', locations.office)}</Text>
        <Pressable
          onPress={async () => {
            setSavingLocation('office');
            if (permissions.location !== 'granted') {
              await requestLocationAccess();
            }
            await saveCurrentLocation('office', 'Office');
            setSavingLocation(null);
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}>
          <Text style={styles.secondaryButtonText}>
            {savingLocation === 'office' ? 'Saving...' : 'Set Office from GPS'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Meeting detection</Text>
            <Text style={styles.helper}>Suppress reminders when your calendar shows a live event.</Text>
          </View>
          <Switch
            value={settings.meetingDetectionEnabled}
            onValueChange={async (value) => {
              if (value && permissions.calendar !== 'granted') {
                await requestCalendarAccess();
              }
              updateSettings({ meetingDetectionEnabled: value });
            }}
            trackColor={{ false: '#D5C5AF', true: '#D96B2B' }}
            thumbColor="#FFF8EE"
          />
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Night mode window</Text>
        <Text style={styles.helper}>
          Current schedule: {formatClockLabel(settings.nightModeStart)} to{' '}
          {formatClockLabel(settings.nightModeEnd)}
        </Text>
        <Text style={styles.smallLabel}>Starts</Text>
        <View style={styles.timeGrid}>
          {nightStartOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => updateSettings({ nightModeStart: value })}
              style={[
                styles.timeChip,
                settings.nightModeStart === value && styles.timeChipActive,
              ]}>
              <Text
                style={[
                  styles.timeChipText,
                  settings.nightModeStart === value && styles.timeChipTextActive,
                ]}>
                {formatClockLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.smallLabel}>Ends</Text>
        <View style={styles.timeGrid}>
          {nightEndOptions.map((value) => (
            <Pressable
              key={value}
              onPress={() => updateSettings({ nightModeEnd: value })}
              style={[
                styles.timeChip,
                settings.nightModeEnd === value && styles.timeChipActive,
              ]}>
              <Text
                style={[
                  styles.timeChipText,
                  settings.nightModeEnd === value && styles.timeChipTextActive,
                ]}>
                {formatClockLabel(value)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Do Not Disturb detection</Text>
            <Text style={styles.helper}>
              Expo cannot read the system DND state directly, so this acts as a manual suppression flag.
            </Text>
          </View>
          <Switch
            value={settings.doNotDisturbDetectionEnabled}
            onValueChange={(value) => updateSettings({ doNotDisturbDetectionEnabled: value })}
            trackColor={{ false: '#D5C5AF', true: '#D96B2B' }}
            thumbColor="#FFF8EE"
          />
        </View>
      </View>

      <Pressable
        onPress={() => {
          Alert.alert('Reset all data?', 'This clears local analytics, locations, and timers.', [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  resetAllData();
                  await resetDatabase();
                  await manualResetTimer();
                })();
              },
            },
          ]);
        }}
        style={({ pressed }) => [styles.resetButton, pressed && styles.resetButtonPressed]}>
        <Text style={styles.resetButtonText}>Reset All Data</Text>
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
  helper: {
    color: '#6C6358',
    lineHeight: 20,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  valueBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3E6D3',
    color: '#6A4A2E',
    fontWeight: '700',
  },
  sliderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sliderTick: {
    minWidth: 46,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#F3E6D3',
    alignItems: 'center',
  },
  sliderTickActive: {
    backgroundColor: '#D96B2B',
  },
  sliderTickPressed: {
    opacity: 0.9,
  },
  sliderTickText: {
    color: '#6A4A2E',
    fontWeight: '700',
  },
  sliderTickTextActive: {
    color: '#FFF8EE',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 6,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#F3E6D3',
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    color: '#6A4A2E',
    fontWeight: '700',
  },
  locationText: {
    color: '#4C4339',
  },
  smallLabel: {
    color: '#6C6358',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontSize: 12,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F3E6D3',
  },
  timeChipActive: {
    backgroundColor: '#D96B2B',
  },
  timeChipText: {
    color: '#6A4A2E',
    fontWeight: '700',
  },
  timeChipTextActive: {
    color: '#FFF8EE',
  },
  resetButton: {
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: '#311E16',
  },
  resetButtonPressed: {
    opacity: 0.92,
  },
  resetButtonText: {
    color: '#FFF8EE',
    fontWeight: '800',
    fontSize: 16,
  },
});
