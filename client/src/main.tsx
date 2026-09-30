import { createRoot } from "react-dom/client";
import App from "./App";
import { GameSocketProvider } from "./game/GameSocketContext";

createRoot(document.getElementById("root")!).render(
    <GameSocketProvider>
        <App />
    </GameSocketProvider>
);