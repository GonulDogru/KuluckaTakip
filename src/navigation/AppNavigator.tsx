import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BatchDetailScreen } from '../screens/BatchDetailScreen';
import { CustomerDetailScreen } from '../screens/CustomerDetailScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { NewBatchScreen } from '../screens/NewBatchScreen';
import { NewCustomerScreen } from '../screens/NewCustomerScreen';
import { PartiesScreen } from '../screens/PartiesScreen';
import { SmsCenterScreen } from '../screens/SmsCenterScreen';
import { SmsPreviewScreen } from '../screens/SmsPreviewScreen';
import { colors } from '../theme/colors';
import type { MainTabParamList, RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, string> = {
  Dashboard: '⌂',
  Customers: '○',
  Parties: '●',
  SmsCenter: '✉',
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBaseHeight = 58;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: tabBarBaseHeight + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
          borderTopColor: colors.border,
        },
        tabBarItemStyle: {
          paddingBottom: insets.bottom > 0 ? 2 : 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarIcon: ({ color }) => (
          <Text style={{ color, fontSize: 20, fontWeight: '900' }}>{tabIcons[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: 'Müşteriler' }} />
      <Tab.Screen name="Parties" component={PartiesScreen} options={{ title: 'Yumurta Kayıtları' }} />
      <Tab.Screen name="SmsCenter" component={SmsCenterScreen} options={{ title: 'SMS Merkezi' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '900' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Müşteri Detayı' }} />
        <Stack.Screen name="NewCustomer" component={NewCustomerScreen} options={{ title: 'Yeni Müşteri' }} />
        <Stack.Screen name="NewBatch" component={NewBatchScreen} options={{ title: 'Yeni Yumurta Kabul' }} />
        <Stack.Screen name="BatchDetail" component={BatchDetailScreen} options={{ title: 'Yumurta Kabulü' }} />
        <Stack.Screen name="SmsPreview" component={SmsPreviewScreen} options={{ title: 'SMS Önizleme' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
