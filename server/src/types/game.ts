export type GamePhase =
    | "LOBBY"
    | "MEMORIZE"
    | "RECONSTRUCT"
    | "REVEAL"
    | "SCORES"
    | "FINISHED";

export interface Player {
    id: string;
    name: string;
    score: number;
    challengesRemaining: number;
}

export interface GameObject {
    id: string;
    emoji: string;
    row: number;
    col: number;
}

export interface Placement {
    objectId: string;
    row: number;
    col: number;
    playerId: string;
    challenged: boolean;
    challengeSuccessful?: boolean;
    frozen: boolean;
    superseded?: boolean;
    scored?: boolean;
}

export interface Round {
    number: number;
    phase: GamePhase;
    originalObjects: GameObject[];
    placements: Placement[];
    startedAt: number;
    phaseEndsAt: number;
}

export interface Room {
    id: string;
    hostId: string;
    players: Map<string, Player>;
    phase: GamePhase;
    currentRound: Round | null;
}
