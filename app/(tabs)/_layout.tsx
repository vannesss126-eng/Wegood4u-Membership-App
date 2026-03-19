import { Tabs } from 'expo-router';
import { CircleEllipsis as Home, MapPin, SquareCheck as CheckSquare, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_BAR_CONTENT_HEIGHT = 68;

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#B8D4C1',
        tabBarStyle: {
          backgroundColor: '#206E56',
          borderTopColor: '#CBEED2',
          paddingTop: 8,
          paddingBottom: insets.bottom,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          color: '#FFFFFF',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ size, color }) => (
            <CheckSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}