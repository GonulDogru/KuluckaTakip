import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.accent}><View style={styles.blueAccent} /><View style={styles.redAccent} /></View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Image source={require('../../assets/hatchery-family.png')} style={styles.art} resizeMode="cover" accessible={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  copy: { flex: 1 },
  eyebrow: { color: colors.red, fontSize: 9, letterSpacing: 1.6, fontWeight: '700', marginBottom: 6 },
  title: { color: colors.primary, fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  accent: { flexDirection: 'row', gap: 4, marginTop: 9 },
  blueAccent: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.primary },
  redAccent: { width: 10, height: 4, borderRadius: 2, backgroundColor: colors.red },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 7 },
  art: { width: 88, height: 96, borderRadius: 25, backgroundColor: colors.cream },
});
