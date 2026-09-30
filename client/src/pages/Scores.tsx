import { useGameSocket } from "../game/GameSocketContext";

interface Score {
    playerId: string;
    playerName: string;
    score: number;
}

interface ScoresProps {
    scores: Score[];
    playerId: string;
    hostId: string;
}

export function Scores({
                           scores,
                           playerId,
                           hostId
                       }: ScoresProps) {
    const { send } = useGameSocket();

    const sortedScores = [...scores].sort(
        (a, b) => b.score - a.score
    );

    const isHost =
        playerId === hostId;

    const handleEndGame = () => {
        send({
            type: "END_GAME"
        });
    };

    const handleNextRound = () => {
        send({ type: "NEXT_ROUND" });
    };

    return (
        <div>
            <h1>Scores</h1>

            <h2>Current Scores</h2>

            <ol>
                {sortedScores.map((player) => (
                    <li key={player.playerId}>
                        {player.playerName}:{" "}
                        {player.score}

                        {player.playerId ===
                            playerId && (
                                <span> (You)</span>
                            )}
                    </li>
                ))}
            </ol>

            {isHost ? (
                <div style={{ display: "flex", gap: 12 }}>
                    <button onClick={handleNextRound}>Next Round</button>
                    <button onClick={handleEndGame}>End Game</button>
                </div>
            ) : (
                <p>
                    Waiting for the host to start the next round or end the game...
                </p>
            )}
        </div>
    );
}
