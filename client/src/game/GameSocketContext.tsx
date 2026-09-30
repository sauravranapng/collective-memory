import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from "react";
import { WebSocketClient } from "./WebSocketClient";
import type { ServerMessage } from "./WebSocketClient";

interface GameSocketContextValue {
    connected: boolean;
    send: (message: unknown) => void;
    subscribe: (
        handler: (message: ServerMessage) => void
    ) => () => void;
}

const GameSocketContext =
    createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({
                                       children
                                   }: {
    children: React.ReactNode;
}) {
    const socketRef = useRef<WebSocketClient | null>(null);

    const handlersRef = useRef(
        new Set<(message: ServerMessage) => void>()
    );

    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const socket = new WebSocketClient(
            (message) => {
                for (const handler of handlersRef.current) {
                    handler(message);
                }
            },
            {
                onOpen: () => setConnected(true),
                onClose: () => setConnected(false)
            }
        );

        socketRef.current = socket;
        socket.connect();

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    const send = useCallback((message: unknown) => {
        socketRef.current?.send(message);
    }, []);

    const subscribe = useCallback(
        (handler: (message: ServerMessage) => void) => {
            handlersRef.current.add(handler);

            return () => {
                handlersRef.current.delete(handler);
            };
        },
        []
    );

    return (
        <GameSocketContext.Provider
            value={{
                connected,
                send,
                subscribe
            }}
        >
            {children}
        </GameSocketContext.Provider>
    );
}

export function useGameSocket() {
    const context = useContext(GameSocketContext);

    if (!context) {
        throw new Error(
            "useGameSocket must be used inside GameSocketProvider"
        );
    }

    return context;
}