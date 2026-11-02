import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DemoModeBadge } from '../components/DemoModeBadge';
import { AppIcon, type IconName } from '../components/AppIcon';
import { InfoCard } from '../components/InfoCard';
import { Screen } from '../components/Screen';
import type { RootStackParamList } from '../navigation/types';
import { dashboardService, type DashboardSummary } from '../services/dashboardService';
import { colors } from '../theme/colors';
import { formatCurrency } from '../utils/money';

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    void dashboardService.getSummary().then((next) => {
      if (active) { setSummary(next); setLoadError(null); }
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Ana sayfa verileri yüklenemedi.');
    });
    return () => { active = false; };
  }, []));
  const date = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
  const actions: { title: string; subtitle: string; icon: IconName; red?: boolean; onPress: () => void }[] = [
    { title: 'Yumurta kabulü', subtitle: 'Yeni kayıt oluştur', icon: 'egg', red: true, onPress: () => navigation.navigate('NewBatch') },
    { title: 'Yeni müşteri', subtitle: 'Müşterini kaydet', icon: 'users', onPress: () => navigation.navigate('NewCustomer') },
  ];
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DemoModeBadge />
        <View style={styles.topbar}>
          <View style={styles.brandMark}><AppIcon name="egg" color={colors.surface} size={25} /></View>
          <View style={styles.brandCopy}><Text style={styles.brand}>Kuluçka<Text style={styles.brandAccent}>Takip</Text></Text><Text style={styles.brandHint}>HER YUMURTA, YENİ BİR BAŞLANGIÇ</Text></View>
          <View style={styles.miniMark}><Text style={styles.miniMarkText}>KT</Text></View>
        </View>
        <View style={styles.welcome}><Text style={styles.welcomeTitle}>Merhaba, hoş geldin.</Text><Text style={styles.date}>{date}</Text></View>
        <View style={styles.hero}>
          <View style={styles.heroTag}><View style={styles.tagDot} /><Text style={styles.heroTagText}>KÜÇÜK BAŞLANGIÇLAR, BÜYÜK UMUTLAR</Text></View>
          <Text style={styles.heroTitle}>Yumurtadan hayata,{"\n"}her adım yanında.</Text>
          <Text style={styles.heroDescription}>Kuluçka yolculuğunu tek yerden takip et.</Text>
          <Image source={require('../../assets/hatchery-family.png')} style={styles.heroArt} resizeMode="contain" accessibilityLabel="Tavuk, sarı civcivler ve kuluçka yumurtaları" />
          <Pressable accessibilityRole="button" onPress={() => navigation.navigate('NewBatch')} style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}><Text style={styles.heroButtonText}>Yeni yumurta kabulü</Text><AppIcon name="arrow" size={19} color={colors.surface} /></Pressable>
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>İşletmene genel bakış</Text><Text style={styles.sectionTag}>ÖZET</Text></View>
        {loadError ? <Text accessibilityRole="alert" style={styles.error}>{loadError}</Text> : null}
        <View style={styles.grid}><InfoCard title="Toplam müşteri" value={summary ? `${summary.customers}` : '—'} tone="primary" /><InfoCard title="Yumurta kabulü" value={summary ? `${summary.batches}` : '—'} /></View>
        <View style={styles.grid}><InfoCard title="Alınan yumurta" value={summary ? `${summary.eggs}` : '—'} /><InfoCard title="Kalan toplam borç" value={summary ? formatCurrency(summary.debt) : '—'} tone="warning" /></View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Hızlı işlemler</Text><AppIcon name="plus" size={18} color={colors.textMuted} /></View>
        <View style={styles.grid}>{actions.map((action) => <Pressable key={action.title} accessibilityRole="button" onPress={action.onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={[styles.actionIcon, action.red && styles.redIcon]}><AppIcon name={action.icon} color={action.red ? colors.red : colors.primary} /></View><Text style={styles.actionTitle}>{action.title}</Text><Text style={styles.actionSubtitle}>{action.subtitle}</Text></Pressable>)}</View>
        <Text style={styles.footer}>Özenle takip et. Güvenle büyüt.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 24 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 25 },
  brandMark: { width: 43, height: 46, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandCopy: { flex: 1 },
  brand: { fontSize: 22, color: colors.text, fontWeight: '900', letterSpacing: -0.8 },
  brandAccent: { color: colors.primary },
  brandHint: { fontSize: 7, letterSpacing: 1.3, color: colors.textMuted, fontWeight: '800', marginTop: 4 },
  miniMark: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.redSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F4DAD8' },
  miniMarkText: { color: colors.red, fontWeight: '900', fontSize: 12 },
  welcome: { marginBottom: 20 },
  welcomeTitle: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  date: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  hero: { borderRadius: 28, backgroundColor: colors.cream, overflow: 'hidden', borderWidth: 1, borderColor: '#F2E6C9', paddingTop: 22 },
  heroTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20 },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  heroTagText: { color: '#97641F', fontSize: 8, fontWeight: '800', letterSpacing: 0.8, flexShrink: 1 },
  heroTitle: { color: colors.text, fontSize: 29, fontWeight: '900', letterSpacing: -1, lineHeight: 35, marginTop: 12, marginHorizontal: 20 },
  heroDescription: { color: '#7B6A4A', fontSize: 12, marginTop: 9, marginHorizontal: 20 },
  heroArt: { width: '100%', height: 175, marginTop: 8 },
  heroButton: { backgroundColor: colors.primary, margin: 14, marginTop: 0, borderRadius: 16, minHeight: 49, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroButtonText: { color: colors.surface, fontSize: 13, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 2 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  sectionTag: { color: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  grid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  action: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 16 },
  actionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  redIcon: { backgroundColor: colors.redSoft },
  actionTitle: { color: colors.text, fontWeight: '800', fontSize: 14 },
  actionSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 5 },
  footer: { textAlign: 'center', color: colors.textMuted, marginTop: 24, fontSize: 11 },
  error: { color: colors.danger, marginTop: 12, fontWeight: '700' },
  pressed: { opacity: 0.78 },
});
