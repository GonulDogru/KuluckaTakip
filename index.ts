import { registerRootComponent } from 'expo';

import App from './App';
import { createElement } from 'react';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(() => createElement(AppErrorBoundary, null, createElement(App)));
