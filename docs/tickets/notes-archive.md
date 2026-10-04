# Notes archive

Every playtest note, verbatim, with the tickets it became.

## N-0001 · 2026-10-04 15:57
the walls of rooms have 0 thickness right now, which isn't realistic when you think too much about what you're looking at. let's add a thickness of 0.25m to walls. two rooms that share a wall don't need two 0.25 walls; just one would suffice.
→ T-001

## N-0002 · 2026-10-04 16:01
in ISO view with the "walls down" enabled, when deciding whether or not to show a wall we should not consider corridors as "needs to be seen" in the calculation. for example, a wall that only obscures a corridor is okay to keep rendering. only walls that obscure another room should be hidden by this mode. the camera angle will certainly impact what a wall covers up, so this will need to be reevaluated as the camera perspective and angle changes. Of course, walls that obscure rock are okay to keep rendering in this mode.
→ T-002

## N-0003 · 2026-10-04 16:03
when adding glass to a wall, we currently highlight the corridor that the glass will be added to, but it is hard to tell from the highlight overlay which room on that corridor is receiving the glass. let's change the overlay to not show the entire corridor, only the half of the corridor on the side with the targeted wall.
→ T-003

## N-0004 · 2026-10-04 16:10
when viewing a floor below the surface, we shouldn't be able to see far into the distance beyond the hole while underground. we should show a cylinder of rock along the other edge of unlocked rings. this cylinder prevents the camera for seeing infinitely beyond the floor you're looking at. 

the height of this cylinder texture should only go as high as the depth below ground that the current floor is. i.e. the cylinder shouldn't be infinitely tall when you're only looking at floor 1.  this new cylinder should never obscure the camera's view or any rooms or corridors.
→ T-004
