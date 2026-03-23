# SMRT × SecurityAdventure — Shared World Integration Workflow

## Overview

This plan integrates content from the **SecurityAdventure** storyline repository into
the **SMRT** game engine to produce a coherent, branching cybersecurity awareness
adventure. The engine/content split is preserved: SMRT owns `engine/`; all story
content lives in `game/security_adventure.json`.

---

## Shared World: "The Wanda Incident"

A single narrative arc threads through every scene. **Wanda** is an insider-threat /
social engineer targeting a federal government office. **Justin** (the player) must
notice, investigate, and report each anomaly. **Smarty** (AI fox) appears after idle
periods to ask Socratic questions — never giving answers directly.

### World Map

```
[parking_lot] ──► [lobby] ──► [server_room]
                    │
                    ▼
               [cafeteria]
                    │
                    ▼
              [workstation]
                    │
                    ▼
               [boardroom]
```

### Character Arcs

| Character | Role | Arc |
|-----------|------|-----|
| Justin | Player (GoC employee) | Grows from passive bystander to active security reporter |
| Smarty | AI Guide (fox) | Socratic mentor — never lectures, always questions |
| Wanda | Antagonist | Executes a multi-vector social engineering campaign |

---

## Sprint Workflow

### Stage 0 — Schema Gate (Architecture Reviewer)
- Confirm `game.schema.json` covers all new constructs needed
- Gate: JSON validates before engine code touches it

### Stage 1 — World Expansion (Content Specialist)
New scenes authored as JSON matching the schema:

| Scene ID | Security Topic | Key Hotspots |
|----------|---------------|--------------|
| `parking_lot` | Tailgating / piggybacking | Secure door, visitor gate, Wanda at entrance |
| `cafeteria` | Shoulder surfing, overheard data | Wanda's table, open laptop, conversation |
| `workstation` | Clean desk, screen lock, passwords | Unlocked screen, sticky-note password, clear desk |
| `boardroom` | Sensitive meetings, visitor badges, screen sharing | Projector, visitor without badge, whiteboard |

### Stage 2 — Branch Completeness (QA Reviewer)
- Every dialogue script has at least one safe and one unsafe choice
- Every unsafe path has a Smarty follow-up question
- Risk deltas are calibrated (+= for bad, -= for good, proportional to severity)
- All flag names are consistent across scenes (snake_case)

### Stage 3 — Integration (Engine Reviewer)
- All actor IDs referenced in scene `actors[]` exist in `actors{}`
- All `script` references in hotspots exist in `dialogue{}`
- All `target` values in transporters reference existing scene IDs
- All badge IDs referenced in choices exist in `badges{}`

---

## Branching Action Map

```
phishing_email ──bad──► phishing_followup_bad ──recover──► [badge: quick_recovery]
               ──good──► phishing_followup_good ──report──► [badge: reporter]
               ──report──► [badge: reporter] (direct)

usb_drop ──plug──► [risk +=30, Smarty prompt]
         ──report──► [badge: usb_aware]
         ──pocket──► [risk +=20, Smarty prompt]

access_log_review ──ignore──► [risk +=10]
                  ──report──► [badge: vigilant]

briefcase_examine ──take──► [risk +=20]
                  ──report──► [badge: reporter]

[NEW] tailgating ──hold_door──► [risk +=20, flag: tailgating_enabled]
                 ──challenge──► [badge: door_guardian]

[NEW] shoulder_surfing ──say_nothing──► [risk +=15]
                       ──speak_up──► [badge: screen_guardian]

[NEW] clean_desk ──leave_it──► [risk +=10]
                 ──secure_desk──► [badge: clean_desk]

[NEW] boardroom_visitor ──ignore_badge──► [risk +=25]
                        ──escort_out──► [badge: access_control]
```

---

## Reviewer Specialists

| Stage | Specialist | Verification Criteria |
|-------|-----------|----------------------|
| Schema | Architecture Reviewer | JSON validates against `game.schema.json` |
| Content | Narrative Reviewer | Branching completeness, consistent tone, Smarty always Socratic |
| Risk | Balance Reviewer | Risk scores calibrated, good choices always decrease risk |
| Flags | State Reviewer | Flag names consistent, no orphaned flags, visibleFlag logic correct |
| References | Engine Reviewer | All IDs cross-referenced, no dangling pointers |

---

## Acceptance Criteria

- [ ] 4 new scenes added (parking_lot, cafeteria, workstation, boardroom)
- [ ] Each scene has 2+ hotspots with scripts
- [ ] All unsafe choices have Smarty follow-up (`to:` pointing to recovery script)
- [ ] 4 new badges awarded for correct security behaviour
- [ ] JSON validates against `game.schema.json` with no errors
- [ ] All transporter chains tested (can navigate full world map)
- [ ] Data Guardian badge logic added (low-risk completion award)
