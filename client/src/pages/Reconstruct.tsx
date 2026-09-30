import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
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
    const [remainingSeconds, setRemainingSeconds] = useState(() =>
        Math.max(0, Math.ceil((phaseEndsAt - Date.now()) / 1000))
    );
    const [draggedObjectId, setDraggedObjectId] = useState<string | null>(null);

    const playerNames = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);

    useEffect(() => {
        setChallengeCount(players.find((player) => player.id === playerId)?.challengesRemaining ?? 0);
    }, [players, playerId]);

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
                frozen: incoming.frozen ?? false
            };
            setPlacements((current) => {
                const key = placementKey(placement);
                const index = current.findIndex((item) => placementKey(item) === key);
                if (index < 0) return [...current, placement];
                const updated = [...current];
                updated[index] = placement;
                return updated;
            });
        }
        if (message.type === "CHALLENGE_RESULT") {
            const successful = message.successful === true;
            setChallengeCount((count) => Math.max(0, count - 1));
            setChallengeMessage(successful ? "Challenge successful: the placement was incorrect." : "Challenge unsuccessful: the placement was correct.");
        }
        if (message.type === "PLACEMENT_REJECTED" || message.type === "ERROR") {
            setChallengeMessage(String(message.message ?? "The action could not be completed."));
        }
    }), [subscribe]);

    const getPlacementAt = (row: number, col: number) => placements.find((p) => p.row === row && p.col === col);
    const isObjectPlacedByCurrentPlayer = (objectId: string) => placements.some((p) => p.objectId === objectId && p.playerId === playerId);

    const handleDragStart = (event: DragEvent<HTMLDivElement>, objectId: string) => {
        if (isObjectPlacedByCurrentPlayer(objectId)) { event.preventDefault(); return; }
        setDraggedObjectId(objectId);
        event.dataTransfer.setData("objectId", objectId);
        event.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = (event: DragEvent<HTMLButtonElement>, row: number, col: number) => {
        event.preventDefault();
        const objectId = event.dataTransfer.getData("objectId");
        if (objectId && !getPlacementAt(row, col) && !isObjectPlacedByCurrentPlayer(objectId)) {
            send({ type: "PLACE_OBJECT", objectId, row, col });
        }
        setDraggedObjectId(null);
    };

    const challenge = (placement: Placement) => {
        if (placement.playerId === playerId || placement.challenged || placement.frozen || challengeCount <= 0) return;
        setChallengeMessage("");
        send({ type: "CHALLENGE_PLACEMENT", objectId: placement.objectId, placementPlayerId: placement.playerId });
    };

    return <div>
        <h1>Reconstruct</h1>
        <h2>Time remaining: {remainingSeconds}</h2>
        <p>Drag each object into the cell where you remember seeing it.</p>
        <h3>Objects</h3>
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            {objects.filter((object) => !isObjectPlacedByCurrentPlayer(object.id)).map((object) =>
                <div key={object.id} draggable onDragStart={(event) => handleDragStart(event, object.id)} onDragEnd={() => setDraggedObjectId(null)}
                    style={{ width: 60, height: 60, border: "2px solid black", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, cursor: "grab", userSelect: "none" }}>
                    {object.emoji}
                </div>
            )}
        </div>
        <h3>Board</h3>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_SIZE}, 100px)`, gap: 4 }}>
            {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
                const row = Math.floor(index / GRID_SIZE);
                const col = index % GRID_SIZE;
                const placement = getPlacementAt(row, col);
                const object = placement && objects.find((item) => item.id === placement.objectId);
                const canChallenge = !!placement && placement.playerId !== playerId && !placement.challenged && !placement.frozen && challengeCount > 0;
                return <div key={`${row}-${col}`} style={{ width: 100, minHeight: 82, border: "1px solid black", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: placement?.frozen ? "#e8e8e8" : draggedObjectId && !placement ? "#f5f5f5" : "white" }}>
                    <button aria-label={`Place at row ${row + 1}, column ${col + 1}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleDrop(event, row, col)}
                        style={{ border: 0, background: "transparent", fontSize: 30, minHeight: 40, cursor: draggedObjectId && !placement ? "copy" : "default" }}>
                        {object?.emoji}
                    </button>
                    {placement && <small>{playerNames.get(placement.playerId) ?? "Player"}{placement.playerId === playerId ? " (you)" : ""}</small>}
                    {placement?.challenged && <small>{placement.frozen ? "Challenged · frozen" : "Challenged"}</small>}
                    {canChallenge && <button onClick={() => challenge(placement)}>Challenge</button>}
                </div>;
            })}
        </div>
        <p>Your placements: {placements.filter((p) => p.playerId === playerId).length} / {objects.length}</p>
        <p>Challenges remaining: {challengeCount}</p>
        {challengeMessage && <p role="status">{challengeMessage}</p>}
    </div>;
}
