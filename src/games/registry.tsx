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
      "Play local two-player 8-ball with group assignment, turn tracking, scratches, pockets, rails, and full ball physics.",
    playTime: "Local 2P",
    status: "Live",
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
  {
    id: "flappy-buffalo",
    name: "Flappy Buffalo",
    path: "/games/flappy-buffalo",
    description:
      "Tap, click, or press Space to keep the buffalo face flying through bright green gates.",
    playTime: "Arcade",
    status: "Live",
    art: (
      <div className="flappy-card-art">
        <span className="flappy-card-pipe flappy-card-pipe--top" />
        <span className="flappy-card-pipe flappy-card-pipe--bottom" />
        <span className="flappy-card-face">
          <span className="flappy-card-horn flappy-card-horn--left" />
          <span className="flappy-card-horn flappy-card-horn--right" />
          <span className="flappy-card-mane" />
          <span className="flappy-card-eye flappy-card-eye--left" />
          <span className="flappy-card-eye flappy-card-eye--right" />
          <span className="flappy-card-snout" />
        </span>
      </div>
    ),
  },
  {
    id: "roulette",
    name: "Golden Ball Roulette",
    path: "/games/roulette",
    description:
      "Play American double-zero roulette with a golden 50x target, polished wheel, casino felt betting table, and accurate payouts.",
    playTime: "Casino",
    status: "Live",
    art: (
      <div className="roulette-card-art">
        <span className="roulette-card-wheel">
          <span>0</span>
          <span>00</span>
          <span>17</span>
          <span>32</span>
        </span>
        <span className="roulette-card-ball" />
        <span className="roulette-card-golden-ball" />
        <span className="roulette-card-chip roulette-card-chip--one">25</span>
        <span className="roulette-card-chip roulette-card-chip--two">100</span>
      </div>
    ),
  },
  {
    id: "mini-golf",
    name: "Neon Mini Golf",
    path: "/games/mini-golf",
    description:
      "Play a polished 3-hole neon mini golf course with arcade aiming, par scoring, and water or sand penalties.",
    playTime: "3 holes",
    status: "Live",
    art: (
      <div className="mini-golf-card-art">
        <span className="mini-golf-card-fairway" />
        <span className="mini-golf-card-wall mini-golf-card-wall--one" />
        <span className="mini-golf-card-wall mini-golf-card-wall--two" />
        <span className="mini-golf-card-hazard mini-golf-card-hazard--water" />
        <span className="mini-golf-card-hazard mini-golf-card-hazard--sand" />
        <span className="mini-golf-card-cup" />
        <span className="mini-golf-card-flag" />
        <span className="mini-golf-card-ball" />
      </div>
    ),
  },
  {
    id: "horse-racing",
    name: "Horse Racing",
    path: "/games/horse-racing",
    description:
      "Bet exacta tickets on a vintage tabletop horse race with changing odds, tiny mechanical horses, and casino-style payouts.",
    playTime: "Table race",
    status: "Live",
    art: (
      <div className="horse-card-art">
        <span className="horse-card-track" />
        <span className="horse-card-infield">DERBY</span>
        <span className="horse-card-finish" />
        <span className="horse-card-horse horse-card-horse--one">1</span>
        <span className="horse-card-horse horse-card-horse--two">4</span>
        <span className="horse-card-horse horse-card-horse--three">6</span>
        <span className="horse-card-ticket">3-5</span>
      </div>
    ),
  },
  {
    id: "brave-buffalo",
    name: "Brave Buffalo",
    path: "/games/brave-buffalo",
    description:
      "Hold to flap upward, release to fall, dodge bright red hazards, and chase your best distance.",
    playTime: "Endless",
    status: "Live",
    art: (
      <div className="brave-card-art">
        <span className="brave-card-speedline brave-card-speedline--one" />
        <span className="brave-card-speedline brave-card-speedline--two" />
        <span className="brave-card-hazard brave-card-hazard--tower" />
        <span className="brave-card-hazard brave-card-hazard--drone" />
        <span className="brave-card-runner">
          <span className="brave-card-wing brave-card-wing--left" />
          <span className="brave-card-wing brave-card-wing--right" />
          <span className="brave-card-runner-horn brave-card-runner-horn--left" />
          <span className="brave-card-runner-horn brave-card-runner-horn--right" />
          <span className="brave-card-runner-mane" />
          <span className="brave-card-runner-face" />
          <span className="brave-card-runner-eye brave-card-runner-eye--left" />
          <span className="brave-card-runner-eye brave-card-runner-eye--right" />
          <span className="brave-card-runner-snout" />
        </span>
      </div>
    ),
  },
].sort((left, right) => left.name.localeCompare(right.name));
