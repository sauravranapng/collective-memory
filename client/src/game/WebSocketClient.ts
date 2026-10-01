export type ServerMessage = {
    type: string;
    [key: string]: unknown;
};

type MessageHandler = (message: ServerMessage) => void;

interface WebSocketClientOptions {
    onOpen?: () => void;
    onClose?: () => void;
}

export class WebSocketClient {
    private socket: WebSocket | null = null;

    private readonly messageHandler: MessageHandler;
    private readonly options: WebSocketClientOptions;

    private readonly pendingMessages: unknown[] = [];

    constructor(
        messageHandler: MessageHandler,
        options: WebSocketClientOptions = {}
    ) {
        this.messageHandler = messageHandler;
        this.options = options;
    }

    connect(): void {
        if (
            this.socket &&
            (
                this.socket.readyState === WebSocket.OPEN ||
                this.socket.readyState === WebSocket.CONNECTING
            )
        ) {
            return;
        }

        const serverUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8080";
        this.socket = new WebSocket(serverUrl);

        this.socket.onopen = () => {
            console.log("Connected to game server");

            this.options.onOpen?.();

            this.flushPendingMessages();
        };

        this.socket.onmessage = (event) => {
            const message = JSON.parse(
                event.data
            ) as ServerMessage;

            console.log("Received from game server:", message);

            this.messageHandler(message);
        };

        this.socket.onclose = () => {
            console.log("Disconnected from game server");

            this.options.onClose?.();
        };

        this.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
    }

    send(message: unknown): void {
        if (!this.socket) {
            console.error("WebSocket has not been created");
            return;
        }

        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return;
        }

        if (this.socket.readyState === WebSocket.CONNECTING) {
            this.pendingMessages.push(message);
            return;
        }

        console.error("WebSocket is not connected");
    }

    disconnect(): void {
        this.pendingMessages.length = 0;

        this.socket?.close();
        this.socket = null;
    }

    private flushPendingMessages(): void {
        while (this.pendingMessages.length > 0) {
            const message = this.pendingMessages.shift();

            if (message !== undefined) {
                this.socket?.send(JSON.stringify(message));
            }
        }
    }
}
