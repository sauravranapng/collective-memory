import type { RoomState } from "../types/game";
import { useGameSocket } from "../game/GameSocketContext";

interface LobbyProps {
    roomState: RoomState;
    playerId: string;
}

export function Lobby({
                          roomState,
                          playerId
                      }: LobbyProps) {
    const { send } = useGameSocket();

    const isHost = roomState.hostId === playerId;

    const handleStartGame = () => {
        console.log("Start Game clicked");

        send({
            type: "START_GAME"
        });
    };

    return (
        <div>
            <h1>Collective Memory</h1>

            <h2>Room: {roomState.roomId}</h2>

            <p>
                {roomState.players.length} / 10 players
            </p>

            <h3>Players</h3>

            <ul>
                {roomState.players.map((player) => (
                    <li key={player.id}>
                        {player.name}

                        {player.id === roomState.hostId && (
                            <span> (Host)</span>
                        )}

                        {player.id === playerId && (
                            <span> (You)</span>
                        )}
                    </li>
                ))}
            </ul>

            {isHost && (
                <button onClick={handleStartGame}>
                    Start Game
                </button>
            )}

            {!isHost && (
                <p>
                    Waiting for the host to start the game...
                </p>
            )}
        </div>
    );
}