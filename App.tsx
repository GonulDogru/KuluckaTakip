import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from './src/screens/AuthScreen';
import { authService } from './src/services/authService';
import { AppNavigator } from './src/navigation/AppNavigator';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { Screen } from './src/components/Screen';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return undefined;
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setAuthLoading(false);
      setAccessAllowed(false);
      setAuthError(null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setAccessAllowed(false);
      setAccessLoading(false);
      return;
    }
    let active = true;
    setAccessLoading(true);
    void authService.isAuthorizedUser().then((allowed) => {
      if (active) setAccessAllowed(allowed);
    }).catch(() => {
      if (active) setAuthError('Uygulama erişim yetkisi doğrulanamadı. Bağlantıyı kontrol edin.');
    }).finally(() => {
      if (active) setAccessLoading(false);
    });
    return () => { active = false; };
  }, [session]);

  return (
    <SafeAreaProvider>
      {!isSupabaseConfigured ? <AppNavigator /> : authLoading || accessLoading ? (
        <Screen><Text style={{ textAlign: 'center', marginTop: 40 }}>Oturum ve erişim doğrulanıyor...</Text></Screen>
      ) : authError && !session ? (
        <AuthScreen accessError={authError} onSignedOut={() => setSession(null)} />
      ) : session && accessAllowed ? (
        <AppNavigator />
      ) : (
        <AuthScreen
          accessDenied={Boolean(session) && !authError}
          accessError={session ? authError : null}
          onSignedOut={() => setSession(null)}
        />
      )}
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
