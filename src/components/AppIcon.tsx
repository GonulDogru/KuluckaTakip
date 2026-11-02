import { View } from 'react-native';
import { colors } from '../theme/colors';

export type IconName = 'home' | 'users' | 'egg' | 'mail' | 'plus' | 'arrow';

export function AppIcon({ name, color = colors.primary, size = 24 }: { name: IconName; color?: string; size?: number }) {
  const line = { position: 'absolute' as const, backgroundColor: color, borderRadius: 2 };
  const border = { position: 'absolute' as const, borderColor: color, borderWidth: 1.8 };
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size }}>
      <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }], transformOrigin: 'top left' }}>
        {name === 'home' ? <>
          <View style={{ ...border, width: 13, height: 13, left: 5.5, top: 3, transform: [{ rotate: '45deg' }], borderRadius: 3 }} />
          <View style={{ ...border, width: 16, height: 13, left: 4, top: 9, borderTopWidth: 0, backgroundColor: 'transparent', borderRadius: 3 }} />
        </> : null}
        {name === 'users' ? <>
          <View style={{ ...border, width: 8, height: 8, borderRadius: 5, left: 4, top: 3 }} />
          <View style={{ ...border, width: 15, height: 9, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomWidth: 0, left: 1, top: 14 }} />
          <View style={{ ...border, width: 6, height: 7, borderRadius: 4, left: 15, top: 5 }} />
          <View style={{ ...border, width: 6, height: 8, borderTopRightRadius: 6, borderLeftWidth: 0, borderBottomWidth: 0, left: 17, top: 15 }} />
        </> : null}
        {name === 'egg' ? <View style={{ ...border, width: 17, height: 22, left: 3.5, top: 1, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, transform: [{ rotate: '15deg' }] }} /> : null}
        {name === 'mail' ? <>
          <View style={{ ...border, width: 22, height: 16, left: 1, top: 4, borderRadius: 4 }} />
          <View style={{ ...border, width: 12, height: 12, left: 6, top: 0, borderTopWidth: 0, borderLeftWidth: 0, transform: [{ rotate: '45deg' }], borderRadius: 2 }} />
        </> : null}
        {name === 'plus' ? <><View style={{ ...line, width: 18, height: 2, left: 3, top: 11 }} /><View style={{ ...line, width: 2, height: 18, left: 11, top: 3 }} /></> : null}
        {name === 'arrow' ? <><View style={{ ...line, width: 17, height: 2, left: 3, top: 11 }} /><View style={{ ...border, width: 9, height: 9, left: 10, top: 7.5, borderLeftWidth: 0, borderBottomWidth: 0, transform: [{ rotate: '45deg' }] }} /></> : null}
      </View>
    </View>
  );
}
