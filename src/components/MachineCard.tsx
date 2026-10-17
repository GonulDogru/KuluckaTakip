import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Machine } from '../types/models';
import { colors } from '../theme/colors';

type MachineCardProps = {
  machine: Machine;
  onPress: () => void;
};

export function MachineCard({ machine, onPress }: MachineCardProps) {
  const occupancy = Math.round((machine.occupied / machine.capacity) * 100);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{machine.name}</Text>
          <Text style={styles.model}>{machine.model}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{machine.status}</Text>
        </View>
      </View>

      <View style={styles.metrics}>
        <Text style={styles.metric}>{machine.temperature || '-'}°C</Text>
        <Text style={styles.metric}>%{machine.humidity || '-'}</Text>
        <Text style={styles.metric}>%{occupancy}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${occupancy}%` }]} />
      </View>
      <Text style={styles.capacity}>
        {machine.occupied}/{machine.capacity} yumurta
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  model: {
    color: colors.textMuted,
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  metric: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  capacity: {
    color: colors.textMuted,
    marginTop: 10,
    fontWeight: '600',
  },
});
