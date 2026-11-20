import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../lib/AuthContext';
import { CartProvider, useCart } from '../lib/CartContext';
import { colors } from '../lib/theme';
import { Loading } from '../components/ui';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

import ShopScreen from '../screens/customer/ShopScreen';
import ProductScreen from '../screens/customer/ProductScreen';
import CartScreen from '../screens/customer/CartScreen';
import OrdersScreen from '../screens/customer/OrdersScreen';
import OrderTrackScreen from '../screens/customer/OrderTrackScreen';
import CompanyScreen from '../screens/customer/CompanyScreen';
import AccountScreen from '../screens/customer/AccountScreen';

import CashierQueueScreen from '../screens/cashier/CashierQueueScreen';
import CashierReceiptsScreen from '../screens/cashier/CashierReceiptsScreen';

import AccountsVerifyScreen from '../screens/accounts/AccountsVerifyScreen';
import AccountsCashBookScreen from '../screens/accounts/CashBookScreen';

import StoreQueueScreen from '../screens/store/StoreQueueScreen';
import StockScreen from '../screens/store/StockScreen';

import DashboardScreen from '../screens/manager/DashboardScreen';
import ManagerOrdersScreen from '../screens/manager/ManagerOrdersScreen';
import ManagerOrderDetailScreen from '../screens/manager/ManagerOrderDetailScreen';
import ProductsScreen from '../screens/manager/ProductsScreen';
import StaffScreen from '../screens/manager/StaffScreen';
import ReportsScreen from '../screens/manager/ReportsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const headerStyle = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700', fontSize: 16 },
};

/** A simple text label instead of an icon font, so there are no extra assets. */
const tabIcon = (label) => ({ color }) => (
  <Text style={{ color, fontSize: 10.5, fontWeight: '700' }}>{label}</Text>
);

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.orange,
  tabBarInactiveTintColor: colors.muted,
  tabBarStyle: { backgroundColor: '#fff', borderTopColor: colors.border, height: 58, paddingBottom: 6 },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
};

// ------------------------------------------------------------- Customer
function ShopStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="ShopHome" component={ShopScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Product" component={ProductScreen} options={{ title: 'Product' }} />
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
    </Stack.Navigator>
  );
}

function OrdersStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="OrdersList" component={OrdersScreen} options={{ title: 'My Orders' }} />
      <Stack.Screen name="OrderTrack" component={OrderTrackScreen} options={{ title: 'Track Order' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

function AccountStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="AccountHome" component={AccountScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
    </Stack.Navigator>
  );
}

function CartTabButton(props) {
  const { count } = useCart();
  return (
    <Pressable {...props} style={[props.style, { alignItems: 'center', justifyContent: 'center' }]}>
      <View>
        {props.children}
        {count > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function CustomerTabs() {
  const { user } = useAuth();
  const isCompany = !!user?.companyId;

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Shop" component={ShopStack} options={{ tabBarIcon: tabIcon('SHOP') }} />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          headerShown: true,
          ...headerStyle,
          title: 'My Cart',
          tabBarIcon: tabIcon('CART'),
          tabBarButton: (props) => <CartTabButton {...props} />,
        }}
      />
      <Tab.Screen name="Orders" component={OrdersStack} options={{ tabBarIcon: tabIcon('ORDR') }} />
      {isCompany && (
        <Tab.Screen
          name="Company"
          component={CompanyScreen}
          options={{ headerShown: true, ...headerStyle, title: 'Company', tabBarIcon: tabIcon('CO') }}
        />
      )}
      <Tab.Screen name="Account" component={AccountStack} options={{ tabBarIcon: tabIcon('ACCT') }} />
    </Tab.Navigator>
  );
}

// -------------------------------------------------------------- Cashier
function CashierTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Queue" component={CashierQueueScreen} options={{ tabBarIcon: tabIcon('QUEUE') }} />
      <Tab.Screen
        name="Receipts"
        component={CashierReceiptsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Receipts', tabBarIcon: tabIcon('RCPT') }}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Alerts', tabBarIcon: tabIcon('BELL') }}
      />
      <Tab.Screen name="Profile" component={AccountStack} options={{ tabBarIcon: tabIcon('ME') }} />
    </Tab.Navigator>
  );
}

// ------------------------------------------------------------- Accounts
function AccountsTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Verify" component={AccountsVerifyScreen} options={{ tabBarIcon: tabIcon('VRFY') }} />
      <Tab.Screen
        name="CashBook"
        component={AccountsCashBookScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Cash Book', tabBarIcon: tabIcon('BOOK') }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Reports', tabBarIcon: tabIcon('RPT') }}
      />
      <Tab.Screen name="Profile" component={AccountStack} options={{ tabBarIcon: tabIcon('ME') }} />
    </Tab.Navigator>
  );
}

// ---------------------------------------------------------------- Store
function StoreTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Release" component={StoreQueueScreen} options={{ tabBarIcon: tabIcon('ORDR') }} />
      <Tab.Screen
        name="Stock"
        component={StockScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Stock', tabBarIcon: tabIcon('STK') }}
      />
      <Tab.Screen
        name="Alerts"
        component={NotificationsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Alerts', tabBarIcon: tabIcon('BELL') }}
      />
      <Tab.Screen name="Profile" component={AccountStack} options={{ tabBarIcon: tabIcon('ME') }} />
    </Tab.Navigator>
  );
}

// -------------------------------------------------------------- Manager
function ManagerOrdersStack() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="ManagerOrdersList" component={ManagerOrdersScreen} options={{ title: 'All Orders' }} />
      <Stack.Screen name="ManagerOrderDetail" component={ManagerOrderDetailScreen} options={{ title: 'Order' }} />
    </Stack.Navigator>
  );
}

function ManagerTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('DASH') }} />
      <Tab.Screen name="Orders" component={ManagerOrdersStack} options={{ tabBarIcon: tabIcon('ORDR') }} />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Products', tabBarIcon: tabIcon('PROD') }}
      />
      <Tab.Screen
        name="Staff"
        component={StaffScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Staff', tabBarIcon: tabIcon('STAFF') }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ headerShown: true, ...headerStyle, title: 'Reports', tabBarIcon: tabIcon('RPT') }}
      />
    </Tab.Navigator>
  );
}

/** Each role lands on its own side of the app. */
function RoleRouter() {
  const { user } = useAuth();
  switch (user.role) {
    case 'cashier':  return <CashierTabs />;
    case 'accounts': return <AccountsTabs />;
    case 'store':    return <StoreTabs />;
    case 'manager':  return <ManagerTabs />;
    default:
      return (
        <CartProvider>
          <CustomerTabs />
        </CartProvider>
      );
  }
}

export default function RootNavigator() {
  const { user, ready } = useAuth();

  if (!ready) return <Loading label="Starting…" />;

  return (
    <NavigationContainer>
      {user ? (
        <RoleRouter />
      ) : (
        <Stack.Navigator screenOptions={headerStyle}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create account' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute', top: -6, right: -12, minWidth: 17, height: 17, borderRadius: 9,
    backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
