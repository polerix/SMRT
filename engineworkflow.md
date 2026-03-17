Here's the full Agile work plan — structured as four focused sprints, each building on the last, with a strict MVP scope gate.The plan is organized across four sprints with a hard MVP gate at each one — you only move forward when the gate passes. A few things worth calling out:

**Sprint 0 is the most important.** Everything downstream lives or dies on the content schema. Getting that JSON contract right before touching engine code means SecurityAdventure authors and engine developers can work in parallel from Sprint 1 onward without stepping on each other.

**The engine/content split is strict by design.** SMRT's `engine/` folder never contains story content; SecurityAdventure never contains renderer code. The GitHub Action is the seam between them — this keeps your game portable and makes it possible to re-skin or swap content without touching the engine.

**Smarty the Fox is deliberately last.** She's a multiplier on a working game, not a foundation. Getting her into Sprint 3 also means she can be tested with real scene data and real player stuck-states rather than mocked content.

Click any user story card to prompt me to start building that specific piece. The schema tab shows a draft of what `game.schema.json` looks like — that's a natural starting point if you want to work through Sprint 0 right now.

SMRT is a game engine for SecurityAdventure.

see smrt_agile_workplan.html for more information.
