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
};

export function DateField({ label, value, onChange, error }: DateFieldProps) {
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
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [styles.field, error && styles.fieldError, pressed && styles.pressed]}
      >
        <Text style={styles.value}>{formatDateForDisplay(value)}</Text>
        <Text style={styles.icon}>Sec</Text>
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
    borderRadius: 8,
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
