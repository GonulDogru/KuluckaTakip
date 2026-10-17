import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { getPartyById, shelfCells } from '../data/demoData';
import { colors } from '../theme/colors';

export function ShelfListScreen() {
  return (
    <Screen>
      <FlatList
        data={shelfCells}
        keyExtractor={(item) => `${item.row}-${item.column}`}
        numColumns={2}
        columnWrapperStyle={styles.columns}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Raf Listesi</Text>
            <Text style={styles.subtitle}>Her hücrenin sıra, kolon ve parti bilgisi.</Text>
          </>
        }
        renderItem={({ item }) => {
          const party = item.partyId ? getPartyById(item.partyId) : undefined;

          return (
            <View style={styles.item}>
              <Text style={styles.position}>
                Sıra {item.row} · Hücre {item.column}
              </Text>
              <Text style={styles.party}>{party ? party.customerName : 'Boş hücre'}</Text>
              <Text style={styles.code}>{party ? `${party.code} · ${party.partyNo}` : 'Kullanıma hazır'}</Text>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 16,
  },
  columns: {
    gap: 10,
  },
  item: {
    flex: 1,
    minHeight: 112,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  position: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  party: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 10,
  },
  code: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
  },
});
