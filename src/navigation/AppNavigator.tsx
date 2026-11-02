import { useEffect } from 'react';
import { customerService } from '../services/customerService';
import { batchService } from '../services/batchService';
import { paymentService } from '../services/paymentService';
import { eggTypeService } from '../services/eggTypeService';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { AppIcon, type IconName } from '../components/AppIcon';
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

const tabIcons: Record<keyof MainTabParamList, IconName> = {
  Dashboard: 'home', Customers: 'users', Parties: 'egg', SmsCenter: 'mail',
};

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarBaseHeight = 68;

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
          backgroundColor: colors.surface,
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          elevation: 0,
        },
        tabBarItemStyle: {
          paddingBottom: insets.bottom > 0 ? 2 : 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarIcon: ({ color, focused }) => (
          <View style={{ width: 52, height: 33, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.primarySoft : 'transparent' }}><AppIcon name={tabIcons[route.name]} color={color} size={22} /></View>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Ana Sayfa' }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: 'Müşteriler' }} />
      <Tab.Screen name="Parties" component={PartiesScreen} options={{ title: 'Yumurtalar' }} />
      <Tab.Screen name="SmsCenter" component={SmsCenterScreen} options={{ title: 'SMS Merkezi' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  useEffect(() => {
    // Warm shared data while the user is on home; concurrent requests are shared.
    void Promise.allSettled([
      customerService.listWithSummary(),
      customerService.list({ includeArchived: true }),
      batchService.list(),
      paymentService.list(),
      eggTypeService.list(),
    ]);
  }, []);
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '900' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Müşteri Detayı' }} />
        <Stack.Screen name="NewCustomer" component={NewCustomerScreen} options={{ title: 'Yeni Müşteri' }} />
        <Stack.Screen name="NewBatch" component={NewBatchScreen} options={{ title: 'Yumurta kabulü', headerTintColor: colors.primary, headerTitleStyle: { fontSize: 18, fontWeight: '800' } }} />
        <Stack.Screen name="BatchDetail" component={BatchDetailScreen} options={{ title: 'Yumurta Kabulü' }} />
        <Stack.Screen name="SmsPreview" component={SmsPreviewScreen} options={{ title: 'SMS Önizleme' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
