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
  type View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardScrollTarget } from '../utils/keyboardScroll';

type KeyboardAwareContextValue = {
  handleInputFocus: (fieldKey: string, field?: View | null) => void;
  handleInputBlur: (fieldKey: string) => void;
  registerFieldLayout: (fieldKey: string, event: LayoutChangeEvent) => void;
};

const noopKeyboardAwareContext: KeyboardAwareContextValue = {
  handleInputFocus: () => undefined,
  handleInputBlur: () => undefined,
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
  const focusedField = useRef<{ key: string; view?: View | null } | null>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef(Number.POSITIVE_INFINITY);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const registerFieldLayout = useCallback((fieldKey: string, event: LayoutChangeEvent) => {
    fieldYRef.current[fieldKey] = event.nativeEvent.layout.y;
  }, []);

  const revealFocusedField = useCallback(() => {
    const active = focusedField.current;
    const scroll = scrollRef.current;
    if (!active || !scroll) return;
    if (active.view) {
      scroll.getNativeScrollRef()?.measureInWindow((_sx, viewportY, _sw, viewportHeight) => {
        active.view?.measureInWindow((_fx, fieldY, _fw, fieldHeight) => {
          if (focusedField.current !== active) return;
          const y = keyboardScrollTarget({ offset: scrollOffset.current,
            fieldTop: fieldY, fieldBottom: fieldY + fieldHeight,
            viewportTop: viewportY, viewportBottom: viewportY + viewportHeight,
            keyboardTop: keyboardTop.current });
          if (Math.abs(y - scrollOffset.current) > 1) scroll.scrollTo({ y, animated: false });
        });
      });
      return;
    }
    const fieldY = fieldYRef.current[active.key];
    if (fieldY === undefined) return;
    scroll.scrollTo({ y: Math.max(0, fieldY - 16), animated: false });
  }, []);

  const handleInputFocus = useCallback((fieldKey: string, field?: View | null) => {
    focusedField.current = { key: fieldKey, view: field };
    revealFocusedField();
  }, [revealFocusedField]);

  const handleInputBlur = useCallback((fieldKey: string) => {
    if (focusedField.current?.key === fieldKey) focusedField.current = null;
  }, []);

  // Focus fires before the keyboard opens. Retry after padding has actually been laid out.
  useEffect(() => {
    if (!keyboardHeight) return;
    const frame = requestAnimationFrame(revealFocusedField);
    return () => cancelAnimationFrame(frame);
  }, [keyboardHeight, revealFocusedField]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
      revealFocusedField();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = Number.POSITIVE_INFINITY;
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [revealFocusedField]);

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
      scrollEventThrottle={16}
      onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
      onContentSizeChange={revealFocusedField}
      onLayout={revealFocusedField}
    >
      {children}
    </ScrollView>
  );

  return (
    <KeyboardAwareContext.Provider value={{ handleInputFocus, handleInputBlur, registerFieldLayout }}>
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
