import { useEffect, useMemo, useState } from "react";
import type { DragEvent, KeyboardEvent } from "react";
import { useGameSocket } from "../game/GameSocketContext";
import type { Placement, Player } from "../types/game";

interface ReconstructionObject {
    id: string;
    emoji: string;
}

interface ReconstructProps {
    objects: ReconstructionObject[];
    phaseEndsAt: number;
    playerId: string;
    players: Player[];
}

const GRID_SIZE = 6;
const placementKey = (placement: Pick<Placement, "objectId" | "playerId">) =>
    `${placement.playerId}:${placement.objectId}`;

export function Reconstruct({ objects, phaseEndsAt, playerId, players }: ReconstructProps) {
    const { send, subscribe } = useGameSocket();
    const [placements, setPlacements] = useState<Placement[]>([]);
    const [challengeCount, setChallengeCount] = useState(0);
    const [challengeMessage, setChallengeMessage] = useState("");
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [remainingSeconds, setRemainingSeconds] = useState(() =>
        Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
    );
    const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);

    const playerNames = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);
    const currentPlayer = players.find((player) => player.id === playerId);
    const myPlacementCount = placements.filter((placement) => placement.playerId === playerId && !placement.superseded).length;
    const myUsedObjectCount = placements.filter((placement) => placement.playerId === playerId).length;

    useEffect(() => {
        setChallengeCount(currentPlayer?.challengesRemaining ?? 0);
    }, [currentPlayer?.challengesRemaining, playerId]);

    useEffect(() => {
        const interval = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000));
            setRemainingSeconds(remaining);
            if (remaining === 0) clearInterval(interval);
        }, 100);
        return () => clearInterval(interval);
    }, [phaseEndsAt]);

    useEffect(() => subscribe((message) => {
        if (message.type === "PLACEMENT_ADDED" || message.type === "PLACEMENT_UPDATED") {
            const incoming = message.placement as Partial<Placement>;
            if (!incoming.objectId || !incoming.playerId || typeof incoming.row !== "number" || typeof incoming.col !== "number") return;
            const placement: Placement = {
                objectId: incoming.objectId,
                row: incoming.row,
                col: incoming.col,
                playerId: incoming.playerId,
                challenged: incoming.challenged ?? false,
                frozen: incoming.frozen ?? false,
                superseded: incoming.superseded ?? false
            };
            setPlacements((current) => {
                const key = placementKey(placement);
                const index = current.findIndex((item) => placementKey(item) === key);
                if (index < 0) return [...current, placement];
                const updated = [...current];
                updated[index] = placement;
                return updated;
            });
            if (placement.playerId === playerId) {
                setSelectedObjectId((selected) => selected === placement.objectId ? null : selected);
            }
        }
        if (message.type === "CHALLENGE_RESULT") {
            const successful = message.successful === true;
            const replacementCorrect = message.replacementCorrect === true;
            setChallengeCount((count) => Math.max(0, count - 1));
            setChallengeMessage(!successful ? "Challenge failed. You lose 10 points; the original placer earns 10." : replacementCorrect ? "Challenge successful. Your replacement is correct: +10 points; the original placer loses 5." : "Challenge successful, but your replacement is incorrect. The original placer loses 5.");
        }
        if (message.type === "PLACEMENT_REJECTED" || message.type === "ERROR") {
            setChallengeMessage(String(message.message ?? "The action could not be completed."));
        }
    }), [subscribe, playerId]);

    const getPlacementAt = (row: number, col: number) => placements.find((placement) => !placement.superseded && placement.row === row && placement.col === col);
    const isObjectPlacedByCurrentPlayer = (objectId: string) => placements.some((placement) => placement.objectId === objectId && placement.playerId === playerId);

    const placeObject = (objectId: string, row: number, col: number) => {
        if (getPlacementAt(row, col) || isObjectPlacedByCurrentPlayer(objectId)) return;
        setChallengeMessage("");
        send({ type: "PLACE_OBJECT", objectId, row, col });
        setSelectedObjectId(null);
        setDraggedObjectId(null);
    };

    const handleDragStart = (event: DragEvent<HTMLButtonElement>, objectId: string) => {
        if (isObjectPlacedByCurrentPlayer(objectId)) {
            event.preventDefault();
            return;
        }
        setSelectedObjectId(objectId);
        setDraggedObjectId(objectId);
        event.dataTransfer.setData("text/plain", objectId);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>, row: number, col: number) => {
        event.preventDefault();
        const objectId = event.dataTransfer.getData("text/plain") || selectedObjectId;
        if (objectId) placeObject(objectId, row, col);
        setDraggedObjectId(null);
    };

    const handleCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: number, col: number) => {
        if ((event.key === "Enter" || event.key === " ") && selectedObjectId) {
            event.preventDefault();
            placeObject(selectedObjectId, row, col);
        }
    };

    const challenge = (placement: Placement) => {
        if (!selectedObjectId || selectedObjectId === placement.objectId || placement.playerId === playerId || placement.challenged || placement.frozen || challengeCount <= 0) return;
        setChallengeMessage("");
        send({
            type: "CHALLENGE_PLACEMENT",
            objectId: placement.objectId,
            placementPlayerId: placement.playerId,
            replacementObjectId: selectedObjectId
        });
    };
    return (
        <main className="screen reconstruct-screen">
            <header className="reconstruct-header">
                <div>
                    <p className="eyebrow">Your turn</p>
                    <h1>Rebuild the board</h1>
                    <p>Select an object, then tap a cell—or drag it into place.</p>
                </div>
                <div className={`timer-pill ${remainingSeconds <= 5 ? "timer-pill--urgent" : ""}`}>◷ {remainingSeconds}s</div>
            </header>

            <div className="placement-meta reconstruct-stats">
                <span className="stat-chip">Placed {myPlacementCount} / {objects.length}</span>
                <span className="stat-chip stat-chip--score">Your score {currentPlayer?.score ?? 0}</span>
                <span className="stat-chip">Challenges {challengeCount}</span>
                {selectedObjectId && <span className="stat-chip stat-chip--selected">Choose a cell</span>}
            </div>

            <div className="reconstruct-layout">
                <section className="reconstruct-tray" aria-label="Available objects">
                    <div className="reconstruct-pane-heading">
                        <h2>Objects</h2>
                        <span>{objects.length - myUsedObjectCount} left</span>
                    </div>
                    <div className="object-tray">
                        {objects.filter((object) => !isObjectPlacedByCurrentPlayer(object.id)).map((object) => (
                            <button
                                className={`object-token${selectedObjectId === object.id ? " object-token--selected" : ""}`}
                                key={object.id}
                                type="button"
                                draggable
                                aria-label={`Select ${object.emoji}`}
                                aria-pressed={selectedObjectId === object.id}
                                onClick={() => setSelectedObjectId((current) => current === object.id ? null : object.id)}
                                onDragStart={(event) => handleDragStart(event, object.id)}
                                onDragEnd={() => setDraggedObjectId(null)}
                            >
                                {object.emoji}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="reconstruct-board" aria-label="Reconstruction grid">
                    <div className="reconstruct-pane-heading">
                        <h2>Board</h2>
                        <span>6 × 6</span>
                    </div>
                    <div className="board">
                        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
                            const row = Math.floor(index / GRID_SIZE);
                            const col = index % GRID_SIZE;
                            const placement = getPlacementAt(row, col);
                            const object = placement && objects.find((item) => item.id === placement.objectId);
                            const canChallenge = !!placement && placement.playerId !== playerId && !placement.challenged && !placement.frozen && challengeCount > 0;
                            const canReplaceAndChallenge = canChallenge && !!selectedObjectId && selectedObjectId !== placement.objectId;
                            return (
                                <div
                                    className={`board-cell${placement?.frozen ? " board-cell--frozen" : ""}${draggedObjectId && !placement ? " board-cell--drop-ready" : ""}`}
                                    key={`${row}-${col}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Row ${row + 1}, column ${col + 1}${placement ? ", occupied" : selectedObjectId ? ", place selected object" : ", empty"}`}
                                    onClick={() => selectedObjectId && !placement && placeObject(selectedObjectId, row, col)}
                                    onKeyDown={(event) => handleCellKeyDown(event, row, col)}
                                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
                                    onDrop={(event) => handleDrop(event, row, col)}
                                >
                                    {object && <span className="board-emoji">{object.emoji}</span>}
                                    {placement && <small>{playerNames.get(placement.playerId) ?? "Player"}{placement.playerId === playerId ? " · you" : ""}</small>}
                                    {placement?.challenged && <small>{placement.frozen ? "Challenged · frozen" : "Challenged"}</small>}
                                    {canChallenge && (
                                        <button className="challenge-button" type="button" disabled={!canReplaceAndChallenge} title={selectedObjectId ? "Replace and challenge this placement" : "Select a replacement object first"} onClick={(event) => { event.stopPropagation(); challenge(placement); }}>Replace &amp; Challenge</button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>

            {challengeMessage && <p className="reconstruct-message" role="status">{challengeMessage}</p>}
        </main>
    );
}



