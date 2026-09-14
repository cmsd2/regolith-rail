-- Fill the route: the reference policy for classic.fixed_route_delivery.
--
-- At the depot a truck loads what the customers ahead of it are short of, up
-- to its space. At a customer it unloads as much as fits. At each review the
-- depot orders up to the storage of all its customers, so it has stock for the
-- next loads.

local function short_ahead(vehicle, here, resource)
  local short = 0
  local passed = { [here.id] = true }
  for _, stop in ipairs(vehicle.route.ahead) do
    local station = stop.station
    if passed[station.id] then
      break
    end
    passed[station.id] = true
    local stock = station.stock[resource]
    if stock ~= nil then
      short = short + station.capacity[resource] - stock
    end
  end
  return short
end

return {
  on_review = function(ctx)
    local here = ctx.here
    for _, supplier in ipairs(here.suppliers) do
      local resource = supplier.resource
      local target = 0
      for _, id in ipairs(ctx.station_order) do
        local station = ctx.stations[id]
        if station ~= here and station.capacity[resource] ~= nil then
          target = target + station.capacity[resource]
        end
      end
      local position = here.stock[resource] or 0
      for _, order in ipairs(here.on_order or {}) do
        if order.resource == resource then
          position = position + order.amount
        end
      end
      if target > position then
        ctx.order(resource, target - position)
      end
    end
  end,

  on_stop = function(ctx)
    local here, vehicle = ctx.here, ctx.vehicle
    for _, resource in ipairs(here.resources) do
      if #here.suppliers > 0 then
        local carried = vehicle.cargo[resource] or 0
        local wanted = short_ahead(vehicle, here, resource) - carried
        local amount =
          math.min(wanted, here.stock[resource], vehicle.space[resource])
        if amount > 0 then
          ctx.load(resource, amount)
        end
      else
        local room = here.capacity[resource] - here.stock[resource]
        local amount = math.min(vehicle.cargo[resource] or 0, room)
        if amount > 0 then
          ctx.unload(resource, amount)
        end
      end
    end
  end,
}
