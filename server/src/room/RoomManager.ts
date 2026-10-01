import { randomBytes, randomUUID } from "node:crypto";
import type {GameObject, Placement, Player, Room, Round} from "../types/game.js";

const ROOM_CODE_LENGTH = 6;
const MAX_PLAYERS = 10;

export class RoomManager {
    private readonly rooms = new Map<string, Room>();

    createRoom(playerName: string): {
        room: Room;
        player: Player;
    } {
        const roomId = this.generateRoomId();

        const player: Player = {
            id: randomUUID(),
            name: playerName,
            score: 0,
            challengesRemaining: 3
        };

        const room: Room = {
            id: roomId,
            hostId: player.id,
            players: new Map([[player.id, player]]),
            phase: "LOBBY",
            currentRound: null
        };

        this.rooms.set(roomId, room);

        return { room, player };
    }

    joinRoom(
        roomId: string,
        playerName: string
    ): {
        room: Room;
        player: Player;
    } {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.players.size >= MAX_PLAYERS) {
            throw new Error("Room is full");
        }

        const player: Player = {
            id: randomUUID(),
            name: playerName,
            score: 0,
            challengesRemaining: 3
        };

        room.players.set(player.id, player);

        return { room, player };
    }

    removePlayer(roomId: string, playerId: string): void {
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
            const nextPlayer = room.players.values().next().value as Player;
            room.hostId = nextPlayer.id;
        }
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    private generateRoomId(): string {
        let roomId: string;

        do {
            roomId = randomBytes(4)
                .toString("base64url")
                .substring(0, ROOM_CODE_LENGTH)
                .toUpperCase();
        } while (this.rooms.has(roomId));

        return roomId;
    }

    startGame(roomId: string, playerId: string):  Round {
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

        const round: Round = {
            number: 1,
            phase: "MEMORIZE",
            originalObjects,
            placements: [],
            startedAt: now,
            phaseEndsAt: now + 20_000
        };

        room.phase = "MEMORIZE";
        room.currentRound = round;

        return round;
    }

    transitionToReconstruct(roomId: string): void {
        const room = this.rooms.get(roomId);

        if (!room) {
            return;
        }

        const round = room.currentRound;

        if (!round || round.phase !== "MEMORIZE") {
            return;
        }

        round.phase = "RECONSTRUCT";
        round.phaseEndsAt = Date.now() + 30_000;

        room.phase = "RECONSTRUCT";
    }

    private generateObjects(): GameObject[] {
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
            "🚲",
            "🍓",
            "🐸",
            "🎁",
            "🧁",
            "🐙",
            "🌵",
            "🎈",
            "🦋"
        ];

        const positions = this.generatePositions(
            emojis.length
        );

        return emojis.map((emoji, index) => ({
            id: `object-${index + 1}`,
            emoji,
            row: positions[index].row,
            col: positions[index].col
        }));
    }

    private generatePositions(
        count: number
    ): { row: number; col: number }[] {
        const positions: {
            row: number;
            col: number;
        }[] = [];

        while (positions.length < count) {
            const row = Math.floor(Math.random() * 6);
            const col = Math.floor(Math.random() * 6);

            const alreadyUsed = positions.some(
                (position) =>
                    position.row === row &&
                    position.col === col
            );

            if (!alreadyUsed) {
                positions.push({ row, col });
            }
        }

        return positions;
    }

    placeObject(
        roomId: string,
        playerId: string,
        objectId: string,
        row: number,
        col: number
    ): Placement {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (!room.players.has(playerId)) {
            throw new Error("Player is not in this room");
        }

        const round = room.currentRound;

        if (!round) {
            throw new Error("No active round");
        }

        if (round.phase !== "RECONSTRUCT") {
            throw new Error(
                "Objects can only be placed during reconstruction"
            );
        }

        if (
            row < 0 ||
            row >= 6 ||
            col < 0 ||
            col >= 6
        ) {
            throw new Error("Invalid grid position");
        }

        const object = round.originalObjects.find(
            (item) => item.id === objectId
        );

        if (!object) {
            throw new Error("Invalid object");
        }

        const playerAlreadyPlacedObject =
            round.placements.some(
                (placement) =>
                    placement.playerId === playerId &&
                    placement.objectId === objectId
            );

        if (playerAlreadyPlacedObject) {
            throw new Error(
                "You have already placed this object"
            );
        }

        const cellAlreadyOccupied =
            round.placements.some(
                (placement) =>
                    placement.row === row &&
                    placement.col === col
            );

        if (cellAlreadyOccupied) {
            throw new Error(
                "This cell is already occupied"
            );
        }

        const placement: Placement = {
            objectId,
            row,
            col,
            playerId,
            challenged: false,
            frozen: false,
            scored: true
        };

        const player = room.players.get(playerId);
        if (player) {
            player.score += object.row === row && object.col === col ? 10 : -5;
        }

        round.placements.push(placement);

        return placement;
    }

    finishReconstruction(
        roomId: string
    ): void {
        const room = this.rooms.get(roomId);

        if (!room) {
            return;
        }

        const round = room.currentRound;

        if (
            !round ||
            round.phase !== "RECONSTRUCT"
        ) {
            return;
        }

        for (const placement of round.placements) {
            if (placement.superseded || placement.scored) {
                continue;
            }
            const object =
                round.originalObjects.find(
                    (item) =>
                        item.id === placement.objectId
                );

            if (!object) {
                continue;
            }

            const player =
                room.players.get(
                    placement.playerId
                );

            if (!player) {
                continue;
            }

            const isCorrect =
                object.row === placement.row &&
                object.col === placement.col;

            if (
                isCorrect &&
                !(
                    placement.challenged &&
                    placement.challengeSuccessful
                )
            ) {
                player.score += 10;
            }
        }

        round.phase = "REVEAL";
        round.phaseEndsAt = 0;

        room.phase = "REVEAL";
    }

    startScores(
        roomId: string,
        playerId: string
    ): void {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.hostId !== playerId) {
            throw new Error(
                "Only the host can continue to scores"
            );
        }

        const round = room.currentRound;

        if (!round || round.phase !== "REVEAL") {
            throw new Error(
                "Scores can only start after reveal"
            );
        }

        round.phase = "SCORES";
        round.phaseEndsAt = 0;

        room.phase = "SCORES";
    }

    endGame(roomId: string, playerId: string): void {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.hostId !== playerId) {
            throw new Error("Only the host can end the game");
        }

        if (room.phase !== "SCORES") {
            throw new Error(
                "Game can only be ended from the scores phase"
            );
        }

        room.phase = "FINISHED";

        if (room.currentRound) {
            room.currentRound.phase = "FINISHED";
            room.currentRound.phaseEndsAt = 0;
        }
    }

    challengePlacement(
        roomId: string,
        challengerId: string,
        placementObjectId: string,
        placementPlayerId: string,
        replacementObjectId: string
    ): {
        successful: boolean;
        replacementCorrect: boolean;
        challengerScore: number;
        placementPlayerScore: number;
        placementPlayerId: string;
        challengedPlacement: Placement;
        replacementPlacement: Placement;
    } {
        const room = this.rooms.get(roomId);
        if (!room) throw new Error("Room not found");

        const round = room.currentRound;
        if (!round) throw new Error("No active round");
        if (round.phase !== "RECONSTRUCT") {
            throw new Error("Challenges are only allowed during reconstruction");
        }
        if (challengerId === placementPlayerId) {
            throw new Error("You cannot challenge your own placement");
        }

        const challenger = room.players.get(challengerId);
        if (!challenger) throw new Error("Challenger is not in the room");
        if (challenger.challengesRemaining <= 0) {
            throw new Error("No challenges remaining");
        }

        const placement = round.placements.find(
            (item) => item.objectId === placementObjectId && item.playerId === placementPlayerId && !item.superseded
        );
        if (!placement) throw new Error("Placement not found");
        if (placement.challenged || placement.frozen) {
            throw new Error("This placement has already been challenged");
        }
        if (!replacementObjectId || replacementObjectId === placementObjectId) {
            throw new Error("Choose a different object as the replacement");
        }

        const originalObject = round.originalObjects.find((object) => object.id === placement.objectId);
        const replacementObject = round.originalObjects.find((object) => object.id === replacementObjectId);
        if (!originalObject || !replacementObject) {
            throw new Error("Original or replacement object not found");
        }
        const placementPlayer = room.players.get(placement.playerId);
        if (!placementPlayer) throw new Error("Placement owner is not in the room");

        const challengerAlreadyPlacedReplacement = round.placements.some(
            (item) => item.playerId === challengerId && item.objectId === replacementObjectId
        );
        if (challengerAlreadyPlacedReplacement) {
            throw new Error("You have already placed this object");
        }

        const challengedPlacementCorrect =
            originalObject.row === placement.row && originalObject.col === placement.col;
        const successful = !challengedPlacementCorrect;
        const replacementCorrect =
            replacementObject.row === placement.row && replacementObject.col === placement.col;

        challenger.challengesRemaining--;
        placement.challenged = true;
        placement.challengeSuccessful = successful;
        placement.frozen = true;
        placement.superseded = true;
        placement.scored = true;

        const replacementPlacement: Placement = {
            objectId: replacementObjectId,
            row: placement.row,
            col: placement.col,
            playerId: challengerId,
            challenged: true,
            challengeSuccessful: successful,
            frozen: true,
            superseded: false,
            scored: true
        };
        round.placements.push(replacementPlacement);

        if (challengedPlacementCorrect) {
            // The original placement was already scored when it was made.
            challenger.score -= 10;
        } else {
            // The original placement already received its -5 penalty.
            // Score the challenger's replacement as a normal placement.
            challenger.score += replacementCorrect ? 10 : -5;
        }

        return {
            successful,
            replacementCorrect,
            challengerScore: challenger.score,
            placementPlayerScore: placementPlayer.score,
            placementPlayerId,
            challengedPlacement: placement,
            replacementPlacement
        };
    }
    startNextRound(
        roomId: string,
        playerId: string
    ): Round {
        const room = this.rooms.get(roomId);

        if (!room) {
            throw new Error("Room not found");
        }

        if (room.hostId !== playerId) {
            throw new Error(
                "Only the host can start the next round"
            );
        }

        if (room.phase !== "SCORES") {
            throw new Error(
                "Next round can only start from scores"
            );
        }

        const previousRound =
            room.currentRound;

        if (!previousRound) {
            throw new Error(
                "No previous round exists"
            );
        }

        const originalObjects =
            this.generateObjects();

        const now = Date.now();

        const round: Round = {
            number:
                previousRound.number + 1,

            phase: "MEMORIZE",

            originalObjects,

            placements: [],

            startedAt: now,

            phaseEndsAt:
                now + 20_000
        };

        room.currentRound = round;
        room.phase = "MEMORIZE";

        for (const player of room.players.values()) {
            player.challengesRemaining = 3;
        }

        return round;
    }
}

