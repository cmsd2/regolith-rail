-- Two stations: the half capacity limit.

return mars.line {
  id = "two-station",
  title = "Two stations",
  description = "A mining outpost supplies a dome over a long line with one train. Balancing moves at most half the stock difference per visit, so the dome runs short while the mine's station fills and its extractors stall, even though one train could carry enough.",
  docs = "failure-modes/half-capacity",
  duration = sols(10),
  stations = {
    mars.small_station {
      id = "Mine",
      stock = { Metals = 15 },
      buildings = { mars.extractor { resource = "Metals", rate = 45 } },
    },
    mars.small_station {
      id = "Dome",
      stock = { Metals = 15 },
      buildings = { mars.consumer { resource = "Metals", rate = 36, variability = 20 } },
    },
  },
  distances = 72000,
  trains = { mars.train { id = "T1", start = "Mine" } },
}
