import { createOfflineQueue } from "@/lib/galmee/offline-queue";

/**
 * Money RPCs of this app that may wait in the offline queue. Each takes `p_client_ref`,
 * and the server ignores a repeat with the same ref, so a replay never sells a seat twice.
 */
export const TRANSPORT_QUEUEABLE_RPCS = ["tr_sell_ticket", "tr_register_parcel", "tr_record_handover"] as const;

export const TRANSPORT_QUEUE_DB = "galmee-transport-queue";

export function createTransportQueue(options: { isClosed?: () => boolean; newRef?: () => string } = {}) {
  return createOfflineQueue({ dbName: TRANSPORT_QUEUE_DB, rpcs: TRANSPORT_QUEUEABLE_RPCS, ...options });
}
