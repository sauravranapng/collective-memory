import { randomBytes, randomUUID } from "node:crypto";
const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 10;
export class RoomManager {
    rooms = new Map();
    createRoom(playerName) {
        const roomId = this.generateRoomId();
        const player = {
            id: randomUUID(),
            name: playerName,
            score: 0,
            challengesRemaining: 3
        };
        const room = {
            id: roomId,
            hostId: player.id,
            players: new Map([[player.id, player]]),
            phase: "LOBBY",
            currentRound: null
        };
        this.rooms.set(roomId, room);
        return { room, player };
    }
    joinRoom(roomId, playerName) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error("Room not found");
        }
        if (room.players.size >= MAX_PLAYERS) {
            throw new Error("Room is full");
        }
        const player = {
            id: randomUUID(),
            name: playerName,
            score: 0,
            challengesRemaining: 3
        };
        room.players.set(player.id, player);
        return { room, player };
    }
    removePlayer(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        room.players.delete(playerId);
        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            return;
        }
        if (room.hostId === playerId) {
            const nextPlayer = room.players.values().next().value;
            room.hostId = nextPlayer.id;
        }
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    generateRoomId() {
        let roomId;
        do {
            roomId = randomBytes(4)
                .toString("base64url")
                .substring(0, ROOM_CODE_LENGTH)
                .toUpperCase();
        } while (this.rooms.has(roomId));
        return roomId;
    }
    startGame(roomId, playerId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error("Room not found");
        }
        if (room.hostId !== playerId) {
            throw new Error("Only the host can start the game");
        }
        if (room.phase !== "LOBBY") {
            throw new Error("Game has already started");
        }
        if (room.players.size < 2) {
            throw new Error("At least 2 players are required");
        }
        const originalObjects = this.generateObjects();
        const now = Date.now();
        const round = {
            number: 1,
            phase: "MEMORIZE",
            originalObjects,
            placements: [],
            startedAt: now,
            phaseEndsAt: now + 10_000
        };
        room.phase = "MEMORIZE";
        room.currentRound = round;
        return round;
    }
    generateObjects() {
        const emojis = [
            "🍎",
            "🚀",
            "🎸",
            "🐱",
            "🌙",
            "⚽",
            "🍕",
            "🌈",
            "🎲",
            "🚲"
        ];
        const positions = this.generatePositions(emojis.length);
        return emojis.map((emoji, index) => ({
            id: `object-${index + 1}`,
            emoji,
            row: positions[index].row,
            col: positions[index].col
        }));
    }
    generatePositions(count) {
        const positions = [];
        while (positions.length < count) {
            const row = Math.floor(Math.random() * 6);
            const col = Math.floor(Math.random() * 6);
            const alreadyUsed = positions.some((position) => position.row === row &&
                position.col === col);
            if (!alreadyUsed) {
                positions.push({ row, col });
            }
        }
        return positions;
    }
}
