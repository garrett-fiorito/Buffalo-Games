import { useEffect, useMemo, useReducer, useState } from "react";
import type { Dispatch } from "react";
import { ArrowLeft, CircleDollarSign, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CHIP_VALUES,
  americanWheelSequence,
  beginSpin,
  clearBets,
  createInitialRouletteState,
  finishSpin,
  getPocketColor,
  getTotalBet,
  placeBet,
  rouletteWheel,
  setSelectedChip,
} from "./rouletteEngine";
import type {
  RouletteBetKind,
  RoulettePocket,
  RoulettePocketValue,
  RouletteState,
} from "./rouletteTypes";

type RouletteAction =
  | { type: "chip"; value: number }
  | { type: "bet"; kind: RouletteBetKind; label: string; number?: RoulettePocketValue }
  | { type: "clear" }
  | { type: "spin" }
  | { type: "finish"; pocket: RoulettePocket }
  | { type: "reset" };

const pocketAngle = 360 / rouletteWheel.length;
const rouletteNumbers = Array.from({ length: 36 }, (_, index) => String(index + 1) as RoulettePocketValue);
const straightNumbers: RoulettePocketValue[] = ["0", "00", ...rouletteNumbers];

function rouletteReducer(state: RouletteState, action: RouletteAction): RouletteState {
  switch (action.type) {
    case "chip":
      return setSelectedChip(state, action.value);
    case "bet":
      return placeBet(state, action.kind, action.label, action.number);
    case "clear":
      return clearBets(state);
    case "spin":
      return beginSpin(state);
    case "finish":
      return finishSpin(state, action.pocket);
    case "reset":
      return createInitialRouletteState();
    default:
      return state;
  }
}

export function RoulettePage() {
  const [state, dispatch] = useReducer(rouletteReducer, undefined, createInitialRouletteState);
  const [pendingPocket, setPendingPocket] = useState<RoulettePocket | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const totalBet = getTotalBet(state.bets);
  const canSpin = state.phase !== "spinning" && state.bets.length > 0;
  const resultText = getResultText(state);

  const betLookup = useMemo(() => {
    return new Map(state.bets.map((bet) => [bet.id, bet.amount]));
  }, [state.bets]);

  useEffect(() => {
    if (state.phase !== "spinning" || !pendingPocket) {
      return;
    }

    const timer = window.setTimeout(() => {
      dispatch({ type: "finish", pocket: pendingPocket });
      setPendingPocket(null);
    }, 4300);

    return () => window.clearTimeout(timer);
  }, [pendingPocket, state.phase]);

  const handleSpin = () => {
    if (!canSpin) {
      return;
    }

    const nextPocket = pickSpinPocket(state.spinIndex);
    const pocketIndex = americanWheelSequence.indexOf(nextPocket.value);
    const targetAngle = 360 - pocketIndex * pocketAngle;
    const nextWheelRotation = wheelRotation + 360 * 6 + targetAngle;
    const nextBallRotation = -(360 * 8 + targetAngle + 10);

    setPendingPocket(nextPocket);
    setWheelRotation(nextWheelRotation);
    setBallRotation(nextBallRotation);
    dispatch({ type: "spin" });
  };

  return (
    <section className="roulette-view" aria-labelledby="roulette-title">
      <div className="table-hero roulette-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="roulette-title">Double Zero Roulette</h1>
        </div>
        <div className="table-stats" aria-label="Roulette stats">
          <Stat label="Chips" value={state.chips.toLocaleString()} />
          <Stat label="Bet" value={totalBet.toLocaleString()} />
        </div>
      </div>

      <div className="roulette-layout">
        <div className="roulette-wheel-panel">
          <div className="roulette-wheel-shell" aria-label="American double-zero roulette wheel">
            <div
              className="roulette-wheel"
              style={{ transform: `rotate(${wheelRotation}deg)` }}
            >
              {rouletteWheel.map((pocket, index) => (
                <span
                  key={pocket.value}
                  className={`roulette-wheel-pocket roulette-wheel-pocket--${pocket.color}`}
                  style={{ transform: `rotate(${index * pocketAngle}deg) translateY(-166px)` }}
                >
                  {pocket.value}
                </span>
              ))}
              <div className="roulette-wheel-center">
                <Sparkles size={30} aria-hidden="true" />
                <strong>BB</strong>
              </div>
            </div>
            <div
              className={`roulette-ball ${state.phase === "spinning" ? "roulette-ball--spinning" : ""}`}
              style={{ transform: `rotate(${ballRotation}deg) translateY(-186px)` }}
            />
          </div>

          <div className="roulette-result" aria-live="polite">
            <span>{state.phase === "spinning" ? "Wheel spinning" : "Result"}</span>
            <strong>{resultText}</strong>
          </div>

          <div className="roulette-history" aria-label="Last spins">
            {state.history.length ? (
              state.history.map((pocket, index) => (
                <span key={`${pocket.value}-${index}`} className={`roulette-chip roulette-chip--${pocket.color}`}>
                  {pocket.value}
                </span>
              ))
            ) : (
              <span className="roulette-history-empty">No spins yet</span>
            )}
          </div>
        </div>

        <div className="roulette-table-panel">
          <div className="roulette-control-strip">
            <div className="roulette-chip-rack" aria-label="Chip values">
              {CHIP_VALUES.map((chip) => (
                <button
                  key={chip}
                  className={`roulette-bet-chip ${state.selectedChip === chip ? "active" : ""}`}
                  type="button"
                  disabled={state.phase === "spinning"}
                  onClick={() => dispatch({ type: "chip", value: chip })}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div className="roulette-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!canSpin}
                onClick={handleSpin}
              >
                <CircleDollarSign size={18} aria-hidden="true" />
                Spin
              </button>
              <button
                className="button"
                type="button"
                disabled={state.phase === "spinning" || state.bets.length === 0}
                onClick={() => dispatch({ type: "clear" })}
              >
                Clear
              </button>
              <button className="icon-button" type="button" onClick={() => dispatch({ type: "reset" })}>
                <RotateCcw size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="roulette-felt">
            <div className="roulette-zeroes">
              {(["0", "00"] as RoulettePocketValue[]).map((number) => (
                <BetButton
                  key={number}
                  className="roulette-number roulette-number--green"
                  label={number}
                  amount={betLookup.get(`straight-${number}`)}
                  disabled={state.phase === "spinning"}
                  onClick={() => dispatch({ type: "bet", kind: "straight", label: number, number })}
                />
              ))}
            </div>

            <div className="roulette-number-grid">
              {rouletteNumbers.map((number) => (
                <BetButton
                  key={number}
                  className={`roulette-number roulette-number--${getPocketColor(number)}`}
                  label={number}
                  amount={betLookup.get(`straight-${number}`)}
                  disabled={state.phase === "spinning"}
                  onClick={() => dispatch({ type: "bet", kind: "straight", label: number, number })}
                />
              ))}
            </div>

            <div className="roulette-column-grid">
              {[
                ["column1", "2:1"],
                ["column2", "2:1"],
                ["column3", "2:1"],
              ].map(([kind, label]) => (
                <BetButton
                  key={kind}
                  className="roulette-outside"
                  label={label}
                  amount={betLookup.get(kind)}
                  disabled={state.phase === "spinning"}
                  onClick={() =>
                    dispatch({
                      type: "bet",
                      kind: kind as RouletteBetKind,
                      label: `Column ${kind.slice(-1)}`,
                    })
                  }
                />
              ))}
            </div>

            <div className="roulette-outside-grid">
              <BetButton kind="dozen1" label="1st 12" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="dozen2" label="2nd 12" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="dozen3" label="3rd 12" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="low" label="1-18" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="even" label="Even" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="red" label="Red" color="red" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="black" label="Black" color="black" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="odd" label="Odd" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
              <BetButton kind="high" label="19-36" lookup={betLookup} dispatch={dispatch} disabled={state.phase === "spinning"} />
            </div>
          </div>

          <p className="table-note">
            American double-zero roulette pays 35:1 on single numbers, 2:1 on dozens and columns, and 1:1 on outside bets.
          </p>
        </div>
      </div>
    </section>
  );
}

function BetButton({
  className = "roulette-outside",
  label,
  amount,
  disabled,
  onClick,
  kind,
  lookup,
  dispatch,
  color,
}: {
  className?: string;
  label: string;
  amount?: number;
  disabled?: boolean;
  onClick?: () => void;
  kind?: RouletteBetKind;
  lookup?: Map<string, number>;
  dispatch?: Dispatch<RouletteAction>;
  color?: "red" | "black";
}) {
  const betAmount = amount ?? (kind && lookup ? lookup.get(kind) : undefined);
  const handleClick =
    onClick ??
    (() => {
      if (kind && dispatch) {
        dispatch({ type: "bet", kind, label });
      }
    });

  return (
    <button
      className={`${className}${color ? ` roulette-outside--${color}` : ""}`}
      type="button"
      disabled={disabled}
      onClick={handleClick}
    >
      <span>{label}</span>
      {betAmount ? <strong>{betAmount}</strong> : null}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getResultText(state: RouletteState): string {
  if (state.phase === "spinning") {
    return "No more bets.";
  }

  if (!state.lastResult) {
    return "Place your bets.";
  }

  const { pocket, net } = state.lastResult;
  const outcome = net > 0 ? `Won ${net}` : net === 0 ? "Pushed" : `Lost ${Math.abs(net)}`;
  return `${pocket.value} ${pocket.color.toUpperCase()} - ${outcome} chips`;
}

function pickSpinPocket(spinIndex: number): RoulettePocket {
  const index = (spinIndex * 11 + Math.floor(Date.now() / 997)) % rouletteWheel.length;
  return rouletteWheel[index];
}
