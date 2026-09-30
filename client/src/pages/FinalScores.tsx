interface Score {
    playerId: string;
    playerName: string;
    score: number;
}

interface FinalScoresProps {
    scores: Score[];
}

export function FinalScores({
                                scores
                            }: FinalScoresProps) {
    const sortedScores = [...scores].sort(
        (a, b) => b.score - a.score
    );

    return (
        <div>
            <h1>Final Scores</h1>

            <ol>
                {sortedScores.map((player) => (
                    <li key={player.playerId}>
                        {player.playerName}: {player.score}
                    </li>
                ))}
            </ol>

            <p>Game Over</p>
        </div>
    );
}