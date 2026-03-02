import * as Location from 'expo-location';

import { useAppStore } from '../store/useAppStore';
import { SavedLocation, SavedLocations } from '../types';
import { DEFAULT_LOCATION_RADIUS_METERS } from '../utils/constants';

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const distanceInMeters = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) => {
  const earthRadius = 6371000;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(toRadians(fromLatitude)) *
      Math.cos(toRadians(toLatitude)) *
      Math.sin(deltaLongitude / 2) *
      Math.sin(deltaLongitude / 2);

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const requestLocationPermission = async () => {
  const result = await Location.requestForegroundPermissionsAsync();
  useAppStore.getState().setPermission('location', result.status);
  return result.status;
};

export const saveCurrentLocation = async (
  key: keyof SavedLocations,
  label: string
): Promise<SavedLocation | null> => {
  const { permissions, setSavedLocation } = useAppStore.getState();
  const status =
    permissions.location === 'granted'
      ? permissions.location
      : await requestLocationPermission();

  if (status !== 'granted') {
    return null;
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const savedLocation: SavedLocation = {
      label,
      latitude: current.coords.latitude,
      longitude: current.coords.longitude,
      radiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
      savedAt: Date.now(),
    };

    setSavedLocation(key, savedLocation);
    return savedLocation;
  } catch {
    return null;
  }
};

export const saveManualLocation = (
  key: keyof SavedLocations,
  label: string,
  latitude: number,
  longitude: number,
  manualAddress?: string
) => {
  const savedLocation: SavedLocation = {
    label,
    latitude,
    longitude,
    radiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
    manualAddress,
    savedAt: Date.now(),
  };

  useAppStore.getState().setSavedLocation(key, savedLocation);
  return savedLocation;
};

export const isAtOfficeLocation = async () => {
  const { locations, permissions } = useAppStore.getState();

  if (!locations.office || permissions.location !== 'granted') {
    return false;
  }

  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });

    const distance = distanceInMeters(
      current.coords.latitude,
      current.coords.longitude,
      locations.office.latitude,
      locations.office.longitude
    );

    return distance <= locations.office.radiusMeters;
  } catch {
    return false;
  }
};
