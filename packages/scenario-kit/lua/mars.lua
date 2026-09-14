-- mars: Surviving Mars rail lines in game vocabulary and units.
--
-- A line is a row of stations joined by track, with trains shuttling from one
-- end to the other. Stations are small or large; buildings next to a station
-- produce, consume or convert the resources it stores. Quantities are whole
-- game units and times are sols and hours. Every construct builds core
-- scenario format parts, so a Mars script evaluates like any other.

local _, kit, core = ...

local mars = {}
local construct = core.__construct

local SMALL = 30
local LARGE = 60

--- Resource priorities when a script does not state them: what colonists need first.
mars.PRIORITIES = { Food = 3, Water = 3, Oxygen = 3, Polymers = 2, MachineParts = 2, Electronics = 2 }

--- Building and train values when a script does not state them.
mars.DEFAULTS = {
  extractor = 40,
  farm = 30,
  dome = { Food = 20 },
  factory = { inputs = { Metals = 3 }, outputs = { MachineParts = 1 }, rate = 10 },
  train = { speed = 5, capacity = 30, dwell_minutes = 10, dwell_per_unit_minutes = 1 },
  variability_hours = 2,
}

local function fail(name, message)
  error(name .. ": " .. message, 0)
end

local function is_list(t)
  return type(t) == "table" and (#t > 0 or next(t) == nil)
end

--- A number is a uniform range in percent over two hours; a core construct passes through.
local function variability(name, value)
  if value == nil or type(value) == "table" then
    return value
  end
  if type(value) ~= "number" then
    fail(name, "variability must be a percentage, uniform { ... } or bursts { ... }")
  end
  return uniform({ range = value, period = hours(mars.DEFAULTS.variability_hours) })
end

local FLOW_PARAMS = { resource = "string", rate = "number", variability = "number|uniform|bursts" }

local function flow_building(kind, make, default_rate, required)
  return construct("mars." .. kind, FLOW_PARAMS, required, function(p, name)
    local flow = make({
      resource = p.resource,
      rate = p.rate or default_rate,
      variability = variability(name, p.variability),
    })
    if kind == "consumer" then
      return { building = kind, consumers = { flow }, resources = { p.resource } }
    end
    return { building = kind, producers = { flow }, resources = { p.resource } }
  end)
end

mars.extractor = flow_building("extractor", producer, mars.DEFAULTS.extractor, { "resource" })
mars.producer = flow_building("producer", producer, nil, { "resource", "rate" })
mars.consumer = flow_building("consumer", consumer, nil, { "resource", "rate" })

mars.farm = construct("mars.farm", FLOW_PARAMS, {}, function(p, name)
  local resource = p.resource or "Food"
  local flow = producer({
    resource = resource,
    rate = p.rate or mars.DEFAULTS.farm,
    variability = variability(name, p.variability),
  })
  return { building = "farm", producers = { flow }, resources = { resource } }
end)

--- Needs as units per sol keyed by resource id, in id order, or a list of { resource, rate }.
mars.dome = construct("mars.dome", {
  consumes = "table<string, number>|table[]",
  variability = "number|uniform|bursts",
}, {}, function(p, name)
  local needs = p.consumes or mars.DEFAULTS.dome
  if type(needs) ~= "table" then
    fail(name, "consumes must be units per sol keyed by resource id, or a list of needs")
  end
  local entries = {}
  if is_list(needs) then
    for i, need in ipairs(needs) do
      if type(need) ~= "table" then
        fail(name, "consumes entry " .. i .. ' must be a table such as { "Food", 20 }')
      end
      entries[i] = { resource = need.resource or need[1], rate = need.rate or need[2], variability = need.variability }
    end
  else
    for resource, rate in pairs(needs) do
      entries[#entries + 1] = { resource = resource, rate = rate }
    end
  end
  local consumers, resources = {}, {}
  for i, need in ipairs(entries) do
    consumers[i] = consumer({
      resource = need.resource,
      rate = need.rate,
      variability = variability(name, need.variability or p.variability),
    })
    resources[i] = need.resource
  end
  return { building = "dome", consumers = consumers, resources = resources }
end)

mars.factory = construct("mars.factory", {
  inputs = "table<string, number>",
  outputs = "table<string, number>",
  rate = "number",
  variability = "number|uniform|bursts",
}, {}, function(p, name)
  local defaults = mars.DEFAULTS.factory
  local made = converter({
    inputs = p.inputs or defaults.inputs,
    outputs = p.outputs or defaults.outputs,
    rate = p.rate or defaults.rate,
    variability = variability(name, p.variability),
  })
  local resources = {}
  for _, amount in ipairs(made.inputs) do
    resources[#resources + 1] = amount.resource
  end
  for _, amount in ipairs(made.outputs) do
    resources[#resources + 1] = amount.resource
  end
  return { building = "factory", converters = { made }, resources = resources }
end)

--- A station where every resource it stores holds `size` units unless `capacity` says otherwise.
local function station_of(size)
  return function(p, name)
    local order, seen = {}, {}
    local function add(resource)
      if type(resource) ~= "string" then
        fail(name, 'resources must be resource ids, such as "Metals"')
      end
      if not seen[resource] then
        seen[resource] = true
        order[#order + 1] = resource
      end
    end
    if p.resources ~= nil then
      if not is_list(p.resources) then
        fail(name, "resources must be a list of resource ids")
      end
      for _, resource in ipairs(p.resources) do
        add(resource)
      end
    end
    local producers, consumers, converters = {}, {}, {}
    for i, b in ipairs(p.buildings or {}) do
      if type(b) ~= "table" or b.building == nil then
        fail(name, "buildings[" .. i .. "] must be a building, such as mars.extractor { ... }")
      end
      for _, resource in ipairs(b.resources) do
        add(resource)
      end
      for _, f in ipairs(b.producers or {}) do
        producers[#producers + 1] = f
      end
      for _, f in ipairs(b.consumers or {}) do
        consumers[#consumers + 1] = f
      end
      for _, c in ipairs(b.converters or {}) do
        converters[#converters + 1] = c
      end
    end
    local stock = p.stock or {}
    local capacity = p.capacity or {}
    if type(stock) ~= "table" or is_list(stock) and next(stock) ~= nil then
      fail(name, "stock must be units keyed by resource id")
    end
    if type(capacity) ~= "table" or is_list(capacity) and next(capacity) ~= nil then
      fail(name, "capacity must be units keyed by resource id")
    end
    for resource in pairs(stock) do
      add(resource)
    end
    for resource in pairs(capacity) do
      if not seen[resource] then
        fail(name, "capacity names " .. tostring(resource) .. ", which the station does not store")
      end
    end
    local stores = {}
    for i, resource in ipairs(order) do
      stores[i] = store({ resource = resource, capacity = capacity[resource] or size, initial = stock[resource] })
    end
    return station({
      id = p.id,
      resources = stores,
      producers = producers,
      consumers = consumers,
      converters = converters,
    })
  end
end

local STATION_PARAMS = {
  id = "string",
  resources = "string[]",
  stock = "table<string, number>",
  capacity = "table<string, number>",
  buildings = "building[]",
}

mars.small_station = construct("mars.small_station", STATION_PARAMS, { "id" }, station_of(SMALL))
mars.large_station = construct("mars.large_station", STATION_PARAMS, { "id" }, station_of(LARGE))

mars.train = construct("mars.train", {
  id = "string",
  start = "string",
  direction = '"forward"|"backward"',
  speed = "integer",
  capacity = "number",
  dwell = "duration",
  dwell_per_unit = "duration",
}, { "id" }, function(p)
  local defaults = mars.DEFAULTS.train
  return {
    id = p.id,
    start = p.start,
    direction = p.direction,
    speed = p.speed or defaults.speed,
    capacity = p.capacity or defaults.capacity,
    dwell = p.dwell or minutes(defaults.dwell_minutes),
    dwell_per_unit = p.dwell_per_unit or minutes(defaults.dwell_per_unit_minutes),
  }
end)

mars.dust_storm = construct("mars.dust_storm", {
  id = "string",
  start = "duration",
  duration = "duration",
  chance_ppm = "integer",
  check_every = "duration",
  stations = '"all"|string[]',
  surge = "{ station, resource, multiplier, after, duration }",
}, { "duration" }, function(p, name)
  local effects = {
    effect({ type = "supply", stations = p.stations, resources = "all", multiplier = 0 }),
  }
  if p.surge ~= nil then
    local surge = p.surge
    if type(surge) ~= "table" then
      fail(name, 'surge must be a table such as { station = "Dome", resource = "Metals", multiplier = 2.5 }')
    end
    for key in pairs(surge) do
      if key ~= "station" and key ~= "resource" and key ~= "multiplier" and key ~= "after" and key ~= "duration" then
        fail(name, "surge has no field named " .. tostring(key))
      end
    end
    effects[2] = effect({
      type = "demand",
      stations = surge.station,
      resources = surge.resource,
      multiplier = surge.multiplier or 2,
      start_offset = surge.after,
      duration = surge.duration,
    })
  end
  return event({
    id = p.id or "dust-storm",
    label = "Dust storm",
    start = p.start,
    duration = p.duration,
    chance_ppm = p.chance_ppm,
    check_every = p.check_every,
    effects = effects,
  })
end)

--- A rail line: stations in order joined by track, and trains shuttling along all of it.
mars.line = construct("mars.line", {
  id = "string",
  title = "string",
  description = "string",
  docs = "string",
  duration = "duration",
  seed = "integer",
  information = '"local"|"line"',
  resources = "string[]",
  stations = "station[]",
  distances = "integer|integer[]",
  trains = "train[]",
  events = "event[]",
}, { "id", "duration", "stations", "distances", "trains" }, function(p, name)
  local built = line({ stations = p.stations, distances = p.distances })
  local stops = {}
  for i, s in ipairs(built.stations) do
    stops[i] = s.id
  end
  if type(p.trains) ~= "table" or not is_list(p.trains) or #p.trains == 0 then
    fail(name, "trains must list at least one mars.train { ... }")
  end
  local vehicles = {}
  for i, t in ipairs(p.trains) do
    if kit.kind_of(t) ~= "mars.train" then
      fail(name, "trains[" .. i .. "] must be built with mars.train")
    end
    vehicles[i] = vehicle({
      id = t.id,
      route = shuttle({ stops = stops, start = t.start or stops[1], direction = t.direction }),
      speed = t.speed,
      capacity = t.capacity,
      dwell = t.dwell,
      dwell_per_unit = t.dwell_per_unit,
    })
  end

  local ids = p.resources
  if ids == nil then
    ids = {}
    local seen = {}
    for _, s in ipairs(built.stations) do
      for _, stored in ipairs(s.resources) do
        if not seen[stored.id] then
          seen[stored.id] = true
          ids[#ids + 1] = stored.id
        end
      end
    end
  elseif not is_list(ids) then
    fail(name, "resources must be a list of resource ids")
  end
  local resources = {}
  for i, id in ipairs(ids) do
    resources[i] = resource({ id = id, priority = mars.PRIORITIES[id] or 1 })
  end

  return scenario({
    id = p.id,
    title = p.title,
    description = p.description,
    docs = p.docs,
    duration = p.duration,
    seed = p.seed,
    information = p.information,
    resources = resources,
    parts = { built },
    vehicles = vehicles,
    events = p.events,
  })
end)

return mars
