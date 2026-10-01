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

export function Scores({ scores, playerId, hostId }: ScoresProps) {
    const { send } = useGameSocket();
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);
    const isHost = playerId === hostId;

    return (
        <main className="screen screen--scores">
            <p className="eyebrow">Round complete</p>
            <h1>Scoreboard</h1>
            <p>Every good memory counts. Here is where everyone stands.</p>
            <ol>
                {sortedScores.map((player) => (
                    <li key={player.playerId}>
                        <span className="score-player">{player.playerName}</span>
                        <span className="score-value">{player.score}</span>
                        {player.playerId === playerId ? <span className="score-you">You</span> : <span className="score-role">Player</span>}
                    </li>
                ))}
            </ol>
            {isHost ? (
                <div className="score-actions">
                    <button onClick={() => send({ type: "NEXT_ROUND" })}>Next Round</button>
                    <button onClick={() => send({ type: "END_GAME" })}>End Game</button>
                </div>
            ) : (
                <p>Waiting for the host to start the next round or end the game...</p>
            )}
        </main>
    );
}

