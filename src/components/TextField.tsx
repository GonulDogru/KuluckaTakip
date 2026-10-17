import { forwardRef, useId } from 'react';
import { StyleSheet, Text, TextInput, type KeyboardTypeOptions, type ReturnKeyTypeOptions, View } from 'react-native';
import { colors } from '../theme/colors';
import { useKeyboardAwareInput } from './KeyboardAwareForm';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  returnKeyType?: ReturnKeyTypeOptions;
  blurOnSubmit?: boolean;
  onSubmitEditing?: () => void;
  onFocus?: (event: unknown) => void;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, value, onChangeText, placeholder, error, keyboardType, multiline, returnKeyType, blurOnSubmit, onSubmitEditing, onFocus },
  ref,
) {
  const fieldKey = useId();
  const keyboardAware = useKeyboardAwareInput();

  return (
    <View
      style={styles.wrapper}
      onLayout={(event) => keyboardAware.registerFieldLayout(fieldKey, event)}
    >
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        returnKeyType={returnKeyType}
        blurOnSubmit={blurOnSubmit}
        onSubmitEditing={onSubmitEditing}
        onFocus={(event) => {
          keyboardAware.handleInputFocus(fieldKey);
          onFocus?.(event);
        }}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
        placeholderTextColor={colors.textMuted}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

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
  input: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  multiline: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
});
