import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./room/RoomManager.js";

const PORT = 8080;

const wss = new WebSocketServer({
    port: PORT
});

const roomManager = new RoomManager();

interface Client {
    socket: WebSocket;
    roomId?: string;
    playerId?: string;
}

const clients = new Map<WebSocket, Client>();

wss.on("connection", (socket) => {
    console.log("Client connected");

    clients.set(socket, {
        socket
    });

    socket.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            console.log("Received from client:", message);

            handleMessage(socket, message);
        } catch (error) {
            console.error("Failed to process message:", error);
            sendError(socket, "Invalid message");
        }
    });

    socket.on("close", () => {
        handleDisconnect(socket);
        clients.delete(socket);

        console.log("Client disconnected");
    });
});

function handleMessage(
    socket: WebSocket,
    message: {
        type: string;
        playerName?: string;
        roomId?: string;
        objectId?: string;
        row?: number;
        col?: number;
        playerId?: string;
    }
): void {
    switch (message.type) {
        case "CREATE_ROOM":
            handleCreateRoom(socket, message.playerName);
            break;

        case "JOIN_ROOM":
            handleJoinRoom(
                socket,
                message.roomId,
                message.playerName
            );
            break;

        case "START_GAME":
            handleStartGame(socket);
            break;

        case "PLACE_OBJECT":
            handlePlaceObject(
                socket,
                message.objectId,
                message.row,
                message.col
            );
            break;

        case "START_SCORES":
            handleStartScores(socket);
            break;

        case "END_GAME":
            handleEndGame(socket);
            break;

        case "CHALLENGE_PLACEMENT":
            handleChallengePlacement(
                socket,
                message.objectId,
                message.playerId
            );
            break;

        case "NEXT_ROUND":
            handleNextRound(socket);
            break;

        default:
            sendError(
                socket,
                `Unknown message type: ${message.type}`
            );
    }
}

function handleCreateRoom(
    socket: WebSocket,
    playerName?: string
): void {
    if (!playerName) {
        sendError(socket, "Player name is required");
        return;
    }

    try {
        const { room, player } =
            roomManager.createRoom(playerName);

        const client = clients.get(socket);

        if (!client) {
            return;
        }

        client.roomId = room.id;
        client.playerId = player.id;

        send(socket, {
            type: "ROOM_CREATED",
            roomId: room.id,
            playerId: player.id,
            hostId: room.hostId
        });

        broadcastRoomState(room.id);
    } catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}

function handleJoinRoom(
    socket: WebSocket,
    roomId?: string,
    playerName?: string
): void {
    if (!roomId || !playerName) {
        sendError(
            socket,
            "Room ID and player name are required"
        );
        return;
    }

    try {
        const { room, player } =
            roomManager.joinRoom(
                roomId.toUpperCase(),
                playerName
            );

        const client = clients.get(socket);

        if (!client) {
            return;
        }

        client.roomId = room.id;
        client.playerId = player.id;

        send(socket, {
            type: "ROOM_JOINED",
            roomId: room.id,
            playerId: player.id,
            hostId: room.hostId
        });

        broadcastRoomState(room.id);
    } catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}

function handleStartGame(socket: WebSocket): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }

    try {
        const round = roomManager.startGame(
            client.roomId,
            client.playerId
        );

        broadcastGameStarted(
            client.roomId,
            round
        );

        const roomId = client.roomId;

        setTimeout(() => {
            const room = roomManager.getRoom(roomId);

            if (!room) {
                return;
            }

            const currentRound = room.currentRound;

            if (
                !currentRound ||
                currentRound.phase !== "MEMORIZE"
            ) {
                return;
            }

            roomManager.transitionToReconstruct(
                roomId
            );

            broadcastReconstructionStarted(
                roomId,
                room.currentRound!
            );

            startReconstructionTimer(roomId);
        }, 10_000);
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}

function handleDisconnect(socket: WebSocket): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        return;
    }

    roomManager.removePlayer(
        client.roomId,
        client.playerId
    );

    broadcastRoomState(client.roomId);
}

function broadcastRoomState(roomId: string): void {
    const room = roomManager.getRoom(roomId);

    if (!room) {
        return;
    }

    const players = Array.from(room.players.values()).map(
        (player) => ({
            id: player.id,
            name: player.name,
            score: player.score,
            challengesRemaining:
            player.challengesRemaining
        })
    );

    const message = {
        type: "ROOM_STATE",
        roomId: room.id,
        hostId: room.hostId,
        players
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function broadcastGameStarted(
    roomId: string,
    round: {
        number: number;
        phase: string;
        originalObjects: unknown[];
        phaseEndsAt: number;
    }
): void {
    const message = {
        type: "GAME_STARTED",
        phase: round.phase,
        roundNumber: round.number,
        originalObjects: round.originalObjects,
        phaseEndsAt: round.phaseEndsAt
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function broadcastReconstructionStarted(
    roomId: string,
    round: {
        number: number;
        phase: string;
        originalObjects: {
            id: string;
            emoji: string;
            row: number;
            col: number;
        }[];
        phaseEndsAt: number;
    }
): void {
    const message = {
        type: "RECONSTRUCTION_STARTED",
        phase: round.phase,
        roundNumber: round.number,
        phaseEndsAt: round.phaseEndsAt,

        // Important:
        // Do NOT send row/col here.
        objects: round.originalObjects.map((object) => ({
            id: object.id,
            emoji: object.emoji
        }))
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function handlePlaceObject(
    socket: WebSocket,
    objectId: string | undefined,
    row: number | undefined,
    col: number | undefined
): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }

    if (
        !objectId ||
        row === undefined ||
        col === undefined
    ) {
        sendError(socket, "Invalid placement");
        return;
    }

    try {
        const placement = roomManager.placeObject(
            client.roomId,
            client.playerId,
            objectId,
            row,
            col
        );

        broadcastPlacement(
            client.roomId,
            placement
        );
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}

function broadcastPlacement(
    roomId: string,
    placement: {
        objectId: string;
        row: number;
        col: number;
        playerId: string;
    }
): void {
    const message = {
        type: "PLACEMENT_ADDED",
        placement: {
            objectId: placement.objectId,
            row: placement.row,
            col: placement.col,
            playerId: placement.playerId,
            challenged: false,
            frozen: false
        }
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function startReconstructionTimer(
    roomId: string
): void {
    setTimeout(() => {
        const room = roomManager.getRoom(roomId);

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

        roomManager.finishReconstruction(
            roomId
        );

        broadcastRevealStarted(
            roomId,
            room.currentRound!
        );

    }, 30_000);
}

function broadcastRevealStarted(
    roomId: string,
    round: {
        number: number;
        phase: string;
        originalObjects: {
            id: string;
            emoji: string;
            row: number;
            col: number;
        }[];
        placements: {
            objectId: string;
            row: number;
            col: number;
            playerId: string;
        }[];
        phaseEndsAt: number;
    }
): void {
    const room = roomManager.getRoom(roomId);

    if (!room) {
        return;
    }

    const scores = Array.from(
        room.players.values()
    ).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));

    const message = {
        type: "REVEAL_STARTED",
        phase: round.phase,
        roundNumber: round.number,
        phaseEndsAt: round.phaseEndsAt,

        originalObjects:
        round.originalObjects,

        placements:
        round.placements,

        scores
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function broadcastScoresStarted(
    roomId: string
): void {
    const room = roomManager.getRoom(roomId);

    if (!room || !room.currentRound) {
        return;
    }


    const scores = Array.from(
        room.players.values()
    ).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));

    const message = {
        type: "SCORES_STARTED",
        phase: "SCORES",
        roundNumber:
        room.currentRound.number,
        scores
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function handleStartScores(
    socket: WebSocket
): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(
            socket,
            "You are not in a room"
        );
        return;
    }

    try {
        roomManager.startScores(
            client.roomId,
            client.playerId
        );

        broadcastScoresStarted(
            client.roomId
        );
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}

function handleEndGame(
    socket: WebSocket
): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(
            socket,
            "You are not in a room"
        );
        return;
    }

    try {
        roomManager.endGame(
            client.roomId,
            client.playerId
        );

        broadcastFinalScores(
            client.roomId
        );
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}

function broadcastGameFinished(
    roomId: string
): void {
    const message = {
        type: "GAME_FINISHED"
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function handleChallengePlacement(
    socket: WebSocket,
    objectId: string | undefined,
    placementPlayerId: string | undefined
): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(
            socket,
            "You are not in a room"
        );
        return;
    }

    if (!objectId || !placementPlayerId) {
        sendError(
            socket,
            "Invalid challenge"
        );
        return;
    }

    try {
        const result =
            roomManager.challengePlacement(
                client.roomId,
                client.playerId,
                objectId,
                placementPlayerId
            );

        sendChallengeResult(
            socket,
            result.successful
        );

        broadcastPlacementUpdated(
            client.roomId,
            objectId,
            placementPlayerId
        );
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}
function sendChallengeResult(
    socket: WebSocket,
    successful: boolean
): void {
    send(socket, {
        type: "CHALLENGE_RESULT",
        successful
    });
}

function broadcastPlacementUpdated(
    roomId: string,
    objectId: string,
    playerId: string
): void {
    const room = roomManager.getRoom(roomId);

    if (!room?.currentRound) {
        return;
    }

    const placement =
        room.currentRound.placements.find(
            (item) =>
                item.objectId === objectId &&
                item.playerId === playerId
        );

    if (!placement) {
        return;
    }

    const message = {
        type: "PLACEMENT_UPDATED",
        placement: {
            objectId: placement.objectId,
            row: placement.row,
            col: placement.col,
            playerId: placement.playerId,
            challenged: placement.challenged,
            frozen: placement.frozen
        }
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function handleNextRound(
    socket: WebSocket
): void {
    const client = clients.get(socket);

    if (!client?.roomId || !client.playerId) {
        sendError(
            socket,
            "You are not in a room"
        );
        return;
    }

    try {
        const round =
            roomManager.startNextRound(
                client.roomId,
                client.playerId
            );

        broadcastGameStarted(
            client.roomId,
            round
        );

        const roomId = client.roomId;

        setTimeout(() => {
            const room =
                roomManager.getRoom(roomId);

            if (!room) {
                return;
            }

            const currentRound =
                room.currentRound;

            if (
                !currentRound ||
                currentRound.phase !==
                "MEMORIZE"
            ) {
                return;
            }

            roomManager.transitionToReconstruct(
                roomId
            );

            broadcastReconstructionStarted(
                roomId,
                room.currentRound!
            );

            startReconstructionTimer(
                roomId
            );
        }, 10_000);
    } catch (error) {
        sendError(
            socket,
            getErrorMessage(error)
        );
    }
}

function broadcastFinalScores(
    roomId: string
): void {
    const room =
        roomManager.getRoom(roomId);

    if (!room) {
        return;
    }

    const scores =
        Array.from(
            room.players.values()
        ).map((player) => ({
            playerId: player.id,
            playerName: player.name,
            score: player.score
        }));

    const message = {
        type: "FINAL_SCORES",
        scores
    };

    for (const [socket, client] of clients) {
        if (
            client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN
        ) {
            send(socket, message);
        }
    }
}

function send(
    socket: WebSocket,
    message: unknown
): void {
    socket.send(JSON.stringify(message));
}

function sendError(
    socket: WebSocket,
    message: string
): void {
    send(socket, {
        type: "ERROR",
        message
    });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return "Something went wrong";
}

console.log(
    `Collective Memory server running on ws://localhost:${PORT}`
);