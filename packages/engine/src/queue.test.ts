import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { EventOrder, EventQueue, type Scheduled } from "./queue.ts";

interface Item extends Scheduled {
  label: string;
}

describe("event queue", () => {
  it("orders by time, then event order, then entity, then insertion", () => {
    const q = new EventQueue<Item>();
    q.push({ time: 5, order: EventOrder.arrival, entity: 0, label: "arrival-5" });
    q.push({ time: 5, order: EventOrder.tick, entity: 0, label: "tick-5" });
    q.push({ time: 1, order: EventOrder.arrival, entity: 1, label: "arrival-1-e1" });
    q.push({ time: 1, order: EventOrder.arrival, entity: 0, label: "arrival-1-e0-a" });
    q.push({ time: 1, order: EventOrder.arrival, entity: 0, label: "arrival-1-e0-b" });
    const out: string[] = [];
    for (let item = q.pop(); item; item = q.pop()) out.push(item.label);
    expect(out).toEqual([
      "arrival-1-e0-a",
      "arrival-1-e0-b",
      "arrival-1-e1",
      "tick-5",
      "arrival-5",
    ]);
  });

  it("pops items in sorted order for arbitrary input", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            time: fc.integer({ min: 0, max: 50 }),
            order: fc.constantFrom(0, 1, 2, 3),
            entity: fc.integer({ min: 0, max: 3 }),
          }),
        ),
        (items) => {
          const q = new EventQueue<Scheduled & { i: number }>();
          items.forEach((item, i) => {
            q.push({ ...item, order: item.order as EventOrder, i });
          });
          const expected = items
            .map((item, i) => ({ ...item, i }))
            .sort(
              (a, b) => a.time - b.time || a.order - b.order || a.entity - b.entity || a.i - b.i,
            )
            .map((x) => x.i);
          const actual: number[] = [];
          for (let item = q.pop(); item; item = q.pop()) actual.push(item.i);
          expect(actual).toEqual(expected);
        },
      ),
    );
  });
});
