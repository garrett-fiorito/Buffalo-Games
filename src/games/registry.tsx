import type { ReactNode } from "react";
import { BuffaloGlyph } from "../components/SiteLayout";

export type GameDefinition = {
  id: string;
  name: string;
  path: string;
  description: string;
  playTime: string;
  status: string;
  art: ReactNode;
};

export const games: GameDefinition[] = [
  {
    id: "blackjack",
    name: "Blackjack",
    path: "/games/blackjack",
    description:
      "Start with 1,000 chips, choose a 1-100 chip wager, and play classic dealer blackjack with 3:2 natural payouts.",
    playTime: "2 min hands",
    status: "Live",
    art: (
      <div className="buffalo-card-art">
        <BuffaloGlyph />
        <span>{"A\u2660"}</span>
        <span>{"K\u2666"}</span>
      </div>
    ),
  },
  {
    id: "billiards",
    name: "Billiards",
    path: "/games/billiards",
    description:
      "Line up shots on a practice 8-ball table with responsive cue control, pockets, rails, and full ball physics.",
    playTime: "Practice table",
    status: "New",
    art: (
      <div className="billiards-card-art">
        <span className="pool-ball pool-ball--cue" />
        <span className="pool-ball pool-ball--eight">8</span>
        <span className="pool-ball pool-ball--solid">3</span>
        <span className="pool-ball pool-ball--stripe">12</span>
        <span className="pool-cue" />
      </div>
    ),
  },
];
