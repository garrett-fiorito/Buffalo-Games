import { useMemo, useReducer } from "react";
import {
  ArrowLeft,
  BadgeDollarSign,
  CircleDollarSign,
  Hand,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BuffaloGlyph } from "../../components/SiteLayout";
import {
  MAX_BET,
  MIN_BET,
  clampBet,
  createInitialState,
  playerHit,
  playerStand,
  resetGame,
  scoreHand,
  startRound,
} from "./blackjackEngine";
import type { BlackjackState, Card } from "./blackjackTypes";

type BlackjackAction =
  | { type: "setBet"; bet: number }
  | { type: "deal" }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "reset" };

function blackjackReducer(state: BlackjackState, action: BlackjackAction): BlackjackState {
  switch (action.type) {
    case "setBet":
      return {
        ...state,
        pendingBet: clampBet(action.bet, state.chips),
      };
    case "deal":
      return startRound(state);
    case "hit":
      return playerHit(state);
    case "stand":
      return playerStand(state);
    case "reset":
      return resetGame();
    default:
      return state;
  }
}

export function BlackjackPage() {
  const [state, dispatch] = useReducer(blackjackReducer, undefined, () => createInitialState());
  const playerScore = scoreHand(state.playerHand);
  const dealerVisibleHand = state.revealDealerHoleCard ? state.dealerHand : state.dealerHand.slice(0, 1);
  const dealerScore = scoreHand(dealerVisibleHand);
  const canDeal = (state.phase === "betting" || state.phase === "roundOver") && state.chips >= MIN_BET;
  const canAct = state.phase === "playerTurn";
  const maxBetForState = Math.min(MAX_BET, Math.max(MIN_BET, state.chips));

  const statusText = useMemo(() => {
    if (state.phase === "roundOver") {
      if (state.outcome === "dealerWin") {
        return "Wager lost";
      }

      if (state.outcome === "push") {
        return "Bet returned";
      }

      return `Paid ${state.lastPayout} chips`;
    }

    if (state.phase === "playerTurn") {
      return "Player decision";
    }

    return "Set wager";
  }, [state.lastPayout, state.outcome, state.phase]);

  return (
    <section className="blackjack-view" aria-labelledby="blackjack-title">
      <div className="table-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="blackjack-title">Buffalo Blackjack</h1>
        </div>
        <div className="table-stats" aria-label="Table stats">
          <Stat label="Chips" value={state.chips.toLocaleString()} icon={<CircleDollarSign />} />
          <Stat label="Bet" value={state.currentBet || state.pendingBet} icon={<BadgeDollarSign />} />
        </div>
      </div>

      <div className="blackjack-table" aria-live="polite">
        <div className="felt-mark" aria-hidden="true">
          <BuffaloGlyph />
        </div>

        <TableHand
          title="Dealer"
          score={state.dealerHand.length ? dealerScore : null}
          scorePrefix={
            !state.revealDealerHoleCard && state.dealerHand.length > 1 ? "Showing" : "Total"
          }
          cards={state.dealerHand}
          hideHoleCard={!state.revealDealerHoleCard && state.dealerHand.length > 1}
        />

        <div className="round-message">
          <span>{statusText}</span>
          <strong>{state.message}</strong>
        </div>

        <TableHand
          title="Player"
          score={state.playerHand.length ? playerScore : null}
          scorePrefix="Total"
          cards={state.playerHand}
        />
      </div>

      <aside className="control-panel" aria-label="Blackjack controls">
        <div className="wager-control">
          <div>
            <label htmlFor="bet-size">Bet size</label>
            <span>
              {state.pendingBet} chip{state.pendingBet === 1 ? "" : "s"}
            </span>
          </div>
          <input
            id="bet-size"
            type="range"
            min={MIN_BET}
            max={maxBetForState}
            step="1"
            value={Math.min(state.pendingBet, maxBetForState)}
            disabled={state.phase === "playerTurn" || state.chips < MIN_BET}
            onChange={(event) => dispatch({ type: "setBet", bet: Number(event.target.value) })}
          />
          <input
            className="bet-number"
            type="number"
            aria-label="Bet size number"
            min={MIN_BET}
            max={maxBetForState}
            value={Math.min(state.pendingBet, maxBetForState)}
            disabled={state.phase === "playerTurn" || state.chips < MIN_BET}
            onChange={(event) => dispatch({ type: "setBet", bet: Number(event.target.value) })}
          />
        </div>

        <div className="action-row">
          <button className="button button-primary" type="button" disabled={!canDeal} onClick={() => dispatch({ type: "deal" })}>
            <Sparkles size={18} aria-hidden="true" />
            Deal
          </button>
          <button className="button" type="button" disabled={!canAct} onClick={() => dispatch({ type: "hit" })}>
            <Hand size={18} aria-hidden="true" />
            Hit
          </button>
          <button className="button" type="button" disabled={!canAct} onClick={() => dispatch({ type: "stand" })}>
            <ShieldCheck size={18} aria-hidden="true" />
            Stand
          </button>
          <button className="icon-button" type="button" onClick={() => dispatch({ type: "reset" })} aria-label="Reset game">
            <RotateCcw size={20} aria-hidden="true" />
          </button>
        </div>

        {state.chips < MIN_BET ? (
          <p className="table-note">The chip rack is empty. Reset the game to start over with 1,000 chips.</p>
        ) : (
          <p className="table-note">Blackjack pays 3:2. Dealer stands on soft 17.</p>
        )}
      </aside>
    </section>
  );
}

type StatProps = {
  label: string;
  value: string | number;
  icon: JSX.Element;
};

function Stat({ label, value, icon }: StatProps) {
  return (
    <div className="stat-pill">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type TableHandProps = {
  title: string;
  score: { total: number; isSoft: boolean } | null;
  scorePrefix: "Showing" | "Total";
  cards: Card[];
  hideHoleCard?: boolean;
};

function TableHand({ title, score, scorePrefix, cards, hideHoleCard = false }: TableHandProps) {
  return (
    <section className="hand-zone" aria-label={`${title} hand`}>
      <div className="hand-zone__header">
        <h2>{title}</h2>
        <span>{formatHandTotal(score, scorePrefix)}</span>
      </div>
      <div className="cards-row">
        {cards.length === 0 ? (
          <>
            <EmptyCard />
            <EmptyCard />
          </>
        ) : (
          cards.map((card, index) =>
            hideHoleCard && index === 1 ? (
              <PlayingCard key={`${card.suit}-${card.rank}-${index}`} hiddenCard />
            ) : (
              <PlayingCard key={`${card.suit}-${card.rank}-${index}`} card={card} />
            ),
          )
        )}
      </div>
    </section>
  );
}

function formatHandTotal(
  score: TableHandProps["score"],
  scorePrefix: TableHandProps["scorePrefix"],
): string {
  if (!score) {
    return "Waiting";
  }

  return `${scorePrefix} ${score.isSoft ? "soft " : ""}${score.total}`;
}

function EmptyCard() {
  return <div className="playing-card playing-card--empty" aria-hidden="true" />;
}

function PlayingCard({ card, hiddenCard = false }: { card?: Card; hiddenCard?: boolean }) {
  if (hiddenCard || !card) {
    return (
      <div className="playing-card playing-card--back" aria-label="Face down card">
        <span>Buff</span>
      </div>
    );
  }

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const suitSymbol = getSuitSymbol(card.suit);

  return (
    <div className={`playing-card ${isRed ? "playing-card--red" : ""}`} aria-label={`${card.rank} of ${card.suit}`}>
      <span className="card-corner">
        {card.rank}
        <small>{suitSymbol}</small>
      </span>
      <strong>{suitSymbol}</strong>
      <span className="card-corner card-corner--bottom">
        {card.rank}
        <small>{suitSymbol}</small>
      </span>
    </div>
  );
}

function getSuitSymbol(suit: Card["suit"]): string {
  switch (suit) {
    case "clubs":
      return "\u2663";
    case "diamonds":
      return "\u2666";
    case "hearts":
      return "\u2665";
    case "spades":
      return "\u2660";
    default:
      return "";
  }
}
