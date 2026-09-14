-- Storm shock: a storm, then a maintenance surge.

return mars.line {
  id = "storm-shock",
  title = "Storm shock",
  description = "A dust storm stops the mine's extractors for a sol, and the "
    .. "damage it leaves behind sends metal demand at the dome up for a sol "
    .. "and a half. Balancing runs the dome close to empty in normal "
    .. "operation, so it has no buffer for either shock and recovers slowly.",
  docs = "book/safety-stock#case-study-storm-shock",
  duration = sols(10),
  stations = {
    mars.small_station {
      id = "Mine",
      stock = { Metals = 15 },
      buildings = { mars.extractor { resource = "Metals", rate = 40 } },
    },
    mars.small_station {
      id = "Dome",
      stock = { Metals = 15 },
      buildings = {
        mars.consumer { resource = "Metals", rate = 24, variability = 20 },
      },
    },
  },
  distances = 72000,
  trains = { mars.train { id = "T1", start = "Mine" } },
  events = {
    mars.dust_storm {
      start = sols(3),
      duration = sols(1),
      surge = {
        station = "Dome",
        resource = "Metals",
        multiplier = 2.5,
        after = sols(0.5),
        duration = sols(1.5),
      },
    },
  },
}
