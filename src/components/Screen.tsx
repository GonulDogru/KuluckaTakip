import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../theme/colors';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
};

export function Screen({ children, style }: ScreenProps) {
  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
