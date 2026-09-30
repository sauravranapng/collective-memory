import WebSocket from "ws";
const socket = new WebSocket("ws://localhost:8080");
socket.on("open", () => {
    console.log("Connected to server");
    socket.send(JSON.stringify({
        type: "JOIN_ROOM",
        roomId: "A7FYWG",
        playerName: "Player 2"
    }));
});
socket.on("message", (data) => {
    console.log("Received:", data.toString());
});
socket.on("close", () => {
    console.log("Disconnected from server");
});
socket.on("error", (error) => {
    console.error("WebSocket error:", error);
});
