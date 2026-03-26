/**
 * Engine — main game loop, canvas, room/actor management, room transitions.
 */

class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        this.rooms = {};    // id → Room
        this.room = null;  // current Room
        this.actors = [];    // actors in current room
        this.player = null;  // player Actor

        // Global state shared across rooms
        this.gameState = {
            inventory: [],          // item ids collected
            roomStates: {},         // per-room state: { roomId: { key: value } }
            dialogLine: null,       // current one-liner text
            dialogSpeaker: null,    // the Actor who is speaking
            dialogTimer: 0,
            activeDialogChoices: null, // [string] or null
            onChoiceCallback: null,
            music: {
                currentTrack: null,
                volume: 0.5,
                isLooping: true,
                tracks: [] // { id, name, url }
            },
            // ── Sprint 0 additions ──────────────────────────────────────────
            flags: {},              // boolean flags set by dialogue choices
            risk: 0,               // numeric risk score (0 = safe, higher = riskier choices)
            earnedBadges: [],      // badge ids awarded during play
            gameData: null         // raw loaded JSON (for scene context injection into Smarty)
        };

        this.quips = {
            'Look at': ["It's just a {T}.", "I've seen better {T}s.", "Not much to say about this {T}.", "Standard issue {T}."],
            'Pick up': ["I can't carry a {T}!", "It's bolted down.", "My pockets aren't that big.", "I don't think that's portable."],
            'Talk to': ["It doesn't seem to want to talk to me.", "I'm talking to a {T}. I need a vacation.", "No response.", "It's giving me the silent treatment."],
            'Use': ["Use it how? I'm not a magician.", "I can't figure out how to use it.", "That doesn't seem to do anything."],
            'Push': ["It won't budge.", "It's heavier than it looks.", "I'm not strong enough to move that."],
            'Pull': ["It's stuck.", "I'm pulling, but nothing's happening.", "It seems firmly attached."],
            'Nothing': ["Nothing there.", "I'm staring at the scenery.", "Just empty space.", "Yep, that's part of the background."],
            'Default': ["I can't do that.", "No.", "Doesn't work.", "Maybe later."],
            'Item': ["Using {I} on {T}... nope.", "That doesn't fit.", "I don't think {I} works with {T}.", "Unlikely."]
        };

        this.ui = new ScummUI(this.canvas.width, this.canvas.height);
        this.input = new InputManager(this.canvas);
        this._lastTime = null;
        this._rafId = null;
        this.debug = false;

        this._wireInput();
    }

    // ── Room registry ──────────────────────────────────────────────────────
    registerRoom(room) {
        this.rooms[room.id] = room;
    }

    /** Switch to a different room, placing player at (entryX, entryY) */
    changeRoom(roomId, entryX, entryY) {
        if (!this.rooms[roomId]) {
            console.warn(`Room "${roomId}" not registered`);
            return;
        }
        this.room = this.rooms[roomId];
        this.actors = [];
        if (this.player) {
            this.player.x = entryX;
            this.player.y = entryY;
            this.player.stopWalking();
            this.actors.push(this.player);
        }
        // Re-add static NPC actors stored on the room
        if (this.room.npcs && this.room.npcs.length) {
            this.actors.push(...this.room.npcs);
        }
        console.log(`[Engine] → ${roomId}`);
    }

    loadRoom(room) {
        this.registerRoom(room);
        this.room = room;
    }

    // ── Actors ─────────────────────────────────────────────────────────────
    addActor(actor) { this.actors.push(actor); }
    setPlayer(actor) {
        this.player = actor;
        if (!this.actors.includes(actor)) this.actors.push(actor);
    }

    // ── Inventory helpers ──────────────────────────────────────────────────
    hasItem(id) { return this.gameState.inventory.includes(id); }
    addItem(id, displayName) {
        if (!this.hasItem(id)) {
            this.gameState.inventory.push(id);
            this.ui.inventory.push({ id, name: displayName ?? id });
            
            // Preload the item image if not already loaded
            if (!this.ui.loadedItemImages) this.ui.loadedItemImages = {};
            if (!this.ui.loadedItemImages[id]) {
                const img = new Image();
                img.src = `assets/item_${id}.png`;
                this.ui.loadedItemImages[id] = img;
            }
        }
    }
    removeItem(id) {
        const i = this.gameState.inventory.indexOf(id);
        if (i >= 0) {
            this.gameState.inventory.splice(i, 1);
            this.ui.inventory.splice(i, 1);
        }
    }

    say(text, duration = 3500, speaker = null) {
        // Clear any previous dialogue immediately when a new one starts
        if (this.gameState.dialogTimer > 3500) this.gameState.dialogTimer = 3500; 

        let actualText = text;
        let actualSpeaker = speaker;

        // Smart speaker detection: if text starts with "Name: ", try to find that actor
        if (!actualSpeaker) {
            const colonIndex = text.indexOf(':');
            if (colonIndex > 0 && colonIndex < 20) { // arbitrary limit to avoid catching long sentences
                const possibleName = text.substring(0, colonIndex).trim();
                // Find actor by name (case-insensitive)
                const found = this.actors.find(a => a.name.toLowerCase() === possibleName.toLowerCase());
                if (found) {
                    actualSpeaker = found;
                    // Strip the "Name: " and any surrounding quotes
                    actualText = text.substring(colonIndex + 1).trim();
                    if ((actualText.startsWith('"') && actualText.endsWith('"')) || 
                        (actualText.startsWith("'") && actualText.endsWith("'"))) {
                        actualText = actualText.substring(1, actualText.length - 1);
                    }
                }
            }
        }

        this.gameState.dialogLine = actualText;
        this.gameState.dialogTimer = duration;
        this.gameState.dialogSpeaker = actualSpeaker || this.player;
    }

    enterDialog(choices, callback) {
        this.gameState.activeDialogChoices = choices;
        this.gameState.onChoiceCallback = callback;
        this.ui.selectedVerb = null; // Hide the active verb pointer
        
        // Track that we successfully entered a conversation to prevent fallback quips
        this.gameState._interactTriggered = true;
    }

    onChoiceClick(index) {
        const callback = this.gameState.onChoiceCallback;
        const choice = this.gameState.activeDialogChoices[index];
        this.gameState.activeDialogChoices = null;
        this.gameState.onChoiceCallback = null;
        this.ui.selectedVerb = 'Walk to'; // Reset verb
        if (callback) callback(index, choice);
    }

    // ── Music ──────────────────────────────────────────────────────────────
    playMusic(trackId) {
        const track = this.gameState.music.tracks.find(t => t.id === trackId);
        if (!track) return;

        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        const audio = new Audio(track.url);
        audio.loop = this.gameState.music.isLooping;
        audio.volume = this.gameState.music.volume;
        audio.play().catch(e => console.warn("Music auto-play blocked by browser. Click to start."));
        
        this.currentAudio = audio;
        this.gameState.music.currentTrack = trackId;
    }

    stopMusic() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
            this.gameState.music.currentTrack = null;
        }
    }

    // ── Interactable helpers ───────────────────────────────────────────────
    getInteractableAt(mx, my) {
        if (!this.room) return null;

        // 1. Check actors (front to back)
        const actors = [...this.actors]
            .filter(a => a.isVisible !== false)
            .sort((a, b) => b.y - a.y); // Closest to bottom = front
            
        for (const actor of actors) {
            const h = actor.getHitbox();
            if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
                return h; // Returns hitbox object which acts like a hotspot
            }
        }

        // 2. Check room hotspots
        return this.room.getHotspotAt(mx, my, this);
    }

    getRoomState(roomId) {
        if (!this.gameState.roomStates[roomId])
            this.gameState.roomStates[roomId] = {};
        return this.gameState.roomStates[roomId];
    }

    // ── Input wiring ───────────────────────────────────────────────────────
    _wireInput() {
        this.input.onMouseMove((mx, my) => {
            this.ui.onMouseMove(mx, my);
            if (this.room && !this.ui.isInPanel(mx, my)) {
                this.ui.hoveredHotspot = this.getInteractableAt(mx, my);
            } else {
                this.ui.hoveredHotspot = null;
            }
        });

        this.input.onClick((mx, my) => {
            const verbClicked = this.ui.onClick(mx, my);
            if (verbClicked) return;
            if (!this.room) return;

            const hotspot = this.getInteractableAt(mx, my);
            if (hotspot) {
                // Walk Dave toward hotspot centre first, then interact
                if (this.player) {
                    const tx = hotspot.walkToX ?? (hotspot.x + hotspot.w / 2);
                    const ty = hotspot.walkToY ?? Math.min(hotspot.y + hotspot.h, 450);
                    const clamped = this.room.clampToWalkbox(tx, ty);
                    this.player.walkTo(clamped.x, clamped.y);
                    // Queue interaction after walk (simple: slight delay)
                    this.player._pendingInteract = () => this._onHotspotInteract(hotspot);
                } else {
                    this._onHotspotInteract(hotspot);
                }
            } else if (this.ui.selectedVerb === 'Walk to') {
                const clamped = this.room.clampToWalkbox(mx, my);
                if (this.player) this.player.walkTo(clamped.x, clamped.y);
            } else if (!this.ui.isInPanel(mx, my)) {
                // Clicked on background (no hotspot)
                if (this.ui.selectedVerb !== 'Walk to') {
                    this.triggerQuip('Nothing');
                }
            }
        });
    }

    triggerQuip(type, targetName = '', itemName = '') {
        const list = this.quips[type] || this.quips['Default'];
        let text = list[Math.floor(Math.random() * list.length)];
        text = text.replace('{T}', targetName || 'thing');
        text = text.replace('{I}', itemName || 'item');
        this.say(text);
    }

    _onHotspotInteract(hotspot) {
        const verb = this.ui.selectedVerb;
        const item = this.ui.selectedInventoryItem;
        
        // Track if any activity was triggered during interaction
        this.gameState._interactTriggered = false;
        const originalSay = this.say;
        this.say = (text, dur, speaker) => {
            this.gameState._interactTriggered = true;
            originalSay.call(this, text, dur, speaker);
        };

        if (typeof hotspot.onInteract === 'function') {
            hotspot.onInteract(verb, this, item);
        }

        this.say = originalSay;

        // Fallback if the interaction didn't trigger any dialogue or menu
        if (!this.gameState._interactTriggered && verb !== 'Walk to') {
            if (item) {
                this.triggerQuip('Item', hotspot.name, (typeof item === 'string' ? item : item.name));
            } else {
                this.triggerQuip(verb, hotspot.name);
            }
        }
    }

    // ── Main loop ──────────────────────────────────────────────────────────
    start() {
        this._lastTime = performance.now();
        const loop = (now) => {
            this._rafId = requestAnimationFrame(loop);
            const dt = Math.min(now - this._lastTime, 100);
            this._lastTime = now;
            this._update(dt);
            this._render();
        };
        this._rafId = requestAnimationFrame(loop);
    }

    stop() { if (this._rafId) cancelAnimationFrame(this._rafId); }

    _update(dt) {
        // Dialog timer
        if (this.gameState.dialogTimer > 0) {
            this.gameState.dialogTimer -= dt;
            if (this.gameState.dialogTimer <= 0) {
                this.gameState.dialogLine = null;
                this.gameState.dialogSpeaker = null;
            }
        }

        for (const actor of this.actors) {
            const wasWalking = actor.state === 'walking';
            actor.update(dt, this.room);
            // Fire queued interaction when actor finishes walking
            if (wasWalking && actor.state === 'idle' && actor._pendingInteract) {
                const fn = actor._pendingInteract;
                actor._pendingInteract = null;
                fn();
            }
        }
    }

    _render() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Room fills entire scene area above UI panel
        if (this.room) {
            this.room.draw(ctx, this);
            if (this.debug) this.room.drawDebugWalkbox(ctx);
        }

        // 2. Actors sorted        // Draw actors
        [...this.actors]
          .filter(a => a.isVisible !== false) // Only draw visible actors
          .sort((a, b) => a.y - b.y)
          .forEach(a => a.draw(ctx));

        // 3. Dialogue speech (above speaker's head)
        if (this.gameState.dialogLine) {
            this._drawDialog(ctx, this.gameState.dialogLine, this.gameState.dialogSpeaker);
        }

        // 4. UI panel
        this.ui.draw(ctx);
    }

    _drawDialog(ctx, text, speaker) {
        const actor = speaker || this.player;
        const x = actor ? actor.x : this.canvas.width / 2;
        const h = actor ? (actor.animator.defaultFrameH * actor.animator.scale) : 60;
        const y = actor ? (actor.y - h - 10) : 80;

        ctx.save();
        ctx.font = 'bold 18px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        
        const words = text.split(' ');
        const lines = [];
        let line = '';
        const maxW = 350;

        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        if (line) lines.push(line);

        const lh = 22;
        const startY = y - (lines.length * lh);

        lines.forEach((l, i) => {
            const ly = startY + i * lh;
            
            // Text Shadow
            ctx.fillStyle = '#000000';
            ctx.fillText(l, x + 2, ly + 2);
            
            // Main Text Color (from actor or white)
            ctx.fillStyle = actor ? (actor.color || '#ffffff') : '#ffffff';
            ctx.fillText(l, x, ly);
        });

        ctx.restore();
    }

    // ── Flag helpers ────────────────────────────────────────────────────────
    setFlag(key)   { this.gameState.flags[key] = true; }
    clearFlag(key) { this.gameState.flags[key] = false; }
    hasFlag(key)   { return !!this.gameState.flags[key]; }

    // ── Risk helper ─────────────────────────────────────────────────────────
    applyRisk(expr) {
        if (!expr) return;
        const m = expr.match(/^([+-])=([\d.]+)$/);
        if (m) {
            const delta = parseFloat(m[2]);
            this.gameState.risk = Math.max(0, this.gameState.risk + (m[1] === '+' ? delta : -delta));
            console.log(`[Engine] risk ${m[1]}= ${delta} → ${this.gameState.risk}`);
        }
    }

    // ── Badge award ─────────────────────────────────────────────────────────
    awardBadge(badgeId) {
        if (!badgeId) return;
        if (this.gameState.earnedBadges.includes(badgeId)) return;
        this.gameState.earnedBadges.push(badgeId);
        const badge = this.gameState.gameData?.badges?.[badgeId];
        const name  = badge?.name ?? badgeId;
        console.log(`[Engine] 🏅 Badge awarded: ${name}`);
        this.say(`🏅 Badge earned: ${name}!`, 5000);
    }

    // ── JSON-driven dialogue runner ──────────────────────────────────────────
    _runDialogueScript(scriptId) {
        const scripts = this.gameState.gameData?.dialogue;
        if (!scripts || !scripts[scriptId]) {
            console.warn(`[Engine] dialogue script not found: ${scriptId}`);
            return;
        }
        const script = scripts[scriptId];
        this._playDialogueLines(script.lines ?? [], () => {
            if (script.choices && script.choices.length) {
                const labels = script.choices.map(c => c.label);
                this.enterDialog(labels, (idx) => {
                    const choice = script.choices[idx];
                    if (!choice) return;
                    // Apply effects
                    if (choice.setFlag)   this.setFlag(choice.setFlag);
                    if (choice.clearFlag) this.clearFlag(choice.clearFlag);
                    if (choice.risk)      this.applyRisk(choice.risk);
                    if (choice.badge)     this.awardBadge(choice.badge);
                    // Play inline response lines, then optionally follow a goto
                    const responseLines = choice.lines ?? [];
                    this._playDialogueLines(responseLines, () => {
                        if (choice.to) this._runDialogueScript(choice.to);
                    });
                });
            }
        });
    }

    /** Play an array of dialogue lines sequentially, then call done(). */
    _playDialogueLines(lines, done) {
        if (!lines || lines.length === 0) { if (done) done(); return; }
        let i = 0;
        const next = () => {
            if (i >= lines.length) { if (done) done(); return; }
            const line = lines[i++];
            const speaker = line.speaker === 'narrator'
                ? null
                : this.actors.find(a => a.id === line.speaker) ?? this.player;
            const dur = line.duration ?? 3500;
            this.say(line.text, dur, speaker);
            setTimeout(next, dur + 200);
        };
        next();
    }

    // ── loadFromJSON — Sprint 0 ──────────────────────────────────────────────
    /**
     * Bootstrap the engine entirely from a smrt game data JSON object.
     * Replaces manual room/actor construction.
     *
     * @param {object} data - Validated game.schema.json payload
     * @param {object} [spriteMap] - Optional { actorId: HTMLImageElement } for pre-loaded sprites
     */
    loadFromJSON(data, spriteMap = {}) {
        this.gameState.gameData = data;
        this.gameState.risk = data.world?.riskStart ?? 0;

        // ── Register actors ─────────────────────────────────────────────────
        const allActors = {};
        for (const [id, def] of Object.entries(data.actors ?? {})) {
            const sprite = spriteMap[id] ?? null;
            let animator;
            if (sprite) {
                const frames = def.frames ?? {};
                const walkCount = frames.walk ?? 4;
                const talkCount = frames.talk ?? 2;
                const idleCount = frames.idle ?? 1;
                const fw = sprite.naturalWidth / Math.max(walkCount, talkCount, idleCount);
                const fh = sprite.naturalHeight;
                const anims = {
                    idle:  { fps: 1.5, frames: Array.from({ length: idleCount }, (_, i) => ({ x: i * fw, y: 0, w: fw, h: fh })) },
                    walkR: { fps: 8,   flipH: true, frames: Array.from({ length: walkCount }, (_, i) => ({ x: i * fw, y: 0, w: fw, h: fh })) },
                    walkL: { fps: 8,   frames: Array.from({ length: walkCount }, (_, i) => ({ x: i * fw, y: 0, w: fw, h: fh })) },
                    talk:  { fps: 6,   frames: Array.from({ length: talkCount }, (_, i) => ({ x: i * fw, y: 0, w: fw, h: fh })) },
                };
                animator = new SpriteAnimator(sprite, fw, fh, anims, 'auto');
            } else {
                // Procedural placeholder block — coloured rectangle
                animator = this._buildPlaceholderAnimator(id, def);
            }
            animator.play('idle');

            const actor = new Actor({ id, name: id, x: 400, y: 400, animator });
            actor.color = def.color ?? '#ffffff';
            actor.type  = def.type  ?? 'npc';
            if (def.speed) actor.speed = def.speed;
            allActors[id] = actor;
        }

        // ── Register scenes ─────────────────────────────────────────────────
        for (const [sceneId, sceneDef] of Object.entries(data.scenes ?? {})) {
            const bgImg = spriteMap[`scene_${sceneId}`] ?? null;

            const hotspots = (sceneDef.hotspots ?? []).map(h => this._buildHotspot(h, data));
            const transporterHotspots = (sceneDef.transporters ?? []).map(t => this._buildTransporter(t));

            const room = new Room({
                id: sceneId,
                name: sceneId,
                background: bgImg,
                walkbox: sceneDef.walkbox ?? [
                    { x: 0,   y: 510 }, { x: 960, y: 510 },
                    { x: 960, y: 300 }, { x: 0,   y: 300 }
                ],
                hotspots: [...hotspots, ...transporterHotspots]
            });

            // Attach NPC actors to the room so changeRoom re-spawns them
            room.npcs = (sceneDef.actors ?? []).map(actorId => {
                const a = allActors[actorId];
                if (!a) { console.warn(`[Engine] scene actor not found: ${actorId}`); return null; }
                return a;
            }).filter(Boolean);

            this.registerRoom(room);
        }

        // ── Set player ──────────────────────────────────────────────────────
        const playerId = data.world?.player;
        if (playerId && allActors[playerId]) {
            this.setPlayer(allActors[playerId]);
        } else {
            console.warn('[Engine] No player actor found — using placeholder');
        }

        // ── Start in startScene ─────────────────────────────────────────────
        const startScene = data.world?.startScene;
        if (startScene && this.rooms[startScene]) {
            this.changeRoom(startScene, 480, 450);
        } else {
            const first = Object.keys(this.rooms)[0];
            if (first) this.changeRoom(first, 480, 450);
        }

        console.log(`[Engine] Loaded "${data.world?.title ?? data.world?.id}" from JSON.`);
    }

    /** Build a hotspot object from JSON definition. */
    _buildHotspot(def, gameData) {
        const engine = this;
        return {
            id:       def.id,
            name:     def.name,
            x:        def.x,
            y:        def.y,
            w:        def.w,
            h:        def.h,
            walkToX:  def.walkToX,
            walkToY:  def.walkToY,
            isVisible: def.visibleFlag
                ? (e) => {
                    const val = !!e.gameState.flags[def.visibleFlag.flag];
                    return val === def.visibleFlag.value;
                }
                : undefined,
            onInteract(verb, e, item) {
                // Pick up item
                if (verb === 'Pick up' && def.pickupItem) {
                    if (!e.hasItem(def.pickupItem.id)) {
                        e.addItem(def.pickupItem.id, def.pickupItem.name);
                        e.say(`${def.pickupItem.name} added to inventory.`);
                    } else {
                        e.say(`I already have the ${def.pickupItem.name}.`);
                    }
                    return;
                }
                // Run dialogue script on Talk to / Use
                if ((verb === 'Talk to' || verb === 'Use') && def.script) {
                    e._runDialogueScript(def.script);
                    return;
                }
                // Look at / default — show examine text
                if (def.examine) {
                    e.say(def.examine, 5000);
                    return;
                }
            }
        };
    }

    /** Build a transporter hotspot from a JSON transporter definition. */
    _buildTransporter(def) {
        return {
            id:      def.id,
            name:    def.label,
            x:       def.x,
            y:       def.y,
            w:       def.w,
            h:       def.h,
            walkToX: def.walkToX,
            walkToY: def.walkToY,
            isVisible: def.condition
                ? (e) => {
                    const val = !!e.gameState.flags[def.condition.flag];
                    return val === def.condition.flagSet;
                }
                : undefined,
            onInteract(verb, e) {
                if (verb === 'Walk to' || verb === 'Use' || verb === 'Open') {
                    e.changeRoom(def.target, def.entryX ?? 200, def.entryY ?? 450);
                } else {
                    e.say(def.label);
                }
            }
        };
    }

    /** Build a solid-colour placeholder animator for actors without sprite sheets. */
    _buildPlaceholderAnimator(id, def) {
        const COLORS = {
            player:     '#FFD700',
            ai_guide:   '#FF8C00',
            antagonist: '#AA2222',
            npc:        '#44AA44'
        };
        const col   = COLORS[def.type] ?? '#888888';
        const oc    = document.createElement('canvas');
        oc.width    = 48;
        oc.height   = 96;
        const octx  = oc.getContext('2d');
        octx.fillStyle = col;
        octx.fillRect(0, 0, 48, 96);
        octx.fillStyle = '#000';
        octx.font = '9px monospace';
        octx.textAlign = 'center';
        octx.fillText(id.substring(0, 6), 24, 52);
        // Minimal animator using a single static frame
        const frames = { idle: { fps: 1, frames: [{ x: 0, y: 0, w: 48, h: 96 }] } };
        frames.walkR = { fps: 4, flipH: true, frames: [{ x: 0, y: 0, w: 48, h: 96 }] };
        frames.walkL = { fps: 4, frames: [{ x: 0, y: 0, w: 48, h: 96 }] };
        frames.talk  = { fps: 4, frames: [{ x: 0, y: 0, w: 48, h: 96 }] };
        return new SpriteAnimator(oc, 48, 96, frames, 'auto');
    }
}
