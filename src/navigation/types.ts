import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  MachineDetail: { machineId: string };
  ShelfList: { machineId: string };
  ShelfMap: { machineId: string; rackId?: string; highlightBatchId?: string };
  CustomerDetail: { customerId: string };
  NewCustomer: { customerId?: string } | undefined;
  NewBatch: { customerId?: string } | undefined;
  BatchDetail: { batchId: string };
  SmsPreview: { smsId: string };
  NewMachine: undefined;
  NewRack: { machineId: string };
  HatchBaskets: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Parties: undefined;
  SmsCenter: undefined;
};
