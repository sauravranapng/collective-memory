import { useEffect, useState } from "react";
import { useGameSocket } from "../game/GameSocketContext";
import type { RoomState } from "../types/game";

interface JoinRoomProps {
    onJoined: (
        roomState: RoomState,
        playerId: string
    ) => void;
    onBack: () => void;
}

export function JoinRoom({
                             onJoined,
                             onBack
                         }: JoinRoomProps) {
    const { send, subscribe, connected } = useGameSocket();

    const [roomId, setRoomId] = useState("");
    const [playerName, setPlayerName] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        return subscribe((message) => {
            if (message.type === "ROOM_JOINED") {
                const playerId = message.playerId as string;
                const joinedRoomId = message.roomId as string;
                const hostId = message.hostId as string;

                const roomState: RoomState = {
                    roomId: joinedRoomId,
                    hostId,
                    players: []
                };

                onJoined(roomState, playerId);
                return;
            }

            if (message.type === "ERROR") {
                setError(message.message as string);
            }
        });
    }, [subscribe, onJoined]);

    const handleJoinRoom = () => {
        if (!roomId.trim()) {
            setError("Please enter a room code");
            return;
        }

        if (!playerName.trim()) {
            setError("Please enter your name");
            return;
        }

        setError("");

        send({
            type: "JOIN_ROOM",
            roomId: roomId.trim().toUpperCase(),
            playerName: playerName.trim()
        });
    };

    return (
        <div className="screen screen--form">
            <p className="eyebrow">Join your people</p><h1>Join a room</h1><p>Enter the room code and your name to join the game.</p>

            <input
                value={roomId}
                onChange={(event) =>
                    setRoomId(event.target.value.toUpperCase())
                }
                placeholder="Room code"
                maxLength={6}
            />

            <input
                value={playerName}
                onChange={(event) =>
                    setPlayerName(event.target.value)
                }
                placeholder="Enter your name"
            />

            <button
                onClick={handleJoinRoom}
                disabled={!connected}
            >
                {connected ? "Join" : "Connecting..."}
            </button>

            <button onClick={onBack}>
                Back
            </button>

            {error && <p className="form-error" role="alert">{error}</p>}
        </div>
    );
}
