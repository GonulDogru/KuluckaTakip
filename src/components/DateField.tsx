import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme/colors';
import { dateOnlyToLocalDate, formatDateForDisplay, formatDateForStorage, todayLocalDateOnly } from '../utils/dateRules';

type DateFieldProps = {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
  error?: string;
  compact?: boolean;
};

export function DateField({ label, value, onChange, error, compact = false }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerValue = dateOnlyToLocalDate(value) ?? dateOnlyToLocalDate(todayLocalDateOnly()) ?? new Date();

  function closeAndroidPicker() {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
  }

  function handleValueChange(_event: unknown, selectedDate: Date) {
    closeAndroidPicker();
    onChange(formatDateForStorage(selectedDate));
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatDateForDisplay(value)}`}
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [styles.field, compact && styles.compactField, error && styles.fieldError, pressed && styles.pressed]}
      >
        <Text style={[styles.value, compact && styles.compactValue]}>{formatDateForDisplay(value)}</Text>
        {!compact ? <Text style={styles.icon}>Seç</Text> : null}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {showPicker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          locale="tr-TR"
          onValueChange={handleValueChange}
          onDismiss={closeAndroidPicker}
          onNeutralButtonPress={closeAndroidPicker}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  compactField: { paddingHorizontal: 10, gap: 4 },
  compactValue: { fontSize: 14 },
  wrapper: {
    marginBottom: 14,
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  field: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.82,
  },
  value: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  icon: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
});
