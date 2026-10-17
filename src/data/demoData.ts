import type { Batch, Breed, Customer, EggType, HatchBasket, HatchBasketPlacement, Machine, OperationalMachine, Party, Payment, PlacementCell, Rack, RackTray, ShelfCell, TrayAllocation } from '../types/models';

export const parties: Party[] = [
  {
    id: 'p-ay',
    code: 'AY',
    customerName: 'Ahmet Yılmaz',
    partyNo: 'PRT-2026-001',
    eggType: 'Tavuk yumurtası',
    count: 64,
    incubationDate: '02.09.2026',
    basketTransferDate: '20.09.2026',
    estimatedHatchDate: '23.09.2026',
    totalFee: 9600,
    paid: 6000,
  },
  {
    id: 'p-mk',
    code: 'MK',
    customerName: 'Mehmet Kaya',
    partyNo: 'PRT-2026-002',
    eggType: 'Hindi yumurtası',
    count: 80,
    incubationDate: '04.09.2026',
    basketTransferDate: '25.09.2026',
    estimatedHatchDate: '28.09.2026',
    totalFee: 12800,
    paid: 7000,
  },
  {
    id: 'p-sd',
    code: 'SD',
    customerName: 'Selim Demir',
    partyNo: 'PRT-2026-003',
    eggType: 'Kaz yumurtası',
    count: 96,
    incubationDate: '06.09.2026',
    basketTransferDate: '03.10.2026',
    estimatedHatchDate: '07.10.2026',
    totalFee: 17280,
    paid: 10000,
  },
  {
    id: 'p-hb',
    code: 'HB',
    customerName: 'Hasan Bulut',
    partyNo: 'PRT-2026-004',
    eggType: 'Ördek yumurtası',
    count: 56,
    incubationDate: '08.09.2026',
    basketTransferDate: '02.10.2026',
    estimatedHatchDate: '05.10.2026',
    totalFee: 8400,
    paid: 4200,
  },
];

export const machines: Machine[] = [
  {
    id: 'm-1',
    name: 'Kuluçka Makinesi 1',
    model: 'K-960 Pro',
    status: 'Çalışıyor',
    temperature: 37.6,
    humidity: 58,
    capacity: 320,
    occupied: 296,
    currentDay: 12,
  },
  {
    id: 'm-2',
    name: 'Kuluçka Makinesi 2',
    model: 'K-480 Eco',
    status: 'Boşta',
    temperature: 0,
    humidity: 0,
    capacity: 160,
    occupied: 0,
    currentDay: 0,
  },
  {
    id: 'm-3',
    name: 'Çıkım Makinesi',
    model: 'C-240 Hatch',
    status: 'Bakımda',
    temperature: 36.9,
    humidity: 70,
    capacity: 120,
    occupied: 64,
    currentDay: 20,
  },
];

const rowPartyIds: Array<Array<string | null>> = [
  ['p-ay', 'p-ay', 'p-ay', 'p-ay', 'p-mk', 'p-mk', 'p-mk', 'p-mk'],
  ['p-ay', 'p-ay', 'p-ay', 'p-ay', 'p-mk', 'p-mk', 'p-mk', 'p-mk'],
  ['p-sd', 'p-sd', 'p-sd', 'p-sd', 'p-sd', 'p-hb', 'p-hb', 'p-hb'],
  ['p-sd', 'p-sd', 'p-sd', 'p-sd', 'p-sd', 'p-hb', 'p-hb', 'p-hb'],
  [null, null, null, null, null, null, null, null],
];

export const shelfCells: ShelfCell[] = rowPartyIds.flatMap((row, rowIndex) =>
  row.map((partyId, columnIndex) => ({
    row: rowIndex + 1,
    column: columnIndex + 1,
    partyId,
  })),
);

export const getPartyById = (partyId: string) =>
  parties.find((party) => party.id === partyId);

export const demoCustomers: Customer[] = [
  {
    id: 'c-ay',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    phone: '0532 123 45 67',
    phoneNormalized: '+905321234567',
    note: 'Düzenli müşteri, teslimatta arama istiyor.',
    isActive: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'c-mk',
    firstName: 'Mehmet',
    lastName: 'Kaya',
    phone: '0543 222 11 00',
    phoneNormalized: '+905432221100',
    note: null,
    isActive: true,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-02T09:00:00.000Z',
  },
  {
    id: 'c-sd',
    firstName: 'Selim',
    lastName: 'Demir',
    phone: '0555 333 22 11',
    phoneNormalized: '+905553332211',
    note: 'Kaz yumurtası için ayrı raf ister.',
    isActive: true,
    createdAt: '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
  },
  {
    id: 'c-hb',
    firstName: 'Hasan',
    lastName: 'Bulut',
    phone: '0538 444 10 10',
    phoneNormalized: '+905384441010',
    note: null,
    isActive: true,
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
  },
];

export const demoEggTypes: EggType[] = [
  {
    id: 'e-tavuk',
    name: 'Tavuk',
    incubationDays: 21,
    transferDay: 20,
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'e-hindi',
    name: 'Hindi',
    incubationDays: 28,
    transferDay: 25,
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'e-kaz',
    name: 'Kaz',
    incubationDays: 31,
    transferDay: 27,
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
  },
];

export const demoBreeds: Breed[] = [
  { id: 'b-atalik', eggTypeId: 'e-tavuk', name: 'Atalık', active: true, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'b-beyaz', eggTypeId: 'e-tavuk', name: 'Beyaz', active: true, createdAt: '2026-09-01T09:00:00.000Z' },
];

export const demoBatches: Batch[] = [
  {
    id: 'batch-ay',
    batchNo: 'P-2026-0001',
    customerId: 'c-ay',
    eggTypeId: 'e-tavuk',
    breedId: 'b-atalik',
    eggCount: 64,
    receivedDate: '2026-09-01',
    incubationDate: '2026-09-02',
    transferDate: '2026-09-22',
    expectedHatchDate: '2026-09-23',
    unitPrice: 150,
    totalPrice: 9600,
    status: 'INCUBATING',
    note: 'Raf üst gözler tercih edildi.',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'batch-mk',
    batchNo: 'P-2026-0002',
    customerId: 'c-mk',
    eggTypeId: 'e-hindi',
    breedId: null,
    eggCount: 80,
    receivedDate: '2026-09-03',
    incubationDate: '2026-09-04',
    transferDate: '2026-09-29',
    expectedHatchDate: '2026-10-02',
    unitPrice: 160,
    totalPrice: 12800,
    status: 'INCUBATING',
    note: null,
    createdAt: '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
  },
  {
    id: 'batch-sd',
    batchNo: 'P-2026-0003',
    customerId: 'c-sd',
    eggTypeId: 'e-kaz',
    breedId: null,
    eggCount: 96,
    receivedDate: '2026-09-05',
    incubationDate: '2026-09-06',
    transferDate: '2026-10-03',
    expectedHatchDate: '2026-10-07',
    unitPrice: 180,
    totalPrice: 17280,
    status: 'INCUBATING',
    note: null,
    createdAt: '2026-09-05T09:00:00.000Z',
    updatedAt: '2026-09-05T09:00:00.000Z',
  },
  {
    id: 'batch-hb',
    batchNo: 'P-2026-0004',
    customerId: 'c-hb',
    eggTypeId: 'e-tavuk',
    breedId: null,
    eggCount: 56,
    receivedDate: '2026-08-25',
    incubationDate: '2026-08-26',
    transferDate: '2026-09-15',
    expectedHatchDate: '2026-09-16',
    unitPrice: 150,
    totalPrice: 8400,
    status: 'INCUBATING',
    note: 'Bugun cikim sepetine alinacak.',
    createdAt: '2026-08-25T09:00:00.000Z',
    updatedAt: '2026-08-25T09:00:00.000Z',
  },
  {
    id: 'batch-test-18',
    batchNo: 'P-2026-0005',
    customerId: 'c-ay',
    eggTypeId: 'e-tavuk',
    breedId: null,
    eggCount: 18,
    receivedDate: '2026-09-23',
    incubationDate: '2026-09-23',
    transferDate: '2026-10-13',
    expectedHatchDate: '2026-10-14',
    unitPrice: 150,
    totalPrice: 2700,
    status: 'INCUBATING',
    note: 'Otomatik dağıt test partisi.',
    createdAt: '2026-09-23T09:00:00.000Z',
    updatedAt: '2026-09-23T09:00:00.000Z',
  },
];

export const demoPayments: Payment[] = [
  { id: 'pay-ay', customerId: 'c-ay', batchId: 'batch-ay', amount: 6000, paymentMethod: 'Nakit', paymentDate: '2026-09-01', note: null, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'pay-mk', customerId: 'c-mk', batchId: 'batch-mk', amount: 7000, paymentMethod: 'Havale', paymentDate: '2026-09-03', note: null, createdAt: '2026-09-03T09:00:00.000Z' },
  { id: 'pay-sd', customerId: 'c-sd', batchId: 'batch-sd', amount: 10000, paymentMethod: 'Nakit', paymentDate: '2026-09-05', note: null, createdAt: '2026-09-05T09:00:00.000Z' },
  { id: 'pay-hb', customerId: 'c-hb', batchId: 'batch-hb', amount: 4200, paymentMethod: 'Nakit', paymentDate: '2026-08-25', note: null, createdAt: '2026-08-25T09:00:00.000Z' },
];

export const demoOperationalMachines: OperationalMachine[] = [
  { id: 'm-1', name: 'Kulucka Makinesi 1', machineNumber: 'KM-001', capacity: 200, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  { id: 'm-2', name: 'Kulucka Makinesi 2', machineNumber: 'KM-002', capacity: 100, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  { id: 'm-hatch', name: 'Cikim Makinesi', machineNumber: 'CM-001', capacity: 360, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
];

export const demoRacks: Rack[] = [
  { id: 'rack-1', machineId: 'm-1', rackNumber: '1', capacity: 100, rowCount: 10, positionsPerRow: 10, trayCount: 10, trayCapacity: 10, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  { id: 'rack-2', machineId: 'm-1', rackNumber: '2', capacity: 100, rowCount: 10, positionsPerRow: 10, trayCount: 10, trayCapacity: 10, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
  { id: 'rack-3', machineId: 'm-2', rackNumber: '1', capacity: 100, rowCount: 10, positionsPerRow: 10, trayCount: 10, trayCapacity: 10, active: true, createdAt: '2026-09-01T09:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z' },
];

export const DEFAULT_TRAY_COUNT = 10;
export const DEFAULT_TRAY_CAPACITY = 10;

function traysFor(rack: Rack): RackTray[] {
  return Array.from({ length: rack.trayCount }, (_, index) => ({
    id: `${rack.id}-tray-${index + 1}`,
    rackId: rack.id,
    trayNumber: index + 1,
    capacity: rack.trayCapacity,
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
  }));
}

export const demoRackTrays: RackTray[] = demoRacks.flatMap(traysFor);

export const demoTrayAllocations: TrayAllocation[] = [
  { id: 'ta-r1-v1-ay', trayId: 'rack-1-tray-1', batchId: 'batch-ay', eggCount: 10, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'ta-r1-v2-ay', trayId: 'rack-1-tray-2', batchId: 'batch-ay', eggCount: 3, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'ta-r1-v2-mk', trayId: 'rack-1-tray-2', batchId: 'batch-mk', eggCount: 7, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'ta-r1-v3-mk', trayId: 'rack-1-tray-3', batchId: 'batch-mk', eggCount: 5, createdAt: '2026-09-01T09:00:00.000Z' },
];

function cellsFor(batchId: string, machineId: string, rackId: string, row: number, start: number, end: number): PlacementCell[] {
  return Array.from({ length: end - start + 1 }, (_, index) => ({
    id: `${batchId}-${rackId}-${row}-${start + index}`,
    batchId,
    machineId,
    rackId,
    rowNumber: row,
    positionNumber: start + index,
    createdAt: '2026-09-01T09:00:00.000Z',
  }));
}

export const demoPlacementCells: PlacementCell[] = [
  ...cellsFor('batch-ay', 'm-1', 'rack-1', 1, 1, 4),
  ...cellsFor('batch-mk', 'm-1', 'rack-1', 1, 5, 8),
  ...cellsFor('batch-ay', 'm-1', 'rack-1', 2, 1, 4),
  ...cellsFor('batch-mk', 'm-1', 'rack-1', 2, 5, 8),
  ...cellsFor('batch-sd', 'm-1', 'rack-1', 3, 1, 5),
  ...cellsFor('batch-hb', 'm-1', 'rack-1', 3, 6, 8),
  ...cellsFor('batch-sd', 'm-1', 'rack-1', 4, 1, 5),
  ...cellsFor('batch-hb', 'm-1', 'rack-1', 4, 6, 8),
];

export const demoHatchBaskets: HatchBasket[] = [
  { id: 'basket-1', machineId: 'm-hatch', basketNumber: '1', capacity: 120, active: true, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'basket-2', machineId: 'm-hatch', basketNumber: '2', capacity: 120, active: true, createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'basket-3', machineId: 'm-hatch', basketNumber: '3', capacity: 120, active: true, createdAt: '2026-09-01T09:00:00.000Z' },
];

export const demoHatchBasketPlacements: HatchBasketPlacement[] = [
  { id: 'hbp-1', hatchBasketId: 'basket-1', batchId: 'batch-ay', eggCount: 20, createdAt: '2026-09-10T09:00:00.000Z' },
  { id: 'hbp-2', hatchBasketId: 'basket-1', batchId: 'batch-mk', eggCount: 30, createdAt: '2026-09-10T09:00:00.000Z' },
];
