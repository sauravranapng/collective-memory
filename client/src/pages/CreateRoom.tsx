import { useEffect, useState } from "react";
import { useGameSocket } from "../game/GameSocketContext";
import type { RoomState } from "../types/game";

interface CreateRoomProps {
    onRoomCreated: (
        roomState: RoomState,
        playerId: string
    ) => void;
    onBack: () => void;
}

export function CreateRoom({
                               onRoomCreated,
                               onBack
                           }: CreateRoomProps) {
    const { send, subscribe, connected } = useGameSocket();

    const [playerName, setPlayerName] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        return subscribe((message) => {
            if (message.type === "ROOM_CREATED") {
                const playerId = message.playerId as string;
                const roomId = message.roomId as string;
                const hostId = message.hostId as string;

                const roomState: RoomState = {
                    roomId,
                    hostId,
                    players: [
                        {
                            id: playerId,
                            name: playerName,
                            score: 0,
                            challengesRemaining: 3
                        }
                    ]
                };

                onRoomCreated(roomState, playerId);
                return;
            }

            if (message.type === "ERROR") {
                setError(message.message as string);
            }
        });
    }, [subscribe, onRoomCreated, playerName]);

    const handleCreateRoom = () => {
        if (!playerName.trim()) {
            setError("Please enter your name");
            return;
        }

        setError("");

        send({
            type: "CREATE_ROOM",
            playerName: playerName.trim()
        });
    };

    return (
        <div className="screen screen--form">
            <p className="eyebrow">Start a new game</p><h1>Create a room</h1><p>Choose a name and invite your friends with the room code.</p>

            <input
                value={playerName}
                onChange={(event) =>
                    setPlayerName(event.target.value)
                }
                placeholder="Enter your name"
            />

            <button
                onClick={handleCreateRoom}
                disabled={!connected}
            >
                {connected ? "Create" : "Connecting..."}
            </button>

            <button onClick={onBack}>
                Back
            </button>

            {error && <p className="form-error" role="alert">{error}</p>}
        </div>
    );
}
