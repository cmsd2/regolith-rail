-- Two trains: double dispatch.

return mars.line {
  id = "two-trains",
  title = "Two trains",
  description = "Two trains share a line from a mine to a factory and a dome. Without knowing what the other train is carrying, both respond to the same shortage, oversupplying one station while the other waits.",
  docs = "failure-modes/double-dispatch",
  duration = sols(10),
  stations = {
    mars.large_station {
      id = "Mine",
      stock = { Metals = 30 },
      buildings = { mars.extractor { resource = "Metals", rate = 80 } },
    },
    mars.small_station {
      id = "Factory",
      stock = { Metals = 15 },
      buildings = {
        mars.consumer { resource = "Metals", rate = 40, variability = bursts { on_ppm = 2000, off_ppm = 1000 } },
      },
    },
    mars.small_station {
      id = "Dome",
      stock = { Metals = 15 },
      buildings = { mars.consumer { resource = "Metals", rate = 42, variability = 30 } },
    },
  },
  distances = { 30000, 42000 },
  trains = {
    mars.train { id = "T1", start = "Mine" },
    mars.train { id = "T2", start = "Dome", direction = "backward" },
  },
}
