-- ops: operations research building blocks for dispatch policies.
--
-- A declarative policy runs these stages at every stop:
--   classify -> target -> plan -> allocate -> execute
-- Each stage takes a block from this library or a Lua function. The library is
-- written to the same Lua 5.1 subset as policies and counts towards the same
-- instruction budget. Its state lives in ctx.memory.ops.
--
-- The host passes, after the budget check the instrumentation consumes:
--   trace(block, station, resource, inputs, result)  records a decision trace
--   level                                              the scenario's information level

local _, trace, scenario_level = ...

local ops = {}
local LEVELS = { ["local"] = 1, line = 2 }
local ROLES = { supply = true, demand = true, relay = true, any = true }

-- Blocks -----------------------------------------------------------------------

local function check_params(name, params, allowed)
  if params == nil then
    params = {}
  end
  if type(params) ~= "table" then
    error("ops." .. name .. " expects a table of parameters, such as ops." .. name .. " {}", 3)
  end
  for key, value in pairs(params) do
    local kind = allowed[key]
    if not kind then
      error("ops." .. name .. " has no parameter named " .. tostring(key), 3)
    end
    if type(value) ~= kind then
      error("ops." .. name .. " parameter " .. key .. " must be a " .. kind, 3)
    end
  end
  return params
end

local function require_param(name, params, key)
  if params[key] == nil then
    error("ops." .. name .. " needs the parameter " .. key, 3)
  end
end

local function new_block(stage, name, level, params, decide)
  return { ops_block = true, stage = stage, name = name, level = level, params = params, decide = decide }
end

local function is_block(value, stage)
  return type(value) == "table" and value.ops_block == true and value.stage == stage
end

-- Classify ------------------------------------------------------------------------

ops.roles = {}

--- Assigns roles by station, for every resource or per resource:
--- ops.roles.manual { Mine = "supply", Dome = { Metals = "demand", Food = "relay" } }
function ops.roles.manual(assignments)
  if type(assignments) ~= "table" then
    error("ops.roles.manual expects a table of roles by station", 2)
  end
  for station, role in pairs(assignments) do
    if type(role) == "table" then
      for resource, r in pairs(role) do
        if not ROLES[r] then
          error("ops.roles.manual: " .. tostring(r) .. " for " .. station .. " " .. resource .. " is not a role", 2)
        end
      end
    elseif not ROLES[role] then
      error("ops.roles.manual: " .. tostring(role) .. " for " .. station .. " is not a role", 2)
    end
  end
  local block = new_block("classify", "roles.manual", "local", { assignments = assignments }, function(site)
    local role = assignments[site.station]
    if type(role) == "table" then
      role = role[site.resource]
    end
    role = role or "any"
    trace("roles.manual", site.station, site.resource, {}, role)
    return role
  end)
  block.assignments = assignments
  return block
end

-- Target ---------------------------------------------------------------------------

function ops.balance(params)
  check_params("balance", params, {})
  return new_block("target", "balance", "line", {}, function(site, view)
    local total, count = 0, 0
    for _, station in ipairs(view.stations) do
      local stock = station.stock[site.resource]
      if stock ~= nil then
        total = total + stock
        count = count + 1
      end
    end
    local target = math.floor(total / count)
    trace("balance", site.station, site.resource, { total = total, stations = count }, target)
    return target
  end)
end

function ops.order_up_to(params)
  params = check_params("order_up_to", params, { level = "number" })
  require_param("order_up_to", params, "level")
  return new_block("target", "order_up_to", "local", params, function(site)
    trace("order_up_to", site.station, site.resource, { position = site.position, level = params.level }, params.level)
    return params.level
  end)
end

function ops.min_max(params)
  params = check_params("min_max", params, { min = "number", max = "number" })
  require_param("min_max", params, "min")
  require_param("min_max", params, "max")
  if params.min > params.max then
    error("ops.min_max: min must not be greater than max", 2)
  end
  return new_block("target", "min_max", "local", params, function(site)
    local target = nil
    if site.position < params.min then
      target = params.max
    end
    trace(
      "min_max",
      site.station,
      site.resource,
      { position = site.position, min = params.min, max = params.max },
      target or "no change"
    )
    return target
  end)
end

function ops.drain(params)
  check_params("drain", params, {})
  return new_block("target", "drain", "local", {}, function(site)
    trace("drain", site.station, site.resource, { stock = site.stock }, 0)
    return 0
  end)
end

function ops.fill(params)
  check_params("fill", params, {})
  return new_block("target", "fill", "local", {}, function(site)
    trace("fill", site.station, site.resource, { capacity = site.capacity }, site.capacity)
    return site.capacity
  end)
end

function ops.pass_through(params)
  check_params("pass_through", params, {})
  return new_block("target", "pass_through", "local", {}, function(site)
    trace("pass_through", site.station, site.resource, {}, "no change")
    return nil
  end)
end

-- Plan -------------------------------------------------------------------------------

function ops.lookahead(params)
  check_params("lookahead", params, {})
  return new_block("plan", "lookahead", "line", {}, "lookahead")
end

-- Allocate ---------------------------------------------------------------------------

local function by_priority(requests, priority, order)
  table.sort(requests, function(a, b)
    local pa, pb = priority[a.resource] or 0, priority[b.resource] or 0
    if pa ~= pb then
      return pa > pb
    end
    return order[a.resource] < order[b.resource]
  end)
  return requests
end

function ops.priority(params)
  check_params("priority", params, {})
  return new_block("allocate", "priority", "local", {}, function(requests, space, priority, order)
    local granted = {}
    by_priority(requests, priority, order)
    for _, request in ipairs(requests) do
      local amount = math.min(request.amount, space)
      granted[request.resource] = amount
      space = space - amount
      trace("priority", request.station, request.resource, { requested = request.amount }, amount)
    end
    return granted
  end)
end

function ops.proportional(params)
  check_params("proportional", params, {})
  return new_block("allocate", "proportional", "local", {}, function(requests, space, priority, order)
    local granted, total = {}, 0
    for _, request in ipairs(requests) do
      total = total + request.amount
    end
    if total <= space then
      for _, request in ipairs(requests) do
        granted[request.resource] = request.amount
      end
    else
      local given = 0
      for _, request in ipairs(requests) do
        local share = math.floor(space * request.amount / total)
        granted[request.resource] = share
        given = given + share
      end
      local left = space - given
      by_priority(requests, priority, order)
      for _, request in ipairs(requests) do
        local extra = math.min(left, request.amount - granted[request.resource])
        granted[request.resource] = granted[request.resource] + extra
        left = left - extra
      end
    end
    for _, request in ipairs(requests) do
      trace(
        "proportional",
        request.station,
        request.resource,
        { requested = request.amount, space = space },
        granted[request.resource]
      )
    end
    return granted
  end)
end

-- Pipeline ---------------------------------------------------------------------------

local function stage_error(stage, err)
  if type(err) ~= "string" then
    error("in the " .. stage .. " stage: the function raised a " .. type(err), 0)
  end
  local line, message = string.match(err, "^policy:(%d+): (.*)$")
  if line then
    error("policy:" .. line .. ": in the " .. stage .. " stage: " .. message, 0)
  end
  error("in the " .. stage .. " stage: " .. err, 0)
end

local function call_custom(stage, fn, ...)
  local results = { pcall(fn, ...) }
  if not results[1] then
    stage_error(stage, results[2])
  end
  return results[2]
end

local function memory_of(ctx)
  local state = ctx.memory.ops
  if state == nil then
    state = { reservations = {} }
    ctx.memory.ops = state
  end
  return state
end

--- Amount of a resource other trains have reserved for a station.
local function inbound(state, train_id, station_id, resource)
  local total = 0
  for other, by_station in pairs(state.reservations) do
    if other ~= train_id then
      local by_resource = by_station[station_id]
      if by_resource and by_resource[resource] then
        total = total + by_resource[resource]
      end
    end
  end
  return total
end

--- Exposed for custom code: stock plus cargo reserved for the site by other trains.
function ops.inventory_position(ctx, station_id, resource)
  local state = memory_of(ctx)
  for _, station in ipairs(ctx.line.stations) do
    if station.id == station_id then
      return (station.stock[resource] or 0) + inbound(state, ctx.train.id, station_id, resource)
    end
  end
  error("ops.inventory_position: unknown station " .. tostring(station_id), 2)
end

local function validate_spec(spec)
  if type(spec) ~= "table" then
    error("ops.policy expects a table, such as ops.policy { target = ops.balance {} }", 3)
  end
  for key in pairs(spec) do
    if key ~= "classify" and key ~= "target" and key ~= "plan" and key ~= "allocate" then
      error("ops.policy has no stage named " .. tostring(key), 3)
    end
  end
  if spec.target == nil then
    error("ops.policy: target is required", 3)
  end

  local blocks = {}
  local function stage(name, value)
    if value == nil or type(value) == "function" then
      return
    end
    if not is_block(value, name) then
      error("ops.policy: " .. name .. " must be an ops " .. name .. " block or a function", 3)
    end
    blocks[#blocks + 1] = value
  end
  stage("classify", spec.classify)
  stage("plan", spec.plan)
  stage("allocate", spec.allocate)
  if type(spec.target) == "table" and not spec.target.ops_block then
    for role, value in pairs(spec.target) do
      if not ROLES[role] then
        error("ops.policy: target has an entry for " .. tostring(role) .. ", which is not a role", 3)
      end
      stage("target", value)
    end
    if is_block(spec.classify, "classify") and spec.classify.assignments then
      for station, role in pairs(spec.classify.assignments) do
        local roles = type(role) == "table" and role or { role }
        for _, r in pairs(roles) do
          if r ~= "any" and spec.target[r] == nil then
            error("ops.policy: " .. station .. " has the role " .. r .. " but target has no " .. r .. " entry", 3)
          end
        end
      end
    end
  else
    stage("target", spec.target)
  end

  for _, block in ipairs(blocks) do
    if LEVELS[block.level] > LEVELS[scenario_level] then
      error(
        "ops."
          .. block.name
          .. " needs the "
          .. block.level
          .. " information level, but this scenario provides "
          .. scenario_level,
        3
      )
    end
  end
end

function ops.policy(spec)
  validate_spec(spec)

  local function role_of(site, ctx)
    if spec.classify == nil then
      return "any"
    elseif type(spec.classify) == "function" then
      local role = call_custom("classify", spec.classify, site, ctx)
      if not ROLES[role] then
        error("in the classify stage: " .. tostring(role) .. " is not a role", 0)
      end
      return role
    end
    return spec.classify.decide(site, ctx)
  end

  local function target_of(site, ctx, view)
    local chosen = spec.target
    if type(chosen) == "table" and not chosen.ops_block then
      chosen = chosen[site.role]
      if chosen == nil then
        return nil
      end
    end
    local target
    if type(chosen) == "function" then
      target = call_custom("target", chosen, site, ctx)
      if target ~= nil and type(target) ~= "number" then
        error("in the target stage: the function returned a " .. type(target) .. " instead of a number", 0)
      end
    else
      target = chosen.decide(site, view)
    end
    if target == nil then
      return nil
    end
    return math.floor(target)
  end

  local function site_for(ctx, state, station, resource)
    local stock = station.stock[resource]
    local site = {
      station = station.id,
      resource = resource,
      stock = stock,
      capacity = station.capacity[resource],
      position = stock + inbound(state, ctx.train.id, station.id, resource),
    }
    site.role = role_of(site, ctx)
    return site
  end

  local policy = {}

  function policy.on_stop(ctx)
    local state = memory_of(ctx)
    local train = ctx.train
    local here = ctx.station
    -- This train's reservations are rebuilt from its cargo at every stop, which
    -- also releases whatever it had reserved for this station.
    local mine = {}
    state.reservations[train.id] = mine

    local view = { stations = {} }
    if scenario_level == "line" then
      for i, station in ipairs(ctx.line.stations) do
        view.stations[i] = station
      end
    end

    -- Classify and target every site at this station.
    local wants = {}
    for _, resource in ipairs(here.resources) do
      local site = site_for(ctx, state, here, resource)
      local target = target_of(site, ctx, view)
      if target ~= nil then
        wants[#wants + 1] = { resource = resource, station = here.id, amount = target - site.position }
      end
    end

    -- Plan: shortfalls further along the line, nearest first.
    local downstream = {}
    local lookahead = spec.plan ~= nil
    if lookahead then
      local stations = ctx.line.stations
      local step = train.direction == "forward" and 1 or -1
      local i = here.index + step
      while i >= 1 and i <= #stations do
        local station = stations[i]
        for _, resource in ipairs(station.resources) do
          local site = site_for(ctx, state, station, resource)
          local target = target_of(site, ctx, view)
          local room = site.capacity - site.position
          if target ~= nil and target > site.position and room > 0 then
            local amount = math.min(target - site.position, room)
            downstream[#downstream + 1] = { station = station.id, resource = resource, amount = amount }
          end
        end
        i = i + step
      end
    end

    local function downstream_need(resource)
      local total = 0
      for _, need in ipairs(downstream) do
        if need.resource == resource then
          total = total + need.amount
        end
      end
      return total
    end

    -- Turn wants into unloads and load requests. Without a plan or allocation
    -- block the amounts are left as wanted and the engine clamps them, exactly
    -- as the naive baseline does.
    local shaping = lookahead or spec.allocate ~= nil
    local unloads, loads = {}, {}
    local order = {}
    for i, want in ipairs(wants) do
      order[want.resource] = i
      local carried = train.cargo[want.resource] or 0
      if want.amount > 0 then
        local amount = want.amount
        if lookahead then
          -- This station is the nearest, so it is served first; what the train
          -- carries beyond its need stays aboard for the stations further on.
          amount = math.min(amount, carried)
          local downstream = downstream_need(want.resource)
          trace("lookahead", here.id, want.resource, { carried = carried, downstream = downstream }, amount)
        end
        if amount > 0 then
          unloads[#unloads + 1] = { resource = want.resource, station = here.id, amount = amount }
        end
      elseif want.amount < 0 then
        local amount = -want.amount
        if shaping then
          amount = math.min(amount, here.stock[want.resource])
        end
        if lookahead then
          local need = math.max(0, downstream_need(want.resource) - carried)
          trace("lookahead", here.id, want.resource, { surplus = amount, downstream = need }, math.min(amount, need))
          amount = math.min(amount, need)
        end
        if amount > 0 then
          loads[#loads + 1] = { resource = want.resource, station = here.id, amount = amount }
        end
      end
    end

    -- Allocate and execute.
    local cargo_after = {}
    for _, resource in ipairs(ctx.resources) do
      cargo_after[resource.id] = train.cargo[resource.id] or 0
    end

    if spec.allocate == nil then
      local unload_by, load_by = {}, {}
      for _, u in ipairs(unloads) do
        unload_by[u.resource] = u.amount
      end
      for _, l in ipairs(loads) do
        load_by[l.resource] = l.amount
      end
      for _, want in ipairs(wants) do
        local r = want.resource
        if unload_by[r] then
          ctx.unload(r, unload_by[r])
          cargo_after[r] = math.max(0, cargo_after[r] - unload_by[r])
        elseif load_by[r] then
          ctx.load(r, load_by[r])
          cargo_after[r] = cargo_after[r] + math.min(load_by[r], here.stock[r])
        end
      end
    else
      for _, u in ipairs(unloads) do
        ctx.unload(u.resource, u.amount)
        cargo_after[u.resource] = math.max(0, cargo_after[u.resource] - u.amount)
      end
      local priority = {}
      for _, resource in ipairs(ctx.resources) do
        priority[resource.id] = resource.priority
      end
      local granted
      if train.capacity.shared ~= nil then
        local used = 0
        for _, amount in pairs(cargo_after) do
          used = used + amount
        end
        local space = math.max(0, train.capacity.shared - used)
        if type(spec.allocate) == "function" then
          granted = call_custom("allocate", spec.allocate, loads, space, ctx)
        else
          granted = spec.allocate.decide(loads, space, priority, order)
        end
      else
        granted = {}
        for _, l in ipairs(loads) do
          local room = math.max(0, (train.capacity.per_resource[l.resource] or 0) - cargo_after[l.resource])
          if type(spec.allocate) == "function" then
            local g = call_custom("allocate", spec.allocate, { l }, room, ctx)
            granted[l.resource] = g[l.resource] or 0
          else
            granted[l.resource] = spec.allocate.decide({ l }, room, priority, order)[l.resource]
          end
        end
      end
      local ordered = {}
      for _, l in ipairs(loads) do
        ordered[#ordered + 1] = l
      end
      table.sort(ordered, function(a, b)
        return order[a.resource] < order[b.resource]
      end)
      for _, l in ipairs(ordered) do
        local amount = math.floor(granted[l.resource] or 0)
        if amount > 0 then
          ctx.load(l.resource, amount)
          cargo_after[l.resource] = cargo_after[l.resource] + amount
        end
      end
    end

    -- Reserve the cargo leaving this stop for the shortfalls ahead.
    if lookahead then
      local left = {}
      for resource, amount in pairs(cargo_after) do
        left[resource] = amount
      end
      for _, need in ipairs(downstream) do
        local amount = math.min(left[need.resource] or 0, need.amount)
        if amount > 0 then
          local by_resource = mine[need.station]
          if by_resource == nil then
            by_resource = {}
            mine[need.station] = by_resource
          end
          by_resource[need.resource] = (by_resource[need.resource] or 0) + amount
          left[need.resource] = left[need.resource] - amount
          trace("lookahead", need.station, need.resource, { shortfall = need.amount }, amount)
        end
      end
    end
  end

  return policy
end

return ops
