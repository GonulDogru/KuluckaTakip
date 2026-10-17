import { StyleSheet, Text } from 'react-native';
import { isSupabaseConfigured } from '../lib/supabase';
import { colors } from '../theme/colors';

export function DemoModeBadge() {
  if (isSupabaseConfigured || !__DEV__) {
    return null;
  }

  return <Text style={styles.badge}>Demo Mod</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    color: colors.textMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 10,
  },
});
