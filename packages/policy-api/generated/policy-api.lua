---@meta
-- Generated from packages/policy-api/src/spec.ts. Do not edit.
-- Regolith Rail Policy API version 2.

--- What `on_start` receives once at the start of each run.
---@class StartContext
---@field now integer Game time in milliseconds since the run started; always 0 at the start.
---@field information_level "local"|"line" How much of other stations this scenario lets the policy see.
---@field stations table<string, Station> Every station, keyed by id. Every station a context refers to is one of these tables.
---@field station_order string[] Station ids in scenario order.
---@field resources table<string, Resource> Every resource, keyed by id.
---@field resource_order string[] Resource ids in scenario order.
---@field memory table Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field distance fun(from: string, to: string): integer Distance between two stations along the shortest path over arcs.
---@field travel_time fun(from: string, to: string, speed?: integer): integer Milliseconds of travel between two stations along the shortest path over arcs, not counting stops. Uses the stopped vehicle's speed when `speed` is omitted.
---@field log fun(...: any) Write a message. Arguments are converted to text and joined with spaces.
---@field record fun(name: string, value: number) Add a point to a named series that is charted after the run.
---@field vehicles table<string, VehicleInfo> Every vehicle, keyed by id.

--- What `on_stop` receives when a vehicle stops at a station.
---@class StopContext
---@field stop integer Number of this stop within the run, starting at 1.
---@field here Station The station the vehicle has stopped at.
---@field vehicle Vehicle The vehicle that has stopped.
---@field now integer Game time in milliseconds since the run started.
---@field information_level "local"|"line" How much of other stations this scenario lets the policy see.
---@field stations table<string, Station> Every station, keyed by id. Every station a context refers to is one of these tables.
---@field station_order string[] Station ids in scenario order.
---@field resources table<string, Resource> Every resource, keyed by id.
---@field resource_order string[] Resource ids in scenario order.
---@field memory table Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field distance fun(from: string, to: string): integer Distance between two stations along the shortest path over arcs.
---@field travel_time fun(from: string, to: string, speed?: integer): integer Milliseconds of travel between two stations along the shortest path over arcs, not counting stops. Uses the stopped vehicle's speed when `speed` is omitted.
---@field log fun(...: any) Write a message. Arguments are converted to text and joined with spaces.
---@field record fun(name: string, value: number) Add a point to a named series that is charted after the run.
---@field load fun(resource: string, amount: integer) Move `amount` milli-units of `resource` from `ctx.here` onto the vehicle. Clamped to what the station holds and the vehicle can carry.
---@field unload fun(resource: string, amount: integer) Move `amount` milli-units of `resource` from the vehicle into `ctx.here`. Clamped to what the vehicle carries and the station can store.

--- What `on_review` receives when a station reviews what to order from its suppliers.
---@class ReviewContext
---@field review integer Number of this review within the run, starting at 1.
---@field here Station The station being reviewed.
---@field now integer Game time in milliseconds since the run started.
---@field information_level "local"|"line" How much of other stations this scenario lets the policy see.
---@field stations table<string, Station> Every station, keyed by id. Every station a context refers to is one of these tables.
---@field station_order string[] Station ids in scenario order.
---@field resources table<string, Resource> Every resource, keyed by id.
---@field resource_order string[] Resource ids in scenario order.
---@field memory table Table kept between calls for the whole run. It may hold only booleans, numbers, strings and tables of those, without cycles.
---@field rand fun(): number A number from 0 up to but not including 1, repeatable for the same seed.
---@field distance fun(from: string, to: string): integer Distance between two stations along the shortest path over arcs.
---@field travel_time fun(from: string, to: string, speed?: integer): integer Milliseconds of travel between two stations along the shortest path over arcs, not counting stops. Uses the stopped vehicle's speed when `speed` is omitted.
---@field log fun(...: any) Write a message. Arguments are converted to text and joined with spaces.
---@field record fun(name: string, value: number) Add a point to a named series that is charted after the run.
---@field order fun(resource: string, amount: integer) Order `amount` milli-units of `resource` from `ctx.here`'s supplier for it. Clamped to the supplier's minimum and maximum order.

--- A place that holds stock. Stock, backorders and orders of stations other than `ctx.here` are readable only at the `line` level.
---@class Station
---@field id string Station id, as written in the scenario.
---@field index integer Position in the scenario's station order, starting at 1.
---@field resources string[] Ids of the resources this station stores, in scenario order.
---@field neighbours Neighbour[] Stations joined to this one by an arc.
---@field stock? table<string, integer> Milli-units stored, by resource id.
---@field capacity? table<string, integer> Storage limit in milli-units, by resource id.
---@field backorders? table<string, integer> Demand waiting to be served, in milli-units, by resource id.
---@field suppliers Supplier[] Where each resource can be ordered from.
---@field on_order? Order[] Orders placed by this station that have not arrived, oldest first.
---@field memory table Persistent table for this station, under the same rules as `ctx.memory`.

--- A station joined to another by an arc.
---@class Neighbour
---@field station Station The neighbouring station.
---@field distance integer Length of the arc between them.

--- A vehicle stopped at a station.
---@class Vehicle
---@field id string Vehicle id, as written in the scenario.
---@field direction "forward"|"backward" Direction the vehicle will leave in along its route's stops. Shuttles reverse at either end; loops always go forward.
---@field speed integer Distance travelled per second.
---@field capacity VehicleCapacity How much the vehicle can carry.
---@field cargo table<string, integer> Milli-units carried, by resource id. Every scenario resource is present.
---@field space table<string, integer> Milli-units more the vehicle could load, by resource id.
---@field route Route The vehicle's route and the stops ahead of it.
---@field memory table Persistent table for this vehicle, under the same rules as `ctx.memory`.

--- Either one capacity shared by all resources, or a capacity per resource.
---@class VehicleCapacity
---@field shared? integer Total milli-units across all resources, when capacity is shared.
---@field per_resource? table<string, integer> Milli-units per resource id, when capacity is per resource.

--- A vehicle as described at the start of a run.
---@class VehicleInfo
---@field id string Vehicle id, as written in the scenario.
---@field speed integer Distance travelled per second.
---@field capacity VehicleCapacity How much the vehicle can carry.
---@field route_kind "shuttle"|"loop"|"timetable" The kind of route the vehicle follows.
---@field stops string[] Ids of the stations on its route, in order.

--- The fixed route a stopped vehicle follows.
---@class Route
---@field kind "shuttle"|"loop"|"timetable" `shuttle` runs back and forth, `loop` goes round, and `timetable` runs trips from its first stop at listed times.
---@field ahead RouteStop[] The next stops in visiting order, up to returning to this stop, or to the end of a timetable trip.

--- A stop ahead on a vehicle's route.
---@class RouteStop
---@field station Station The station at that stop.
---@field distance integer Distance along the route from `ctx.here`.
---@field travel_time integer Milliseconds of travel from `ctx.here`, not counting stops on the way.

--- An order on its way to the station that placed it.
---@class Order
---@field resource string Resource id.
---@field amount integer Milli-units still to arrive.
---@field from string `external`, or the id of the supplying station.
---@field placed_at integer Game time the order was placed.
---@field arrives_at? integer Game time the order arrives; `nil` while it waits for stock at a supplying station.

--- A supplier for one resource.
---@class Supplier
---@field resource string Resource id.
---@field from string `external`, or the id of the supplying station.
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
