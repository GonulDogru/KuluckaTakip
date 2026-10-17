import { Pressable, StyleSheet, Text, View } from 'react-native';
import { parties, shelfCells } from '../data/demoData';
import { colors } from '../theme/colors';
import type { Party } from '../types/models';

type ShelfMapProps = {
  onSelectParty: (party: Party) => void;
};

const partyColors: Record<string, string> = {
  AY: '#DFF3FF',
  MK: '#E6F6E9',
  SD: '#FFF1D6',
  HB: '#F2E8FF',
};

export function ShelfMap({ onSelectParty }: ShelfMapProps) {
  const rows = [1, 2, 3, 4, 5];

  return (
    <View style={styles.wrapper}>
      {rows.map((row) => {
        const cells = shelfCells.filter((cell) => cell.row === row);

        return (
          <View key={row} style={styles.row}>
            <Text style={styles.rowLabel}>SIRA {row}</Text>
            <View style={styles.cells}>
              {cells.map((cell) => {
                const party = parties.find((item) => item.id === cell.partyId);
                const isEmpty = !party;

                return (
                  <Pressable
                    key={`${cell.row}-${cell.column}`}
                    disabled={isEmpty}
                    onPress={() => party && onSelectParty(party)}
                    style={({ pressed }) => [
                      styles.cell,
                      isEmpty && styles.emptyCell,
                      party && { backgroundColor: partyColors[party.code] },
                      pressed && styles.pressedCell,
                    ]}
                  >
                    <Text style={[styles.cellText, isEmpty && styles.emptyText]}>
                      {party?.code ?? 'boş'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowLabel: {
    width: 54,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '900',
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  cell: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCell: {
    backgroundColor: colors.empty,
    borderStyle: 'dashed',
  },
  pressedCell: {
    transform: [{ scale: 0.96 }],
    opacity: 0.8,
  },
  cellText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 10,
  },
});
