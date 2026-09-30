import { useEffect, useState } from "react";
import { CreateRoom } from "./pages/CreateRoom";
import { JoinRoom } from "./pages/JoinRoom";
import { Lobby } from "./pages/Lobby";
import { Memorize } from "./pages/Memorize";
import { Reconstruct } from "./pages/Reconstruct";
import { Reveal } from "./pages/Reveal";
import { Scores } from "./pages/Scores";
import { useGameSocket } from "./game/GameSocketContext";
import type {
    GameObject,
    Placement,
    RoomState
} from "./types/game";
import { FinalScores } from "./pages/FinalScores";

type ReconstructionObject = {
    id: string;
    emoji: string;
};

import type { Score } from "./types/game";

type Screen =
    | "HOME"
    | "CREATE"
    | "JOIN"
    | "LOBBY"
    | "MEMORIZE"
    | "RECONSTRUCT"
    | "REVEAL"
    | "SCORES"
    | "FINAL_SCORES";

function App() {
    const { subscribe } = useGameSocket();

    const [screen, setScreen] =
        useState<Screen>("HOME");

    const [roomState, setRoomState] =
        useState<RoomState | null>(null);

    const [playerId, setPlayerId] =
        useState("");

    const [memorizeObjects, setMemorizeObjects] =
        useState<GameObject[]>([]);

    const [reconstructObjects, setReconstructObjects] =
        useState<ReconstructionObject[]>([]);

    const [phaseEndsAt, setPhaseEndsAt] =
        useState(0);

    const [revealData, setRevealData] =
        useState<{
            originalObjects: GameObject[];
            placements: Placement[];
        } | null>(null);

    const [scores, setScores] =
        useState<Score[]>([]);

    useEffect(() => {
        return subscribe((message) => {
            console.log(
                "App received:",
                message
            );

            if (message.type === "ROOM_STATE") {
                const updatedRoomState: RoomState = {
                    roomId:
                        message.roomId as string,

                    hostId:
                        message.hostId as string,

                    players:
                        message.players as RoomState["players"]
                };

                setRoomState(updatedRoomState);

                return;
            }

            if (message.type === "GAME_STARTED") {
                const objects =
                    message.originalObjects as GameObject[];

                const endsAt =
                    message.phaseEndsAt as number;

                setMemorizeObjects(objects);
                setPhaseEndsAt(endsAt);
                setScreen("MEMORIZE");

                return;
            }

            if (message.type === "RECONSTRUCTION_STARTED") {
                const objects =
                    message.objects as ReconstructionObject[];

                const endsAt =
                    message.phaseEndsAt as number;

                setReconstructObjects(objects);
                setPhaseEndsAt(endsAt);
                setScreen("RECONSTRUCT");

                return;
            }

            if (message.type === "REVEAL_STARTED") {
                const originalObjects =
                    message.originalObjects as GameObject[];

                const placements =
                    message.placements as Placement[];

                const endsAt =
                    message.phaseEndsAt as number;

                setRevealData({
                    originalObjects,
                    placements
                });

                setPhaseEndsAt(endsAt);
                setScreen("REVEAL");

                return;
            }

            if (message.type === "SCORES_STARTED") {
                const updatedScores =
                    message.scores as Score[];

                setScores(updatedScores);
                setScreen("SCORES");

                return;
            }

            if (message.type === "GAME_FINISHED") {
                setScreen("HOME");

                return;
            }
            if (message.type === "FINAL_SCORES") {
                const finalScores =
                    message.scores as Score[];

                setScores(finalScores);
                setScreen("FINAL_SCORES");

                return;
            }

            if (message.type === "ERROR") {
                console.error(
                    "Server error:",
                    message.message
                );
            }
        });
    }, [subscribe]);

    if (screen === "CREATE") {
        return (
            <CreateRoom
                onRoomCreated={(room, id) => {
                    setRoomState(room);
                    setPlayerId(id);
                    setScreen("LOBBY");
                }}
                onBack={() => {
                    setScreen("HOME");
                }}
            />
        );
    }

    if (screen === "JOIN") {
        return (
            <JoinRoom
                onJoined={(room, id) => {
                    setRoomState(room);
                    setPlayerId(id);
                    setScreen("LOBBY");
                }}
                onBack={() => {
                    setScreen("HOME");
                }}
            />
        );
    }

    if (
        screen === "LOBBY" &&
        roomState
    ) {
        return (
            <Lobby
                roomState={roomState}
                playerId={playerId}
            />
        );
    }

    if (screen === "MEMORIZE") {
        return (
            <Memorize
                objects={memorizeObjects}
                phaseEndsAt={phaseEndsAt}
            />
        );
    }

    if (screen === "RECONSTRUCT") {
        return (
            <Reconstruct
                objects={reconstructObjects}
                phaseEndsAt={phaseEndsAt}
                playerId={playerId}
                players={roomState?.players ?? []}
            />
        );
    }

    if (
        screen === "REVEAL" &&
        revealData
    ) {
        return (
            <Reveal
                objects={
                    revealData.originalObjects
                }
                placements={
                    revealData.placements
                }
                phaseEndsAt={phaseEndsAt}
                playerId={playerId}
                hostId={
                    roomState?.hostId ?? ""
                }
            />
        );
    }

    if (screen === "SCORES") {
        return (
            <Scores
                scores={scores}
                playerId={playerId}
                hostId={
                    roomState?.hostId ?? ""
                }
            />
        );
    }

    if (screen === "FINAL_SCORES") {
        return (
            <FinalScores
                scores={scores}
            />
        );
    }

    return (
        <div>
            <h1>Collective Memory</h1>

            <button
                onClick={() =>
                    setScreen("CREATE")
                }
            >
                Create Room
            </button>

            <button
                onClick={() =>
                    setScreen("JOIN")
                }
            >
                Join Room
            </button>
        </div>
    );
}

export default App;
