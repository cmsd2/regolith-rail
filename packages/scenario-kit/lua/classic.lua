-- classic: templates for well-known operations research problems.
--
-- Each template returns a complete scenario from named parameters with
-- documented defaults. Quantities are in units, durations in milliseconds
-- written with the unit helpers, and costs in whole cost units.
--
-- Reviews are one minute into each period. A tick covers the minute before
-- its time and runs after reviews at the same time, so a review a minute in
-- sees all of the previous period's demand and none of the next.

local _, kit, core = ...

local classic = {}
local construct = core.__construct

local function fail(name, message)
  error(name .. ": " .. message, 0)
end

local function count(name, key, value, default, low, high)
  if value == nil then
    return default
  end
  if type(value) ~= "number" or value ~= math.floor(value) or value < low or value > high then
    fail(name, key .. " must be a whole number from " .. low .. " to " .. high)
  end
  return value
end

local function flag(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) ~= "boolean" then
    fail(name, key .. " must be true or false")
  end
  return value
end

local function choice(name, key, value, default, a, b)
  if value == nil then
    return default
  end
  if value ~= a and value ~= b then
    fail(name, key .. ' must be "' .. a .. '" or "' .. b .. '"')
  end
  return value
end

classic.newsvendor = construct("classic.newsvendor", {
  demand = "number|discrete",
  unit_cost = "integer",
  lost_cost = "integer",
  period = "duration",
  periods = "integer",
  seed = "integer",
}, {}, function(p, name)
  local period = p.period or days(1)
  local periods = count(name, "periods", p.periods, 30, 1, 1000)
  local demand = p.demand or discrete({ { 5, 1 }, { 10, 2 }, { 15, 3 }, { 20, 2 }, { 25, 1 } })
  return scenario({
    id = "newsvendor",
    title = "Newsvendor",
    description = "A stand orders papers once a day before facing random demand. Unsold papers are worthless the next day and demand that finds no paper is lost, so the order balances the cost of too many against the cost of too few.",
    docs = "book/newsvendor",
    information = "local",
    duration = period * periods,
    seed = p.seed,
    stations = {
      station({
        id = "Stand",
        resources = { store({ resource = "Papers", capacity = "unlimited", expires = true }) },
        consumers = {
          consumer({
            resource = "Papers",
            per_period = per_period({ period = period, amount = demand }),
            lost_cost = p.lost_cost or 5,
          }),
        },
        suppliers = { supplier({ resource = "Papers", unit_cost = p.unit_cost or 2 }) },
        review = review({ period = period, offset = minutes(1) }),
      }),
    },
  })
end)

classic.reorder = construct("classic.reorder", {
  demand = "number",
  random = "boolean",
  lead_time = "duration",
  review_period = "duration",
  holding_cost = "integer",
  order_cost = "integer",
  unit_cost = "integer",
  shortage = '"lost"|"backorder"',
  shortage_cost = "integer",
  initial = "number",
  duration = "duration",
  seed = "integer",
}, {}, function(p, name)
  local demand = p.demand or 10
  local random = flag(name, "random", p.random, false)
  local shortage = choice(name, "shortage", p.shortage, "backorder", "lost", "backorder")
  local shortage_cost = p.shortage_cost or 10
  local flow = { resource = "Goods", unmet = shortage }
  if random then
    flow.poisson = poisson({ per_sol = demand, size = 1 })
  else
    flow.rate = demand
  end
  if shortage == "lost" then
    flow.lost_cost = shortage_cost
  else
    flow.backorder_cost = shortage_cost
  end
  return scenario({
    id = "reorder",
    title = "Reorder",
    description = "A store sells goods from stock and reorders from a supplier who delivers after a lead time. Holding stock costs money, every order has a fixed cost, and running out costs more, so the policy chooses when to order and how much.",
    docs = "book/order-quantities",
    information = "local",
    duration = p.duration or days(20),
    seed = p.seed,
    stations = {
      station({
        id = "Shop",
        resources = {
          store({
            resource = "Goods",
            capacity = "unlimited",
            initial = p.initial or 0,
            holding_cost = p.holding_cost or 1,
          }),
        },
        consumers = { consumer(flow) },
        suppliers = {
          supplier({
            resource = "Goods",
            lead_time = p.lead_time or 0,
            order_cost = p.order_cost or 20,
            unit_cost = p.unit_cost or 0,
          }),
        },
        review = review({ period = p.review_period or hours(1), offset = minutes(1) }),
      }),
    },
  })
end)

-- The shortest and longest of a fixed or discrete lead time, in milliseconds.
local function lead_time_range(name, value)
  if type(value) == "number" then
    return value, value
  end
  if kit.kind_of(value) ~= "discrete" then
    fail(name, "lead_time must be a duration or discrete { ... } of durations")
  end
  local low, high
  for _, entry in ipairs(value.discrete) do
    low = (low == nil or entry.value < low) and entry.value or low
    high = (high == nil or entry.value > high) and entry.value or high
  end
  return low, high
end

classic.safety_stock = construct("classic.safety_stock", {
  demand = "number",
  lead_time = "duration|discrete",
  review_period = "duration",
  target_service = "number",
  holding_cost = "integer",
  backorder_cost = "integer",
  initial = "number",
  duration = "duration",
  seed = "integer",
}, {}, function(p, name)
  local review_period = p.review_period or weeks(1)
  local lead_time = p.lead_time or discrete({ { days(1), 1 }, { days(3), 1 } })
  local low, high = lead_time_range(name, lead_time)
  if high - low >= review_period then
    fail(name, "lead times must differ by less than the review period, so that orders never overtake each other")
  end
  local target = p.target_service or 0.95
  if type(target) ~= "number" or target <= 0 or target >= 1 then
    fail(name, "target_service must be a number between 0 and 1, such as 0.95")
  end
  return scenario({
    id = "safety-stock",
    title = "Safety stock",
    description = "A store reviewed on a schedule faces random demand and a supplier whose lead time varies. Stock above the average demand protects against running short before the next delivery, and the target service level says how often a cycle may end with customers waiting.",
    docs = "book/safety-stock",
    information = "local",
    duration = p.duration or weeks(10),
    seed = p.seed,
    stations = {
      station({
        id = "Shop",
        resources = {
          store({
            resource = "Goods",
            capacity = "unlimited",
            initial = p.initial or 0,
            holding_cost = p.holding_cost or 1,
          }),
        },
        consumers = {
          consumer({
            resource = "Goods",
            poisson = poisson({ per_sol = p.demand or 10, size = 1 }),
            unmet = "backorder",
            backorder_cost = p.backorder_cost or 10,
          }),
        },
        suppliers = { supplier({ resource = "Goods", lead_time = lead_time, order_cost = 0 }) },
        review = review({ period = review_period, offset = minutes(1) }),
      }),
    },
  })
end)

classic.serial_chain = construct("classic.serial_chain", {
  stages = "integer",
  lead_time = "duration",
  review_period = "duration",
  demand = "number|discrete",
  holding_cost = "integer",
  backorder_cost = "integer",
  initial = "number",
  duration = "duration",
  seed = "integer",
}, {}, function(p, name)
  local stages = count(name, "stages", p.stages, 4, 2, 10)
  local period = p.review_period or days(1)
  local lead_time = p.lead_time or days(2)
  local demand = p.demand or discrete({ { 2, 1 }, { 4, 2 }, { 6, 1 } })
  local stations = {}
  for i = 1, stages do
    local from = i == 1 and "external" or "Stage" .. (i - 1)
    local consumers = {}
    if i == stages then
      consumers[1] = consumer({
        resource = "Beer",
        per_period = per_period({ period = period, amount = demand }),
        unmet = "backorder",
        backorder_cost = p.backorder_cost or 2,
      })
    end
    stations[i] = station({
      id = "Stage" .. i,
      resources = {
        store({
          resource = "Beer",
          capacity = "unlimited",
          initial = p.initial or 12,
          holding_cost = p.holding_cost or 1,
        }),
      },
      consumers = consumers,
      suppliers = { supplier({ resource = "Beer", from = from, lead_time = lead_time }) },
      review = review({ period = period, offset = minutes(1) }),
    })
  end
  return scenario({
    id = "serial-chain",
    title = "Serial supply chain",
    description = "Stages in series pass beer from a brewery at Stage1 to customers at the last stage, each ordering from the one before it and waiting a lead time for shipments. Each stage sees only the orders of the stage after it, so small swings in customer demand can grow into large swings upstream.",
    docs = "classic/serial-chain",
    information = "line",
    duration = p.duration or days(60),
    seed = p.seed,
    stations = stations,
  })
end)

classic.fixed_route_delivery = construct("classic.fixed_route_delivery", {
  customers = "integer",
  demand = "number",
  customer_capacity = "number",
  customer_initial = "number",
  distance = "integer",
  vehicles = "integer",
  vehicle_capacity = "number",
  speed = "integer",
  lead_time = "duration",
  review_period = "duration",
  depot_initial = "number",
  lost_cost = "integer",
  cost_per_distance = "integer",
  duration = "duration",
  seed = "integer",
}, {}, function(p, name)
  local customers = count(name, "customers", p.customers, 3, 1, 20)
  local vehicles = count(name, "vehicles", p.vehicles, 1, 1, 10)
  local distance = p.distance or 600
  local stations = {
    station({
      id = "Depot",
      resources = { store({ resource = "Fuel", capacity = "unlimited", initial = p.depot_initial or 60 }) },
      suppliers = { supplier({ resource = "Fuel", lead_time = p.lead_time or days(1) }) },
      review = review({ period = p.review_period or days(1), offset = minutes(1) }),
    }),
  }
  local stops = { "Depot" }
  local arcs = {}
  for i = 1, customers do
    local id = "Customer" .. i
    stations[i + 1] = station({
      id = id,
      resources = {
        store({
          resource = "Fuel",
          capacity = p.customer_capacity or 20,
          initial = p.customer_initial or 10,
        }),
      },
      consumers = { consumer({ resource = "Fuel", rate = p.demand or 4, lost_cost = p.lost_cost or 5 }) },
    })
    arcs[i] = arc({ from = stops[i], to = id, distance = distance })
    stops[i + 1] = id
  end
  if customers > 1 then
    arcs[customers + 1] = arc({ from = stops[customers + 1], to = "Depot", distance = distance })
  end
  local fleet = {}
  for i = 1, vehicles do
    fleet[i] = vehicle({
      id = "Truck" .. i,
      route = loop({ stops = stops, start = stops[(i - 1) % #stops + 1] }),
      speed = p.speed or 5,
      capacity = p.vehicle_capacity or 30,
      cost_per_distance = p.cost_per_distance or 0,
    })
  end
  return scenario({
    id = "fixed-route-delivery",
    title = "Fixed-route delivery",
    description = "A depot restocked by an outside supplier serves customers that trucks visit on a fixed loop. Each truck decides how much to load at the depot and how much to leave at each customer, so no customer runs dry before the truck comes round again.",
    docs = "classic/fixed-route-delivery",
    information = "line",
    duration = p.duration or days(20),
    seed = p.seed,
    stations = stations,
    arcs = arcs,
    vehicles = fleet,
  })
end)

return classic
