export interface Player {
    id: string;
    name: string;
    score: number;
    challengesRemaining: number;
}

export interface RoomState {
    roomId: string;
    hostId: string;
    players: Player[];
}

export interface GameObject {
    id: string;
    emoji: string;
    row: number;
    col: number;
}

/** Public placement state sent during reconstruction and reveal. */
export interface Placement {
    objectId: string;
    row: number;
    col: number;
    playerId: string;
    challenged: boolean;
    frozen: boolean;
    superseded?: boolean;
}

export interface Score {
    playerId: string;
    playerName: string;
    score: number;
}

export interface GameStartedMessage {
    phase: "MEMORIZE";
    roundNumber: number;
    originalObjects: GameObject[];
    phaseEndsAt: number;
}

