# Buddy's World Adventure — Dev Notes

## What This Is

A browser-based canvas platformer game (900×480px) built with vanilla JS ES modules — no build step, no dependencies. The player controls a character through 3 worlds, solving math, logic, and action challenges to rescue Luna the Fox. Buddy the dog follows the player and provides AI-powered hints.

## How to Run

Requires a local HTTP server (ES modules don't work over `file://`).

```bash
cd /Users/yairfelig/projects/worlds-game
python3 -m http.server 8765
```

Then open `http://localhost:8765/` in your browser.

## Controls

| Key | Action |
|-----|--------|
| A / D or ←/→ | Move |
| Space / ↑ | Jump |
| E | Enter a challenge zone |
| B | Open/close Buddy chat panel |
| P | Push-to-talk (when Buddy panel is open) |
| Esc | Close Buddy panel / exit challenge |

---

## Project Structure

```
worlds-game/
├── index.html                  # Entry point
├── js/
│   ├── main.js                 # Boot sequence — wires everything together
│   ├── engine.js               # Game loop, input, camera, rendering
│   ├── player.js               # Player physics and rendering
│   ├── buddy.js                # Buddy dog: AI client, speech bubble, animation
│   ├── buddy-panel.js          # Buddy conversation sidebar panel (NEW)
│   ├── world-manager.js        # World transitions, portal logic, victory screen
│   ├── audio-manager.js        # Web Audio API: music, SFX
│   ├── uglab-client.js         # UGLabs AI client (voice + text)
│   ├── config.js               # API keys / connection config
│   ├── worlds/
│   │   ├── world1.js           # Enchanted Forest
│   │   ├── world2.js           # Sky Kingdom
│   │   └── world3.js           # Volcano Arena
│   └── challenges/
│       ├── challenge-manager.js # Overlay system, lives, credits, failure handling
│       ├── math.js             # Math challenges (multiple choice)
│       ├── logic.js            # Logic/deduction challenges
│       └── action.js           # Action challenges (click battle, rhythm, lightning)
```

---

## Key Systems

### Game Loop (`engine.js`)
- `Engine` class owns the canvas, RAF loop, input, and camera
- `_update()` runs only when not paused and story is done
- `_render()` runs every frame regardless — renders world, player, buddy, HUD, buddy panel, challenge overlay
- B key is handled in `_bindInput()` (always fires, even when paused)

### Worlds (`worlds/world*.js`)
Each world exports a `createWorldN()` function returning a plain object:
- `platforms[]` — x, y, w, h, color, topColor, optional glowColor
- `decorations[]` — trees, mushrooms, lava, spires, etc.
- `challengeZones[]` — id, x, y, w, h, label, solved
- `portal` — x, y, locked

### Challenges (`challenges/`)
Each challenge class implements:
- `init(zone, worldIndex, audioManager, callbacks)` — set up, `callbacks.onCorrect` called on correct answer
- `render(ctx)` — draw the challenge UI
- `handleInput(event)` — keyboard/mouse events
- `isDone()` — returns true when player wins
- `isFailed()` — returns true when player loses

`ChallengeManager` owns lives (3) and credits (3). Credits are earned on correct answers (+1) and spent on Buddy hints (-1).

### Buddy Panel (`buddy-panel.js`)
- Fixed portrait button bottom-right of canvas (click or press B)
- Opens a sidebar with full conversation history
- Text input (type + Enter) or push-to-talk (P key)
- Pauses engine while open; closing during a challenge does NOT unpause (challenge stays active)
- Subscribes to `buddy.onTextChunk()` to stream Buddy's responses live into the chat

### Lives & Credits
- 3 lives — lose one on challenge failure
- 0 lives → current world resets (all zones unsolved, player returns to start)
- 3 credits at start — earn +1 per correct answer, spend 1 to ask Buddy for a hint

### Story
- Intro screen: "Save Luna the Fox" narrative
- Luna progress bar top-right HUD (3 segments, one per world)
- Victory screen: "YOU SAVED LUNA!" with canvas-drawn fox

---

## Things to Pick Up / Extend

### Easy wins
- **Buddy button position** — `BuddyPanel.BTN_X / BTN_Y` in `buddy-panel.js`
- **Panel width** — `BuddyPanel.PANEL_W` (currently 245px)
- **World colors / platforms** — edit the relevant `worlds/world*.js`
- **Challenge difficulty** — edit question generation in `math.js` / `logic.js`
- **Buddy's personality prompts** — `WORLD_COACHING` object at top of `buddy.js`

### Medium
- **Add a 4th world** — create `worlds/world4.js`, add to `world-manager.js` `WORLDS` array
- **New challenge type** — create a class in `challenges/`, add to `ZONE_TYPES` map in `challenge-manager.js`
- **Sound effects** — `audio-manager.js` has `playJump`, `playSuccess`, `playWrong`, `playBark` etc.
- **Mobile support** — add touch events in `engine.js` `_bindInput()` and `buddy-panel.js`

### Larger
- **Persistent progress** — save `zone.solved` and world index to `localStorage`
- **Leaderboard / score** — track time, credits remaining, number of lives lost
- **More narrative** — add cutscene frames between worlds (similar to story screen pattern in `engine.js`)

---

## AI / UGLabs Connection

The game connects to UGLabs for Buddy's AI voice and text responses.

- Config is in `js/config.js` (`API_KEY`, `PLAYER_ID`, `AUTH_URL`, `WS_URL`)
- Connection is non-blocking — game works without it, Buddy just can't respond
- `buddy.chat(text, gameState)` — send a free-form message
- `buddy.requestHelp(gameState)` — send a structured hint request
- Buddy streams text back via `client` events → updates both speech bubble and chat panel

---

## Last Session Summary (Feb 2026)

Implemented a full feature update:
1. Math Zone 1 converted to multiple choice (timer removed)
2. Lives system (3 hearts, world reset on 0)
3. Credits system (earn on correct answers, spend on hints)
4. Buddy conversation panel (portrait button, sidebar, text + voice)
5. World 3 platform visibility improvements
6. "Save Luna the Fox" narrative + progress bar + victory screen
7. Correct-answer particles and +1 🦴 floating text
