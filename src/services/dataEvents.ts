import { clearQueryCache } from './queryCache';

export type DataEvent =
  | 'eggType'
  | 'customer'
  | 'batch'
  | 'payment'
  | 'sms'
  | 'machine'
  | 'rack'
  | 'placement'
  | 'hatchBasket';

type Listener = (event: DataEvent) => void;

const listeners = new Set<Listener>();

export function emitDataChanged(event: DataEvent) {
  clearQueryCache();
  listeners.forEach((listener) => listener(event));
}

export function subscribeDataChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
