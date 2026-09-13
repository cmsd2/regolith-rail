-- Moving-average order-up-to: the reference policy for classic.serial_chain.
--
-- At each review a stage estimates the demand since its last review from the
-- fall in its inventory position, averages the last few estimates, and orders
-- up to that average times the periods an order must cover: its lead time
-- plus one review period. The inventory position is stock plus orders on the
-- way, less backorders and less what the stage owes the stages that order
-- from it.

local WINDOW = 4

local function inventory_position(ctx, here, resource)
  local position = here.stock[resource] or 0
  if here.backorders then
    position = position - (here.backorders[resource] or 0)
  end
  for _, order in ipairs(here.on_order or {}) do
    if order.resource == resource then
      position = position + order.amount
    end
  end
  -- Orders from later stages that are waiting for this stage's stock.
  for _, id in ipairs(ctx.station_order) do
    local other = ctx.stations[id]
    if other ~= here then
      for _, order in ipairs(other.on_order or {}) do
        if order.from == here.id and order.resource == resource and order.arrives_at == nil then
          position = position - order.amount
        end
      end
    end
  end
  return position
end

local function mean_lead_time(supplier)
  local total, weights = 0, 0
  for _, lead in ipairs(supplier.lead_times) do
    total = total + lead.value * lead.weight
    weights = weights + lead.weight
  end
  return total / weights
end

return {
  on_review = function(ctx)
    local here = ctx.here
    local memory = here.memory
    local period = nil
    if memory.last_review ~= nil then
      period = ctx.now - memory.last_review
    end
    memory.last_review = ctx.now

    for _, supplier in ipairs(here.suppliers) do
      local resource = supplier.resource
      local state = memory[resource]
      if state == nil then
        state = { history = {} }
        memory[resource] = state
      end
      local position = inventory_position(ctx, here, resource)
      if state.after ~= nil then
        table.insert(state.history, math.max(0, state.after - position))
        if #state.history > WINDOW then
          table.remove(state.history, 1)
        end
      end

      local average = 0
      for _, demand in ipairs(state.history) do
        average = average + demand / #state.history
      end
      local cover = 1
      if period ~= nil and period > 0 then
        cover = mean_lead_time(supplier) / period + 1
      end
      local target = math.floor(average * cover + 0.5)
      local amount = 0
      if target > position then
        amount = target - position
        ctx.order(resource, amount)
      end
      state.after = position + amount
    end
  end,
}
