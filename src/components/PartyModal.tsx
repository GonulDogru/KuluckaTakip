import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Party } from '../types/models';
import { colors } from '../theme/colors';

type PartyModalProps = {
  party: Party | null;
  visible: boolean;
  onClose: () => void;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);

export function PartyModal({ party, visible, onClose }: PartyModalProps) {
  if (!party) {
    return null;
  }

  const remaining = party.totalFee - party.paid;
  const rows = [
    ['Müşteri adı', party.customerName],
    ['Parti numarası', party.partyNo],
    ['Yumurta türü', party.eggType],
    ['Adet', `${party.count} adet`],
    ['Kuluçkaya giriş tarihi', party.incubationDate],
    ['Çıkım sepetine aktarım tarihi', party.basketTransferDate],
    ['Tahmini çıkım tarihi', party.estimatedHatchDate],
    ['Toplam ücret', formatCurrency(party.totalFee)],
    ['Ödenen', formatCurrency(party.paid)],
    ['Kalan borç', formatCurrency(remaining)],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <Text style={styles.code}>{party.code}</Text>
              <Text style={styles.title}>{party.customerName}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Kapat</Text>
            </Pressable>
          </View>

          <View style={styles.rows}>
            {rows.map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 32, 51, 0.36)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  code: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
  },
  closeText: {
    color: colors.text,
    fontWeight: '800',
  },
  rows: {
    marginTop: 18,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
});
