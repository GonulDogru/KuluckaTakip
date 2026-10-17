export type CustomerCode = 'AY' | 'MK' | 'SD' | 'HB';

export type Party = {
  id: string;
  code: CustomerCode;
  customerName: string;
  partyNo: string;
  eggType: string;
  count: number;
  incubationDate: string;
  basketTransferDate: string;
  estimatedHatchDate: string;
  totalFee: number;
  paid: number;
};

export type ShelfCell = {
  row: number;
  column: number;
  partyId: string | null;
};

export type Machine = {
  id: string;
  name: string;
  model: string;
  status: 'Çalışıyor' | 'Bakımda' | 'Boşta';
  temperature: number;
  humidity: number;
  capacity: number;
  occupied: number;
  currentDay: number;
};

export type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  phoneNormalized: string;
  note?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EggType = {
  id: string;
  name: string;
  incubationDays: number;
  transferDay: number;
  active: boolean;
  createdAt: string;
};

export type Breed = {
  id: string;
  eggTypeId: string;
  name: string;
  active: boolean;
  createdAt: string;
};

export type BatchStatus =
  | 'RECEIVED'
  | 'INCUBATING'
  | 'TRANSFER_DUE'
  | 'HATCHING'
  | 'HATCHED'
  | 'DELIVERED'
  | 'CANCELLED';

export type Batch = {
  id: string;
  batchNo: string;
  customerId: string;
  eggTypeId: string;
  breedId?: string | null;
  eggCount: number;
  receivedDate: string;
  incubationDate?: string | null;
  transferDate?: string | null;
  expectedHatchDate?: string | null;
  unitPrice: number;
  totalPrice: number;
  status: BatchStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  customerId: string;
  batchId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  note?: string | null;
  createdAt: string;
};

export type SmsLog = {
  id: string;
  customerId: string | null;
  batchId: string | null;
  phone: string;
  message: string;
  status: string;
  createdAt: string;
  providerResponse?: string | null;
  claimedBy?: string | null;
  leaseUntil?: string | null;
};

export type CustomerSummary = Customer & {
  activeBatchCount: number;
  totalDebt: number;
};

export type OperationalMachine = {
  id: string;
  name: string;
  machineNumber: string;
  capacity: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Rack = {
  id: string;
  machineId: string;
  rackNumber: string;
  capacity: number;
  rowCount: number;
  positionsPerRow: number;
  trayCount: number;
  trayCapacity: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RackTray = {
  id: string;
  rackId: string;
  trayNumber: number;
  capacity: number;
  active: boolean;
  createdAt: string;
};

export type TrayAllocation = {
  id: string;
  trayId: string;
  batchId: string;
  eggCount: number;
  createdAt: string;
};

export type TrayWithUsage = RackTray & {
  allocations: TrayAllocation[];
  used: number;
  empty: number;
};

export type PlacementCell = {
  id: string;
  batchId: string;
  machineId: string;
  rackId: string;
  rowNumber: number;
  positionNumber: number;
  createdAt: string;
};

export type HatchBasket = {
  id: string;
  machineId: string;
  basketNumber: string;
  capacity: number;
  active: boolean;
  createdAt: string;
};

export type HatchBasketPlacement = {
  id: string;
  hatchBasketId: string;
  batchId: string;
  eggCount: number;
  createdAt: string;
};
