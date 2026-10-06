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

## N-0005 · 2026-10-04 17:10
right now a colony loses way too much water and really relies on supply drops full of water. we should make sure that the resource loop for water makes sense. at a high level:

1. colonies have a certain amount of seed water (clean) at the beginning
2. several things consume that water, like farms, people, kitchens, life support etc.
3. anything consuming clean water turns that water into gray water at a 1:1 ratio. 
4. farms, people, kitchens, etc can only consume clean water.
5. water treatment facility converts gray water back to clean water, at the expense of other resources (electricity etc) and effects (noise etc)
   1. water treatment facility also produces soil, slowly
6. some industrial rooms convert water not just to gray water but also to black water. in early game the only thing you can do with black water is store it or discard it.


in this context, gray water means "reasonable to sanitize and filter to create clean water" and is a process immediately available form the beginning. black water means "heavily contaminated with industrial byproducts, not easy to clean" an unlockable room later in the game should be an "industrial byproduct filtration" room that can convert black water into gray water, with high resource usage. i'm up for better labels if this is too confusing with the generally-accepted meanings of those concepts. 

so, given infinite electricity and maintenance, water should largely be a closed loop system from the start (with the exception of clean water lost to black water). the trickiness for the player is managing the levels of clean to gray water in the hole, and making sure that too much isn't being lost to black water without being replenished externally (supply drop, trade with another hole, deep well). when retrieving water via a well, it should come in as gray water (in the narrative, it's very salty brine that can be liquid at low temps), and the player will need to convert it to clean water.

something i haven't really figured out is whether:

1. throughout the course of the day, humans convert water to gray water
   1. not sure what purpose restrooms have here
2. humans don't do that directly; bathrooms are where the resource exchange happens and the player needs to make sure that restrooms are within X distance of many other rooms
   1. some rooms (like suite) seem to have a bathroom furniture, if that exists in a room than that room is exempt from restroom calculation
   2. if we go this path, restroom distance could be a comfort modifier. in general i'd like to figure out more comfort modifiers so you have enough tools to keep people happy


i'd appreciate perspective on what a good system would be here

--- Follow-up (same note): Claude's perspective, which Bryon approved ---
- Who makes gray water: the hole as a whole, not restrooms. Clean water is one shared pool, like power. When a person, farm or kitchen uses clean water, the same amount becomes gray right away. No carrying water to restrooms.
- Restrooms are an amenity by walking distance, like parks and clinics. Homes with bathroom furniture (the suite, for example) count as covered. Being far from a restroom costs comfort, and a nearby one is a small plus. This is a new comfort lever.
- The loop leaks a little: treatment returns about 95–98% as clean water, and the rest comes out as sludge that becomes soil (that's where the soil output comes from). Wells and supply drops still matter a little. With infinite power, the early challenge is treatment capacity and gray-water storage: when the gray tanks are full, consumers stall.
- Names: clean / gray / tailings, since "black water" means toilet waste in real life. The late-game room is a "tailings reclaimer" (tailings → gray). Well water arrives as gray (salty brine in the story).

--- Bryon's answers ---
1. Gray water needs its own storage. The water tank room lets you choose what it holds (clean or gray), the way farms let you pick a crop.
2. Tailings can be stored. If there isn't enough storage, the overflow just disappears for now.
3. The water charts should show exactly what is converting water, by source and by user. Check how they handle "humans" today.
→ T-005, T-006, T-007

## N-0006 · 2026-10-04 17:20
we should add a way for people to "upgrade" a room's building materials. generally rooms are build from bare rock in the early game because the overall resource value is cheapest. once the player has access to better materials like bricks and metal, the player should be able to upgrade the room in place to be made with one of these other materials. i don't think you should get materials back when you convert a room away from a given material, but it should have a cost in the new material. the task should also be part of the construction queue. i'm undecided if the room should be usable while in active construction. 

one further idea: you can modify a room to have a slightly upgraded version within the same building material. for example, not just:

* rock -> brick

but also:

* bare rock -> smoothed rock
* brick -> patterned brick
* metal -> inlaid decorative metal 

etc

so room type should have it's own base comfort and other values, and these are modifiable with these upgrades to different degrees
→ T-008

## N-0007 · 2026-10-04 17:21
in godot mode (maybe web too), some of the floors appear to have a wooden texture. we should make sure there is not a wooden texture floor since there is no wood resource in the game
→ T-009

## N-0008 · 2026-10-04 17:59
this sounds like a very large idea:

a drawback of the current system is that the furniture layout of the same room on ring 1 vs ring 2 is very different, because the overall square footage of a 2x1 room (for example) is very different between rings (it is the largest difference between ring 1->2  and 2->3). this make building and corridor paths much simpler, but perhaps we should have a fundamentally different system where:

1. each room has a "target square footage"
2. each ring continues to have a set "depth" dimension
3. when building a room, we translate the target square footage and specific ring's depth into "degrees"
   1. degrees is the span around the circle at that ring distance which would create a room of that area
4. there are no longer a certain number of "slots" for rooms in a given ring
5. a room no longer identifies itself by number of room "slots" it takes up, instead by overall area
6. when building, we should have a little wiggle room when placing a room:
   1. a proposed room should "snap" to a neighbor room when the hover state is close enough to that room
   2. snapping should also work for the ends of rooms on other rings, so that it's easier to make successive corridors traversing rings lined up into a straight line
   3. there should be a little (10-15%) grace when filling in a room so that it can snap to a similar ending line of another ring, or to meet the next neighbor room on the current ring. this means that even though rooms have a target sqft, when placing, the true sqft might end up +/- 10 or 15 percent based on snapping opportunities
   4. snapping is an option that can be toggled off from the build UI, default is on but you should be able to toggle it while placing a given room without leaving the placement mode.
7. some room types, like empty rooms and plazas, can take _any_ number of degrees as valid. this will be useful for filling in null spaces between other rooms where a standard room area won't fit.
   1. perhaps there is a different "fill tool" that can be used with these rooms, and it attempts to fill in those awkward spaces. this only works if there are already two rooms to bookend the fill, that way you don't create a ring with only one room and then a very very long plaza. perhaps fill covers at most 60 degrees radially or something
   2. or, perhaps you could place a normal room in a temporary invalid state (won't get build if you exit this state while it's still invalid) and then you can drag the left/right borders of the room to fit your needs. perhaps visually there's handle UI to convey that the left & right wall are moveable. snapping should apply while dragging those, and there should be visual indication when your proposed room is now in a valid placement. normal rooms get +/- 10 or 15 percent adjustment with these handles, and then some "fill rooms" like plazas and empty rooms can go much much further in swing.
→ T-010

## N-0009 · 2026-10-04 19:06
we should build some new saves for the public folder, since a lot has changed since they were made
→ T-013

## N-0010 · 2026-10-05 00:44
if someone builds a kitchen and a canteen instead of a galley, that should satisfy the tutorial step asking you to make a galley
→ T-015

## N-0011 · 2026-10-05 00:51
the "mesa" style horizon could use some work: the mesa doesn't look believable and there's only one of them. perhaps we can add some large craters to the horizon too.
→ T-016

## N-0012 · 2026-10-05 00:57
in the web version, when on a lower flow you can still see the hovering caution icons generated by rooms on higher floors
→ T-017

## N-0013 · 2026-10-05 00:57
we should rename the "all" floor to "surface"
→ T-018

## N-0014 · 2026-10-05 01:02
there are thin black lines on the ceiling borders between rooms. they are also visible when looking at an empty floor -- the seams are above all the room segments of unexcavated rock. in both cases those seams shouldn't be visible. removing this shouldn't affect any hover or selection boxes though
→ T-019

## N-0015 · 2026-10-05 01:07
stars should move through the sky in an accurate way, similar to the sun. both the stars and the sun should take into account the latitude of the site on the planet when calculating the way they move in the sky. we don't need to go so far as to introduce seasons though. pick an equinox position for all this to be built from
→ T-020

## N-0016 · 2026-10-05 01:09
things happen too quickly between the simulation and the number of days elapsed. for example, the day after happiness hits the critical threshold do babies begin being born, and by like day 40 the first of the original colonists are dying of old age. instead of "day 45" let's switch things to "month 45". this doesn't affect anything else in the simulation, just the labels. in this system, each month is one day long.
→ T-021

## N-0017 · 2026-10-05 01:11
after implementing months, we can start showing a large count of months as years. like month 45 would be "year 3, month 9"
→ T-021

## N-0018 · 2026-10-05 02:33
if a corridor is running perpendicular to a room's multisegment wall and makes a dead-end at the room (not a corner of a room, but along the multisegment side of a room), then this is a potential valid place for a door to be added. doors should not be added to the absolute corner of a room (less than 1m from the corner)
→ T-022

## N-0019 · 2026-10-05 02:39
the "try" skill should be able take web/godot/both as input for what engine to start up
→ T-023

## N-0020 · 2026-10-05 02:54
sometimes the "hovering over the button for another floor shows you that floor" is jarring, we should make that a game setting (toggleable in the settings menu) wether to preview floors on hover
→ T-024

## N-0021 · 2026-10-05 18:59
we should care a little about loading the web version on mobile browsers -- gettign the viewport correct, gestures and controls, etc
→ T-025

## N-0022 · 2026-10-06 00:46
let's limit the amount you can zoom out in iso mode. you should be able to zoom out to see the full 6 rings of width, plus a small amount of padding, but not further
→ T-051

## N-0023 · 2026-10-06 00:47
let's deprecate the shaft view, the 3d top view, and xray mode.
→ T-052

## N-0024 · 2026-10-06 00:48
rename Iso view to free view
→ T-052
