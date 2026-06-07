import { GameCard } from "../components/GameCard";
import { games } from "../games/registry";

export function HomePage() {
  return (
    <section className="lobby-view" aria-label="Game lobby">
      <div className="game-grid">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
