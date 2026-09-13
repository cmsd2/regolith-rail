/**
 * Lua 5.4 code that runs before any policy in a fresh Lua state. It builds
 * the sandbox, wraps snapshots in read-only tables, enforces the instruction
 * budget and memory rules, and exchanges data with the host: snapshots
 * arrive as Lua table constructors and outcomes leave as JSON.
 *
 * The host sets `__rr_host_rand`, `__rr_host_shuffle` and `__rr_budget`
 * globals first; the prelude captures and removes them and leaves a single
 * global table `__rr` holding its entry points.
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
local function iterate(proxy_or_table)
  local t = raw_of[proxy_or_table] or proxy_or_table
  local keys = sorted_keys(t)
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

local function make_env()
  local env = {
    assert = assert, error = error, ipairs = ipairs, next = sandbox_next, pairs = sandbox_pairs,
    pcall = pcall, xpcall = xpcall, select = select, tonumber = tonumber, tostring = sandbox_tostring,
    type = type, unpack = tunpack, rawequal = rawequal, rawget = rawget, rawset = rawset, rawlen = rawlen,
    setmetatable = setmetatable, getmetatable = getmetatable, print = log,
    math = guarded_copy(math, MATH_BANNED),
    string = sandbox_string,
    table = guarded_copy(table),
    utf8 = guarded_copy(utf8),
    coroutine = guarded_copy(coroutine),
  }
  env._G = env
  return setmetatable(env, {
    __index = function(_, k)
      local message = BANNED[k]
      if message then error(message, 2) end
      return nil
    end,
  })
end

-- Memory ----------------------------------------------------------------------

local memory = { global = {}, stations = {}, trains = {} }
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
  for _, id in ipairs(sorted_keys(memory.trains)) do
    err = check_memory(memory.trains[id], "train memory for " .. id, {})
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

local policy
local function station_lookup(line_raw)
  local index = {}
  for i, s in ipairs(line_raw.stations) do index[s.id] = i end
  return index
end

local function line_functions(line_raw, default_speed)
  local index = station_lookup(line_raw)
  local function position(id, argument)
    local i = type(id) == "string" and index[id]
    if not i then error("unknown station " .. tostring(id) .. " (argument " .. argument .. ")", 3) end
    return i
  end
  local function distance(from, to)
    local a, b = position(from, 1), position(to, 2)
    if a > b then a, b = b, a end
    local d = 0
    for i = a, b - 1 do d = d + line_raw.stations[i].distance_to_next end
    return d
  end
  return {
    distance = distance,
    travel_time = function(from, to, speed)
      speed = speed or default_speed
      if type(speed) ~= "number" or speed <= 0 then error("travel_time needs a positive speed", 2) end
      local d = distance(from, to)
      return (d * 1000 + speed - 1) // speed
    end,
  }
end

local function station_proxy(raw, level, current_id, with_memory)
  local restricted
  if raw.stock == nil and level == "local" and raw.id ~= current_id then
    local message = "reading another station's stock requires the line information level"
    restricted = { stock = message, capacity = sgsub(message, "stock", "capacity") }
  end
  return wrap(raw, restricted, with_memory and { memory = memory_for("stations", raw.id) } or nil)
end

local function line_proxy(line_raw, level, current_id, default_speed)
  local stations = {}
  for i, s in ipairs(line_raw.stations) do
    stations[i] = station_proxy(s, level, current_id, s.id == current_id)
  end
  local list = setmetatable({}, {
    __index = function(_, i) return stations[i] end,
    __newindex = function() error(READ_ONLY, 2) end,
    __len = function() return #stations end,
    __metatable = false,
  })
  raw_of[list] = stations
  local extra = line_functions(line_raw, default_speed)
  extra.stations = list
  return wrap(line_raw, nil, extra)
end

local function check_transfer(name, resource, amount)
  if type(resource) ~= "string" then error(name .. " expects a resource id as its first argument", 3) end
  if type(amount) ~= "number" then error(name .. " expects an amount in milli-units as its second argument", 3) end
end

local hook_functions = {
  rand = function() return host_rand() end,
  load = function(resource, amount)
    check_transfer("ctx.load", resource, amount)
    current.actions[#current.actions + 1] = { type = "load", resource = resource, amount = amount }
  end,
  unload = function(resource, amount)
    check_transfer("ctx.unload", resource, amount)
    current.actions[#current.actions + 1] = { type = "unload", resource = resource, amount = amount }
  end,
  log = log,
  record = function(name, value)
    if type(name) ~= "string" then error("ctx.record expects a series name as its first argument", 2) end
    if type(value) ~= "number" then error("ctx.record expects a number as its second argument", 2) end
    current.records[#current.records + 1] = { name = name, value = value }
  end,
}

local function stop_context(snap)
  local extra = { memory = memory.global, line = line_proxy(snap.line, snap.information_level, snap.station.id, snap.train.speed) }
  for k, f in next, hook_functions do extra[k] = f end
  extra.station = station_proxy(snap.station, snap.information_level, snap.station.id, true)
  extra.train = wrap(snap.train, nil, { memory = memory_for("trains", snap.train.id) })
  return wrap(snap, nil, extra)
end

local function start_context(snap)
  local extra = { memory = memory.global, line = line_proxy(snap.line, snap.information_level, nil, nil) }
  extra.rand, extra.log, extra.record = hook_functions.rand, hook_functions.log, hook_functions.record
  return wrap(snap, nil, extra)
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

function __rr.load(source)
  current = new_outcome()
  local chunk, err = load(source, "=policy", "t", make_env())
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
    current.error = { kind = "load", message = "the policy must return a table with an on_stop function" }
  elseif type(rawget(result, "on_stop")) ~= "function" then
    current.error = { kind = "load", message = "the policy's table has no on_stop function; on_stop is required" }
  else
    policy = result
  end
  return encode(current)
end

-- Snapshots arrive as Lua table constructors, which Lua's own parser loads far
-- faster than decoding JSON in Lua.
local function snapshot(literal)
  return assert(load(literal, "=snapshot", "t", {}))()
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

function __rr.save()
  return "return " .. serialize(memory)
end

function __rr.restore(text)
  local chunk = assert(load(text, "=memory", "t", {}))
  memory = chunk()
end
`;
