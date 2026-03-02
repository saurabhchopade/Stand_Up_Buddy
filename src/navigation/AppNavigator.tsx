import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  NavigationContainer,
  createNavigationContainerRef,
  DefaultTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AnalyticsScreen from '../screens/AnalyticsScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';

type TabParamList = {
  Home: undefined;
  Analytics: undefined;
  Settings: undefined;
};

type RootStackParamList = {
  Tabs: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F6EFE3',
    card: '#FFF8EE',
    border: '#E8D9C6',
    primary: '#D96B2B',
    text: '#1E1A16',
  },
};

const iconMap: Record<keyof TabParamList, React.ComponentProps<typeof Ionicons>['name']> = {
  Home: 'home',
  Analytics: 'bar-chart',
  Settings: 'options',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#D96B2B',
        tabBarInactiveTintColor: '#7B6A57',
        tabBarStyle: {
          backgroundColor: '#FFF8EE',
          borderTopColor: '#E8D9C6',
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={iconMap[route.name as keyof TabParamList]}
            size={size}
            color={color}
          />
        ),
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export const navigateToHome = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Tabs');
  }
};

export default function AppNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={appTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
