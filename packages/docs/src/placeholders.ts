/** A simulator capability a book example waits for. */
export interface Capability {
  id: string;
  /** What the simulator needs, in a sentence. */
  needs: string;
}

/** Where the roadmap describes each capability; the id is the heading's anchor. */
export const ROADMAP_URL = "https://github.com/cmsd2/regolith-rail/blob/main/docs/roadmap.md";

/**
 * Capabilities that book examples wait for, as roadmap §8.8 lists them. A chapter shows a
 * placeholder naming one of these where it would otherwise run the example.
 */
export const PLACEHOLDERS: readonly Capability[] = [
  {
    id: "mars-poisson-consumer",
    needs: "Poisson demand for consumers in the mars pack",
  },
  {
    id: "mars-dispatch-interval",
    needs: "timetable routes and a fixed cost per trip in the mars pack",
  },
  {
    id: "normal-per-period-demand",
    needs: "normally distributed per-period demand",
  },
  {
    id: "service-level-metrics",
    needs: "cycle service level and fill rate as run and batch metrics",
  },
  {
    id: "smooth-seasonal-demand",
    needs: "a seasonal demand profile smoother than two levels",
  },
];

export const capability = (id: string) => PLACEHOLDERS.find((c) => c.id === id);

export const roadmapLink = (id: string) => `${ROADMAP_URL}#${id}`;
