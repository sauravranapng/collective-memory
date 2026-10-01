# Collective Memory

A multiplayer memory game where players recreate a shared board, challenge placements, and compete across rounds.

## Play

[Play Collective Memory](https://collective-memory-client-hi29nv0i0-sauravranabhari2002-1758.vercel.app/)

## Rules

- Play with at least two people. One player creates a room and shares its room code; the others join with that code.
- Each round shows 18 objects on a 6 × 6 board for 20 seconds. Memorize which object is in each cell.
- The board is hidden for the reconstruction phase. Players have 30 seconds to place objects in the cells where they remember seeing them. Each player can place a given object once, and an occupied cell can only be changed by a challenge.
- Every player starts each round with three challenges. To challenge an opponent, select a different unused object and choose **Replace & Challenge** on their placement. The selected object replaces theirs in that cell. You cannot challenge your own placement or challenge the same placement twice.
- When reconstruction ends, the original board is revealed. The scoreboard shows the players’ cumulative scores.
- The host chooses **Next Round** to continue or **End Game** to finish. At the end, everyone can return home.

## Scoring

- Correct placement: **+10 points**.
- Incorrect placement: **−5 points**.
- Challenging a correct placement fails and costs the challenger **−10 points**. The original placer keeps the **+10** earned for placing it correctly.
- Challenging an incorrect placement succeeds. The original placer receives **−5** for the incorrect placement; the challenger earns **+10** if their replacement is correct, or **−5** if it is incorrect.
- Scores carry across rounds. Each player’s three challenges reset at the start of every round.

## Playbook

1. **Create or join a room.** The host creates a room and shares its code. Everyone else joins using the code.
2. **Study the board.** During the 20-second viewing period, group the objects by rows or memorable clusters and note their positions.
3. **Rebuild together.** During the 30-second timer, drag an object to a cell, or select it and tap a cell. Your current score is visible during play.
4. **Challenge carefully.** If an opponent’s placement looks wrong, select the object you believe belongs in that cell, then challenge the placement. A failed challenge costs 10 points, so use your limited challenges where you have a strong memory.
5. **Review and continue.** Compare scores after the reveal. The host can start another round or end the game; all players can return home from the final scores screen.

## Project structure

- `client/` — React, TypeScript, and Vite frontend
- `server/` — Node.js WebSocket game server
