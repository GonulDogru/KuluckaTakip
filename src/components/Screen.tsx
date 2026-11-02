import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '../theme/colors';

type ScreenProps = {
  children: ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
};

export function Screen({ children, style, edges }: ScreenProps) {
  return <SafeAreaView edges={edges} style={[styles.screen, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
