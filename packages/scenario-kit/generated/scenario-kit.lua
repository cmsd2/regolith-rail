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

---@class MarsLineParams
---@field id string Scenario id.
---@field title? string Title shown to players. Default the id.
---@field description? string What the scenario shows. Default the title.
---@field docs? string Documentation page explaining the scenario.
---@field duration integer Length of a run. In ms.
---@field seed? integer Base seed for random processes. Default 1.
---@field information? "local"|"line" How much of other stations policies can see. Default "line".
---@field resources? string[] Resource ids in scenario order. Default in the order stations store them.
---@field stations station[] Stations from one end of the line to the other.
---@field distances integer|integer[] Track length between neighbours, or one per gap.
---@field trains train[] Trains built with mars.train.
---@field events? event[] Disasters, such as mars.dust_storm.

--- A rail line: stations in order joined by track, and trains shuttling along all of it. Resource priorities default to mars.PRIORITIES.
---@param p MarsLineParams
---@return table
function mars.line(p) end

---@class MarsSmallStationParams
---@field id string Station id.
---@field resources? string[] Resources the station stores, in order, before any its buildings and stock add.
---@field stock? table<string, number> Stock at the start of a run, by resource id. In units.
---@field capacity? table<string, number> Storage by resource id, instead of 30 units. In units.
---@field buildings? building[] Buildings next to the station, such as mars.extractor.

--- A small station: 30 units of storage for each resource it stores.
---@param p MarsSmallStationParams
---@return table
function mars.small_station(p) end

---@class MarsLargeStationParams
---@field id string Station id.
---@field resources? string[] Resources the station stores, in order, before any its buildings and stock add.
---@field stock? table<string, number> Stock at the start of a run, by resource id. In units.
---@field capacity? table<string, number> Storage by resource id, instead of 60 units. In units.
---@field buildings? building[] Buildings next to the station, such as mars.extractor.

--- A large station: 60 units of storage for each resource it stores.
---@param p MarsLargeStationParams
---@return table
function mars.large_station(p) end

---@class MarsTrainParams
---@field id string Train id.
---@field start? string Station the train starts at. Default the first station.
---@field direction? "forward"|"backward" Direction it starts in along the line. Default "forward".
---@field speed? integer Distance per second. Default 5.
---@field capacity? number Units it carries across all resources. In units. Default 30.
---@field dwell? integer Time at every station. In ms. Default minutes(10).
---@field dwell_per_unit? integer Extra time per unit loaded or unloaded. In ms. Default minutes(1).

--- A train shuttling along the whole line.
---@param p MarsTrainParams
---@return table
function mars.train(p) end

---@class MarsExtractorParams
---@field resource string Resource extracted.
---@field rate? number Output per sol. In units per sol. Default 40.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- Extracts a resource from a deposit, such as metals.
---@param p MarsExtractorParams
---@return table
function mars.extractor(p) end

---@class MarsFarmParams
---@field resource? string Resource grown. Default "Food".
---@field rate? number Output per sol. In units per sol. Default 30.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- Grows food.
---@param p MarsFarmParams
---@return table
function mars.farm(p) end

---@class MarsProducerParams
---@field resource string Resource produced.
---@field rate number Output per sol. In units per sol.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- Any other building that adds a resource.
---@param p MarsProducerParams
---@return table
function mars.producer(p) end

---@class MarsConsumerParams
---@field resource string Resource used.
---@field rate number Use per sol. In units per sol.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- Any other building that uses a resource, such as for maintenance.
---@param p MarsConsumerParams
---@return table
function mars.consumer(p) end

---@class MarsDomeParams
---@field consumes? table<string, number>|table[] Use per sol by resource id, or a list such as { { "Food", 45, variability = 20 } } to keep an order. In units per sol. Default { Food = 20 }.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- A dome whose colonists use resources.
---@param p MarsDomeParams
---@return table
function mars.dome(p) end

---@class MarsFactoryParams
---@field inputs? table<string, number> Resources each batch uses. In units. Default { Metals = 3 }.
---@field outputs? table<string, number> Resources each batch makes. In units. Default { MachineParts = 1 }.
---@field rate? number Batches per sol. Default 10.
---@field variability? number|uniform|bursts A percentage for a uniform range over two hours, or a uniform or bursts construct. Fixed when omitted.

--- Turns input resources into output resources in batches.
---@param p MarsFactoryParams
---@return table
function mars.factory(p) end

---@class MarsDustStormParams
---@field id? string Event id. Default "dust-storm".
---@field start? integer When the storm starts, for a storm at a fixed time. In ms.
---@field duration integer How long the storm lasts. In ms.
---@field chance_ppm? integer Chance at each check of a random storm starting, in parts per million.
---@field check_every? integer Time between checks of a random storm. In ms.
---@field stations? "all"|string[] Stations the storm covers. Default "all".
---@field surge? { station, resource, multiplier, after, duration } Extra demand after the storm starts: a multiplier (default 2) for a resource at a station, starting after a delay and lasting a duration.

--- A dust storm that stops production while it lasts, optionally followed by a surge in demand for repairs.
---@param p MarsDustStormParams
---@return table
function mars.dust_storm(p) end

---@class ClassicNewsvendorParams
---@field demand? number|discrete Demand in each period. In units. Default discrete { { 5, 1 }, { 10, 2 }, { 15, 3 }, { 20, 2 }, { 25, 1 } }.
---@field unit_cost? integer Cost of each unit ordered. Default 2.
---@field lost_cost? integer Cost of each unit of demand that finds no stock. Default 5.
---@field period? integer Length of a selling period, with a review at its start. In ms. Default days(1).
---@field periods? integer Number of periods in a run. Default 30.
---@field seed? integer Base seed for random demand. Default 1.

--- One stand whose unsold stock expires at each daily review, facing random demand each period with lost sales.
---@param p ClassicNewsvendorParams
---@return table
function classic.newsvendor(p) end

---@class ClassicReorderParams
---@field demand? number Average demand per sol. In units per sol. Default 10.
---@field random? boolean Poisson arrivals of one unit each instead of a steady rate. Default false.
---@field lead_time? integer Time from order to delivery. In ms. Default 0.
---@field review_period? integer Time between reviews. In ms. Default hours(1).
---@field holding_cost? integer Cost per unit held per sol. Default 1.
---@field order_cost? integer Fixed cost per order. Default 20.
---@field unit_cost? integer Cost per unit ordered. Default 0.
---@field shortage? "lost"|"backorder" Whether unmet demand is lost or backordered. Default "backorder".
---@field shortage_cost? integer Cost per unit lost, or per unit backordered per sol. Default 10.
---@field initial? number Stock at the start of a run. In units. Default 0.
---@field duration? integer Length of a run. In ms. Default sols(20).
---@field seed? integer Base seed for random demand. Default 1.

--- One store replenished from an outside supplier after a lead time, facing steady or random demand, with holding, ordering and shortage costs.
---@param p ClassicReorderParams
---@return table
function classic.reorder(p) end

---@class ClassicSerialChainParams
---@field stages? integer Number of stages, from 2 to 10. Default 4.
---@field lead_time? integer Shipping time into each stage. In ms. Default days(2).
---@field review_period? integer Time between each stage's reviews, and the demand period. In ms. Default days(1).
---@field demand? number|discrete Customer demand each period. In units. Default discrete { { 2, 1 }, { 4, 2 }, { 6, 1 } }.
---@field holding_cost? integer Cost per unit held per sol at every stage. Default 1.
---@field backorder_cost? integer Cost per unit of customer demand backordered per sol. Default 2.
---@field initial? number Stock at every stage at the start. In units. Default 12.
---@field duration? integer Length of a run. In ms. Default sols(60).
---@field seed? integer Base seed for random demand. Default 1.

--- Stages in series, each ordering from the one before it with a shipping lead time, and customer demand with backorders at the last stage, in the style of the beer game.
---@param p ClassicSerialChainParams
---@return table
function classic.serial_chain(p) end

---@class ClassicFixedRouteDeliveryParams
---@field customers? integer Number of customers, from 1 to 20. Default 3.
---@field demand? number Demand per sol at each customer. In units per sol. Default 4.
---@field customer_capacity? number Storage at each customer. In units. Default 20.
---@field customer_initial? number Stock at each customer at the start. In units. Default 10.
---@field distance? integer Length of each leg of the loop. Default 600.
---@field vehicles? integer Number of trucks, from 1 to 10. Default 1.
---@field vehicle_capacity? number What each truck carries. In units. Default 30.
---@field speed? integer Truck speed in distance per second. Default 5.
---@field lead_time? integer Time from a depot order to delivery. In ms. Default days(1).
---@field review_period? integer Time between depot reviews. In ms. Default days(1).
---@field depot_initial? number Stock at the depot at the start. In units. Default 60.
---@field lost_cost? integer Cost per unit of customer demand lost. Default 5.
---@field cost_per_distance? integer Transport cost per unit of distance. Default 0.
---@field duration? integer Length of a run. In ms. Default sols(20).
---@field seed? integer Base seed for random demand. Default 1.

--- A depot supplied from outside and customers that trucks visit on a fixed loop, with lost sales when a customer runs dry.
---@param p ClassicFixedRouteDeliveryParams
---@return table
function classic.fixed_route_delivery(p) end
