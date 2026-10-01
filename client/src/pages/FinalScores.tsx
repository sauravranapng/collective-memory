interface Score {
    playerId: string;
    playerName: string;
    score: number;
}

interface FinalScoresProps {
    scores: Score[];
    onGoHome: () => void;
    playerId: string;
}

export function FinalScores({ scores, onGoHome, playerId }: FinalScoresProps) {
    const sortedScores = [...scores].sort((a, b) => b.score - a.score);

    return (
        <main className="screen screen--final">
            <p className="eyebrow">That is a wrap</p>
            <h1>Final scores</h1>
            <p>Thanks for playing Collective Memory.</p>
            <ol>
                {sortedScores.map((player) => (
                    <li key={player.playerId}>
                        <span className="score-player">{player.playerName}</span>
                        <span className="score-value">{player.score}</span>
                        <span className={player.playerId === playerId ? "score-you" : "score-role"}>{player.playerId === playerId ? "You" : "Player"}</span>
                    </li>
                ))}
            </ol>
            <p>Game Over</p>
            <button onClick={onGoHome}>Go to Home</button>
        </main>
    );
}

