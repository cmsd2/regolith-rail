/** Kinds of scheduled event, in the order they are handled at the same time. */
export const EventOrder = {
  eventCheck: 0,
  tick: 1,
  departure: 2,
  arrival: 3,
} as const;

export type EventOrder = (typeof EventOrder)[keyof typeof EventOrder];

export interface Scheduled {
  time: number;
  order: EventOrder;
  /** Index of the train, storm or other entity, for deterministic ties. */
  entity: number;
}

interface Entry<T extends Scheduled> {
  item: T;
  seq: number;
}

const before = <T extends Scheduled>(a: Entry<T>, b: Entry<T>) =>
  a.item.time !== b.item.time
    ? a.item.time < b.item.time
    : a.item.order !== b.item.order
      ? a.item.order < b.item.order
      : a.item.entity !== b.item.entity
        ? a.item.entity < b.item.entity
        : a.seq < b.seq;

/** Binary heap ordered by time, then event order, entity and insertion. */
export class EventQueue<T extends Scheduled> {
  private heap: Entry<T>[] = [];
  private seq = 0;

  get size(): number {
    return this.heap.length;
  }

  push(item: T): void {
    const heap = this.heap;
    heap.push({ item, seq: this.seq++ });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const child = heap[i] as Entry<T>;
      const up = heap[parent] as Entry<T>;
      if (!before(child, up)) break;
      heap[i] = up;
      heap[parent] = child;
      i = parent;
    }
  }

  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  pop(): T | undefined {
    const heap = this.heap;
    const top = heap[0];
    const last = heap.pop();
    if (top === undefined || last === undefined) return undefined;
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let best = i;
        if (left < heap.length && before(heap[left] as Entry<T>, heap[best] as Entry<T>))
          best = left;
        if (right < heap.length && before(heap[right] as Entry<T>, heap[best] as Entry<T>)) {
          best = right;
        }
        if (best === i) break;
        const tmp = heap[i] as Entry<T>;
        heap[i] = heap[best] as Entry<T>;
        heap[best] = tmp;
        i = best;
      }
    }
    return top.item;
  }
}
