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
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    justifyContent: 'space-between',
  },
  default: {},
  primary: {
    backgroundColor: colors.primarySoft,
    borderColor: '#DCE6FF',
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
    fontSize: 25,
    fontWeight: '800',
  },
});
