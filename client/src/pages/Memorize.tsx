import { useEffect, useState } from "react";
import type { GameObject } from "../types/game";

interface MemorizeProps {
    objects: GameObject[];
    phaseEndsAt: number;
}

const GRID_SIZE = 6;

export function Memorize({
                             objects,
                             phaseEndsAt
                         }: MemorizeProps) {
    const [remainingSeconds, setRemainingSeconds] =
        useState(() =>
            Math.max(
                0,
                Math.ceil(
                    (phaseEndsAt - Date.now()) / 1000
                )
            )
        );

    useEffect(() => {
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

        return () => {
            clearInterval(interval);
        };
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

    return (
        <div className="screen">
            <p className="eyebrow">Round in progress</p><h1>Memorize the board</h1>

            <h2 className="timer-pill">◷ {remainingSeconds}s</h2>

            <p>
                Remember the objects and their exact
                positions.
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
                    { length: GRID_SIZE * GRID_SIZE },
                    (_, index) => {
                        const row = Math.floor(
                            index / GRID_SIZE
                        );

                        const col = index % GRID_SIZE;

                        const object = getObjectAt(
                            row,
                            col
                        );

                        return (
                            <div
                                className="board-cell" key={`${row}-${col}`}
                                style={{
                                    width: "70px",
                                    height: "70px",
                                    border: "1px solid black",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "32px"
                                }}
                            >
                                {object?.emoji}
                            </div>
                        );
                    }
                )}
            </div>
        </div>
    );
}



