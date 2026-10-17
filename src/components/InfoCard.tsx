import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type InfoCardProps = {
  title: string;
  value: string;
  tone?: 'default' | 'primary' | 'success' | 'warning';
};

export function InfoCard({ title, value, tone = 'default' }: InfoCardProps) {
  return (
    <View style={[styles.card, styles[tone]]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 92,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    justifyContent: 'space-between',
  },
  default: {},
  primary: {
    backgroundColor: colors.primarySoft,
    borderColor: '#BFE2EA',
  },
  success: {
    backgroundColor: '#E7F6ED',
    borderColor: '#BEE5CE',
  },
  warning: {
    backgroundColor: '#FFF4DE',
    borderColor: '#F6D293',
  },
  title: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
});
