-- Naive baseline: how Surviving Mars: Relaunched trains appear to decide what to
-- carry, based on observed behaviour and not yet verified against the game.
--
-- At every stop, each resource the station stores is moved towards the average
-- stock of that resource across all stations on the line that store it. Nothing
-- else is considered: not how fast stations consume or produce, not what other
-- trains carry, and not which station needs the resource most.

local policy = {}

local function stores(station, resource)
  for _, id in ipairs(station.resources) do
    if id == resource then
      return true
    end
  end
  return false
end

function policy.on_stop(ctx)
  local station = ctx.station
  for _, resource in ipairs(station.resources) do
    local total, count = 0, 0
    for _, other in ipairs(ctx.line.stations) do
      if stores(other, resource) then
        total = total + other.stock[resource]
        count = count + 1
      end
    end
    local target = math.floor(total / count)
    local difference = station.stock[resource] - target
    if difference > 0 then
      ctx.load(resource, difference)
    elseif difference < 0 then
      ctx.unload(resource, -difference)
    end
  end
end

return policy
