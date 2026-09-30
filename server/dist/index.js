import { WebSocketServer, WebSocket } from "ws";
import { RoomManager } from "./room/RoomManager.js";
const PORT = 8080;
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
            handleMessage(socket, message);
        }
        catch (error) {
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
console.log(`Collective Memory server running on ws://localhost:${PORT}`);
