-- Balance stock: how Surviving Mars: Relaunched trains appear to decide what to
-- carry, based on observed behaviour and not yet verified against the game.
--
-- At every stop, each resource the station stores is moved towards the average
-- stock of that resource across all stations on the line that store it. Nothing
-- else is considered: not how fast stations consume or produce, not what other
-- trains carry, and not which station needs the resource most.
--
-- The ops.balance documentation page shows the same rule written in plain Lua.

return ops.policy { target = ops.balance {} }
