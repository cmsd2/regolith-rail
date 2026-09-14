-- core: constructs that build scenario format 2 documents.
--
-- Every construct takes a table of named parameters, applies the documented
-- defaults, converts units to the integer units of the scenario format, and
-- returns a plain table that a script may change before returning it.
-- Quantities are given in units and returned in milli-units; durations are
-- given and returned in milliseconds, usually written with sols(), hours() and
-- the other unit helpers.
--
-- The host passes, after the budget check the instrumentation consumes:
--   kit.caller_line()           the script line calling into the library
--   kit.mark(t, kind, line)     records the construct and line that built t
--   kit.kind_of(t)              the construct that built t, if any

local _, kit = ...

local core = {}
local registry = {}

local UNIT = 1000
local MINUTE = 60000
local HOUR = 60 * MINUTE
local SOL = 24 * HOUR
local DEFAULT_CAPACITY = 30

-- Errors and exact numbers -------------------------------------------------------

local function fail(name, message)
  error(name .. ": " .. message, 0)
end

--- Formats a number of milli-units as units, without trailing zeros.
local function show_units(milli)
  local text = string.format("%.3f", milli / UNIT)
  text = string.gsub(text, "0+$", "")
  text = string.gsub(text, "%.$", "")
  return text
end

local function show(value)
  if value == math.floor(value) and math.abs(value) < 1e15 then
    return string.format("%d", value)
  end
  return string.format("%.14g", value)
end

--- Rounds value * factor to an integer, or returns nil with the integers either side.
local function exact(value, factor)
  local scaled = value * factor
  local rounded = math.floor(scaled + 0.5)
  if math.abs(scaled - rounded) > 1e-9 + math.abs(scaled) * 1e-15 then
    local below = math.floor(scaled)
    return nil, below, below + 1
  end
  return rounded
end

local function whole_units(name, what, value)
  local milli, below, above = exact(value, UNIT)
  if milli == nil then
    fail(
      name,
      what
        .. " of "
        .. show(value)
        .. " units cannot be stated exactly: quantities have a resolution of 0.001 units; the nearest values are "
        .. show_units(below)
        .. " and "
        .. show_units(above)
    )
  end
  return milli
end

-- Unit helpers ---------------------------------------------------------------------

local function duration_helper(helper, factor)
  return function(value)
    if type(value) ~= "number" then
      fail(helper, "expects a number, such as " .. helper .. "(2)")
    end
    if value < 0 then
      fail(helper, "durations must not be negative")
    end
    local ms, below, above = exact(value, factor)
    if ms == nil then
      fail(
        helper,
        helper
          .. "("
          .. show(value)
          .. ") is not a whole number of milliseconds: durations have a resolution of 1 ms; the nearest values are "
          .. show(below)
          .. " ms and "
          .. show(above)
          .. " ms"
      )
    end
    return ms
  end
end

--- Milli-units for a quantity in units.
function core.units(value)
  if type(value) ~= "number" then
    fail("units", "expects a number, such as units(2.5)")
  end
  return whole_units("units", "a quantity", value)
end

core.minutes = duration_helper("minutes", MINUTE)
core.hours = duration_helper("hours", HOUR)
core.sols = duration_helper("sols", SOL)
core.days = duration_helper("days", SOL)
core.weeks = duration_helper("weeks", 7 * SOL)

-- Parameters -----------------------------------------------------------------------

--- Declares a construct with its parameters. `required` lists parameters that must be given.
local function construct(name, params, required, build)
  registry[name] = params
  return function(args)
    local line = kit.caller_line()
    if type(args) ~= "table" or kit.kind_of(args) ~= nil then
      fail(
        name,
        "expects a table of parameters, such as " .. name .. " { ... }"
      )
    end
    for key in pairs(args) do
      if type(key) ~= "string" or params[key] == nil then
        fail(name, "has no parameter named " .. tostring(key))
      end
    end
    for _, key in ipairs(required) do
      if args[key] == nil then
        fail(name, "needs the parameter " .. key)
      end
    end
    local result = build(args, name, line)
    kit.mark(result, name, line)
    return result
  end
end

local function is_list(t)
  return type(t) == "table" and (#t > 0 or next(t) == nil)
end

local function check_type(name, key, value, expected)
  if type(value) ~= expected then
    fail(name, key .. " must be a " .. expected)
  end
  return value
end

local function id_param(name, key, value)
  if
    type(value) ~= "string"
    or not string.match(value, "^[A-Za-z][A-Za-z0-9_-]*$")
  then
    fail(
      name,
      key
        .. " must be an id that starts with a letter and uses letters, digits, _ or -"
    )
  end
  return value
end

--- A quantity in units, converted to milli-units.
local function quantity(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) ~= "number" then
    fail(name, key .. " must be a number of units")
  end
  if value < 0 then
    fail(name, key .. " must not be negative")
  end
  return whole_units(name, key, value)
end

--- A duration in milliseconds, as returned by the unit helpers.
local function duration(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) ~= "number" then
    fail(name, key .. " must be a duration, such as hours(2)")
  end
  if value < 0 then
    fail(name, key .. " must not be negative")
  end
  if value ~= math.floor(value) then
    fail(
      name,
      key
        .. " must be a whole number of milliseconds; use a unit helper, such as hours(1.5)"
    )
  end
  return value
end

--- A whole number, such as a count or a cost.
local function whole(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) ~= "number" or value ~= math.floor(value) then
    fail(name, key .. " must be a whole number")
  end
  if value < 0 then
    fail(name, key .. " must not be negative")
  end
  return value
end

--- A multiplier, such as 2.5, converted to thousandths.
local function multiplier(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) ~= "number" or value < 0 then
    fail(name, key .. " must be a number that is not negative, such as 1.5")
  end
  local permille = exact(value, 1000)
  if permille == nil then
    fail(
      name,
      key .. " of " .. show(value) .. " has more than three decimal places"
    )
  end
  return permille
end

local function one_of(name, key, value, choices, default)
  if value == nil then
    return default
  end
  for _, choice in ipairs(choices) do
    if value == choice then
      return value
    end
  end
  fail(name, key .. " must be one of " .. table.concat(choices, ", "))
end

--- Entries of a list, or of a table keyed by id in id order, as { id, value } pairs.
local function entries(name, key, value)
  if type(value) ~= "table" then
    fail(name, key .. " must be a list or a table keyed by id")
  end
  local out = {}
  if is_list(value) then
    for i, item in ipairs(value) do
      out[i] = { nil, item }
    end
  else
    for id, item in pairs(value) do
      out[#out + 1] = { id, item }
    end
  end
  return out
end

-- Distributions ------------------------------------------------------------------------

--- Weighted values: discrete { { 2, 1 }, { 3, 2 } } or discrete { { value = 2, weight = 1 } }.
function core.discrete(values)
  local line = kit.caller_line()
  if type(values) ~= "table" or not is_list(values) or #values == 0 then
    fail(
      "discrete",
      "expects a list of { value, weight } pairs, such as discrete { { 2, 1 }, { 3, 1 } }"
    )
  end
  local out = {}
  for i, pair in ipairs(values) do
    if type(pair) ~= "table" then
      fail("discrete", "entry " .. i .. " must be a { value, weight } pair")
    end
    local value = pair.value or pair[1]
    local weight = pair.weight or pair[2]
    if type(value) ~= "number" or type(weight) ~= "number" then
      fail("discrete", "entry " .. i .. " needs a number value and weight")
    end
    out[i] = { value = value, weight = weight }
  end
  return kit.mark({ discrete = out }, "discrete", line)
end

local function weights(name, key, entry, i)
  if entry.weight <= 0 or entry.weight ~= math.floor(entry.weight) then
    fail(
      name,
      key .. " weight " .. i .. " must be a whole number greater than zero"
    )
  end
  return entry.weight
end

--- A quantity distribution: a number of units or discrete {...}.
local function amount_distribution(name, key, value)
  if type(value) == "number" then
    return { kind = "fixed", value = quantity(name, key, value) }
  end
  if kit.kind_of(value) ~= "discrete" then
    fail(name, key .. " must be a number of units or discrete { ... }")
  end
  local values = {}
  for i, entry in ipairs(value.discrete) do
    values[i] = {
      value = quantity(name, key, entry.value),
      weight = weights(name, key, entry, i),
    }
  end
  return { kind = "discrete", values = values }
end

--- A duration distribution: a duration or discrete {...} of durations.
local function duration_distribution(name, key, value, default)
  if value == nil then
    return default
  end
  if type(value) == "number" then
    return { kind = "fixed", value = duration(name, key, value) }
  end
  if kit.kind_of(value) ~= "discrete" then
    fail(name, key .. " must be a duration or discrete { ... } of durations")
  end
  local values = {}
  for i, entry in ipairs(value.discrete) do
    values[i] = {
      value = duration(name, key, entry.value),
      weight = weights(name, key, entry, i),
    }
  end
  return { kind = "discrete", values = values }
end

-- Resources and stations ------------------------------------------------------------------

core.resource = construct(
  "resource",
  { id = "string", priority = "integer" },
  { "id" },
  function(p, name)
    return {
      id = id_param(name, "id", p.id),
      priority = whole(name, "priority", p.priority, 1),
    }
  end
)

core.store = construct("store", {
  resource = "string",
  capacity = 'units|"unlimited"',
  initial = "units",
  expires = "boolean",
  holding_cost = "integer",
}, { "resource" }, function(p, name)
  local capacity
  if p.capacity == "unlimited" then
    capacity = "unlimited"
  else
    capacity = quantity(name, "capacity", p.capacity, DEFAULT_CAPACITY * UNIT)
  end
  return {
    id = id_param(name, "resource", p.resource),
    capacity = capacity,
    initial = quantity(name, "initial", p.initial, 0),
    expires = p.expires ~= nil
        and check_type(name, "expires", p.expires, "boolean")
      or false,
    holdingCost = whole(name, "holding_cost", p.holding_cost),
  }
end)

--- Variability for a flow with a rate.
core.uniform = construct(
  "uniform",
  { range = "integer", period = "duration" },
  { "range" },
  function(p, name)
    local range = whole(name, "range", p.range)
    if range > 100 then
      fail(name, "range must be a percentage from 0 to 100")
    end
    return {
      kind = "uniform",
      rangePercent = range,
      periodMs = duration(name, "period", p.period, HOUR),
    }
  end
)

core.bursts = construct(
  "bursts",
  { on_ppm = "integer", off_ppm = "integer", starts_on = "boolean" },
  { "on_ppm", "off_ppm" },
  function(p, name)
    local out = {
      kind = "bursts",
      onPpm = whole(name, "on_ppm", p.on_ppm),
      offPpm = whole(name, "off_ppm", p.off_ppm),
      startsOn = true,
    }
    if p.starts_on ~= nil then
      out.startsOn = check_type(name, "starts_on", p.starts_on, "boolean")
    end
    return out
  end
)

core.poisson = construct(
  "poisson",
  { per_sol = "number", size = "units|discrete" },
  { "per_sol" },
  function(p, name)
    local per_sol = p.per_sol
    if type(per_sol) ~= "number" or per_sol < 0 then
      fail(
        name,
        "per_sol must be a number of arrivals per sol that is not negative"
      )
    end
    local arrivals = exact(per_sol, 1000)
    if arrivals == nil then
      fail(
        name,
        "per_sol of " .. show(per_sol) .. " has more than three decimal places"
      )
    end
    local size = p.size
    if size == nil then
      size = 1
    end
    return {
      arrivalsPerSol = arrivals,
      size = amount_distribution(name, "size", size),
    }
  end
)

core.per_period = construct(
  "per_period",
  { period = "duration", amount = "units|discrete" },
  { "period", "amount" },
  function(p, name)
    return {
      periodMs = duration(name, "period", p.period),
      amount = amount_distribution(name, "amount", p.amount),
    }
  end
)

core.trace = construct(
  "trace",
  { period = "duration", amounts = "units[]" },
  { "period", "amounts" },
  function(p, name)
    if type(p.amounts) ~= "table" or not is_list(p.amounts) then
      fail(name, "amounts must be a list of quantities in units")
    end
    local amounts = {}
    for i, value in ipairs(p.amounts) do
      amounts[i] = quantity(name, "amounts[" .. i .. "]", value)
    end
    return { periodMs = duration(name, "period", p.period), amounts = amounts }
  end
)

--- Multipliers over time: profile { { sols(0), 1 }, { sols(10), 2 } }.
function core.profile(points)
  local line = kit.caller_line()
  if type(points) ~= "table" or not is_list(points) or #points == 0 then
    fail(
      "profile",
      "expects a list of { time, multiplier } pairs, such as profile { { sols(0), 1 }, { sols(5), 2 } }"
    )
  end
  local out = {}
  for i, point in ipairs(points) do
    if type(point) ~= "table" then
      fail("profile", "point " .. i .. " must be a { time, multiplier } pair")
    end
    out[i] = {
      atMs = duration(
        "profile",
        "point " .. i .. " time",
        point.at or point[1]
      ),
      multiplierPermille = multiplier(
        "profile",
        "point " .. i .. " multiplier",
        point.multiplier or point[2]
      ),
    }
  end
  return kit.mark({ profile = out }, "profile", line)
end

local FLOW_PARAMS = {
  resource = "string",
  rate = "units per sol",
  variability = "uniform|bursts",
  poisson = "poisson",
  per_period = "per_period",
  trace = "trace",
  profile = "profile",
}

local function expect_kind(name, key, value, kinds)
  if value == nil then
    return nil
  end
  local kind = kit.kind_of(value)
  for _, k in ipairs(kinds) do
    if kind == k then
      return value
    end
  end
  fail(name, key .. " must be built with " .. table.concat(kinds, " or "))
end

local function flow(p, name)
  local out = { resource = id_param(name, "resource", p.resource) }
  out.rate = quantity(name, "rate", p.rate)
  out.variability =
    expect_kind(name, "variability", p.variability, { "uniform", "bursts" })
  if out.variability == nil and out.rate ~= nil then
    out.variability = { kind = "fixed" }
  end
  out.poisson = expect_kind(name, "poisson", p.poisson, { "poisson" })
  out.perPeriod =
    expect_kind(name, "per_period", p.per_period, { "per_period" })
  out.trace = expect_kind(name, "trace", p.trace, { "trace" })
  local profile = expect_kind(name, "profile", p.profile, { "profile" })
  if profile then
    out.profile = profile.profile
  end
  local kinds = 0
  for _, key in ipairs({ "rate", "poisson", "perPeriod", "trace" }) do
    if out[key] ~= nil then
      kinds = kinds + 1
    end
  end
  if kinds ~= 1 then
    fail(name, "needs exactly one of rate, poisson, per_period or trace")
  end
  return out
end

local function with(base, extra)
  local out = {}
  for k, v in pairs(base) do
    out[k] = v
  end
  for k, v in pairs(extra) do
    out[k] = v
  end
  return out
end

core.producer = construct(
  "producer",
  with(FLOW_PARAMS, { stall_cost = "integer" }),
  { "resource" },
  function(p, name)
    local out = flow(p, name)
    out.stallCost = whole(name, "stall_cost", p.stall_cost)
    return out
  end
)

core.consumer = construct(
  "consumer",
  with(FLOW_PARAMS, {
    unmet = '"lost"|"backorder"',
    lost_cost = "integer",
    backorder_cost = "integer",
  }),
  { "resource" },
  function(p, name)
    local out = flow(p, name)
    out.unmet = one_of(name, "unmet", p.unmet, { "lost", "backorder" }, "lost")
    out.lostCost = whole(name, "lost_cost", p.lost_cost)
    out.backorderCost = whole(name, "backorder_cost", p.backorder_cost)
    return out
  end
)

--- Amounts per batch: a table keyed by resource id, or a list of { resource, amount } pairs.
local function batch_amounts(name, key, value)
  if value == nil then
    return {}
  end
  local out = {}
  for i, entry in ipairs(entries(name, key, value)) do
    local resource, amount = entry[1], entry[2]
    if resource == nil then
      if type(amount) ~= "table" then
        fail(
          name,
          key .. " entry " .. i .. " must be a { resource, amount } pair"
        )
      end
      resource, amount =
        amount.resource or amount[1], amount.amount or amount[2]
    end
    local milli = quantity(name, key .. "." .. tostring(resource), amount)
    if milli == nil or milli <= 0 then
      fail(
        name,
        key .. "." .. tostring(resource) .. " must be greater than zero"
      )
    end
    out[i] = { resource = id_param(name, key, resource), amount = milli }
  end
  return out
end

core.converter = construct("converter", {
  inputs = "table<string, units>",
  outputs = "table<string, units>",
  rate = "number",
  variability = "uniform|bursts",
}, { "rate" }, function(p, name)
  if type(p.rate) ~= "number" or p.rate < 0 then
    fail(name, "rate must be a number of batches per sol that is not negative")
  end
  local rate = exact(p.rate, 1000)
  if rate == nil then
    fail(
      name,
      "rate of " .. show(p.rate) .. " has more than three decimal places"
    )
  end
  return {
    inputs = batch_amounts(name, "inputs", p.inputs),
    outputs = batch_amounts(name, "outputs", p.outputs),
    rate = rate,
    variability = expect_kind(
      name,
      "variability",
      p.variability,
      { "uniform", "bursts" }
    ) or { kind = "fixed" },
  }
end)

core.supplier = construct("supplier", {
  resource = "string",
  from = "string",
  lead_time = "duration|discrete",
  min_order = "units",
  max_order = "units",
  order_cost = "integer",
  unit_cost = "integer",
}, { "resource" }, function(p, name)
  return {
    resource = id_param(name, "resource", p.resource),
    from = p.from == nil and "external" or id_param(name, "from", p.from),
    leadTime = duration_distribution(
      name,
      "lead_time",
      p.lead_time,
      { kind = "fixed", value = 0 }
    ),
    minOrder = quantity(name, "min_order", p.min_order),
    maxOrder = quantity(name, "max_order", p.max_order),
    orderCost = whole(name, "order_cost", p.order_cost),
    unitCost = whole(name, "unit_cost", p.unit_cost),
  }
end)

core.review = construct(
  "review",
  { period = "duration", offset = "duration" },
  { "period" },
  function(p, name)
    return {
      periodMs = duration(name, "period", p.period),
      offsetMs = duration(name, "offset", p.offset, 0),
    }
  end
)

--- Builds a list from items made with one construct, where a string stands for that construct's defaults.
local function built_list(name, key, value, kinds, from_string, from_keyed)
  if value == nil then
    return {}
  end
  local out = {}
  for i, entry in ipairs(entries(name, key, value)) do
    local id, item = entry[1], entry[2]
    if id ~= nil then
      if from_keyed == nil then
        fail(name, key .. " must be a list")
      end
      item = from_keyed(id, item)
    elseif type(item) == "string" and from_string then
      item = from_string(item)
    else
      expect_kind(name, key .. "[" .. i .. "]", item, kinds)
    end
    out[i] = item
  end
  return out
end

local function params_table(name, key, id, value)
  if value == true then
    return {}
  end
  if type(value) ~= "table" or kit.kind_of(value) ~= nil then
    fail(name, key .. "." .. id .. " must be a table of parameters")
  end
  return value
end

core.station = construct("station", {
  id = "string",
  resources = "(string|store)[]|table<string, table>",
  producers = "producer[]",
  consumers = "consumer[]",
  converters = "converter[]",
  suppliers = "supplier[]",
  review = "review",
  position = "{ x: number, y: number }",
}, { "id", "resources" }, function(p, name)
  local out = { id = id_param(name, "id", p.id) }
  out.resources = built_list(
    name,
    "resources",
    p.resources,
    { "store" },
    function(resource)
      return core.store({ resource = resource })
    end,
    function(resource, params)
      local args = with(
        params_table(name, "resources", resource, params),
        { resource = resource }
      )
      return core.store(args)
    end
  )
  if #out.resources == 0 then
    fail(name, "resources must list at least one resource")
  end
  out.producers = built_list(name, "producers", p.producers, { "producer" })
  out.consumers = built_list(name, "consumers", p.consumers, { "consumer" })
  out.converters = built_list(name, "converters", p.converters, { "converter" })
  out.suppliers = built_list(name, "suppliers", p.suppliers, { "supplier" })
  out.review = expect_kind(name, "review", p.review, { "review" })
  if p.position ~= nil then
    local position = check_type(name, "position", p.position, "table")
    if type(position.x) ~= "number" or type(position.y) ~= "number" then
      fail(name, "position needs numbers x and y")
    end
    out.position = { x = position.x, y = position.y }
  end
  return out
end)

-- Network and vehicles ---------------------------------------------------------------------

local function positive_whole(name, key, value)
  local n = whole(name, key, value)
  if n == nil or n <= 0 then
    fail(name, key .. " must be a whole number greater than zero")
  end
  return n
end

core.arc = construct(
  "arc",
  { from = "string", to = "string", distance = "integer" },
  { "from", "to", "distance" },
  function(p, name)
    return {
      from = id_param(name, "from", p.from),
      to = id_param(name, "to", p.to),
      distance = positive_whole(name, "distance", p.distance),
    }
  end
)

local function station_id(name, key, value)
  if kit.kind_of(value) == "station" then
    return value.id
  end
  return id_param(name, key, value)
end

--- Stations joined in order: { stations = {...}, arcs = {...} }.
core.line = construct(
  "line",
  { stations = "station[]", distances = "integer|integer[]" },
  { "stations", "distances" },
  function(p, name)
    local stations = built_list(name, "stations", p.stations, { "station" })
    if #stations < 2 then
      fail(name, "stations must list at least two stations")
    end
    local arcs = {}
    for i = 1, #stations - 1 do
      local distance = p.distances
      if type(distance) == "table" then
        if #distance ~= #stations - 1 then
          fail(
            name,
            "distances must list one distance fewer than there are stations"
          )
        end
        distance = distance[i]
      end
      arcs[i] = {
        from = stations[i].id,
        to = stations[i + 1].id,
        distance = positive_whole(name, "distances", distance),
      }
    end
    return { stations = stations, arcs = arcs }
  end
)

local function stops(name, value)
  if type(value) ~= "table" or not is_list(value) or #value < 2 then
    fail(name, "stops must list at least two stations")
  end
  local out = {}
  for i, stop in ipairs(value) do
    out[i] = station_id(name, "stops[" .. i .. "]", stop)
  end
  return out
end

core.shuttle = construct(
  "shuttle",
  { stops = "string[]", start = "string", direction = '"forward"|"backward"' },
  { "stops" },
  function(p, name)
    return {
      kind = "shuttle",
      stops = stops(name, p.stops),
      start = p.start ~= nil and station_id(name, "start", p.start) or nil,
      direction = one_of(
        name,
        "direction",
        p.direction,
        { "forward", "backward" },
        "forward"
      ),
    }
  end
)

core.loop = construct(
  "loop",
  { stops = "string[]", start = "string" },
  { "stops" },
  function(p, name)
    return {
      kind = "loop",
      stops = stops(name, p.stops),
      start = p.start ~= nil and station_id(name, "start", p.start) or nil,
    }
  end
)

core.timetable = construct(
  "timetable",
  { stops = "string[]", departures = "duration[]" },
  { "stops", "departures" },
  function(p, name)
    if
      type(p.departures) ~= "table"
      or not is_list(p.departures)
      or #p.departures == 0
    then
      fail(name, "departures must list at least one departure time")
    end
    local departures = {}
    for i, at in ipairs(p.departures) do
      departures[i] = duration(name, "departures[" .. i .. "]", at)
    end
    return {
      kind = "timetable",
      stops = stops(name, p.stops),
      departuresMs = departures,
    }
  end
)

core.vehicle = construct("vehicle", {
  id = "string",
  route = "shuttle|loop|timetable",
  speed = "integer",
  dwell = "duration",
  dwell_per_unit = "duration",
  capacity = "units|table<string, units>",
  cost_per_distance = "integer",
}, { "id", "route", "speed", "capacity" }, function(p, name)
  local capacity
  if type(p.capacity) == "number" then
    capacity = { shared = quantity(name, "capacity", p.capacity) }
  elseif type(p.capacity) == "table" and not is_list(p.capacity) then
    local per = {}
    for resource, amount in pairs(p.capacity) do
      per[id_param(name, "capacity", resource)] =
        quantity(name, "capacity." .. resource, amount)
    end
    capacity = { perResource = per }
  else
    fail(name, "capacity must be a number of units, or units by resource id")
  end
  return {
    id = id_param(name, "id", p.id),
    route = expect_kind(
      name,
      "route",
      p.route,
      { "shuttle", "loop", "timetable" }
    ),
    speed = positive_whole(name, "speed", p.speed),
    dwellMs = duration(name, "dwell", p.dwell, 10000),
    dwellPerUnitMs = duration(name, "dwell_per_unit", p.dwell_per_unit, 1000),
    capacity = capacity,
    costPerDistance = whole(name, "cost_per_distance", p.cost_per_distance),
  }
end)

-- Events ----------------------------------------------------------------------------------------

local function selection(name, key, value)
  if value == nil or value == "all" then
    return "all"
  end
  if type(value) == "string" then
    return { id_param(name, key, value) }
  end
  if type(value) ~= "table" or not is_list(value) or #value == 0 then
    fail(name, key .. ' must be "all", an id or a list of ids')
  end
  local out = {}
  for i, item in ipairs(value) do
    out[i] = station_id(name, key, item)
  end
  return out
end

core.effect = construct("effect", {
  type = '"supply"|"demand"',
  stations = '"all"|string|string[]',
  resources = '"all"|string|string[]',
  multiplier = "number",
  start_offset = "duration",
  duration = "duration",
}, { "type", "multiplier" }, function(p, name)
  return {
    type = one_of(name, "type", p.type, { "supply", "demand" }),
    stations = selection(name, "stations", p.stations),
    resources = selection(name, "resources", p.resources),
    multiplierPermille = multiplier(name, "multiplier", p.multiplier),
    startOffsetMs = duration(name, "start_offset", p.start_offset, 0),
    durationMs = duration(name, "duration", p.duration),
  }
end)

core.event = construct("event", {
  id = "string",
  label = "string",
  start = "duration",
  duration = "duration",
  chance_ppm = "integer",
  check_every = "duration",
  effects = "effect[]",
}, { "id", "duration", "effects" }, function(p, name)
  local schedule
  if p.start ~= nil and p.chance_ppm == nil then
    schedule = {
      kind = "fixed",
      startMs = duration(name, "start", p.start),
      durationMs = duration(name, "duration", p.duration),
    }
  elseif p.chance_ppm ~= nil and p.start == nil then
    if p.check_every == nil then
      fail(name, "check_every is needed with chance_ppm")
    end
    schedule = {
      kind = "random",
      probabilityPpm = whole(name, "chance_ppm", p.chance_ppm),
      checkIntervalMs = duration(name, "check_every", p.check_every),
      durationMs = duration(name, "duration", p.duration),
    }
  else
    fail(
      name,
      "needs either start, for a fixed time, or chance_ppm and check_every, for a random event"
    )
  end
  local effects = built_list(name, "effects", p.effects, { "effect" })
  if #effects == 0 then
    fail(name, "effects must list at least one effect")
  end
  return {
    id = id_param(name, "id", p.id),
    label = p.label ~= nil and check_type(name, "label", p.label, "string")
      or p.id,
    schedule = schedule,
    effects = effects,
  }
end)

-- Scenario --------------------------------------------------------------------------------------

local function append(target, items)
  for _, item in ipairs(items or {}) do
    target[#target + 1] = item
  end
end

core.scenario = construct("scenario", {
  id = "string",
  title = "string",
  description = "string",
  docs = "string",
  duration = "duration",
  seed = "integer",
  information = '"local"|"line"',
  sample_interval = "duration",
  resources = "(string|resource)[]|table<string, table>",
  stations = "station[]",
  arcs = "arc[]",
  vehicles = "vehicle[]",
  events = "event[]",
  parts = "table[]",
}, { "id", "duration" }, function(p, name)
  local stations = built_list(name, "stations", p.stations, { "station" })
  local arcs = built_list(name, "arcs", p.arcs, { "arc" })
  local vehicles = built_list(name, "vehicles", p.vehicles, { "vehicle" })
  local events = built_list(name, "events", p.events, { "event" })
  if p.parts ~= nil then
    if type(p.parts) ~= "table" or not is_list(p.parts) then
      fail(
        name,
        "parts must be a list of tables with stations, arcs, vehicles or events"
      )
    end
    for _, part in ipairs(p.parts) do
      append(stations, part.stations)
      append(arcs, part.arcs)
      append(vehicles, part.vehicles)
      append(events, part.events)
    end
  end

  local resources = built_list(
    name,
    "resources",
    p.resources,
    { "resource" },
    function(id)
      return core.resource({ id = id })
    end,
    function(id, params)
      return core.resource(
        with(params_table(name, "resources", id, params), { id = id })
      )
    end
  )
  if p.resources == nil then
    -- Every resource a station stores, in the order stations first store them.
    local seen = {}
    for _, station in ipairs(stations) do
      for _, stored in ipairs(station.resources or {}) do
        if stored.id ~= nil and not seen[stored.id] then
          seen[stored.id] = true
          resources[#resources + 1] = { id = stored.id, priority = 1 }
        end
      end
    end
  end

  local title = p.title ~= nil and check_type(name, "title", p.title, "string")
    or p.id
  return {
    format = 2,
    id = id_param(name, "id", p.id),
    title = title,
    description = p.description ~= nil
        and check_type(name, "description", p.description, "string")
      or title,
    docs = p.docs ~= nil and check_type(name, "docs", p.docs, "string") or nil,
    durationMs = duration(name, "duration", p.duration),
    seed = whole(name, "seed", p.seed, 1),
    informationLevel = one_of(
      name,
      "information",
      p.information,
      { "local", "line" },
      "line"
    ),
    sampleIntervalMs = duration(
      name,
      "sample_interval",
      p.sample_interval,
      HOUR
    ),
    resources = resources,
    stations = stations,
    arcs = arcs,
    vehicles = vehicles,
    events = events,
  }
end)

-- Names starting with __ are for the other libraries and the host, not for scripts.

--- Declares a construct for a pack library, such as mars.line.
core.__construct = construct

--- Parameter types by construct name, for checking the construct descriptions.
function core.__constructs()
  return registry
end

return core
