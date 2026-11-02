import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { Screen } from '../components/Screen';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { authService } from '../services/authService';

type Props = {
  accessDenied?: boolean;
  accessError?: string | null;
  onSignedOut: () => void;
};

export function AuthScreen({ accessDenied = false, accessError = null, onSignedOut }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch {
      setError('Giriş yapılamadı. E-posta ve parolayı kontrol edin.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    try {
      await authService.signOut();
      onSignedOut();
    } catch {
      setError('Oturum kapatılamadı. Lütfen tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/hatchery-family.png')} style={styles.art} resizeMode="cover" accessible={false} />
        <Text style={styles.title}>Kuluçka Takip</Text>
        {accessDenied || accessError ? (
          <>
            <Text style={styles.message}>{accessError
              ? 'Hesabın uygulama erişimi şu anda doğrulanamıyor.'
              : 'Bu hesap uygulama erişimi için etkinleştirilmemiş.'}</Text>
            <Text style={styles.hint}>{accessError ?? 'Erişim için işletme yöneticisine başvurun.'}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void signOut(); }} disabled={busy} style={styles.button}>
              <Text style={styles.buttonText}>{busy ? 'Bekleyin...' : 'Başka hesapla giriş yap'}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.message}>Devam etmek için yetkili hesabınızla giriş yapın.</Text>
            <TextInput
              accessibilityLabel="E-posta"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="E-posta"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={email}
            />
            <TextInput
              accessibilityLabel="Parola"
              autoCapitalize="none"
              autoComplete="current-password"
              onChangeText={setPassword}
              onSubmitEditing={() => { void signIn(); }}
              placeholder="Parola"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy || !email.trim() || !password}
              onPress={() => { void signIn(); }}
              style={[styles.button, (busy || !email.trim() || !password) && styles.disabled]}
            >
              <Text style={styles.buttonText}>{busy ? 'Giriş yapılıyor...' : 'Giriş yap'}</Text>
            </Pressable>
            <Text style={styles.hint}>Yeni hesaplar yalnızca işletme yöneticisi tarafından tanımlanır.</Text>
          </>
        )}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {!isSupabaseConfigured ? <Text style={styles.error}>Supabase yapılandırması bulunamadı.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  art: { width: '100%', height: 190, borderRadius: 26, marginBottom: 22 },
  title: { color: colors.text, fontSize: 30, fontWeight: '900', marginBottom: 12 },
  message: { color: colors.text, fontSize: 16, lineHeight: 23, marginBottom: 18 },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, color: colors.text, fontSize: 16, marginBottom: 12 },
  button: { minHeight: 52, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, marginTop: 4 },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  hint: { color: colors.textMuted, marginTop: 14, lineHeight: 20 },
  error: { color: colors.danger, marginTop: 16, fontWeight: '800' },
});
