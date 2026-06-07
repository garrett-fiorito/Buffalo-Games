import { ArrowRight, Clock3, Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { GameDefinition } from "../games/registry";

type GameCardProps = {
  game: GameDefinition;
};

export function GameCard({ game }: GameCardProps) {
  return (
    <article className="game-card">
      <div className="game-card__art" aria-hidden="true">
        {game.art}
      </div>
      <div className="game-card__body">
        <div className="game-card__meta">
          <span>
            <Gamepad2 size={15} aria-hidden="true" />
            {game.status}
          </span>
          <span>
            <Clock3 size={15} aria-hidden="true" />
            {game.playTime}
          </span>
        </div>
        <h2>{game.name}</h2>
        <p>{game.description}</p>
        <Link className="button button-primary" to={game.path}>
          Play
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
