import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { resetDatabase } from '../database/db';
import { usePermissions } from '../hooks/usePermissions';
import {
  manualResetTimer,
  recalculateCountdown,
  setKillSwitch,
} from '../services/ActivityService';
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

const stripTimeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);

const formatTimeInput = (value: string) => {
  const digits = stripTimeDigits(value);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

const normalizeTimeInput = (value: string) => {
  const digits = stripTimeDigits(value);

  if (digits.length !== 4) {
    return null;
  }

  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
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
  const killSwitchEnabled = useAppStore((state) => state.killSwitchEnabled);
  const { requestCalendarAccess, requestLocationAccess } = usePermissions();
  const tabBarHeight = useBottomTabBarHeight();
  const [savingLocation, setSavingLocation] = useState<'home' | 'office' | null>(null);
  const [nightStartInput, setNightStartInput] = useState(settings.nightModeStart);
  const [nightEndInput, setNightEndInput] = useState(settings.nightModeEnd);

  const alertIntervalOptions = useMemo(
    () => [1,3, 5, 15, 20, 30, 40, 50, 60, 75, 90],
    []
  );
  const walkGoalOptions = useMemo(
    () => Array.from({ length: 10 }, (_, index) => index + 1),
    []
  );

  useEffect(() => {
    setNightStartInput(settings.nightModeStart);
  }, [settings.nightModeStart]);

  useEffect(() => {
    setNightEndInput(settings.nightModeEnd);
  }, [settings.nightModeEnd]);

  const locationSummary = (label: string, value: typeof locations.home) => {
    if (!value) {
      return `${label} not set`;
    }

    return `${label}: ${value.latitude.toFixed(3)}, ${value.longitude.toFixed(3)}`;
  };

  const saveNightTime = (key: 'nightModeStart' | 'nightModeEnd', draft: string) => {
    const normalized = normalizeTimeInput(draft);
    const fallbackValue = settings[key];

    if (!normalized) {
      if (key === 'nightModeStart') {
        setNightStartInput(fallbackValue);
      } else {
        setNightEndInput(fallbackValue);
      }
      return;
    }

    updateSettings({ [key]: normalized });

    if (key === 'nightModeStart') {
      setNightStartInput(normalized);
    } else {
      setNightEndInput(normalized);
    }
  };

  const normalizedNightStart = normalizeTimeInput(nightStartInput);
  const normalizedNightEnd = normalizeTimeInput(nightEndInput);

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
          Tune how aggressively StandUpBro intervenes, and which contexts should silence notifications.
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
        <Text style={styles.panelTitle}>Saved locations</Text>
        <Text style={styles.helper}>
          Save your current GPS coordinates for Home and Office. Manual address entry can be added later.
        </Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Location-Based Suppression</Text>
            <Text style={styles.helper}>
              Disable location-based suppression while keeping your saved locations.
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
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.panelTitle}>Kill switch</Text>
            <Text style={styles.helper}>
              Instantly pause all reminders and stop any active alarm until you turn it back on.
            </Text>
          </View>
          <Switch
            value={killSwitchEnabled}
            onValueChange={(value) => {
              void setKillSwitch(value);
            }}
            trackColor={{ false: '#D5C5AF', true: '#D96B2B' }}
            thumbColor="#FFF8EE"
          />
        </View>
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
        <Text style={styles.helper}>Enter any 24-hour time in `HH:MM` format.</Text>

        <Text style={styles.smallLabel}>Starts</Text>
        <View style={styles.timeEditorRow}>
          <TextInput
            value={formatTimeInput(nightStartInput)}
            onChangeText={(value) => setNightStartInput(stripTimeDigits(value))}
            onBlur={() => saveNightTime('nightModeStart', nightStartInput)}
            onSubmitEditing={() => saveNightTime('nightModeStart', nightStartInput)}
            placeholder="23:00"
            placeholderTextColor="#A18F7A"
            keyboardType="number-pad"
            maxLength={5}
            style={styles.timeInput}
          />
          <Pressable
            onPress={() => saveNightTime('nightModeStart', nightStartInput)}
            style={({ pressed }) => [
              styles.timeSaveButton,
              !normalizedNightStart && styles.timeSaveButtonDisabled,
              pressed && normalizedNightStart && styles.secondaryButtonPressed,
            ]}
            disabled={!normalizedNightStart}>
            <Text style={styles.timeSaveButtonText}>Set</Text>
          </Pressable>
        </View>
        <Text style={styles.timePreview}>
          Applies as {formatClockLabel(normalizedNightStart ?? settings.nightModeStart)}
        </Text>

        <Text style={styles.smallLabel}>Ends</Text>
        <View style={styles.timeEditorRow}>
          <TextInput
            value={formatTimeInput(nightEndInput)}
            onChangeText={(value) => setNightEndInput(stripTimeDigits(value))}
            onBlur={() => saveNightTime('nightModeEnd', nightEndInput)}
            onSubmitEditing={() => saveNightTime('nightModeEnd', nightEndInput)}
            placeholder="06:00"
            placeholderTextColor="#A18F7A"
            keyboardType="number-pad"
            maxLength={5}
            style={styles.timeInput}
          />
          <Pressable
            onPress={() => saveNightTime('nightModeEnd', nightEndInput)}
            style={({ pressed }) => [
              styles.timeSaveButton,
              !normalizedNightEnd && styles.timeSaveButtonDisabled,
              pressed && normalizedNightEnd && styles.secondaryButtonPressed,
            ]}
            disabled={!normalizedNightEnd}>
            <Text style={styles.timeSaveButtonText}>Set</Text>
          </Pressable>
        </View>
        <Text style={styles.timePreview}>
          Applies as {formatClockLabel(normalizedNightEnd ?? settings.nightModeEnd)}
        </Text>
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
  timeEditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F3E6D3',
    borderWidth: 1,
    borderColor: '#E1D0BB',
    color: '#1E1A16',
    fontWeight: '700',
    fontSize: 16,
  },
  timeSaveButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#D96B2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSaveButtonDisabled: {
    backgroundColor: '#D5C5AF',
  },
  timeSaveButtonText: {
    color: '#FFF8EE',
    fontWeight: '800',
  },
  timePreview: {
    color: '#6C6358',
    fontSize: 12,
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
