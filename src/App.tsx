import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { BlackjackPage } from "./games/blackjack/BlackjackPage";
import { BilliardsPage } from "./games/billiards/BilliardsPage";
import { BraveBuffaloPage } from "./games/brave/BraveBuffaloPage";
import { FlappyBuffaloPage } from "./games/flappy/FlappyBuffaloPage";
import { HorseRacingPage } from "./games/horseracing/HorseRacingPage";
import { MiniGolfPage } from "./games/minigolf/MiniGolfPage";
import { RoulettePage } from "./games/roulette/RoulettePage";

export function App() {
  return (
    <SiteLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/games/blackjack" element={<BlackjackPage />} />
        <Route path="/games/billiards" element={<BilliardsPage />} />
        <Route path="/games/flappy-buffalo" element={<FlappyBuffaloPage />} />
        <Route path="/games/brave-buffalo" element={<BraveBuffaloPage />} />
        <Route path="/games/roulette" element={<RoulettePage />} />
        <Route path="/games/mini-golf" element={<MiniGolfPage />} />
        <Route path="/games/horse-racing" element={<HorseRacingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SiteLayout>
  );
}
