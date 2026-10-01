import { useEffect, useState } from "react";
import type { GameObject } from "../types/game";
import type { Placement } from "../types/game";
import { useGameSocket } from "../game/GameSocketContext";

interface RevealProps {
    objects: GameObject[];
    placements: Placement[];
    phaseEndsAt: number;
    playerId: string;
    hostId: string;
}

const GRID_SIZE = 6;

export function Reveal({
                           objects,
                           placements,
                           phaseEndsAt,
                           playerId,
                           hostId
                       }: RevealProps) {
    const { send } = useGameSocket();

    const [remainingSeconds, setRemainingSeconds] =
        useState(() =>
            Math.max(
                0,
                Math.ceil(
                    (phaseEndsAt - Date.now()) / 1000
                )
            )
        );

    const isHost = playerId === hostId;

    useEffect(() => {
        if (phaseEndsAt <= 0) {
            return;
        }

        const interval = setInterval(() => {
            const remaining = Math.max(
                0,
                Math.ceil(
                    (phaseEndsAt - Date.now()) / 1000
                )
            );

            setRemainingSeconds(remaining);

            if (remaining === 0) {
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [phaseEndsAt]);

    const getObjectAt = (
        row: number,
        col: number
    ): GameObject | undefined => {
        return objects.find(
            (object) =>
                object.row === row &&
                object.col === col
        );
    };

    const getPlacementsAt = (
        row: number,
        col: number
    ): Placement[] => {
        return placements.filter(
            (placement) =>
                placement.row === row &&
                placement.col === col
        );
    };

    const getObjectForPlacement = (
        placement: Placement
    ): GameObject | undefined => {
        return objects.find(
            (object) =>
                object.id === placement.objectId
        );
    };

    const handleContinueToScores = () => {
        send({
            type: "START_SCORES"
        });
    };

    return (
        <div className="screen">
            <p className="eyebrow">Round recap</p><h1>See what everyone remembered</h1>

            <h2>
                Original Board
            </h2>

            <p>
                Time remaining:{" "}
                {remainingSeconds}
            </p>

            <div
                className="board"
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        `repeat(${GRID_SIZE}, 70px)`,
                    gap: "4px"
                }}
            >
                {Array.from(
                    {
                        length:
                            GRID_SIZE * GRID_SIZE
                    },
                    (_, index) => {
                        const row = Math.floor(
                            index / GRID_SIZE
                        );

                        const col =
                            index % GRID_SIZE;

                        const original =
                            getObjectAt(row, col);

                        const cellPlacements =
                            getPlacementsAt(
                                row,
                                col
                            );

                        return (
                            <div
                                className="board-cell" key={`${row}-${col}`}
                                style={{
                                    width: "70px",
                                    height: "70px",
                                    border:
                                        "1px solid black",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "28px"
                                }}
                            >
                                {original?.emoji}

                                {cellPlacements.length >
                                    0 && (
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "2px",
                                                fontSize: "14px"
                                            }}
                                        >
                                            {cellPlacements.map(
                                                (placement) => {
                                                    const placedObject =
                                                        getObjectForPlacement(
                                                            placement
                                                        );

                                                    return (
                                                        <span
                                                            key={`${placement.playerId}-${placement.objectId}`}
                                                            title={`${placement.playerId}${placement.challenged ? " · challenged" : ""}${placement.frozen ? " · frozen" : ""}`}
                                                        >
                                                            {placedObject?.emoji}{placement.challenged ? "⚑" : ""}
                                                        </span>
                                                    );
                                                }
                                            )}
                                        </div>
                                    )}
                            </div>
                        );
                    }
                )}
            </div>

            <h3>
                Placements
            </h3>

            <p>
                Total placements:{" "}
                {placements.length}
            </p>

            {isHost ? (
                <button
                    onClick={
                        handleContinueToScores
                    }
                >
                    Continue to Scores
                </button>
            ) : (
                <p>
                    Waiting for the host to
                    continue to scores...
                </p>
            )}
        </div>
    );
}






