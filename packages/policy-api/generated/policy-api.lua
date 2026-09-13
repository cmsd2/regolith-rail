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

--- A resource and how important it is.
---@class Resource
---@field id string Resource id, such as `Metals`.
---@field priority integer Weight used when scoring unmet demand; higher is more important.

--- A policy module.
---@class Policy
---@field on_start? fun(ctx: StartContext) Called once at the start of each run.
---@field on_stop fun(ctx: StopContext) Called every time a train stops.
