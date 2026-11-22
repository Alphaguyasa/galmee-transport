import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { NotQueueableError } from "@/lib/galmee/offline-queue";
import { createTransportQueue } from "./transport-offline";

describe("transport offline queue", () => {
  it("queues a ticket sale once per client_ref and refuses calls that are not money RPCs", async () => {
    let i = 0;
    const q = createTransportQueue({ newRef: () => `ref-${++i}` });
    const args = { p_departure: "d1", p_seat: 5, p_method: "cash", p_channel: "office" };
    expect(await q.enqueue("tr_sell_ticket", args)).toEqual({ client_ref: "ref-1", queued: true });
    expect((await q.enqueue("tr_sell_ticket", { ...args, p_client_ref: "ref-1" })).queued).toBe(false);
    expect((await q.list()).map((e) => e.args.p_client_ref)).toEqual(["ref-1"]);
    await expect(q.enqueue("tr_void_ticket", { p_ticket: "t1" })).rejects.toBeInstanceOf(NotQueueableError);
    await expect(q.enqueue("tr_route_report", { p_day: "2026-11-22" })).rejects.toBeInstanceOf(NotQueueableError);
    q.close();
  });
});
