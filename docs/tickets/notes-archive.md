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

## N-0025 · 2026-10-06 00:56
let's add a "milestones" panel to the UI. some milestones are like 

* a hole that is capable of keeping humans alive indefinitely at its current size, provided continued supply drops from earth
* a hole that is capable of keeping humans alive indefinitely at its current size, thanks to trade with other holes
* a hole that is self-sufficient on its own
* a hole that has produced a kit to create another hole
* first birth in hole
* 
* and any other ideas you have.

--- Follow-up (same note): Claude's extra milestone ideas, which Bryon approved ---
- First Martian adult: someone born in the hole grows up
- Third generation: the grandchild of an original colonist is born
- Laid to rest: the first colonist dies of old age on Mars
- Closed loop: water treatment returns more than it loses over a whole month
- First harvest: a farm produces food for the first time
- Deep roots: the hole reaches floor 5, then 10 and 20
- Full ring: every slot on one floor's ring is dug
- Under glass: the shaft dome is finished
- A year on our own: the hole goes a full year without a supply drop
- Network: first trade route, then 3 and 5 holes linked
- Drifting apart: one hole's culture becomes clearly different from the others
- Good neighbors: the belt ship in distress is rescued
- Population: 50, 100, 250 and 500 people
→ F-005

## N-0026 · 2026-10-06 01:17
let's add an intro narrative card to new games. the card describes that you are the administrator of a mission from earth to create a sustainable society on mars. however, because mars lacks an appreciable atmosphere and magnetic field, the surface of the planet is irradiated by the sun, unlike on earth. staying on the surface too long -- even in suits and vehicles -- comes with a radiation dose and long-term health impact. because of this, your colony needs to build underground. your mission provided 20 people, supplies to sustain you for some time, and one large borehole drilling machine. your goal is to build your colony in the walls of the hole that is being drilled. it's the only way to live long term on this planet.

please wordsmith it to be exciting and easily readable by someone who really just wants to start playing the game

--- Follow-up (same note): Claude's draft of the card text, which Bryon approved ---
**Welcome to Mars, Administrator.**

Earth sent you here to build something that lasts: a home where people can live for generations.

There's a catch. Mars has almost no air and no magnetic field, so the Sun's radiation hits the surface unchecked. Stay up there too long, even in a suit or rover, and it catches up with you.

So we go down.

You have **20 colonists**, enough supplies to get started, and **one very large drill**. As it bores into the ground, you'll carve homes, farms and workshops into the walls of the hole.

It's the only way to live here for good. Let's dig in.
→ T-053

## N-0027 · 2026-10-06 01:19
create procedurally generated persona headshots for each of the notable people. for some of them, elements of their profession are incorporated into their profile picture.
→ T-054

## N-0028 · 2026-10-06 01:43
add a section to the readme file: "why not a game building habitats on the surface?" with this exact explanation (from a chat with Claude):

It's quite realistic. Burying a colony is one of the leading real proposals for living on Mars long term. Suits and ordinary habitats are fine for visits, but not for a lifetime.

**The numbers:**
- NASA's Curiosity rover measured about **0.6–0.7 mSv a day** on the surface. That's roughly **230 mSv a year**, about 100 times the natural background on Earth.
- NASA's career limit for astronauts is **600 mSv**. Living on the surface unshielded would use that up in about **2–3 years**.
- **Space suits barely help.** They're built to hold air in and keep you warm, not to stop radiation.
- **Thin-walled habitats help a little.** They block most of the dangerous bursts from solar storms, but not the steady background radiation.

**Why going underground works:** the radiation mostly comes from two sources:
1. **Cosmic rays:** a steady stream of very high-energy particles from deep space. They're the main long-term danger and very hard to stop. A thin shield can even make things worse, because the particles shatter in it and spray secondary radiation. You need a lot of mass, about **2–3 m of rock or soil** or more. Living a floor or more below ground does that job well.
2. **Solar storms:** occasional bursts of particles from the Sun. They're dangerous in the moment but easy to block. A few centimetres of water or plastic does it.

Being underground also helps with Mars's other problems: temperature swings of more than 100 °C between day and night, and small meteorites. Real proposals include habitats buried under soil, lava tubes, and dug-out caverns. Your borehole fits right in.
→ T-062

## N-0029 · 2026-10-06 01:44
when creating a PR, add a clickable link to the github pages preview of the code from that PR. it's okay if the link becomes non-functional after the PR merges
→ no ticket

## N-0030 · 2026-10-06 01:58
i'd like to be able to "install" the web page on mobile phones, so you don't have to look at the web browser bar while playing. i presume we need to make some fort of manifest or add special headers to the page to facilitate this. i don't want to go so far as building an actual mobile app for distribution in the app stores
→ T-063

## N-0031 · 2026-10-06 02:02
add an offline mode, and a way of updating the version of the game when a newer one is available
→ T-064

## N-0032 · 2026-10-06 02:05
add more sound effects, and procedurally generated cozy uplifting mars music.
→ F-006

## N-0033 · 2026-10-06 02:11
let's create a doc describing the dev work flow:

* when to use which skills
* what the general flow of stages are
* some of the reasoning (succinctly) for doing things this way
→ T-065

## N-0034 · 2026-10-06 02:23
for installed android PWAs, we should have an option to show/hide the system bar
→ T-072

## N-0035 · 2026-10-06 02:28
let's take a more refined pass as the distant geologic features on the horizon (mountains and plateaus). can we make them a little more 3d?
→ T-016

## N-0036 · 2026-10-06 09:45
we should color the soil at a hole site to match the mars planet map where the particular hole is located. we should prevent players from placing hole sites on ice caps or glaciers
→ T-073

## N-0037 · 2026-10-06 09:45
we should add local weather report, even though the hole colony is insulated within their habitable space.
→ T-074

## N-0038 · 2026-10-06 09:45
we should make a favicon
→ no ticket

## N-0039 · 2026-10-06 09:46
in a pr build on github.io, we should prepend the pr id to the page title
→ T-075

## N-0040 · 2026-10-06 19:11
when in colored room mode, we currently show a variety of different floor textures. floor textures should match the building material always, regardless of room coloring mode or not
→ T-076

## N-0041 · 2026-10-06 19:12
sometimes the room labels clip through the walls of the room (or a neighboring room). perhaps the should be centered on the room. but we should still make sure they never clip a wall.
→ T-077

## N-0042 · 2026-10-06 19:12
is it possible to apply a tilt shift photography perspective to the cameras in iso view?
→ T-078

## N-0043 · 2026-10-06 19:14
sometimes the walls of the entry room fight for visibility through other room's walls, and you can see portions of the entry room wall from within another room at certain angles.
→ T-079

## N-0044 · 2026-10-06 19:15
in the tutorial, there is a step "someone is waiting in the office for you" but no one is. we should generate a person that is just saying hi when that tutorial step is selected. that person doesn't give up after waiting; but once you dismiss them the tutorial step completes
→ T-080

## N-0045 · 2026-10-06 19:16
you should be able to move forwards in backwards in the tutorial steps without completing them, with left and right icons. that way some players can complete tutorial in a different order if they need
→ T-081

## N-0046 · 2026-10-06 19:18
this is a larger feature: we should consider a version of the tutorial for people that are unfamiliar with city builder or colony sim games, that holds their hand much more through the first stages of game. in this mode, we should introduce UI elements like the clock speed buttons one by one, and not show other elements until they've been covered by the tutorial. perhaps we can create auto-playing mp4s of certain tasks and actions that can show in a popup if the player wants to see that for a step
→ F-007

## N-0047 · 2026-10-06 19:19
when not in build mode, none of the keyboard commands should bind to building a room. the only way to enable a hotkey for a specific room is to enter build mode
→ T-082

## N-0048 · 2026-10-07 18:47
a pass at the layout and presentation of the pause menu and settings, for ease of use and information density. should be usable on mobile and keyboard accessible
→ T-088

## N-0049 · 2026-10-07 18:49
better, more intuitive UI for the top of the screen. there is a lot going on there and hard to tell what you need to know about immediately. consider ways to make the information more compact, such as icons instead of whole words. perhaps introduce a grid to put resources in
→ T-089

## N-0050 · 2026-10-08 01:57
let's build a comprehensive playing guide, liek a wiki of interlinked information about all the mechanics, resources, rooms, event,s etc
→ F-010

## N-0051 · 2026-10-08 01:59
let's build a snazzy title screen to show then the game is first launched. this should fit with the overall aesthetic. we can also show this screen while loading all the assets as a real game loads (with a loading bar ui).
→ T-090

## N-0052 · 2026-10-08 02:05
in cutaway view, the space between the surface and the first floor should be opaque
→ T-091

## N-0053 · 2026-10-08 02:28
we don't need the floor picker in cutaway mode; always show all floors and the surface in this mode. going to another mode returns the floor picker to the same floor it was before going to cutaway mode.
→ T-098

## N-0054 · 2026-10-09 01:29
in godot, the different ui panels should hug their respective sides or corners of the window as it is resized. the floor picker container should only be shown just as tall as needed to show the current number of floors, not more. take another pass at the buttons in places like the build menu so that they feel more clickable and "square-ish" so more can fit side by side.
→ T-099

## N-0055 · 2026-10-09 01:31
lessen the population requirements for unlocking more housing rooms. use 100 instead of 200 and use 200 instead of 1000
→ T-100

## N-0056 · 2026-10-09 01:32
in godot, when looking at a floor in free view during the daytime, the engine is making complex shadows. we should consider lighting as if those floors are still underground; only bright daylight comes through the shaft and bleeds into the hole from there.
→ T-101

## N-0057 · 2026-10-09 01:36
in web, there is a weird graphical artifact hovering over the hole in surface mode during the daytime. it looks like it is dependent on the position of the sun but it shouldn't be visible in the form or shape that it currently is. i'm not sure if it is supposed to represent something else or not; if so then fix why it is showing up as a ring above the hole. additionally, there is a ghost "ledge" shape along the inner wall of the hole on floors that haven't been excavated yet. this might be related to the inner walkway that can be built, but these floors haven't had any construction yet so nothing should be visible.
→ T-102, T-103

## N-0058 · 2026-10-09 01:56
the "snake mode" of dragging out a series of corridors is a little difficult to use. never allow the snake to go down a path, make a turn, but then double back to the intersection where the turn occurred and then into a different direction. this happens often by mistake and it is very annoying.
→ T-104

## N-0059 · 2026-10-09 12:39
you should be able to dismiss a notification manually by clicking an x button in the notification
→ T-105

## N-0060 · 2026-10-09 12:47
on mobile, we should hide many of the elements that show at the top of the screen inside a collapsible menu. right now too much of the screen is taken over by this menu at phone sizes. perhaps the only things that are outside of the collapsing bit are:

* system menu
* hole name
* pause/play toggle (the speed controls are inside the collapse).
* how many warnings are active (like low food or happiness)
* the "office" link


and then everything else like the specific warnings and all the resource counts are collapsed
→ T-106

## N-0061 · 2026-10-09 19:43
part of the early game should be framed around moving out of the landing pod so it is not needed for any housing, storage, meals, etc etc. the narrative here is that the colonists are experiencing unwanted low-level radiation while above the surface, so to keep people healthy they need to completely move all habitation underground in a certain number of months. after that point, people's health starts to deteriorate from going back up to the surface so often. 

we should have a checklist of things that the lander provides (like housing and a place to eat), and as you build sufficient capacity within the hole, things are subsequently checked off the list. once everything is checked on that list, you get the option to "deconstruct the landing pod for resources" which gives a nice boost of things like metal, glass, electronics, machinery, etc. this can be framed as a "mission" that happens after the tutorial is complete (or a certain number of months have passed) and we can ideate on other missions that could occur throughout the rest of the game. 

other holes after the first one should start with a "base camp" instead of a landing pod, since colonists are arriving via rovers from earlier holes with resources in tow.
→ F-011

## N-0062 · 2026-10-09 19:45
when in build mode, we should show slightly shaded areas on the surface where surface buildings can be built. when hovering over one with a surface room (like the solar panels) selected, these shaded areas become more opaque (like the current presentation on hover). Also, we should add a 2nd and 3rd "ring" of above-ground building spots. let's not worry about opening up surface rings 4-6 yet.
→ T-107, T-108

## N-0063 · 2026-10-09 19:47
when in cutaway view, the "front face" of rock seems to be missing. this is what obscures everything that isn't rooms and excavated space in the hole.
→ T-109

## N-0064 · 2026-10-09 20:00
this is a bigger, long term idea: a version of the game that is 2d sprites, rather than rendered in 3d. the view would be stuck in isometric, and the graphical aesthetic would be similar to "into the breach". we wouldn't need to do all the complicated 3d stuff in this version and could instead invest more energy in detailed 2d graphics of things like furniture, rooms, and people. this might be a separate game that shares some resources and logic with the current web/godot versions, depending on how deep the changes are. i don't expect that this is a view that you can toggle in and out of from the existing game, and you probably can't even port a save back and forth. all the concepts and mechanics in this game would be the same as the current game, just a completely different presentation and we'll probably need to make some amount of gameplay changes to accommodate that
→ F-012

## N-0065 · 2026-10-10 00:13
we should consider the size of the lift to create holes of different diameters. i would like for the current hole diameter to be the smallest, and we should figure out M, L, and XL diameters.
→ F-013

## N-0066 · 2026-10-10 00:15
we should introduce a difficulty picker when creating a new game. players new to the game or the genre can pick easy difficulty, and experienced players can go for a challenge in hard difficulty. the current difficuly would be considered "normal".
→ F-014

## N-0067 · 2026-10-10 01:30
i like the scroll action moving up and down a hole in cutaway view, but we should also figure out a way to zoom in and out in that view
→ T-130

## N-0068 · 2026-10-10 01:37
we should make sure we've implemented all the rooms we talked about
→ F-015

## N-0069 · 2026-10-10 13:51
when in 3d views, are there any efficiencies optimization we can take in rendering the scene? for example, if you are in free view and looking at floor 2, i'm not sure if ALL of the rooms and furniture way down on floor 7 are being drawn in full. if there's a way to know which rooms are visible to the camera and which aren't, perhaps we can save some energy by not rendering rooms we can't see. this will be complicated by the fact that you can see through any number of rooms if they have windows in the right places, as well as rooms from a lot of different floors are visible from the main shaft. furniture might be the biggest savings if we know we don't have to render a specific room at all.
→ T-137

## N-0070 · 2026-10-10 13:58
when in first person view, you should walk a little more quickly than presently, since you might get bored walking a long distance. a cool little easter egg could be that if you go to a room with the ability to serve meals (like a canteen, galley, etc, maybe even some of the nicer residences), there is an action you can take on a furniture that is able to serve beverages: "press <key> to grab a drink". doing this action will then render a first person pov arm holding a steaming beverage of dark brown liquid in a mug as you walk around. the effect would be similar to other first person perspective games where you're holding a gun or tool, only in this case it is just a mug of liquid. this state would last until you leave first person view, and the next tim you enter the view you would be back to normal (need to return to a meal room to re-trigger).
→ T-138, T-139

## N-0071 · 2026-10-10 14:07
in mobile web view, if the number of resources in a category wraps onto another row, it's shouldn't wrap to underneath the resource category label. the label should span the entire height of that resource section, be anchored left, and then the resources will appear in multiple rows to the right of it.
→ T-140

## N-0072 · 2026-10-10 14:10
the proof of concept for events and office visits has been solid. let's plan out some more of those.
→ F-016

## N-0073 · 2026-10-10 14:13
before jumping into the rest of the room catalog we have planned out, we should add a 1x1 "lounge" room with furniture like couches, tvs, games tables, etc. this should add va comfort bonus to nearby rooms
→ T-141, F-015

## N-0074 · 2026-10-10 14:16
corridors should be able to have their building materials upgraded, just like rooms with all the same visual changes and an analogous resource cost.
→ T-142, F-003

## N-0075 · 2026-10-10 14:24
let's plan out singular room-specific upgrades. these should be tailored to each room type, and performing the upgrade comes with an up-front resource cost and/or continued resource draw every month. for example, a clinic could offer upgraded medical diagnostic tools, which carry a greater impact on health but also cost several electronics upfront and add something like a 0.1 or 0.2 electronics cost every month (we can balance the specific numbers). another example could be "fiber noise damping panels" in an industrial / life support room which decrease nearly noise impact, but cost fiber up front as well as a monthly "replace old fibers" budget. In most cases, performing a room upgrade changes the room visually, whether some of the furniture is replaced with new pieces (which are only available to rooms with that upgrade) or some other decoration.
→ F-017

## N-0076 · 2026-10-10 14:48
some events should have a random change of working out favorably, depending on your choice (if you have a choice) within the event. 

for example, someone might come to the office proposing that they take a party of colonists out on a metal-rich meteorite collection mission, and they need to bring 10 machinery with them on the trip. if you agree, then you lose 10 machinery for a day (or however long the event action is supposed to last narratively), and upon their return there is a random probability that:

* all the machinery is safely returned, you gain back 10 machinery. 
* some of the machinery was consumed when a winch broke, you gain back 8 machinery.
* there were catastrophic problems with their tools and machines, they returned empty-handed and no machinery is returnend.

additionally this example result would carry:

* they found useful meteorites and you gain 25 metal ore (not available if they had catastrophic problems)
* they were unsuccessful at finding anything so you gain no ore


in events like these where some colonists are unavailable for a time, the pool of workers in the hole should be reduced by that amount for the duration of the event. one option in committing to an event could be posed as:

1. agree to the full proposal
2. agree, but commit fewer colonists than asked for. in some events, it might appear as committing fewer resources than asked for. this could impact the odds, but you have a smaller wager (cost) 
3. deny the proposal. in some cases, this might come with a temporary impact on happiness as well


we'll need a way to show visually in the "resource UI" at the top of the screen that some number of workers are on a mission like this and not working a normal job. we'll need to actually reduce the worker pool by that amount for the duration. the tooltip over the worker count can elaborate on the details. 

lastly, some scenarios might complete with a negative outcome of "some workers were injured on the mission". a worker that was injured by an event  takes certain number of days to heal and recover before they can be added back to the worker pool. we'll need a separate indicator in the resource display of injured/healing workers. perhaps this info is only shown in the tooltip. since this is a cozy game, workers never die on missions/events, and workers always heal back to normal (after their duration of healing is completed). 

some events don't have a duration. it could be like "the drill is jammed and we need someone to get underneath it and see what is wrong" which would give an immediate result to your choices.

overall, we should balance these events/missions as a wager: generally the higher the cost, the higher the reward. and the higher the risk, the higher the reward. in an abstract sense, it will be an incentive to build your hole with spare capacity/resources in mind, so you don't encounter one of these events and don't have enough to commit to it, or can't take on the risk of a possible failure state and what that would mean to a tenuous balance in the hole.
→ F-016

## N-0077 · 2026-10-11 01:44
we should add the ability to adjust the "slice angle" of cutaway view. the current behavior would be considered 180 degrees -- resulting in a flat line across the entire colony. this would be the maximum angle, and for example 90 degrees would show only the front-most quarter of the hole removed.
→ T-143

## N-0078 · 2026-10-11 02:02
we should try adding a "concrete collar" around the top of the hole, where it transitions to surface. this would be keeping with some realism and prevent rock from crumbling in. additionally, some machinery should be attached to this collar, and that machinery should be managing the cables rising through the shaft form the drill. for now, this new element is purely decorative -- you can't select or interact with it, and it conveys no resources, costs, maintenance  or effects on its own.
→ T-144

## N-0079 · 2026-10-11 02:04
in web 3d mode, sometimes corridors are obstructed by a thin wall of rock -- this happened when there is a room on an inner ring, then an unexcavated segment adjacent on an outer ring, and a corridor running in/out along one side of the room. the unwanted wall sticks out form the unexcavated segment and covers the corridor halfway.
→ T-145

## N-0080 · 2026-10-11 02:05
when loading a game, it should start in paused mode
→ T-146

## N-0081 · 2026-10-11 02:05
clicking the pause button while paused should unpause the simulation and return it to the speed before pausing (of 1x as a fallback)
→ T-146

## N-0082 · 2026-10-11 02:08
the happiness metric and tooltip should tell you what is impacting the score
→ T-147

## N-0083 · 2026-10-11 02:17
rooms shouldn't stall if gray water tanks are full; i this case gray water should be lost permenantly
→ T-148

## N-0084 · 2026-10-11 02:25
we need to add a "floor directory" panel (accessible form the charts area) that lists all the floors and all the rooms on each floor. clicking on a room will show the detail panel for that room.
→ T-149

## N-0085 · 2026-10-11 20:18
when under 20 colonists, supply drops should sometimes carry a handful of replacement colonists. this can help get you out of a tailspin.
→ T-161

## N-0086 · 2026-10-11 20:19
when you reach zero colonists, we should have some sort of "the game is over" screen that explains the hole has failed and there's no one to let new colonists in anymore. after that you get sent to the home screen to start a new game
→ T-162

## N-0087 · 2026-10-12 01:33
when entering first person mode, if the floor doesn't have an inner glass walkway, then find an appropriate corridor to place the camera. right now the camera gets stuck in the shaft and unable to move
→ T-163

## N-0088 · 2026-10-12 19:53
when starting a new game, the first hole should have a few things beyond the battery already added since a player is brand new to the experience. like they have battery, electrolyzer, co2 scrubber, clean and gray water tanks already built for them. this wouldn't go so far as to build dorms or galleys etc. this is just so that players figuring out how the game works won't lose their first hole immediately. perhaps we give people a choice, or if difficulty is high then you start with just a battery (but not on normal and easy).  also, subsequent holes in a game should start with just a battery (and surface stuff)

we'll have to adapt the turorials etc depending on which version the player starts with
→ T-164

## N-0089 · 2026-10-13 00:56
i like the new art direction for the collar and surface-level entry room. let's apply a similar aesthetic to all of the other buildings on the surface
→ T-165

## N-0090 · 2026-10-13 20:42
we should switch storage room to have so many slots of storage for their size, and then you whitelist which resources are allowed to be put into one of the slots. you don't reserve a certain number of slots for a bunch of resources anymore. in the new scenario, you could whitelist every resource to be stored in a given storage room with 200 capacity and still fill all 200 with rock if that's the first 200 resources to attempt to be stored there.
→ T-166

## N-0091 · 2026-10-13 20:42
let's improve the floor texture for "bare rock" to be less lo-fi. additionally, the smoothed rock shouldn't show in square tiles; instead it should be a nearly textureless version of bare rock.
→ T-167

## N-0092 · 2026-10-13 20:42
when placing windows on a wall that has a room on the other side instead of a corridor, the window should show through to the other room. you pay resources the same as if placing the windows between a corridor and a room, though.
→ T-168

## N-0093 · 2026-10-13 20:42
when drawing a corridor over unexcavated rock, paint the corridor over the top "ceiling" of the rock instead of at the "bottom" of that segment. this applies to both hover while clicking to make single corridors as well as dragging/snaking a corridor chain.
→ T-169

## N-0094 · 2026-10-13 20:42
you shouldn't be able to select a floor on the floor picker bar until the drill is complete with drilling out that floor. we should show visuallly an overlay on the new floor in that floor menu as it is drilled out, showing the progress %, this means we don't need the drill % or drill pause in the top menu anymore. clicking on the drill itself gives you a choice for pausing it.
→ T-170

## N-0095 · 2026-10-19 21:55
We need to add a way for the player to diagnose problems with hole health and happiness, so they know why it is dropping and what to do to turn it around. For example, a hole I'm playing has a health of 3 and I can't figure out why. A solution could take the form of
- room details
- office visits that are either information only or per a challenge to take an action in a time frame
- specific charts interface 
- extra tutorial steps like the purpose of building bulkheads
→ F-018

## N-0096 · 2026-10-13 23:43
let's try using 0.5m for wall thickness, not 0.25m
→ T-179
