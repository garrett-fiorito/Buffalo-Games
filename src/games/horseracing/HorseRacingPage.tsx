import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleDollarSign, Play, RotateCcw, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import {
  MAX_HORSE_BET,
  MIN_HORSE_BET,
  RACE_DURATION_MS,
  beginHorseRace,
  clearHorseBets,
  createInitialHorseRaceState,
  createRacePlan,
  finishHorseRace,
  getExactaOdds,
  getFinishOrder,
  getHorse,
  getOddsBoard,
  horses,
  placeExactaBet,
  selectExactaHorse,
  setHorseBetAmount,
} from "./horseRacingEngine";
import type { HorseId, HorseRaceState, RacePlanEntry } from "./horseRacingTypes";

const TABLE_WIDTH = 1040;
const TABLE_HEIGHT = 640;

export function HorseRacingPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const raceStartRef = useRef<number | null>(null);
  const stateRef = useRef<HorseRaceState>(createInitialHorseRaceState());
  const planRef = useRef<RacePlanEntry[]>(createRacePlan(0));
  const [state, setState] = useState(stateRef.current);
  const [racePlan, setRacePlan] = useState(planRef.current);
  const [elapsedMs, setElapsedMs] = useState(0);

  const totalBet = state.bets.reduce((sum, bet) => sum + bet.amount, 0);
  const selectedOdds = getExactaOdds(state.selectedFirst, state.selectedSecond, state.raceNumber);
  const oddsBoard = useMemo(() => getOddsBoard(state.raceNumber), [state.raceNumber]);
  const finishOrder = state.lastResult?.finishOrder ?? getFinishOrder(racePlan);

  const updateState = useCallback((updater: (current: HorseRaceState) => HorseRaceState) => {
    setState((current) => {
      const next = updater(current);
      stateRef.current = next;
      return next;
    });
  }, []);

  const handleStartRace = () => {
    if (state.phase === "racing" || state.bets.length === 0) {
      return;
    }

    const plan = createRacePlan(state.raceNumber);
    planRef.current = plan;
    setRacePlan(plan);
    setElapsedMs(0);
    raceStartRef.current = performance.now();
    updateState((current) => beginHorseRace(current));
  };

  const handleReset = () => {
    const next = createInitialHorseRaceState();
    stateRef.current = next;
    planRef.current = createRacePlan(0);
    raceStartRef.current = null;
    setState(next);
    setRacePlan(planRef.current);
    setElapsedMs(0);
  };

  useEffect(() => {
    drawHorseTable(canvasRef.current, racePlan, elapsedMs, state);
  }, [elapsedMs, racePlan, state]);

  useEffect(() => {
    const tick = (timestamp: number) => {
      if (stateRef.current.phase === "racing") {
        const start = raceStartRef.current ?? timestamp;
        raceStartRef.current = start;
        const elapsed = timestamp - start;
        setElapsedMs(elapsed);

        if (elapsed >= RACE_DURATION_MS) {
          const order = getFinishOrder(planRef.current);
          updateState((current) => finishHorseRace(current, order));
          raceStartRef.current = null;
        }
      }

      frameRef.current = window.requestAnimationFrame(tick);
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [updateState]);

  return (
    <section className="horse-view" aria-labelledby="horse-title">
      <div className="table-hero horse-hero">
        <div className="table-hero__copy">
          <Link className="back-link" to="/">
            <ArrowLeft size={18} aria-hidden="true" />
            Lobby
          </Link>
          <h1 id="horse-title">Horse Racing</h1>
        </div>
        <div className="table-stats horse-stats" aria-label="Horse racing stats">
          <Stat label="Chips" value={state.chips.toLocaleString()} />
          <Stat label="Tickets" value={state.bets.length} />
          <Stat label="Bet" value={totalBet.toLocaleString()} />
        </div>
      </div>

      <div className="horse-layout">
        <div className="horse-table-shell">
          <canvas
            ref={canvasRef}
            className="horse-canvas"
            width={TABLE_WIDTH}
            height={TABLE_HEIGHT}
            aria-label="Old Vegas tabletop horse racing track"
          />
        </div>

        <aside className="horse-panel" aria-label="Horse racing controls">
          <div>
            <p className="eyebrow">Table exacta</p>
            <h2>{getStatusTitle(state)}</h2>
            <p>{getStatusMessage(state, finishOrder)}</p>
          </div>

          <div className="horse-selector" aria-label="Exacta selector">
            <HorsePickColumn
              title="1st"
              selected={state.selectedFirst}
              disabled={state.phase === "racing"}
              onPick={(horseId) =>
                updateState((current) => selectExactaHorse(current, "first", horseId))
              }
            />
            <HorsePickColumn
              title="2nd"
              selected={state.selectedSecond}
              disabled={state.phase === "racing"}
              onPick={(horseId) =>
                updateState((current) => selectExactaHorse(current, "second", horseId))
              }
            />
          </div>

          <div className="horse-bet-control">
            <label htmlFor="horse-bet">Bet amount</label>
            <input
              id="horse-bet"
              type="range"
              min={MIN_HORSE_BET}
              max={MAX_HORSE_BET}
              step={5}
              value={state.betAmount}
              disabled={state.phase === "racing"}
              onChange={(event) =>
                updateState((current) => setHorseBetAmount(current, Number(event.target.value)))
              }
            />
            <strong>{state.betAmount}</strong>
          </div>

          <div className="horse-ticket-preview">
            <span>
              {state.selectedFirst}-{state.selectedSecond} exacta
            </span>
            <strong>{selectedOdds}x</strong>
          </div>

          <div className="action-row">
            <button
              className="button button-primary"
              type="button"
              disabled={state.phase === "racing" || state.betAmount > state.chips}
              onClick={() => updateState((current) => placeExactaBet(current))}
            >
              <Ticket size={18} aria-hidden="true" />
              Ticket
            </button>
            <button
              className="button"
              type="button"
              disabled={state.phase === "racing" || state.bets.length === 0}
              onClick={() => updateState((current) => clearHorseBets(current))}
            >
              Clear
            </button>
            <button
              className="button"
              type="button"
              disabled={state.phase === "racing" || state.bets.length === 0}
              onClick={handleStartRace}
            >
              <Play size={18} aria-hidden="true" />
              Race
            </button>
            <button className="icon-button" type="button" onClick={handleReset}>
              <RotateCcw size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="horse-tickets" aria-label="Active tickets">
            {state.bets.length ? (
              state.bets.map((bet) => (
                <span key={bet.id}>
                  {bet.first}-{bet.second} <strong>{bet.amount} @ {bet.odds}x</strong>
                </span>
              ))
            ) : (
              <span>No tickets placed</span>
            )}
          </div>

          <div className="horse-odds-board" aria-label="Featured exacta odds">
            {oddsBoard.map((bet) => (
              <button
                key={bet.id}
                type="button"
                disabled={state.phase === "racing"}
                onClick={() => {
                  updateState((current) => ({
                    ...selectExactaHorse(selectExactaHorse(current, "first", bet.first), "second", bet.second),
                  }));
                }}
              >
                <span>{bet.first}-{bet.second}</span>
                <strong>{bet.odds}x</strong>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}

function HorsePickColumn({
  title,
  selected,
  disabled,
  onPick,
}: {
  title: string;
  selected: HorseId;
  disabled: boolean;
  onPick: (horseId: HorseId) => void;
}) {
  return (
    <div>
      <span>{title}</span>
      {horses.map((horse) => (
        <button
          key={horse.id}
          className={selected === horse.id ? "active" : ""}
          type="button"
          disabled={disabled}
          onClick={() => onPick(horse.id)}
        >
          <i style={{ background: horse.color }} />
          {horse.id}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-pill">
      <CircleDollarSign size={18} aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getStatusTitle(state: HorseRaceState): string {
  if (state.phase === "racing") {
    return "Race running";
  }

  if (state.phase === "result") {
    return "Photo finish";
  }

  return "Place exacta tickets";
}

function getStatusMessage(state: HorseRaceState, finishOrder: HorseId[]): string {
  if (state.phase === "racing") {
    return "Tiny table horses are on the move. Hold onto that ticket.";
  }

  if (state.lastResult) {
    const [first, second] = state.lastResult.finishOrder;
    const outcome =
      state.lastResult.net > 0
        ? `Won ${state.lastResult.net} chips.`
        : `Lost ${Math.abs(state.lastResult.net)} chips.`;
    return `${first}-${second} came in. ${outcome}`;
  }

  const [first, second] = finishOrder;
  return `Pick the first two horses in exact order. Featured board opens with ${first}-${second} as the table favorite.`;
}

function drawHorseTable(
  canvas: HTMLCanvasElement | null,
  plan: RacePlanEntry[],
  elapsedMs: number,
  state: HorseRaceState,
) {
  if (!canvas) {
    return;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
  drawTableBase(context);
  drawTrack(context);
  drawFinishPost(context);
  drawHorses(context, plan, elapsedMs, state.phase);
  drawRaceOverlay(context, state);
}

function drawTableBase(context: CanvasRenderingContext2D) {
  const wood = context.createLinearGradient(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
  wood.addColorStop(0, "#2b160d");
  wood.addColorStop(0.52, "#4a2815");
  wood.addColorStop(1, "#160b07");
  context.fillStyle = wood;
  context.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);
  context.fillStyle = "#050505";
  context.fillRect(28, 28, TABLE_WIDTH - 56, TABLE_HEIGHT - 56);
  context.strokeStyle = "#d7a448";
  context.lineWidth = 5;
  context.strokeRect(28, 28, TABLE_WIDTH - 56, TABLE_HEIGHT - 56);
}

function drawTrack(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(TABLE_WIDTH / 2, TABLE_HEIGHT / 2 + 12);
  context.fillStyle = "#09241a";
  context.beginPath();
  context.ellipse(0, 0, 408, 214, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#10100c";
  context.beginPath();
  context.ellipse(0, 0, 252, 104, 0, 0, Math.PI * 2);
  context.fill();

  for (let lane = 0; lane < 6; lane += 1) {
    context.strokeStyle = lane % 2 === 0 ? "rgba(246, 234, 208, 0.2)" : "rgba(215, 164, 72, 0.22)";
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(0, 0, 392 - lane * 25, 198 - lane * 13, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "rgba(215, 164, 72, 0.1)";
  context.fillRect(-170, -70, 340, 140);
  context.strokeStyle = "rgba(246, 234, 208, 0.16)";
  context.strokeRect(-170, -70, 340, 140);
  context.fillStyle = "#f0c66a";
  context.font = '900 34px Georgia, Cambria, "Times New Roman", serif';
  context.textAlign = "center";
  context.fillText("DERBY", 0, -8);
  context.font = "900 13px Inter, system-ui, sans-serif";
  context.fillText("EXACTA TABLE", 0, 20);
  context.restore();
}

function drawFinishPost(context: CanvasRenderingContext2D) {
  context.save();
  context.translate(TABLE_WIDTH / 2 + 408, TABLE_HEIGHT / 2 + 12);
  context.strokeStyle = "#f6ead0";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(0, -188);
  context.lineTo(0, -116);
  context.stroke();
  context.fillStyle = "#c7463a";
  context.fillRect(0, -188, 46, 18);
  context.fillStyle = "#f6ead0";
  context.fillRect(0, -170, 46, 18);
  context.restore();
}

function drawHorses(
  context: CanvasRenderingContext2D,
  plan: RacePlanEntry[],
  elapsedMs: number,
  phase: HorseRaceState["phase"],
) {
  plan.forEach((entry) => {
    const horse = getHorse(entry.horseId);
    const progress = phase === "betting" ? 0.02 : getRaceProgress(entry, elapsedMs);
    const point = getTrackPoint(progress, entry.lane);
    drawToyHorse(context, point.x, point.y, point.angle, horse.color, horse.id);
  });
}

function drawToyHorse(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  number: HorseId,
) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.fillStyle = "rgba(0, 0, 0, 0.28)";
  context.beginPath();
  context.ellipse(0, 18, 30, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = color;
  roundCanvasRect(context, -23, -13, 46, 22, 7);
  context.fill();
  context.beginPath();
  context.arc(22, -16, 12, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#0a0503";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-16, 8);
  context.lineTo(-22, 24);
  context.moveTo(-4, 9);
  context.lineTo(-4, 25);
  context.moveTo(11, 8);
  context.lineTo(18, 24);
  context.stroke();
  context.fillStyle = "#f6ead0";
  context.beginPath();
  context.arc(25, -18, 3, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#050505";
  context.font = "900 14px Inter, system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), 0, -2);
  context.restore();
}

function drawRaceOverlay(context: CanvasRenderingContext2D, state: HorseRaceState) {
  context.fillStyle = "rgba(5, 5, 5, 0.7)";
  context.fillRect(48, 48, 190, 74);
  context.strokeStyle = "rgba(215, 164, 72, 0.5)";
  context.strokeRect(48, 48, 190, 74);
  context.fillStyle = "#f0c66a";
  context.font = "900 13px Inter, system-ui, sans-serif";
  context.fillText(`RACE ${state.raceNumber + 1}`, 66, 76);
  context.fillStyle = "#f6ead0";
  context.font = "900 22px Inter, system-ui, sans-serif";
  context.fillText(state.phase === "racing" ? "RUNNING" : "TABLE OPEN", 66, 104);

  if (state.phase !== "result" || !state.lastResult) {
    return;
  }

  const [first, second] = state.lastResult.finishOrder;
  context.fillStyle = "rgba(5, 5, 5, 0.72)";
  context.fillRect(TABLE_WIDTH - 258, 48, 210, 74);
  context.strokeStyle = "#35ff84";
  context.strokeRect(TABLE_WIDTH - 258, 48, 210, 74);
  context.fillStyle = "#35ff84";
  context.font = "900 13px Inter, system-ui, sans-serif";
  context.fillText("RESULT", TABLE_WIDTH - 236, 76);
  context.fillStyle = "#f6ead0";
  context.font = "900 28px Inter, system-ui, sans-serif";
  context.fillText(`${first}-${second}`, TABLE_WIDTH - 236, 106);
}

function getRaceProgress(entry: RacePlanEntry, elapsedMs: number): number {
  const raw = Math.min(1, elapsedMs / entry.finishTimeMs);
  const eased = raw < 1 ? Math.pow(raw, 0.92) : 1;
  const wobble = Math.sin(raw * Math.PI * 5 + entry.surge * 8) * 0.012 * (1 - raw);
  return Math.min(1, Math.max(0, eased + wobble));
}

function getTrackPoint(progress: number, lane: number) {
  const radiusX = 392 - lane * 25;
  const radiusY = 198 - lane * 13;
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  const x = TABLE_WIDTH / 2 + Math.cos(angle) * radiusX;
  const y = TABLE_HEIGHT / 2 + 12 + Math.sin(angle) * radiusY;
  const tangent = angle + Math.PI / 2;

  return { x, y, angle: tangent };
}

function roundCanvasRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
