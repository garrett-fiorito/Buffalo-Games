import { Navigate, Route, Routes } from "react-router-dom";
import { SiteLayout } from "./components/SiteLayout";
import { HomePage } from "./pages/HomePage";
import { BlackjackPage } from "./games/blackjack/BlackjackPage";
import { BilliardsPage } from "./games/billiards/BilliardsPage";
import { FlappyBuffaloPage } from "./games/flappy/FlappyBuffaloPage";

export function App() {
  return (
    <SiteLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/games/blackjack" element={<BlackjackPage />} />
        <Route path="/games/billiards" element={<BilliardsPage />} />
        <Route path="/games/flappy-buffalo" element={<FlappyBuffaloPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </SiteLayout>
  );
}
