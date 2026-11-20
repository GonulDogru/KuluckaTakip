import { invalidateQueryCache } from './queryCache';

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
  const prefixes: Record<DataEvent, string[]> = {
    customer: ['customer:', 'dashboard:'],
    batch: ['batch:', 'customer:listWithSummary:', 'dashboard:'],
    payment: ['payment:', 'customer:listWithSummary:', 'dashboard:'],
    eggType: ['eggType:'],
    sms: [], machine: ['machine:'], rack: ['rack:'], placement: ['placement:'], hatchBasket: ['hatchBasket:'],
  };
  invalidateQueryCache(prefixes[event]);
  listeners.forEach((listener) => listener(event));
}

export function subscribeDataChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
