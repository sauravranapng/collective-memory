import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./room/RoomManager.js";
const PORT = Number(process.env.PORT) || 8080;
const wss = new WebSocketServer({
    port: PORT
});
const roomManager = new RoomManager();
const clients = new Map();
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
        }
        catch (error) {
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
function handleMessage(socket, message) {
    switch (message.type) {
        case "CREATE_ROOM":
            handleCreateRoom(socket, message.playerName);
            break;
        case "JOIN_ROOM":
            handleJoinRoom(socket, message.roomId, message.playerName);
            break;
        case "START_GAME":
            handleStartGame(socket);
            break;
        case "PLACE_OBJECT":
            handlePlaceObject(socket, message.objectId, message.row, message.col);
            break;
        case "START_SCORES":
            handleStartScores(socket);
            break;
        case "END_GAME":
            handleEndGame(socket);
            break;
        case "CHALLENGE_PLACEMENT":
            handleChallengePlacement(socket, message.objectId, message.placementPlayerId, message.replacementObjectId);
            break;
        case "NEXT_ROUND":
            handleNextRound(socket);
            break;
        default:
            sendError(socket, `Unknown message type: ${message.type}`);
    }
}
function handleCreateRoom(socket, playerName) {
    if (!playerName) {
        sendError(socket, "Player name is required");
        return;
    }
    try {
        const { room, player } = roomManager.createRoom(playerName);
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
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function handleJoinRoom(socket, roomId, playerName) {
    if (!roomId || !playerName) {
        sendError(socket, "Room ID and player name are required");
        return;
    }
    try {
        const { room, player } = roomManager.joinRoom(roomId.toUpperCase(), playerName);
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
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function handleStartGame(socket) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    try {
        const round = roomManager.startGame(client.roomId, client.playerId);
        broadcastGameStarted(client.roomId, round);
        const roomId = client.roomId;
        setTimeout(() => {
            const room = roomManager.getRoom(roomId);
            if (!room) {
                return;
            }
            const currentRound = room.currentRound;
            if (!currentRound ||
                currentRound.phase !== "MEMORIZE") {
                return;
            }
            roomManager.transitionToReconstruct(roomId);
            broadcastReconstructionStarted(roomId, room.currentRound);
            startReconstructionTimer(roomId);
        }, 20_000);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function handleDisconnect(socket) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        return;
    }
    roomManager.removePlayer(client.roomId, client.playerId);
    broadcastRoomState(client.roomId);
}
function broadcastScoresUpdated(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room)
        return;
    const scores = Array.from(room.players.values()).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));
    const message = { type: "SCORES_UPDATED", scores };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId && socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function broadcastRoomState(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
        return;
    }
    const players = Array.from(room.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
        score: player.score,
        challengesRemaining: player.challengesRemaining
    }));
    const message = {
        type: "ROOM_STATE",
        roomId: room.id,
        hostId: room.hostId,
        players
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function broadcastGameStarted(roomId, round) {
    const message = {
        type: "GAME_STARTED",
        phase: round.phase,
        roundNumber: round.number,
        originalObjects: round.originalObjects,
        phaseEndsAt: round.phaseEndsAt
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function broadcastReconstructionStarted(roomId, round) {
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
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function handlePlaceObject(socket, objectId, row, col) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    if (!objectId ||
        row === undefined ||
        col === undefined) {
        sendError(socket, "Invalid placement");
        return;
    }
    try {
        const placement = roomManager.placeObject(client.roomId, client.playerId, objectId, row, col);
        broadcastPlacement(client.roomId, placement);
        broadcastScoresUpdated(client.roomId);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function broadcastPlacement(roomId, placement) {
    const message = {
        type: "PLACEMENT_ADDED",
        placement: {
            objectId: placement.objectId,
            row: placement.row,
            col: placement.col,
            playerId: placement.playerId,
            challenged: placement.challenged ?? false,
            frozen: placement.frozen ?? false,
            superseded: placement.superseded ?? false
        }
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId && socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function startReconstructionTimer(roomId) {
    setTimeout(() => {
        const room = roomManager.getRoom(roomId);
        if (!room) {
            return;
        }
        const round = room.currentRound;
        if (!round ||
            round.phase !== "RECONSTRUCT") {
            return;
        }
        roomManager.finishReconstruction(roomId);
        broadcastRevealStarted(roomId, room.currentRound);
    }, 30_000);
}
function broadcastRevealStarted(roomId, round) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
        return;
    }
    const scores = Array.from(room.players.values()).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));
    const message = {
        type: "REVEAL_STARTED",
        phase: round.phase,
        roundNumber: round.number,
        phaseEndsAt: round.phaseEndsAt,
        originalObjects: round.originalObjects,
        placements: round.placements
            .filter((placement) => !placement.superseded)
            .map((placement) => ({
            objectId: placement.objectId,
            row: placement.row,
            col: placement.col,
            playerId: placement.playerId,
            challenged: placement.challenged,
            frozen: placement.frozen
        })),
        scores
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function broadcastScoresStarted(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.currentRound) {
        return;
    }
    const scores = Array.from(room.players.values()).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));
    const message = {
        type: "SCORES_STARTED",
        phase: "SCORES",
        roundNumber: room.currentRound.number,
        scores
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function handleStartScores(socket) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    try {
        roomManager.startScores(client.roomId, client.playerId);
        broadcastScoresStarted(client.roomId);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function handleEndGame(socket) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    try {
        roomManager.endGame(client.roomId, client.playerId);
        broadcastFinalScores(client.roomId);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function broadcastGameFinished(roomId) {
    const message = {
        type: "GAME_FINISHED"
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function handleChallengePlacement(socket, objectId, placementPlayerId, replacementObjectId) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    if (!objectId || !placementPlayerId || !replacementObjectId) {
        sendError(socket, "Select an object to replace the challenged placement");
        return;
    }
    try {
        const result = roomManager.challengePlacement(client.roomId, client.playerId, objectId, placementPlayerId, replacementObjectId);
        sendChallengeResult(socket, result.successful, result.replacementCorrect);
        broadcastPlacementUpdated(client.roomId, objectId, placementPlayerId);
        broadcastPlacement(client.roomId, result.replacementPlacement);
        broadcastScoresUpdated(client.roomId);
        broadcastRoomState(client.roomId);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function sendChallengeResult(socket, successful, replacementCorrect) {
    send(socket, {
        type: "CHALLENGE_RESULT",
        successful,
        replacementCorrect
    });
}
function broadcastPlacementUpdated(roomId, objectId, playerId) {
    const room = roomManager.getRoom(roomId);
    if (!room?.currentRound) {
        return;
    }
    const placement = room.currentRound.placements.find((item) => item.objectId === objectId &&
        item.playerId === playerId);
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
            frozen: placement.frozen,
            superseded: placement.superseded ?? false
        }
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function handleNextRound(socket) {
    const client = clients.get(socket);
    if (!client?.roomId || !client.playerId) {
        sendError(socket, "You are not in a room");
        return;
    }
    try {
        const round = roomManager.startNextRound(client.roomId, client.playerId);
        broadcastGameStarted(client.roomId, round);
        const roomId = client.roomId;
        setTimeout(() => {
            const room = roomManager.getRoom(roomId);
            if (!room) {
                return;
            }
            const currentRound = room.currentRound;
            if (!currentRound ||
                currentRound.phase !==
                    "MEMORIZE") {
                return;
            }
            roomManager.transitionToReconstruct(roomId);
            broadcastReconstructionStarted(roomId, room.currentRound);
            startReconstructionTimer(roomId);
        }, 20_000);
    }
    catch (error) {
        sendError(socket, getErrorMessage(error));
    }
}
function broadcastFinalScores(roomId) {
    const room = roomManager.getRoom(roomId);
    if (!room) {
        return;
    }
    const scores = Array.from(room.players.values()).map((player) => ({
        playerId: player.id,
        playerName: player.name,
        score: player.score
    }));
    const message = {
        type: "FINAL_SCORES",
        scores
    };
    for (const [socket, client] of clients) {
        if (client.roomId === roomId &&
            socket.readyState === WebSocket.OPEN) {
            send(socket, message);
        }
    }
}
function send(socket, message) {
    socket.send(JSON.stringify(message));
}
function sendError(socket, message) {
    send(socket, {
        type: "ERROR",
        message
    });
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return "Something went wrong";
}
console.log(`Collective Memory server listening on port ${PORT}`);
