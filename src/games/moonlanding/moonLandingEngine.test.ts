import { describe, expect, it } from "vitest";
import {
  ASTEROID_DAMAGE,
  GAS_STATION_SPACING,
  MAX_FUEL,
  MAX_HEALTH,
  MOON_GROUND_Y,
  PLANET_DISTANCE,
  SHIP_HEIGHT,
  createInitialMoonLandingState,
  isSafeLanding,
  isShipOnGasStation,
  startMoonLanding,
  stepMoonLanding,
} from "./moonLandingEngine";

describe("moonLandingEngine", () => {
  it("starts a playable mission and applies gravity", () => {
    const ready = createInitialMoonLandingState();
    const playing = startMoonLanding(ready);
    const next = stepMoonLanding(playing, 500, { left: false, right: false, up: false });

    expect(playing.phase).toBe("playing");
    expect(next.ship.velocity.y).toBeGreaterThan(0);
    expect(next.ship.position.y).toBeGreaterThan(playing.ship.position.y);
  });

  it("only moves right when right thrust is pressed", () => {
    const playing = startMoonLanding(createInitialMoonLandingState());
    const drifting = stepMoonLanding(playing, 500, { left: false, right: false, up: true });
    const accelerating = stepMoonLanding(playing, 500, { left: false, right: true, up: false });

    expect(drifting.ship.velocity.x).toBe(0);
    expect(accelerating.ship.velocity.x).toBeGreaterThan(0);
  });

  it("drains fuel while thrusting", () => {
    const playing = startMoonLanding(createInitialMoonLandingState());
    const next = stepMoonLanding(playing, 1000, { left: false, right: true, up: true });

    expect(next.fuel).toBeLessThan(MAX_FUEL);
  });

  it("spaces gas stations farther apart for larger sectors", () => {
    const stations = createInitialMoonLandingState().gasStations;

    stations.slice(1).forEach((station, index) => {
      expect(station.x - stations[index].x).toBeGreaterThanOrEqual(GAS_STATION_SPACING);
    });
  });

  it("refuels and restores health to halfway on a safe gas station landing", () => {
    const station = createInitialMoonLandingState().gasStations[0];
    const playing = {
      ...startMoonLanding(createInitialMoonLandingState()),
      fuel: 18,
      health: 20,
      ship: {
        position: { x: station.x + station.width / 2, y: station.y - SHIP_HEIGHT / 2 - 1 },
        velocity: { x: 0, y: 28 },
      },
    };
    const next = stepMoonLanding(playing, 16, { left: false, right: false, up: false });

    expect(isShipOnGasStation(next.ship, station)).toBe(true);
    expect(isSafeLanding(next.ship)).toBe(true);
    expect(next.fuel).toBe(MAX_FUEL);
    expect(next.health).toBe(MAX_HEALTH / 2);
  });

  it("allows the ship to take off after landing on a fuel station", () => {
    const station = createInitialMoonLandingState().gasStations[0];
    const playing = {
      ...startMoonLanding(createInitialMoonLandingState()),
      ship: {
        position: { x: station.x + station.width / 2, y: station.y - SHIP_HEIGHT / 2 },
        velocity: { x: 0, y: 0 },
      },
    };
    const next = stepMoonLanding(playing, 32, { left: false, right: false, up: true });

    expect(next.ship.position.y).toBeLessThan(playing.ship.position.y);
    expect(next.ship.velocity.y).toBeLessThan(0);
  });

  it("damages health when colliding with asteroids", () => {
    const playing = startMoonLanding(createInitialMoonLandingState());
    const asteroid = playing.asteroids[0];
    const next = stepMoonLanding(
      {
        ...playing,
        ship: {
          position: { x: asteroid.x, y: asteroid.y },
          velocity: { x: 0, y: 0 },
        },
      },
      16,
      { left: false, right: false, up: false },
    );

    expect(next.health).toBe(MAX_HEALTH - ASTEROID_DAMAGE);
  });

  it("restores fuel and health at new planet checkpoints", () => {
    const playing = {
      ...startMoonLanding(createInitialMoonLandingState()),
      fuel: 2,
      health: 7,
      ship: {
        position: { x: PLANET_DISTANCE - 5, y: MOON_GROUND_Y - SHIP_HEIGHT - 80 },
        velocity: { x: 200, y: 0 },
      },
    };
    const next = stepMoonLanding(playing, 100, { left: false, right: true, up: false });

    expect(next.planetIndex).toBe(2);
    expect(next.fuel).toBe(MAX_FUEL);
    expect(next.health).toBe(MAX_HEALTH);
  });
});
