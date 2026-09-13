---@meta
-- Generated from packages/scenario-kit. Do not edit.

mars = {}
classic = {}

---@class ScenarioParams
---@field id string Scenario id: a letter, then letters, digits, _ or -.
---@field title? string Title shown to players. Default the id.
---@field description? string What the scenario shows. Default the title.
---@field docs? string Documentation page explaining the scenario, such as failure-modes/relay.
---@field duration integer Length of a run. In ms.
---@field seed? integer Base seed for random processes. Default 1.
---@field information? "local"|"line" How much of other stations policies can see. Default "line".
---@field sample_interval? integer How often stock is sampled for charts. In ms. Default hours(1).
---@field resources? (string|resource)[]|table<string, table> Resources as ids, resource constructs, or parameters keyed by id.
---@field stations? station[] Stations, in scenario order.
---@field arcs? arc[] Arcs joining stations.
---@field vehicles? vehicle[] Vehicles and their routes.
---@field events? event[] Events such as storms.
---@field parts? table[] Tables with stations, arcs, vehicles or events lists, such as the result of line, appended in order.

--- A complete scenario document. Resources default to every resource a station stores, in the order stations first store them.
---@param p ScenarioParams
---@return table
function scenario(p) end

---@class ResourceParams
---@field id string Resource id, such as Metals.
---@field priority? integer Higher numbers matter more to priority allocation. Default 1.

--- A resource and its priority.
---@param p ResourceParams
---@return table
function resource(p) end

---@class StationParams
---@field id string Station id.
---@field resources (string|store)[]|table<string, table> Resources stored: ids with default storage, store constructs, or store parameters keyed by resource id.
---@field producers? producer[] What adds stock.
---@field consumers? consumer[] What takes stock as demand.
---@field converters? converter[] What turns some resources into others.
---@field suppliers? supplier[] Where the station orders resources from.
---@field review? review When the station reviews its orders.
---@field position? { x: number, y: number } Where to draw the station on the map.

--- A place that stores resources, with what produces, consumes, converts and supplies them.
---@param p StationParams
---@return table
function station(p) end

---@class StoreParams
---@field resource string Resource id.
---@field capacity? number|"unlimited" Most the station can hold. In units. Default 30.
---@field initial? number Stock at the start of a run. In units. Default 0.
---@field expires? boolean Whether stock is removed at each review. Default false.
---@field holding_cost? integer Cost per unit held per sol.

--- How a station stores one resource.
---@param p StoreParams
---@return table
function store(p) end

---@class ProducerParams
---@field resource string Resource id.
---@field rate? number Amount produced per sol, spread evenly over each minute. In units per sol.
---@field variability? uniform|bursts How the rate varies over time. Fixed when omitted.
---@field poisson? poisson Arrivals at random times instead of a rate.
---@field per_period? per_period An amount drawn at the start of each period instead of a rate.
---@field trace? trace Recorded amounts per period instead of a rate.
---@field profile? profile Multipliers over the run, for ramps and seasons.
---@field stall_cost? integer Cost per unit of production that does not fit.

--- Adds a resource to its station, by exactly one of rate, poisson, per_period or trace.
---@param p ProducerParams
---@return table
function producer(p) end

---@class ConsumerParams
---@field resource string Resource id.
---@field rate? number Amount demanded per sol, spread evenly over each minute. In units per sol.
---@field variability? uniform|bursts How the rate varies over time. Fixed when omitted.
---@field poisson? poisson Arrivals at random times instead of a rate.
---@field per_period? per_period An amount drawn at the start of each period instead of a rate.
---@field trace? trace Recorded amounts per period instead of a rate.
---@field profile? profile Multipliers over the run, for ramps and seasons.
---@field unmet? "lost"|"backorder" Whether demand that cannot be met is lost or waits for stock. Default "lost".
---@field lost_cost? integer Cost per unit of lost demand.
---@field backorder_cost? integer Cost per unit backordered per sol.

--- Takes a resource from its station as demand, by exactly one of rate, poisson, per_period or trace.
---@param p ConsumerParams
---@return table
function consumer(p) end

---@class UniformParams
---@field range integer Largest change from the base rate, in percent.
---@field period? integer How long each drawn rate lasts. In ms. Default hours(1).

--- Varies a rate uniformly within a range, drawing a new rate each period.
---@param p UniformParams
---@return table
function uniform(p) end

---@class BurstsParams
---@field on_ppm integer Chance per minute of switching on, in parts per million.
---@field off_ppm integer Chance per minute of switching off, in parts per million.
---@field starts_on? boolean Whether the flow starts on. Default true.

--- Switches a rate on and off at random.
---@param p BurstsParams
---@return table
function bursts(p) end

---@class PoissonParams
---@field per_sol number Average arrivals per sol.
---@field size? number|discrete Size of each arrival. In units. Default 1.

--- Arrivals at random times at an average rate, each of a fixed or random size.
---@param p PoissonParams
---@return table
function poisson(p) end

---@class PerPeriodParams
---@field period integer Length of each period. In ms.
---@field amount number|discrete Amount for each period. In units.

--- An amount drawn at the start of each period and spread evenly over it.
---@param p PerPeriodParams
---@return table
function per_period(p) end

---@class TraceParams
---@field period integer Length of each period. In ms.
---@field amounts number[] Amount for each period. In units.

--- Recorded amounts, one per period, repeated from the start when they run out.
---@param p TraceParams
---@return table
function trace(p) end

---@class ConverterParams
---@field inputs? table<string, number> Amount of each resource each batch takes. In units.
---@field outputs? table<string, number> Amount of each resource each batch makes. In units.
---@field rate number Batches per sol.
---@field variability? uniform|bursts How the rate varies over time. Fixed when omitted.

--- Turns input resources into output resources at its station, in batches.
---@param p ConverterParams
---@return table
function converter(p) end

---@class SupplierParams
---@field resource string Resource id.
---@field from? string external, or the id of the station that ships from its own stock. Default "external".
---@field lead_time? integer|discrete Time from order to arrival. In ms. Default 0.
---@field min_order? number Smallest order. In units.
---@field max_order? number Largest order. In units.
---@field order_cost? integer Fixed cost per order.
---@field unit_cost? integer Cost per unit ordered.

--- Where a station orders one resource from, and how long orders take to arrive.
---@param p SupplierParams
---@return table
function supplier(p) end

---@class ReviewParams
---@field period integer Time between reviews. In ms.
---@field offset? integer Time of the first review. In ms. Default 0.

--- A schedule of reviews, when the policy decides what the station orders.
---@param p ReviewParams
---@return table
function review(p) end

---@class ArcParams
---@field from string Station id at one end.
---@field to string Station id at the other end.
---@field distance integer Length of the arc.

--- Joins two stations, in both directions.
---@param p ArcParams
---@return table
function arc(p) end

---@class LineParams
---@field stations station[] Stations from one end of the line to the other.
---@field distances integer|integer[] Distance between neighbours, or one per gap.

--- Stations joined in order by arcs. Pass the result to scenario's parts.
---@param p LineParams
---@return table
function line(p) end

---@class ShuttleParams
---@field stops (string|station)[] Stations in order; neighbours must be joined by arcs.
---@field start? string Stop the vehicle starts at. Default the first stop.
---@field direction? "forward"|"backward" Direction the vehicle starts in. Default "forward".

--- A route back and forth along its stops, reversing at each end.
---@param p ShuttleParams
---@return table
function shuttle(p) end

---@class LoopParams
---@field stops (string|station)[] Stations in order; the last joins back to the first.
---@field start? string Stop the vehicle starts at. Default the first stop.

--- A route around its stops and back to the first, repeatedly.
---@param p LoopParams
---@return table
function loop(p) end

---@class TimetableParams
---@field stops (string|station)[] Stations in order from the first stop.
---@field departures integer[] Departure times from the first stop. In ms.

--- Trips out along its stops and back, leaving the first stop at listed times.
---@param p TimetableParams
---@return table
function timetable(p) end

---@class VehicleParams
---@field id string Vehicle id.
---@field route shuttle|loop|timetable The route it follows.
---@field speed integer Distance per second.
---@field dwell? integer Time at every stop. In ms. Default 10000.
---@field dwell_per_unit? integer Extra time per unit loaded or unloaded. In ms. Default 1000.
---@field capacity number|table<string, number> Units it can carry across all resources, or units by resource id. In units.
---@field cost_per_distance? integer Cost per unit of distance travelled.

--- A vehicle on a fixed route.
---@param p VehicleParams
---@return table
function vehicle(p) end

---@class EffectParams
---@field type "supply"|"demand" supply scales production; demand scales consumption.
---@field stations? "all"|string|string[] Stations affected. Default "all".
---@field resources? "all"|string|string[] Resources affected. Default "all".
---@field multiplier number Rate multiplier: 0 stops the flow, 2.5 multiplies it by two and a half.
---@field start_offset? integer When the effect starts after the event starts. In ms. Default 0.
---@field duration? integer How long the effect lasts. In ms. Default the event's duration.

--- How an event changes production or demand while it is active.
---@param p EffectParams
---@return table
function effect(p) end

---@class EventParams
---@field id string Event id.
---@field label? string Name shown to players. Default the id.
---@field start? integer Start time of a fixed event. In ms.
---@field duration integer How long the event lasts. In ms.
---@field chance_ppm? integer Chance at each check of a random event starting, in parts per million.
---@field check_every? integer Time between checks of a random event. In ms.
---@field effects effect[] What the event changes.

--- Something that changes rates for a while, at a fixed time or at random.
---@param p EventParams
---@return table
function event(p) end

--- Weighted values, such as discrete { { 2, 1 }, { 3, 2 } }, drawn with chance proportional to weight. Values are converted by the parameter they are given to.
---@param pairs { number, integer }[] Value and whole-number weight pairs.
---@return table
function discrete(pairs) end

--- Multipliers at times in the run, such as profile { { sols(0), 1 }, { sols(10), 2 } }, interpolated linearly between points.
---@param points { integer, number }[] Time and multiplier pairs.
---@return table
function profile(points) end

--- Milli-units in a quantity of units, for changing a construct's result. Rejects values finer than 0.001 units.
---@param value number Quantity in units, such as 2.5.
---@return integer
function units(value) end

--- Milliseconds in a number of minutes, where one minute is 60000 ms. Rejects values that are not a whole number of milliseconds.
---@param value number Number of minutes, such as 1.5.
---@return integer
function minutes(value) end

--- Milliseconds in a number of hours, where one hour is 60 minutes. Rejects values that are not a whole number of milliseconds.
---@param value number Number of hours, such as 1.5.
---@return integer
function hours(value) end

--- Milliseconds in a number of sols, where one sol is 24 hours. Rejects values that are not a whole number of milliseconds.
---@param value number Number of sols, such as 1.5.
---@return integer
function sols(value) end

--- Milliseconds in a number of days, where one day is 24 hours, the same as a sol. Rejects values that are not a whole number of milliseconds.
---@param value number Number of days, such as 1.5.
---@return integer
function days(value) end

--- Milliseconds in a number of weeks, where one week is 7 days. Rejects values that are not a whole number of milliseconds.
---@param value number Number of weeks, such as 1.5.
---@return integer
function weeks(value) end
