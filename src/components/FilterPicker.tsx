import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { normalizeSearch } from '../utils/batchFilters';

type Option = { value: string; label: string; detail?: string };
type Props = { label: string; value: string; options: Option[]; onChange: (value: string) => void };

export function FilterPicker({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const term = normalizeSearch(query);
    const digits = /^[+\d\s().-]+$/.test(term) ? term.replace(/\D/g, '') : '';
    return options.filter((option) => normalizeSearch(`${option.label} ${option.detail ?? ''}`).includes(term)
      || Boolean(digits && option.detail?.replace(/\D/g, '').includes(digits)));
  }, [options, query]);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label ?? 'Tümü'}`} onPress={() => { setQuery(''); setOpen(true); }} style={[styles.trigger, Boolean(value) && styles.activeTrigger]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}><Text numberOfLines={1} style={styles.value}>{selected?.label ?? 'Tümü'}</Text><Text style={styles.arrow}>⌄</Text></View>
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.title}>{label} seç</Text><Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}><Text style={styles.closeText}>Kapat</Text></Pressable></View>
          <TextInput accessibilityLabel={`${label} ara`} value={query} onChangeText={setQuery} placeholder="Listede ara..." placeholderTextColor={colors.textMuted} autoCorrect={false} style={styles.search} />
          <FlatList data={visible} keyExtractor={(option) => option.value} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.empty}>Eşleşen seçenek bulunamadı.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: item.value === value }} onPress={() => { onChange(item.value); setOpen(false); }} style={[styles.option, item.value === value && styles.selectedOption]}>
            <View style={styles.optionCopy}><Text style={styles.optionLabel}>{item.label}</Text>{item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}</View><View style={[styles.radio, item.value === value && styles.selectedRadio]}>{item.value === value ? <View style={styles.dot} /> : null}</View>
          </Pressable>} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { flex: 1, minWidth: 0, minHeight: 58, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 10 },
  activeTrigger: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  label: { color: colors.textMuted, fontSize: 9, marginBottom: 5, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  value: { flex: 1, color: colors.primary, fontSize: 11, fontWeight: '700' },
  arrow: { color: colors.primary, fontSize: 15 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  title: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  closeText: { color: colors.primary, fontWeight: '700' },
  search: { marginHorizontal: 20, marginBottom: 12, minHeight: 48, paddingHorizontal: 14, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 14 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 60, borderRadius: 16, backgroundColor: colors.surface, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  selectedOption: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionCopy: { flex: 1 },
  optionLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  radio: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  selectedRadio: { borderColor: colors.primary },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 28 },
});
