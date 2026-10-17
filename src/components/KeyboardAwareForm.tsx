import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type KeyboardAwareContextValue = {
  handleInputFocus: (fieldKey: string) => void;
  registerFieldLayout: (fieldKey: string, event: LayoutChangeEvent) => void;
};

const noopKeyboardAwareContext: KeyboardAwareContextValue = {
  handleInputFocus: () => undefined,
  registerFieldLayout: () => undefined,
};

const KeyboardAwareContext = createContext<KeyboardAwareContextValue>(noopKeyboardAwareContext);

type KeyboardAwareFormProps = {
  children: ReactNode;
  bottomPadding?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function KeyboardAwareForm({ children, bottomPadding = 32, contentContainerStyle }: KeyboardAwareFormProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const fieldYRef = useRef<Record<string, number>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const registerFieldLayout = useCallback((fieldKey: string, event: LayoutChangeEvent) => {
    fieldYRef.current[fieldKey] = event.nativeEvent.layout.y;
  }, []);

  const handleInputFocus = useCallback((fieldKey: string) => {
    const fieldY = fieldYRef.current[fieldKey];
    if (fieldY === undefined) return;

    scrollRef.current?.scrollTo({
      y: Math.max(0, fieldY - 80),
      animated: false,
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollView = (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        contentContainerStyle,
        { paddingBottom: bottomPadding + insets.bottom + (keyboardHeight ? keyboardHeight + 40 : 0) },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {children}
    </ScrollView>
  );

  return (
    <KeyboardAwareContext.Provider value={{ handleInputFocus, registerFieldLayout }}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView style={styles.keyboard} behavior="padding">
          {scrollView}
        </KeyboardAvoidingView>
      ) : scrollView}
    </KeyboardAwareContext.Provider>
  );
}

export function useKeyboardAwareInput() {
  return useContext(KeyboardAwareContext);
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 18,
  },
});
