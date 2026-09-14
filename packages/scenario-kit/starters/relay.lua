-- Relay station: dead stock at a junction.

return mars.line {
  id = "relay",
  title = "Relay station",
  description = "A junction station with no producers or consumers sits "
    .. "between a mine and a dome. Balancing fills it to the line average, "
    .. "tying up stock the dome needs.",
  docs = "failure-modes/dead-stock",
  duration = sols(10),
  stations = {
    mars.small_station {
      id = "Mine",
      stock = { Metals = 15 },
      buildings = { mars.extractor { resource = "Metals", rate = 45 } },
    },
    mars.small_station { id = "Junction", resources = { "Metals" } },
    mars.small_station {
      id = "Dome",
      stock = { Metals = 15 },
      buildings = {
        mars.consumer { resource = "Metals", rate = 34, variability = 20 },
      },
    },
  },
  distances = 36000,
  trains = { mars.train { id = "T1", start = "Mine" } },
}
