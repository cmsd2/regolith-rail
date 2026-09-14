-- Mixed line: ping-pong and missing priorities.

return mars.line {
  id = "mixed-line",
  title = "Mixed line",
  description = "Five stations trade food, metals and polymers of different "
    .. "importance. Balancing carries goods back and forth between stations "
    .. "that neither produce nor need them, and treats food the same as "
    .. "metals.",
  docs = "failure-modes/ping-pong",
  duration = sols(10),
  resources = { "Metals", "Polymers", "Food" },
  stations = {
    mars.small_station {
      id = "Farm",
      capacity = { Food = 60 },
      stock = { Food = 30, Metals = 10 },
      buildings = {
        mars.farm { rate = 60 },
        mars.consumer { resource = "Metals", rate = 4 },
      },
    },
    mars.small_station {
      id = "Mine",
      capacity = { Metals = 60 },
      stock = { Metals = 30, Food = 10 },
      buildings = {
        mars.extractor { resource = "Metals", rate = 40 },
        mars.consumer { resource = "Food", rate = 8 },
      },
    },
    mars.small_station {
      id = "Depot",
      resources = { "Metals", "Polymers", "Food" },
    },
    mars.small_station {
      id = "Plant",
      stock = { Polymers = 15, Metals = 10 },
      buildings = {
        mars.producer { resource = "Polymers", rate = 24 },
        mars.consumer { resource = "Metals", rate = 12, variability = 25 },
      },
    },
    mars.small_station {
      id = "Dome",
      capacity = { Food = 60 },
      stock = { Food = 30, Polymers = 15, Metals = 15 },
      buildings = {
        mars.dome {
          consumes = {
            { "Food", 45, variability = 20 },
            { "Polymers", 16 },
            {
              "Metals",
              16,
              variability = bursts { on_ppm = 1500, off_ppm = 1500 },
            },
          },
        },
      },
    },
  },
  distances = { 18000, 24000, 18000, 30000 },
  trains = {
    mars.train { id = "T1", start = "Farm", speed = 6 },
    mars.train { id = "T2", start = "Dome", direction = "backward", speed = 6 },
  },
}
