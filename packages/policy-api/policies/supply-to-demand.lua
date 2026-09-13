-- Supply to demand: an example policy built from ops blocks.
--
-- Stations are given roles by hand for the starter scenarios. Trains empty the
-- stations that produce a resource, fill the stations that need it, and pass
-- relays by. Lookahead keeps cargo for stations further along and reserves it,
-- so a second train does not answer a shortage that is already covered. When a
-- train cannot carry everything, higher priority resources go first.

return ops.policy {
  classify = ops.roles.manual {
    -- Mining outposts and the farm produce; domes and factories consume.
    Mine = { Metals = "supply", Food = "demand" },
    Farm = { Food = "supply", Metals = "demand" },
    Plant = { Polymers = "supply", Metals = "demand" },
    Factory = "demand",
    Dome = "demand",
    Junction = "relay",
    Depot = "relay",
  },
  target = {
    supply = ops.drain {},
    demand = ops.fill {},
    relay = ops.pass_through {},
  },
  plan = ops.lookahead {},
  allocate = ops.priority {},
}
