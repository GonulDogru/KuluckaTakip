import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAwareForm } from '../components/KeyboardAwareForm';
import { PrimaryButton } from '../components/PrimaryButton';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { useFocusedRefresh } from '../hooks/useFocusedRefresh';
import type { RootStackParamList } from '../navigation/types';
import { eggTypeService } from '../services/eggTypeService';
import { colors } from '../theme/colors';
import type { EggType } from '../types/models';

type Props = NativeStackScreenProps<RootStackParamList, 'EggTypes'>;
export function EggTypesScreen(_props: Props) {
  const [types, setTypes] = useState<EggType[]>([]);
  const [editing, setEditing] = useState<EggType | null>(null);
  const [name, setName] = useState('');
  const [incubation, setIncubation] = useState('');
  const [transfer, setTransfer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    try { setTypes(await eggTypeService.listAll()); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Türler yüklenemedi.'); }
  }, []);
  useFocusedRefresh(() => { void load(); }, ['eggType']);
  function clear() { setEditing(null); setName(''); setIncubation(''); setTransfer(''); }
  function edit(item: EggType) { setEditing(item); setName(item.name); setIncubation(String(item.incubationDays)); setTransfer(String(item.transferDay)); }
  async function save() {
    const days = Number(incubation); const transferDay = Number(transfer);
    if (!name.trim() || !Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(transferDay) || transferDay < 1 || transferDay > days) {
      Alert.alert('Bilgileri kontrol edin', 'Tür adını ve pozitif gün sayılarını girin. Transfer günü kuluçka süresini aşamaz.'); return;
    }
    if (types.some((item) => item.id !== editing?.id && item.name.trim().toLocaleLowerCase('tr-TR') === name.trim().toLocaleLowerCase('tr-TR'))) {
      Alert.alert('Tür zaten var', 'Bu adla bir tür zaten bulunuyor.'); return;
    }
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      const input = { name: name.trim(), incubationDays: days, transferDay };
      if (editing) await eggTypeService.update(editing.id, input); else await eggTypeService.create(input);
      clear(); await load();
    } catch (e) { Alert.alert('Kaydedilemedi', e instanceof Error ? e.message : 'Tekrar deneyin.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function confirmToggle(item: EggType) {
    Alert.alert(item.active ? 'Türü pasife al?' : 'Türü yeniden etkinleştir?', item.active ? 'Yeni kabullerde seçilemez; geçmiş kayıtlar korunur.' : 'Yeni kabullerde tekrar seçilebilir.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: item.active ? 'Pasife al' : 'Etkinleştir', onPress: () => { void toggle(item); } },
    ]);
  }
  async function toggle(item: EggType) {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { await eggTypeService.update(item.id, { active: !item.active }); if (editing?.id === item.id) clear(); await load(); }
    catch (e) { Alert.alert('İşlem başarısız', e instanceof Error ? e.message : 'Tekrar deneyin.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Screen><KeyboardAwareForm contentContainerStyle={styles.content}>
    <Text style={styles.title}>Yumurta türleri</Text>
    <Text style={styles.hint}>Türleri ekleyin, düzenleyin veya pasife alın. Süre değişiklikleri mevcut tarihleri hemen değiştirmez; kabul yeniden düzenlendiğinde yeni süre kullanılır.</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.heading}>{editing ? 'Türü düzenle' : 'Yeni tür ekle'}</Text>
    <TextField label="Tür adı" value={name} onChangeText={setName} />
    <TextField label="Kuluçka süresi (gün)" value={incubation} onChangeText={setIncubation} keyboardType="number-pad" />
    <TextField label="Transfer günü" value={transfer} onChangeText={setTransfer} keyboardType="number-pad" />
    <PrimaryButton title={busy ? 'Kaydediliyor...' : editing ? 'Değişiklikleri kaydet' : 'Tür ekle'} onPress={() => { void save(); }} disabled={busy} />
    {editing ? <PrimaryButton title="Vazgeç" variant="secondary" onPress={clear} disabled={busy} /> : null}
    <Text style={styles.heading}>Kayıtlı türler</Text>
    {types.map((item) => <View key={item.id} style={styles.card}>
      <Text style={styles.item}>{item.name}{item.active ? '' : '  · Pasif'}</Text>
      <Text style={styles.hint}>{item.incubationDays} gün kuluçka · {item.transferDay}. gün transfer</Text>
      <View style={styles.actions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => edit(item)}><Text style={styles.action}>Düzenle</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => confirmToggle(item)}><Text style={styles.action}>{item.active ? 'Pasife al' : 'Etkinleştir'}</Text></Pressable></View>
    </View>)}
  </KeyboardAwareForm></Screen>;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 36, gap: 8 }, title: { fontSize: 26, fontWeight: '900', color: colors.text },
  hint: { color: colors.textMuted, lineHeight: 20 }, error: { color: colors.danger },
  heading: { marginTop: 16, fontSize: 18, fontWeight: '900', color: colors.text },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  item: { fontSize: 16, fontWeight: '900', color: colors.text }, actions: { flexDirection: 'row', gap: 26, marginTop: 12 }, action: { color: colors.primary, fontWeight: '900', paddingVertical: 8 },
});
