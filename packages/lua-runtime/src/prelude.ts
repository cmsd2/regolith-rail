/**
 * Lua 5.4 code that runs before any policy in a fresh Lua state. It builds
 * the sandbox, wraps snapshots in read-only tables, enforces the instruction
 * budget and memory rules, and exchanges data with the host: snapshots
 * arrive as Lua table constructors and outcomes leave as JSON.
 *
 * The host sets `__rr_host_rand`, `__rr_host_shuffle` and `__rr_budget`
 * globals first; the prelude captures and removes them and leaves a single
 * global table `__rr` holding its entry points.
 *
 * The same prelude evaluates scenario scripts: `__rr.evaluate` loads the
 * construct libraries and runs a script with a fixed iteration order.
 */
export const PRELUDE = String.raw`
local host_rand, host_shuffle, BUDGET = __rr_host_rand, __rr_host_shuffle, __rr_budget
__rr_host_rand, __rr_host_shuffle, __rr_budget = nil, nil, nil

local type, next, error, pcall, xpcall, tostring, tonumber, select, assert =
  type, next, error, pcall, xpcall, tostring, tonumber, select, assert
local setmetatable, getmetatable, rawget, rawset, rawequal, rawlen, load =
  setmetatable, getmetatable, rawget, rawset, rawequal, rawlen, load
local sformat, sbyte, sgsub, srep, smatch =
  string.format, string.byte, string.gsub, string.rep, string.match
local tconcat, tsort, tunpack = table.concat, table.sort, table.unpack
local mfloor, mtype, mhuge = math.floor, math.type, math.huge
local getinfo = debug.getinfo

-- JSON encoding for outcomes ---------------------------------------------------

local escapes = { ['"'] = '\\"', ["\\"] = "\\\\", ["\n"] = "\\n", ["\r"] = "\\r", ["\t"] = "\\t" }
local function encode_string(s)
  return '"' .. sgsub(s, '[%c"\\]', function(c)
    return escapes[c] or sformat("\\u%04x", sbyte(c))
  end) .. '"'
end

local function sorted_keys(t)
  local keys = {}
  for k in next, t do keys[#keys + 1] = k end
  tsort(keys, function(a, b)
    local ta, tb = type(a), type(b)
    if ta ~= tb then return ta < tb end
    if ta == "number" or ta == "string" then return a < b end
    return tostring(a) < tostring(b)
  end)
  return keys
end

local encode
function encode(value)
  local tv = type(value)
  if tv == "string" then return encode_string(value) end
  if tv == "number" then
    if mtype(value) == "integer" then return sformat("%d", value) end
    if value ~= value or value == mhuge or value == -mhuge then return "null" end
    return sformat("%.17g", value)
  end
  if tv == "boolean" then return value and "true" or "false" end
  if tv ~= "table" then return "null" end
  local n = rawlen(value)
  local count = 0
  for _ in next, value do count = count + 1 end
  local parts = {}
  if count == n then
    for i = 1, n do parts[i] = encode(value[i]) end
    return "[" .. tconcat(parts, ",") .. "]"
  end
  for _, k in ipairs(sorted_keys(value)) do
    parts[#parts + 1] = encode_string(tostring(k)) .. ":" .. encode(value[k])
  end
  return "{" .. tconcat(parts, ",") .. "}"
end

-- Budget ----------------------------------------------------------------------

local BUDGET_MESSAGE = "instruction budget exceeded; the policy ran too long at this stop"
local budget_left, exhausted = 0, false
local function tick()
  budget_left = budget_left - 1
  if budget_left < 0 then
    exhausted = true
    error(BUDGET_MESSAGE, 2)
  end
end
local function reset_budget() budget_left, exhausted = BUDGET, false end

-- Read-only snapshot tables --------------------------------------------------

local raw_of = setmetatable({}, { __mode = "k" })
local READ_ONLY = "the snapshot is read-only; keep your own data in ctx.memory"

local function sandbox_tostring(v)
  local tv = type(v)
  if tv == "table" or tv == "function" or tv == "thread" or tv == "userdata" then return tv end
  return tostring(v)
end

local wrap
-- Scenario scripts iterate in sorted key order, so they evaluate the same way every time.
local evaluating = false
local function iterate(proxy_or_table)
  local t = raw_of[proxy_or_table] or proxy_or_table
  local keys = sorted_keys(t)
  if evaluating then return keys end
  for i = #keys, 2, -1 do
    local j = mfloor(host_shuffle() * i) + 1
    keys[i], keys[j] = keys[j], keys[i]
  end
  return keys
end

--- wrap(raw, restricted, extra): restricted maps missing keys to error messages;
--- extra adds runtime members such as memory tables and functions.
function wrap(raw, restricted, extra)
  local cache = {}
  local proxy = {}
  raw_of[proxy] = raw
  return setmetatable(proxy, {
    __index = function(_, k)
      if extra then
        local e = extra[k]
        if e ~= nil then return e end
      end
      local v = raw[k]
      if v == nil and restricted and restricted[k] then error(restricted[k], 2) end
      if type(v) == "table" then
        local p = cache[k]
        if not p then p = wrap(v) cache[k] = p end
        return p
      end
      return v
    end,
    __newindex = function() error(READ_ONLY, 2) end,
    __len = function() return #raw end,
    __metatable = false,
  })
end

local orders = setmetatable({}, { __mode = "k" })
local function sandbox_next(t, k)
  local order = orders[t]
  if k == nil or not order then
    local keys = iterate(t)
    local index = {}
    for i, key in ipairs(keys) do index[key] = i end
    order = { keys = keys, index = index }
    orders[t] = order
    if k == nil then
      local first = keys[1]
      if first == nil then return nil end
      return first, t[first]
    end
  end
  local i = order.index[k]
  if not i then error("the table changed while it was being traversed", 2) end
  local key = order.keys[i + 1]
  if key == nil then return nil end
  return key, t[key]
end

local function sandbox_pairs(t)
  if type(t) ~= "table" then error("bad argument to pairs (table expected, got " .. type(t) .. ")", 2) end
  local keys = iterate(t)
  local i = 0
  return function()
    i = i + 1
    local key = keys[i]
    if key == nil then return nil end
    return key, t[key]
  end, t, nil
end

-- Sandbox environment ---------------------------------------------------------

local BANNED = {
  io = "io is not available to policies",
  os = "os is not available to policies; use ctx.now for the time",
  debug = "debug is not available to policies",
  package = "package is not available to policies",
  require = "require is not available to policies; building blocks are already available as ops",
  load = "load is not available to policies",
  loadstring = "loadstring is not available to policies",
  dofile = "dofile is not available to policies",
  loadfile = "loadfile is not available to policies",
  collectgarbage = "collectgarbage is not available to policies",
  setfenv = "setfenv is not available to policies",
  getfenv = "getfenv is not available to policies",
}
local MATH_BANNED = {
  random = "math.random is not available to policies; use ctx.rand(), which repeats for the same seed",
  randomseed = "math.randomseed is not available to policies; use ctx.rand(), which repeats for the same seed",
}
local MAX_STRING = 1000000

local function guarded_copy(source, banned, label)
  local copy = {}
  for k, v in next, source do
    if not (banned and banned[k]) then copy[k] = v end
  end
  return setmetatable(copy, {
    __index = function(_, k)
      if banned and banned[k] then error(banned[k], 2) end
      return nil
    end,
    __metatable = false,
  })
end

local sandbox_string = guarded_copy(string, { dump = "string.dump is not available to policies" })
rawset(sandbox_string, "rep", function(s, n, sep)
  local len = #tostring(s) * (tonumber(n) or 0) + (sep and #tostring(sep) * ((tonumber(n) or 1) - 1) or 0)
  if len > MAX_STRING then error("string.rep result would be longer than " .. MAX_STRING .. " bytes", 2) end
  return srep(s, n, sep)
end)
-- Method calls on strings use the string metatable; point it at the sandbox copy.
getmetatable("").__index = sandbox_string

local current -- outcome being built by the current hook call

local function log(...)
  local n = select("#", ...)
  local parts = {}
  for i = 1, n do parts[i] = sandbox_tostring((select(i, ...))) end
  current.logs[#current.logs + 1] = tconcat(parts, " ")
end

local SCRIPT_MATH_BANNED = {
  random = "math.random is not available to scenario scripts; scenario randomness belongs in demand and event processes, such as poisson, discrete or random events",
  randomseed = "math.randomseed is not available to scenario scripts; scenario randomness belongs in demand and event processes, such as poisson, discrete or random events",
}
local SCRIPT_BANNED = {}
for k, message in next, BANNED do
  SCRIPT_BANNED[k] = (sgsub(sgsub(message, "; use ctx%.now for the time", ""), "to policies", "to scenario scripts"))
end

--- A sandbox environment, with errors worded for scenario scripts when for_scripts is set.
local function make_env(for_scripts)
  local banned = for_scripts and SCRIPT_BANNED or BANNED
  local env = {
    assert = assert, error = error, ipairs = ipairs, next = sandbox_next, pairs = sandbox_pairs,
    pcall = pcall, xpcall = xpcall, select = select, tonumber = tonumber, tostring = sandbox_tostring,
    type = type, unpack = tunpack, rawequal = rawequal, rawget = rawget, rawset = rawset, rawlen = rawlen,
    setmetatable = setmetatable, getmetatable = getmetatable, print = log,
    math = guarded_copy(math, for_scripts and SCRIPT_MATH_BANNED or MATH_BANNED),
    string = sandbox_string,
    table = guarded_copy(table),
    utf8 = guarded_copy(utf8),
    coroutine = guarded_copy(coroutine),
  }
  env._G = env
  return setmetatable(env, {
    __index = function(_, k)
      local message = banned[k]
      if message then error(message, 2) end
      return nil
    end,
  })
end

-- Memory ----------------------------------------------------------------------

local memory = { global = {}, stations = {}, vehicles = {} }
local function memory_for(group, id)
  local t = memory[group][id]
  if not t then t = {} memory[group][id] = t end
  return t
end

local function check_memory(value, path, visiting)
  local tv = type(value)
  if tv == "boolean" or tv == "number" or tv == "string" then return nil end
  if tv ~= "table" then return path .. " holds a " .. tv end
  if raw_of[value] then return path .. " holds part of the snapshot; copy the values you need" end
  if visiting[value] then return path .. " contains a cycle" end
  if getmetatable(value) ~= nil then return path .. " has a metatable" end
  visiting[value] = true
  for _, k in ipairs(sorted_keys(value)) do
    local tk = type(k)
    if tk ~= "string" and tk ~= "number" then return path .. " has a " .. tk .. " key" end
    local err = check_memory(value[k], path .. "." .. tostring(k), visiting)
    if err then return err end
  end
  visiting[value] = nil
  return nil
end

local function check_all_memory()
  local err = check_memory(memory.global, "ctx.memory", {})
  if err then return err end
  for _, id in ipairs(sorted_keys(memory.stations)) do
    err = check_memory(memory.stations[id], "station memory for " .. id, {})
    if err then return err end
  end
  for _, id in ipairs(sorted_keys(memory.vehicles)) do
    err = check_memory(memory.vehicles[id], "vehicle memory for " .. id, {})
    if err then return err end
  end
  return nil
end

local function serialize(value)
  local tv = type(value)
  if tv == "string" then return sformat("%q", value) end
  if tv == "number" then
    if mtype(value) == "integer" then return sformat("%d", value) end
    if value ~= value then return "(0/0)" end
    if value == mhuge then return "(1/0)" end
    if value == -mhuge then return "(-1/0)" end
    return sformat("%.17g", value)
  end
  if tv == "boolean" then return tostring(value) end
  local parts = {}
  for _, k in ipairs(sorted_keys(value)) do
    parts[#parts + 1] = "[" .. serialize(k) .. "]=" .. serialize(value[k])
  end
  return "{" .. tconcat(parts, ",") .. "}"
end

-- Outcomes ----------------------------------------------------------------------

local function new_outcome()
  return { actions = {}, logs = {}, records = {}, traces = {} }
end

local function set_error(kind, err)
  if type(err) ~= "string" then
    current.error = { kind = kind, message = "the policy raised an error value that is not a string (" .. type(err) .. ")" }
    return
  end
  local line, message = smatch(err, "^policy:(%d+): (.*)$")
  if line then
    current.error = { kind = kind, message = message, line = tonumber(line) }
  else
    current.error = { kind = kind, message = (sgsub(err, "^[%w_]+:%d+: ", "")) }
  end
end

-- Context ----------------------------------------------------------------------
--
-- The host sends the layout of the scenario once per Lua state, then only what
-- changes with each call. Stations are built once as linked read-only tables;
-- their stock, capacity, backorders and orders read from the current call.

local policy
local layout -- static scenario layout from __rr.layout
local level
local quantities = {} -- station id -> this call's quantities, when visible
local wrapped_quantities = {} -- station id -> read-only proxy of those quantities
local station_proxies = {} -- station id -> linked station table
local station_keys = {} -- station id -> { hidden = keys without quantities, shown = keys with }

local LEVEL_MESSAGES = {
  stock = "reading another station's stock requires the line information level",
  capacity = "reading another station's capacity requires the line information level",
  backorders = "reading another station's backorders requires the line information level",
  on_order = "reading another station's orders requires the line information level",
}

local function readonly(items, raw)
  local proxy = setmetatable({}, {
    __index = function(_, k) return items[k] end,
    __newindex = function() error(READ_ONLY, 2) end,
    __len = function() return #items end,
    __metatable = false,
  })
  raw_of[proxy] = raw or items
  return proxy
end

local function build_stations()
  station_proxies, station_keys = {}, {}
  local neighbour_lists = {}
  for _, raw in ipairs(layout.stations) do
    local id = raw.id
    local static = {
      id = id, index = raw.index, resources = wrap(raw.resources), suppliers = wrap(raw.suppliers),
    }
    local hidden = { id = true, index = true, resources = true, neighbours = true, suppliers = true }
    local shown = { stock = true, capacity = true, backorders = true, on_order = true }
    for k in next, hidden do shown[k] = true end
    station_keys[id] = { hidden = hidden, shown = shown }
    local proxy = {}
    setmetatable(proxy, {
      __index = function(_, k)
        local message = LEVEL_MESSAGES[k]
        if message then
          local q = wrapped_quantities[id]
          if q then return q[k] end
          if level == "local" then error(message, 2) end
          return nil
        end
        if k == "neighbours" then return neighbour_lists[id] end
        if k == "memory" then return memory_for("stations", id) end
        return static[k]
      end,
      __newindex = function() error(READ_ONLY, 2) end,
      __metatable = false,
    })
    raw_of[proxy] = hidden
    station_proxies[id] = proxy
  end
  for _, raw in ipairs(layout.stations) do
    local items = {}
    for i, n in ipairs(raw.neighbours) do
      items[i] = wrap(n, nil, { station = station_proxies[n.station] })
    end
    neighbour_lists[raw.id] = readonly(items)
  end
  layout.stations_proxy = readonly(station_proxies)
end

--- Takes this call's quantities; stations without an entry are hidden from the policy.
local function set_quantities(q)
  quantities, wrapped_quantities = q or {}, {}
  for id, proxy in next, station_proxies do
    local entry = quantities[id]
    if entry then wrapped_quantities[id] = wrap(entry) end
    raw_of[proxy] = entry and station_keys[id].shown or station_keys[id].hidden
  end
end

local function station_position(id, argument)
  if type(id) ~= "string" or not station_proxies[id] then
    error("unknown station " .. tostring(id) .. " (argument " .. argument .. ")", 3)
  end
end

-- Shortest paths over arcs, found once per source station.
local paths = {}
local function shortest_from(source)
  local found = paths[source]
  if found then return found end
  local neighbours = {}
  for _, s in ipairs(layout.stations) do neighbours[s.id] = s.neighbours end
  local dist, prev, done = { [source] = 0 }, {}, {}
  while true do
    local best
    for _, s in ipairs(layout.stations) do
      local d = dist[s.id]
      if d and not done[s.id] and (best == nil or d < dist[best]) then best = s.id end
    end
    if best == nil then break end
    done[best] = true
    for _, n in ipairs(neighbours[best]) do
      local d = dist[best] + n.distance
      if dist[n.station] == nil or d < dist[n.station] then
        dist[n.station], prev[n.station] = d, { from = best, distance = n.distance }
      end
    end
  end
  found = { dist = dist, prev = prev }
  paths[source] = found
  return found
end

local default_speed
local function distance(from, to)
  station_position(from, 1)
  station_position(to, 2)
  return shortest_from(from).dist[to]
end

local function travel_time(from, to, speed)
  station_position(from, 1)
  station_position(to, 2)
  speed = speed or default_speed
  if type(speed) ~= "number" or speed <= 0 then error("travel_time needs a positive speed", 2) end
  local found = shortest_from(from)
  if found.dist[to] == nil then return nil end
  -- Vehicles take whole milliseconds per arc, so sum the arcs as they would.
  local total, at = 0, to
  while at ~= from do
    local step = found.prev[at]
    total = total + (step.distance * 1000 + speed - 1) // speed
    at = step.from
  end
  return total
end

local function check_transfer(name, resource, amount)
  if type(resource) ~= "string" then error(name .. " expects a resource id as its first argument", 3) end
  if type(amount) ~= "number" then error(name .. " expects an amount in milli-units as its second argument", 3) end
end

local shared_functions = {
  rand = function() return host_rand() end,
  distance = distance,
  travel_time = travel_time,
  log = log,
  record = function(name, value)
    if type(name) ~= "string" then error("ctx.record expects a series name as its first argument", 2) end
    if type(value) ~= "number" then error("ctx.record expects a number as its second argument", 2) end
    current.records[#current.records + 1] = { name = name, value = value }
  end,
}

local stop_functions = {
  load = function(resource, amount)
    check_transfer("ctx.load", resource, amount)
    current.actions[#current.actions + 1] = { type = "load", resource = resource, amount = amount }
  end,
  unload = function(resource, amount)
    check_transfer("ctx.unload", resource, amount)
    current.actions[#current.actions + 1] = { type = "unload", resource = resource, amount = amount }
  end,
}

local review_functions = {
  order = function(resource, amount)
    check_transfer("ctx.order", resource, amount)
    current.actions[#current.actions + 1] = { type = "order", resource = resource, amount = amount }
  end,
}

--- The context for one call: shared members, then the hook's own.
local function context(call, own_functions, own_members)
  set_quantities(call.quantities)
  local raw = { now = call.now, information_level = level }
  local extra = {
    stations = layout.stations_proxy,
    station_order = layout.station_order_proxy,
    resources = layout.resources_proxy,
    resource_order = layout.resource_order_proxy,
    memory = memory.global,
  }
  for k in next, extra do raw[k] = true end
  for k, f in next, shared_functions do extra[k] = f end
  for k, f in next, own_functions do extra[k] = f end
  for k, v in next, own_members do
    raw[k] = type(v) == "table" and true or v
    if type(v) == "table" then extra[k] = v end
  end
  return wrap(raw, nil, extra)
end

local function stop_context(call)
  local v = call.vehicle
  default_speed = v.speed
  local ahead = {}
  for i, stop in ipairs(v.route.ahead) do
    ahead[i] = wrap(stop, nil, { station = station_proxies[stop.station] })
  end
  local route = wrap(v.route, nil, { ahead = readonly(ahead, v.route.ahead) })
  local vehicle = wrap(v, nil, { route = route, memory = memory_for("vehicles", v.id) })
  return context(call, stop_functions, {
    stop = call.stop, here = station_proxies[call.here], vehicle = vehicle,
  })
end

local function review_context(call)
  default_speed = nil
  return context(call, review_functions, { review = call.review, here = station_proxies[call.here] })
end

local function start_context(call)
  default_speed = nil
  return context(call, {}, { vehicles = layout.vehicles_proxy })
end

local function call_hook(fn, ctx)
  reset_budget()
  local ok, err = pcall(fn, ctx)
  if exhausted then
    set_error("budget", ok and BUDGET_MESSAGE or err)
  elseif not ok then
    set_error("runtime", err)
  else
    local merr = check_all_memory()
    if merr then
      current.error = { kind = "memory", message = "memory may hold only booleans, numbers, strings and tables of those: " .. merr }
    end
  end
end

-- Entry points -----------------------------------------------------------------

__rr = {}

local function record_trace(block, station, resource, inputs, result)
  current.traces[#current.traces + 1] = {
    block = block, station = station, resource = resource, inputs = inputs, result = result,
  }
end

--- Loads the ops library and then the policy, which sees the library as the global ops.
function __rr.load(source, ops_source, information_level, needs_stop, needs_review)
  current = new_outcome()
  level = information_level
  local ops_chunk = assert(load(ops_source, "=ops", "t", make_env()))
  reset_budget()
  local ops_ok, ops = pcall(ops_chunk, tick, record_trace, level)
  if not ops_ok then error("the ops library failed to load: " .. tostring(ops)) end

  local env = make_env()
  rawset(env, "ops", ops)
  local chunk, err = load(source, "=policy", "t", env)
  if not chunk then
    set_error("load", err)
    return encode(current)
  end
  reset_budget()
  local ok, result = pcall(chunk, tick)
  if exhausted then
    set_error("load", ok and BUDGET_MESSAGE or result)
  elseif not ok then
    set_error("load", result)
  elseif type(result) ~= "table" then
    current.error = { kind = "load", message = "the policy must return a table of hook functions, such as on_stop" }
  elseif needs_stop and type(rawget(result, "on_stop")) ~= "function" then
    current.error = { kind = "load", message = "the policy's table has no on_stop function; on_stop is required" }
  elseif needs_review and type(rawget(result, "on_review")) ~= "function" then
    current.error = { kind = "load", message = "the policy's table has no on_review function; on_review is required" }
  elseif type(rawget(result, "on_stop")) ~= "function"
    and type(rawget(result, "on_review")) ~= "function"
    and type(rawget(result, "on_start")) ~= "function" then
    current.error = { kind = "load", message = "the policy's table has no hook functions; define on_stop, on_review or on_start" }
  else
    policy = result
  end
  return encode(current)
end

-- Data arrives as Lua table constructors, which Lua's own parser loads far
-- faster than decoding JSON in Lua.
local function snapshot(literal)
  return assert(load(literal, "=snapshot", "t", {}))()
end

--- Takes the scenario's layout, which does not change during a run.
function __rr.layout(literal)
  layout = snapshot(literal)
  paths = {}
  layout.station_order_proxy = wrap(layout.station_order)
  layout.resource_order_proxy = wrap(layout.resource_order)
  layout.resources_proxy = wrap(layout.resources)
  layout.vehicles_proxy = wrap(layout.vehicles)
  build_stations()
end

function __rr.start(literal)
  current = new_outcome()
  local on_start = rawget(policy, "on_start")
  if type(on_start) == "function" then call_hook(on_start, start_context(snapshot(literal))) end
  return encode(current)
end

function __rr.stop(literal)
  current = new_outcome()
  call_hook(policy.on_stop, stop_context(snapshot(literal)))
  return encode(current)
end

function __rr.review(literal)
  current = new_outcome()
  call_hook(policy.on_review, review_context(snapshot(literal)))
  return encode(current)
end

--- Names of the hook functions the loaded policy defines.
function __rr.hooks()
  local names = {}
  if policy then
    for _, name in ipairs({ "on_start", "on_stop", "on_review" }) do
      if type(rawget(policy, name)) == "function" then names[#names + 1] = name end
    end
  end
  return encode(names)
end

-- Scenario scripts -------------------------------------------------------------

local SCRIPT_BUDGET_MESSAGE = "instruction budget exceeded; the scenario script ran too long"
local MAX_DOCUMENT_VALUES = 500000

local origins = setmetatable({}, { __mode = "k" })
local kinds = setmetatable({}, { __mode = "k" })

--- The current line of the innermost scenario script frame on the stack.
local function script_line()
  local level = 2
  while true do
    local info = getinfo(level, "Sl")
    if not info then return nil end
    if info.source == "=scenario" then return info.currentline end
    level = level + 1
  end
end

-- What the construct libraries may use beyond the sandbox.
local kit = {
  caller_line = script_line,
  -- The first construct to mark a table names it, so a pack construct that returns a
  -- core construct's result keeps the core kind.
  mark = function(t, kind, line)
    if type(t) == "table" then
      if kinds[t] == nil then kinds[t] = kind end
      if line and origins[t] == nil then origins[t] = line end
    end
    return t
  end,
  kind_of = function(t)
    if type(t) ~= "table" then return nil end
    return kinds[t]
  end,
}

local function document_path(path) return path == "" and "(document)" or path end

--- The script line that built each table in the document, by document path. Also
--- rejects documents that contain themselves or are too large.
local function source_map(document)
  local map, count, visiting = {}, 0, {}
  local function walk(value, path)
    count = count + 1
    if count > MAX_DOCUMENT_VALUES then
      error("the scenario has more than " .. MAX_DOCUMENT_VALUES .. " values, the size limit", 0)
    end
    if type(value) ~= "table" then return end
    if visiting[value] then error("the scenario contains itself at " .. document_path(path), 0) end
    visiting[value] = true
    local line = origins[value]
    if line then map[document_path(path)] = line end
    local n, total = rawlen(value), 0
    for _ in next, value do total = total + 1 end
    if total == n then
      for i = 1, n do walk(rawget(value, i), path .. "[" .. (i - 1) .. "]") end
    else
      for _, k in ipairs(sorted_keys(value)) do
        local key = tostring(k)
        walk(rawget(value, k), path == "" and key or path .. "." .. key)
      end
    end
    visiting[value] = nil
  end
  walk(document, "")
  return map
end

--- Evaluates a scenario script with the construct libraries. Returns JSON with the
--- document and its source map, or an error with the script line it happened at.
function __rr.evaluate(script, core_source, mars_source, classic_source)
  evaluating = true
  current = new_outcome()
  local library_env = make_env(true)
  local function library(name, source, ...)
    local chunk = assert(load(source, "=" .. name, "t", library_env))
    reset_budget()
    local ok, lib = pcall(chunk, tick, kit, ...)
    if not ok or type(lib) ~= "table" then
      error("the " .. name .. " library failed to load: " .. tostring(lib))
    end
    return lib
  end

  local core = library("core", core_source)
  local exports = {}
  for k, v in next, core do
    if type(k) == "string" and not smatch(k, "^__") then exports[k] = v end
  end
  for k, v in next, exports do rawset(library_env, k, v) end
  local mars = library("mars", mars_source, core)
  rawset(library_env, "mars", mars)
  local classic = library("classic", classic_source, core)

  local env = make_env(true)
  for k, v in next, exports do rawset(env, k, v) end
  rawset(env, "mars", mars)
  rawset(env, "classic", classic)

  local function result(fields)
    fields.logs = current.logs
    return encode(fields)
  end

  local chunk, err = load(script, "=scenario", "t", env)
  if not chunk then
    local line, message = smatch(err, "^scenario:(%d+): (.*)$")
    return result({ error = { message = message or err, line = tonumber(line) } })
  end

  reset_budget()
  local failure
  local ok, document = xpcall(chunk, function(e)
    local message
    if exhausted then
      message = SCRIPT_BUDGET_MESSAGE
    elseif type(e) ~= "string" then
      message = "the script raised an error value that is not a string (" .. type(e) .. ")"
    else
      message = (sgsub(e, "^[%w_]+:%d+: ", ""))
    end
    failure = { message = message, line = script_line() }
    return failure
  end, tick)
  if not ok then return result({ error = failure }) end
  if type(document) ~= "table" then
    return result({ error = { message = "the script must return a scenario, such as return scenario { ... }" } })
  end
  local mapped, map = pcall(source_map, document)
  if not mapped then return result({ error = { message = tostring(map) } }) end
  return result({ document = document, sourceMap = map })
end

--- Parameter types of every construct the libraries declare, as JSON.
function __rr.constructs(core_source, mars_source, classic_source)
  evaluating = true
  reset_budget()
  local library_env = make_env(true)
  local core = assert(load(core_source, "=core", "t", library_env))(tick, kit)
  for k, v in next, core do
    if type(k) == "string" and not smatch(k, "^__") then rawset(library_env, k, v) end
  end
  local mars = assert(load(mars_source, "=mars", "t", library_env))(tick, kit, core)
  rawset(library_env, "mars", mars)
  local classic = assert(load(classic_source, "=classic", "t", library_env))(tick, kit, core)
  local functions = {}
  for name, lib in next, { [""] = core, ["mars."] = mars, ["classic."] = classic } do
    for k, v in next, lib do
      if type(v) == "function" and not smatch(k, "^__") then functions[#functions + 1] = name .. k end
    end
  end
  return encode({ constructs = core.__constructs(), functions = functions })
end

function __rr.save()
  return "return " .. serialize(memory)
end

function __rr.restore(text)
  local chunk = assert(load(text, "=memory", "t", {}))
  memory = chunk()
end
`;
