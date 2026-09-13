---@meta
-- Generated from packages/policy-api/src/spec.ts. Do not edit.
-- Regolith Rail Policy API version 1.

--- Everything `on_stop` receives about the stop, the train, the station and the line.
---@class StopContext
---@field stop integer Number of this stop within the run, starting at 1.
---@field now integer Game time in milliseconds since the run started.
---@field information_level "local"|"line" How much of the line this scenario lets the policy see.
---@field train Train The train that has stopped.
---@field station Station The station the train has stopped at. Its stock and capacity are always readable.
---@field line Line The stations on the line, in order.
---@field resources Resource[] Every resource in the scenario, in scenario order.
---@field memory table Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field load fun(resource: string, amount: integer) Move `amount` milli-units of `resource` from the station onto the train. Clamped to what the station holds and the train can carry.
---@field unload fun(resource: string, amount: integer) Move `amount` milli-units of `resource` from the train into the station. Clamped to what the train carries and the station can store.
---@field log fun(...: any) Attach a message to this stop. Arguments are converted to text and joined with spaces.
---@field record fun(name: string, value: number) Add a point to a named series that is charted after the run.

--- What `on_start` receives once at the start of each run.
---@class StartContext
---@field now integer Game time in milliseconds; always 0 at the start of a run.
---@field information_level "local"|"line" How much of the line this scenario lets the policy see.
---@field line Line The stations on the line, without stock.
---@field resources Resource[] Every resource in the scenario.
---@field trains TrainInfo[] Every train on the line.
---@field memory table The same persistent table `on_stop` receives.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field log fun(...: any) Write a message at the start of the run.
---@field record fun(name: string, value: number) Add a point to a named series at time 0.

--- A train stopped at a station.
---@class Train
---@field id string Train id, as written in the scenario.
---@field direction "forward"|"backward" Direction the train will leave in. `forward` runs towards the last station; trains reverse at either end.
---@field speed integer Distance travelled per second.
---@field capacity TrainCapacity How much the train can carry.
---@field cargo table<string, integer> Milli-units carried, by resource id. Every scenario resource is present.
---@field space table<string, integer> Milli-units more the train could load, by resource id.
---@field memory table Persistent table for this train, under the same rules as `ctx.memory`.

--- Either one capacity shared by all resources, or a capacity per resource.
---@class TrainCapacity
---@field shared? integer Total milli-units across all resources, when capacity is shared.
---@field per_resource? table<string, integer> Milli-units per resource id, when capacity is per resource.

--- A train as described at the start of a run.
---@class TrainInfo
---@field id string Train id, as written in the scenario.
---@field speed integer Distance travelled per second.
---@field capacity TrainCapacity How much the train can carry.

--- A station on the line.
---@class Station
---@field id string Station id, as written in the scenario.
---@field index integer Position on the line, starting at 1.
---@field resources string[] Ids of the resources this station stores, in scenario order.
---@field distance_to_next? integer Distance to the next station; `nil` on the last station.
---@field stock? table<string, integer> Milli-units stored, by resource id. Readable for other stations only at the `line` level.
---@field capacity? table<string, integer> Storage limit in milli-units, by resource id. Readable for other stations only at the `line` level.
---@field memory? table Persistent table for this station, under the same rules as `ctx.memory`. Present on `ctx.station`.

--- The line the train runs on.
---@class Line
---@field stations Station[] Stations in line order.
---@field distance fun(from: string, to: string): integer Distance along the line between two stations.
---@field travel_time fun(from: string, to: string, speed?: integer): integer Milliseconds a train takes between two stations, not counting stops. Uses the stopped train's speed when `speed` is omitted.

--- Everything `on_review` receives when a stock point reviews what to order from its suppliers.
---@class ReviewContext
---@field review integer Number of this review within the run, starting at 1.
---@field now integer Game time in milliseconds since the run started.
---@field information_level "local"|"line" How much of the scenario this policy may see.
---@field stock_point StockPoint The stock point being reviewed, with its stock, orders and suppliers.
---@field line Line Every stock point in the scenario, in order. Their stock is readable only at the `line` level.
---@field resources Resource[] Every resource in the scenario, in scenario order.
---@field memory table The same persistent table `on_start` and `on_stop` receive.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field order fun(resource: string, amount: integer) Order `amount` milli-units of `resource` from the stock point's supplier for it. Clamped to the supplier's minimum and maximum order.
---@field log fun(...: any) Attach a message to this review. Arguments are converted to text and joined with spaces.
---@field record fun(name: string, value: number) Add a point to a named series that is charted after the run.

--- A stock point under review.
---@class StockPoint
---@field id string Stock point id, as written in the scenario.
---@field index integer Position in the scenario's list of stock points, starting at 1.
---@field resources string[] Ids of the resources this stock point stores, in scenario order.
---@field stock table<string, integer> Milli-units stored, by resource id, after any expiring stock was removed.
---@field capacity table<string, integer> Storage limit in milli-units, by resource id.
---@field backorders table<string, integer> Demand waiting to be served here, in milli-units, by resource id.
---@field on_order Order[] Orders placed by this stock point that have not arrived, oldest first.
---@field suppliers Supplier[] Where each resource can be ordered from.
---@field memory table Persistent table for this stock point; the same table as `ctx.station.memory` at its stops.

--- An order on its way to the stock point that placed it.
---@class Order
---@field resource string Resource id.
---@field amount integer Milli-units still to arrive.
---@field from string `external`, or the id of the supplying stock point.
---@field placed_at integer Game time the order was placed.
---@field arrives_at? integer Game time the order arrives; `nil` while it waits for stock at a supplying stock point.

--- A supplier for one resource.
---@class Supplier
---@field resource string Resource id.
---@field from string `external`, or the id of the supplying stock point.
---@field lead_times LeadTime[] Possible lead times in milliseconds, with their weights.
---@field min_order? integer Smallest order in milli-units, when there is one.
---@field max_order? integer Largest order in milli-units, when there is one.

--- One possible lead time and how likely it is.
---@class LeadTime
---@field value integer Lead time in milliseconds.
---@field weight integer Relative weight; a fixed lead time has one value with weight 1.

--- A resource and how important it is.
---@class Resource
---@field id string Resource id, such as `Metals`.
---@field priority integer Weight used when scoring unmet demand; higher is more important.

--- A policy module.
---@class Policy
---@field on_start? fun(ctx: StartContext) Called once at the start of each run.
---@field on_stop? fun(ctx: StopContext) Called every time a vehicle stops.
---@field on_review? fun(ctx: ReviewContext) Called at every review of a stock point.
