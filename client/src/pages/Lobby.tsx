import { useState } from "react";
import type { RoomState } from "../types/game";
import { useGameSocket } from "../game/GameSocketContext";

interface LobbyProps {
    roomState: RoomState;
    playerId: string;
}

export function Lobby({ roomState, playerId }: LobbyProps) {
    const { send } = useGameSocket();
    const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
    const isHost = roomState.hostId === playerId;

    const handleStartGame = () => send({ type: "START_GAME" });

    const handleCopyRoomCode = async () => {
        try {
            await navigator.clipboard.writeText(roomState.roomId);
            setCopyState("copied");
        } catch {
            setCopyState("failed");
        }
        window.setTimeout(() => setCopyState("idle"), 1800);
    };

    return (
        <div className="screen screen--lobby">
            <p className="eyebrow">Game lobby</p>
            <h1>Ready to remember?</h1>

            <h2>Your room code</h2>
            <div className="room-code-row">
                <div className="room-code">{roomState.roomId}</div>
                <button
                    className="room-code-copy"
                    type="button"
                    onClick={handleCopyRoomCode}
                    aria-label="Copy room code"
                    title={copyState === "copied" ? "Copied" : "Copy room code"}
                >
                    {copyState === "copied" ? (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                    ) : (
                        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></svg>
                    )}
                </button>
                {copyState === "copied" && <span className="copy-feedback" role="status">Copied</span>}
                {copyState === "failed" && <span className="copy-feedback copy-feedback--error" role="status">Could not copy</span>}
            </div>

            <p>{roomState.players.length} / 10 players</p>
            <h3>Players</h3>
            <ul className="player-list">
                {roomState.players.map((player) => (
                    <li key={player.id}>
                        <span>{player.name}</span>
                        <span className="player-tags">
                            {player.id === roomState.hostId && <span className="player-badge">Host</span>}
                            {player.id === playerId && <span className="player-badge">You</span>}
                        </span>
                    </li>
                ))}
            </ul>

            {isHost ? (
                <button onClick={handleStartGame}>Start Game</button>
            ) : (
                <p>Waiting for the host to start the game...</p>
            )}
        </div>
    );
}
