import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { subscribeDataChanged, type DataEvent } from '../services/dataEvents';
import { clearQueryCache } from '../services/queryCache';

// Subscribe only while visible; refresh shared server data on return to the app.
export function useFocusedRefresh(refresh: () => void, events: readonly DataEvent[]) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const eventKey = events.join(',');
  useFocusEffect(useCallback(() => {
    const relevantEvents = eventKey.split(',');
    let previousState = AppState.currentState;
    refreshRef.current();
    const unsubscribe = subscribeDataChanged((event) => {
      if (relevantEvents.includes(event)) refreshRef.current();
    });
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && previousState !== 'active') {
        clearQueryCache();
        refreshRef.current();
      }
      previousState = state;
    });
    return () => { unsubscribe(); listener.remove(); };
  }, [eventKey]));
}
