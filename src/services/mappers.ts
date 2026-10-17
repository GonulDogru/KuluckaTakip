import type { Batch, Customer, EggType, Payment, SmsLog } from '../types/models';

export function mapCustomer(row: Record<string, any>): Customer {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    phoneNormalized: row.phone_normalized,
    note: row.note,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBatch(row: Record<string, any>): Batch {
  return {
    id: row.id,
    batchNo: row.batch_no,
    customerId: row.customer_id,
    eggTypeId: row.egg_type_id,
    breedId: row.breed_id,
    eggCount: Number(row.egg_count),
    receivedDate: row.received_date,
    incubationDate: row.incubation_date,
    transferDate: row.transfer_date,
    expectedHatchDate: row.expected_hatch_date,
    unitPrice: Number(row.unit_price),
    totalPrice: Number(row.total_price),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEggType(row: Record<string, any>): EggType {
  return {
    id: row.id,
    name: row.name,
    incubationDays: Number(row.incubation_days),
    transferDay: Number(row.transfer_day),
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function mapPayment(row: Record<string, any>): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    batchId: row.batch_id,
    amount: Number(row.amount),
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapSmsLog(row: Record<string, any>): SmsLog {
  return {
    id: row.id,
    customerId: row.customer_id,
    batchId: row.batch_id,
    phone: row.phone,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    providerResponse: row.provider_response ?? null,
    claimedBy: row.claimed_by ?? null,
    leaseUntil: row.lease_until ?? null,
  };
}
