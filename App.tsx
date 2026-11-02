import { clearQueryCache } from './src/services/queryCache';
import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { authService } from './src/services/authService';
import { AppNavigator } from './src/navigation/AppNavigator';
import { isSupabaseConfigured, supabase, readStoredSession } from './src/lib/supabase';
import { colors } from './src/theme/colors';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const currentUserId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;
    let authEventReceived = false;
    // Restore the local session without waiting for a token refresh request.
    void readStoredSession().then((stored) => {
      if (mounted && !authEventReceived && stored) {
        currentUserId.current = stored.user.id;
        setSession(stored);
        setAccessAllowed(true);
        setAuthLoading(false);
      }
    }).catch(() => { /* The SDK remains responsible for session recovery. */ });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      authEventReceived = true;
      if (currentUserId.current !== nextSession?.user.id) {
        clearQueryCache();
        setAccessAllowed(true);
      }
      currentUserId.current = nextSession?.user.id;
      setSession(nextSession);
      setAuthLoading(false);
      if (!nextSession) {
        setAccessAllowed(true);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const updateRefresh = (state: string) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    updateRefresh(AppState.currentState);
    const listener = AppState.addEventListener('change', updateRefresh);
    return () => {
      listener.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId || !supabase) {
      setAccessAllowed(false);
      return;
    }
    let active = true;
    // RLS enforces authorization on every data request; this check only controls UI.
    setAccessAllowed(true);
    void authService.isAuthorizedUser().then((allowed) => {
      if (active) setAccessAllowed(allowed);
    }).catch(() => {
      // Keep the local session on connection errors. RLS still protects all data.
    });
    return () => { active = false; };
  }, [userId]);

  const demoAllowed = !isSupabaseConfigured && __DEV__;
  const showNavigator = demoAllowed || Boolean(session && accessAllowed);
  const showAuthScreen = isSupabaseConfigured
    && !authLoading
    && (!session || !accessAllowed);

  return (
    <SafeAreaProvider>
      {showNavigator ? <AppNavigator key={userId ?? 'demo'} /> : null}
      {showAuthScreen ? (
        <AuthScreen
          accessDenied={Boolean(session)}
          onSignedOut={() => setSession(null)}
        />
      ) : null}
      {!isSupabaseConfigured && !demoAllowed ? <View style={styles.loadingOverlay}><Text style={styles.loadingText}>Sunucu yapılandırması eksik. Uygulamayı güncel kurulum paketiyle yeniden yükleyin.</Text></View> : null}
      {authLoading ? (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Uygulama açılıyor...</Text>
        </View>
      ) : null}
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: colors.background,
    justifyContent: 'center',
    zIndex: 1,
  },
  loadingText: { color: colors.textMuted, fontWeight: '700' },
});
