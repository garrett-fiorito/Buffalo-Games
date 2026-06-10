import { useEffect, useMemo, useReducer, useState } from "react";
import type { CSSProperties, Dispatch } from "react";
import { ArrowLeft, CircleDollarSign, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  CHIP_VALUES,
  americanWheelSequence,
  beginSpin,
  clearBets,
  createInitialRouletteState,
  finishSpin,
  getGoldenBallCandidates,
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
  | { type: "finish"; pocket: RoulettePocket; goldenPocket: RoulettePocket }
  | { type: "reset" };

const pocketAngle = 360 / rouletteWheel.length;
const rouletteNumbers = Array.from({ length: 36 }, (_, index) => String(index + 1) as RoulettePocketValue);
const straightNumbers: RoulettePocketValue[] = ["0", "00", ...rouletteNumbers];

type PendingSpin = {
  pocket: RoulettePocket;
  goldenPocket: RoulettePocket;
  settleDelayMs: number;
};

type RouletteSpinStyle = {
  wheelDurationMs: number;
  ballDurationMs: number;
  outerShift: number;
  hopOne: number;
  hopTwo: number;
  hopThree: number;
  hopFour: number;
  jitterOne: number;
  jitterTwo: number;
};

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
      return finishSpin(state, action.pocket, action.goldenPocket);
    case "reset":
      return createInitialRouletteState();
    default:
      return state;
  }
}

export function RoulettePage() {
  const [state, dispatch] = useReducer(rouletteReducer, undefined, createInitialRouletteState);
  const [pendingSpin, setPendingSpin] = useState<PendingSpin | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [spinStyle, setSpinStyle] = useState<RouletteSpinStyle>(() => createSpinStyle());
  const totalBet = getTotalBet(state.bets);
  const canSpin = state.phase !== "spinning" && state.bets.length > 0;
  const resultText = getResultText(state);
  const goldenCandidates = getGoldenBallCandidates(state.spinIndex);
  const activeGoldenPocket = state.phase === "spinning" ? pendingSpin?.goldenPocket : null;
  const visibleWinningValue = state.phase === "result" ? state.lastResult?.pocket.value ?? null : null;
  const wheelStyle = {
    transform: `rotate(${wheelRotation}deg)`,
    transitionDuration: `${spinStyle.wheelDurationMs}ms`,
  };
  const ballTrackStyle = {
    transform: `rotate(${ballRotation}deg)`,
    transitionDuration: `${spinStyle.ballDurationMs}ms`,
    "--roulette-ball-duration": `${spinStyle.ballDurationMs}ms`,
    "--roulette-ball-outer-shift": `${spinStyle.outerShift}px`,
    "--roulette-ball-hop-one": `${spinStyle.hopOne}px`,
    "--roulette-ball-hop-two": `${spinStyle.hopTwo}px`,
    "--roulette-ball-hop-three": `${spinStyle.hopThree}px`,
    "--roulette-ball-hop-four": `${spinStyle.hopFour}px`,
    "--roulette-ball-jitter-one": `${spinStyle.jitterOne}px`,
    "--roulette-ball-jitter-two": `${spinStyle.jitterTwo}px`,
  } as CSSProperties;

  const betLookup = useMemo(() => {
    return new Map(state.bets.map((bet) => [bet.id, bet.amount]));
  }, [state.bets]);

  useEffect(() => {
    if (state.phase !== "spinning" || !pendingSpin) {
      return;
    }

    const timer = window.setTimeout(() => {
      dispatch({ type: "finish", pocket: pendingSpin.pocket, goldenPocket: pendingSpin.goldenPocket });
      setPendingSpin(null);
    }, pendingSpin.settleDelayMs);

    return () => window.clearTimeout(timer);
  }, [pendingSpin, state.phase]);

  const handleSpin = () => {
    if (!canSpin) {
      return;
    }

    const nextPocket = pickSpinPocket();
    const nextGoldenPocket = pickRandomPocket(goldenCandidates);
    const pocketIndex = americanWheelSequence.indexOf(nextPocket.value);
    const nextSpin = getNextRouletteSpin(wheelRotation, ballRotation, pocketIndex);

    setPendingSpin({
      pocket: nextPocket,
      goldenPocket: nextGoldenPocket,
      settleDelayMs: nextSpin.spinStyle.ballDurationMs + 160,
    });
    setSpinStyle(nextSpin.spinStyle);
    setWheelRotation(nextSpin.wheelRotation);
    setBallRotation(nextSpin.ballRotation);
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
              style={wheelStyle}
            >
              {rouletteWheel.map((pocket, index) => (
                <span
                  key={pocket.value}
                  className={`roulette-wheel-pocket roulette-wheel-pocket--${pocket.color}${
                    visibleWinningValue === pocket.value ? " roulette-wheel-pocket--active" : ""
                  }`}
                  style={{
                    transform: `rotate(${index * pocketAngle}deg) translateY(var(--roulette-pocket-offset))`,
                  }}
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
              className={`roulette-ball-track ${state.phase === "spinning" ? "roulette-ball-track--spinning" : ""}`}
              style={ballTrackStyle}
            >
              <span className="roulette-ball" />
            </div>
          </div>

          <div className="roulette-result" aria-live="polite">
            <span>{state.phase === "spinning" ? "Golden target revealed" : "Result"}</span>
            <strong>{resultText}</strong>
          </div>

          <div className="roulette-golden-panel" aria-label="Golden ball bonus">
            <span>{state.phase === "spinning" ? "50x golden ball" : "Possible golden numbers"}</span>
            <div>
              {goldenCandidates.map((pocket) => (
                <strong
                  key={pocket.value}
                  className={
                    activeGoldenPocket && pocket.value === activeGoldenPocket.value
                      ? "active"
                      : ""
                  }
                >
                  {pocket.value}
                </strong>
              ))}
            </div>
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
            Each spin also reveals one golden number from the preview row; a straight-up hit on it pays 50:1.
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
  const golden = state.lastResult.goldenHit ? " GOLDEN 50x" : "";
  const outcome = net > 0 ? `Won ${net}` : net === 0 ? "Pushed" : `Lost ${Math.abs(net)}`;
  return `${pocket.value} ${pocket.color.toUpperCase()}${golden} - ${outcome} chips`;
}

function pickSpinPocket(): RoulettePocket {
  return pickRandomPocket(rouletteWheel);
}

function pickRandomPocket<T>(pockets: T[]): T {
  return pockets[getRandomInt(pockets.length)];
}

function getNextRouletteSpin(
  currentWheelRotation: number,
  currentBallRotation: number,
  pocketIndex: number,
) {
  const spinStyle = createSpinStyle();
  const wheelFinalAngle = getRandomFloat(0, 360);
  const wheelTurns = getRandomIntBetween(5, 8);
  const ballTurns = getRandomIntBetween(10, 15);
  const wheelRotation = getNextClockwiseRotation(currentWheelRotation, wheelFinalAngle, wheelTurns);
  const targetBallAngle = normalizeAngle(wheelRotation + pocketIndex * pocketAngle);
  const ballRotation = getNextCounterClockwiseRotation(currentBallRotation, targetBallAngle, ballTurns);

  return {
    wheelRotation,
    ballRotation,
    spinStyle,
  };
}

function createSpinStyle(): RouletteSpinStyle {
  const wheelDurationMs = getRandomIntBetween(4300, 5200);

  return {
    wheelDurationMs,
    ballDurationMs: wheelDurationMs + getRandomIntBetween(850, 1500),
    outerShift: -getRandomIntBetween(22, 36),
    hopOne: -getRandomIntBetween(8, 18),
    hopTwo: getRandomIntBetween(5, 13),
    hopThree: -getRandomIntBetween(4, 13),
    hopFour: getRandomIntBetween(3, 9),
    jitterOne: getRandomIntBetween(-7, 8),
    jitterTwo: getRandomIntBetween(-6, 7),
  };
}

function getNextClockwiseRotation(currentRotation: number, targetAngle: number, turns: number): number {
  const baseRotation = currentRotation + turns * 360;
  const adjustment = normalizeAngle(targetAngle - normalizeAngle(baseRotation));
  return baseRotation + adjustment;
}

function getNextCounterClockwiseRotation(currentRotation: number, targetAngle: number, turns: number): number {
  const baseRotation = currentRotation - turns * 360;
  const adjustment = normalizeAngle(normalizeAngle(baseRotation) - targetAngle);
  return baseRotation - adjustment;
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function getRandomIntBetween(min: number, max: number): number {
  return min + getRandomInt(max - min + 1);
}

function getRandomFloat(min: number, max: number): number {
  return min + (getRandomInt(1_000_000) / 1_000_000) * (max - min);
}

function getRandomInt(max: number): number {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoApi.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}
