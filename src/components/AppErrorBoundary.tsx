import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { clearQueryCache } from '../services/queryCache';
import { colors } from '../theme/colors';
import { PrimaryButton } from './PrimaryButton';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.container}>
      <Text style={styles.title}>Ekran açılamadı</Text>
      <Text style={styles.hint}>Uygulamayı yeniden deneyebilirsin. Kaydedilmiş kayıtların sunucuda korunur.</Text>
      <PrimaryButton title="Tekrar dene" onPress={() => { clearQueryCache(); this.setState({ failed: false }); }} />
    </View>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 18, padding: 28, backgroundColor: colors.background },
  title: { color: colors.primary, fontSize: 24, fontWeight: '800' },
  hint: { color: colors.textMuted, lineHeight: 22 },
});
