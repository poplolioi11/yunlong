import assert from 'node:assert/strict';
import { FlightWorld } from '../dist/flight.js';

const order = ['azure', 'red', 'gold', 'white', 'black'];
const names = ['wood', 'fire', 'earth', 'metal', 'water'];
// These limits match flight.js. Head direction itself is free to rotate in XYZ.
const limits = {
  turn: 0.045, turnAcceleration: 0.006,
  pitch: 1.48, pitchRate: 0.080, pitchAcceleration: 0.014,
  roll: 1.78, rollRate: 0.10, rollAcceleration: 0.018,
};
const epsilon = 0.00001;
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const results = [];

for (const [width, height, duration] of [[1280, 720, 1100], [390, 844, 1100]]) {
  const world = new FlightWorld(28);
  world.resize(width, height);
  assert.deepEqual(world.elementOrder, order);
  assert.equal(world.openingDuration, 55);
  assert.deepEqual(world.dragons.map(d => d.theme).sort(), [...order].sort());
  assert.equal(world.dragons.filter(d => d.hasPearl).length, 1);
  for (const d of world.dragons) {
    const index = order.indexOf(d.theme);
    assert.equal(d.element, names[index]);
    assert.equal(d.generates, order[(index + 1) % 5]);
    assert.equal(d.overcomes, order[(index + 2) % 5]);
  }

  const ranges = world.dragons.map(d => ({
    theme: d.theme, length: d.length, speedMax: 0, opacityMin: 1, opacityMax: 0,
    departures: 0, completedFadeReturns: 0, opacityLow: false, behavior: d.behavior,
    lastTurn: d.turn, lastPitchRate: d.pitchRate, lastRollRate: d.rollRate,
    lastPosition: [d.wx, d.wy, d.wz],
    pitchMin: Infinity, pitchMax: -Infinity, rollMin: Infinity, rollMax: -Infinity,
    pitchRateMin: Infinity, pitchRateMax: -Infinity,
    rollRateMin: Infinity, rollRateMax: -Infinity,
    pitchAccelerationMin: Infinity, pitchAccelerationMax: -Infinity,
    rollAccelerationMin: Infinity, rollAccelerationMax: -Infinity,
    worldXMin: Infinity, worldXMax: -Infinity, worldYMin: Infinity, worldYMax: -Infinity,
    worldZMin: Infinity, worldZMax: -Infinity,
    nearCameraSamples: 0, overheadSamples: 0, wasNearCamera: false, wasOverhead: false,
  }));
  const nearCameraRecords = [];
  const overheadRecords = [];
  let maxSpacing = 0, maxTurn = 0, maxAcceleration = 0;
  let maxHeadY = 0, maxHeadZ = 0, maxTransitionStep = 0, maxOpacityStep = 0;
  let maxPitch = 0, maxRoll = 0, maxPitchRate = 0, maxRollRate = 0;
  let maxPitchAcceleration = 0, maxRollAcceleration = 0;

  for (let frame = 1; frame <= duration * 30; frame++) {
    const time = frame / 30;
    const priorOpacity = world.dragons.map(d => d.opacity);
    world.step(1 / 30, time);
    assert.equal(world.phase, time < 55 ? 'opening' : 'roaming');

    for (const [index, d] of world.dragons.entries()) {
      const range = ranges[index];
      assert.ok([
        d.wx, d.wy, d.wz, d.radius, d.speed, d.opacity, d.depthPitch,
        d.heading, d.turn, d.roll, d.pitchRate, d.rollRate,
      ].every(Number.isFinite));
      assert.ok(d.opacity >= 0 && d.opacity <= 1);
      range.speedMax = Math.max(range.speedMax, d.speed);
      range.opacityMin = Math.min(range.opacityMin, d.opacity);
      range.opacityMax = Math.max(range.opacityMax, d.opacity);
      if (d.behavior === 'far' && range.behavior !== 'far') range.departures++;
      range.behavior = d.behavior;
      if (d.opacity < 0.02) range.opacityLow = true;
      if (range.opacityLow && d.opacity > 0.90) {
        range.completedFadeReturns++;
        range.opacityLow = false;
      }
      maxTurn = Math.max(maxTurn, Math.abs(d.turn));
      maxPitch = Math.max(maxPitch, Math.abs(d.depthPitch));
      maxRoll = Math.max(maxRoll, Math.abs(d.roll));
      maxPitchRate = Math.max(maxPitchRate, Math.abs(d.pitchRate));
      maxRollRate = Math.max(maxRollRate, Math.abs(d.rollRate));
      range.pitchMin = Math.min(range.pitchMin, d.depthPitch);
      range.pitchMax = Math.max(range.pitchMax, d.depthPitch);
      range.rollMin = Math.min(range.rollMin, d.roll);
      range.rollMax = Math.max(range.rollMax, d.roll);
      range.pitchRateMin = Math.min(range.pitchRateMin, d.pitchRate);
      range.pitchRateMax = Math.max(range.pitchRateMax, d.pitchRate);
      range.rollRateMin = Math.min(range.rollRateMin, d.rollRate);
      range.rollRateMax = Math.max(range.rollRateMax, d.rollRate);
      range.worldXMin = Math.min(range.worldXMin, d.wx);
      range.worldXMax = Math.max(range.worldXMax, d.wx);
      range.worldYMin = Math.min(range.worldYMin, d.wy);
      range.worldYMax = Math.max(range.worldYMax, d.wy);
      range.worldZMin = Math.min(range.worldZMin, d.wz);
      range.worldZMax = Math.max(range.worldZMax, d.wz);
      // Opening is analytical; rate acceleration checks start after its handoff.
      if (time > 55.1) {
        const turnAcceleration = (d.turn - range.lastTurn) * 30;
        const pitchAcceleration = (d.pitchRate - range.lastPitchRate) * 30;
        const rollAcceleration = (d.rollRate - range.lastRollRate) * 30;
        maxAcceleration = Math.max(maxAcceleration, Math.abs(turnAcceleration));
        maxPitchAcceleration = Math.max(maxPitchAcceleration, Math.abs(pitchAcceleration));
        maxRollAcceleration = Math.max(maxRollAcceleration, Math.abs(rollAcceleration));
        range.pitchAccelerationMin = Math.min(range.pitchAccelerationMin, pitchAcceleration);
        range.pitchAccelerationMax = Math.max(range.pitchAccelerationMax, pitchAcceleration);
        range.rollAccelerationMin = Math.min(range.rollAccelerationMin, rollAcceleration);
        range.rollAccelerationMax = Math.max(range.rollAccelerationMax, rollAcceleration);
      }
      range.lastTurn = d.turn;
      range.lastPitchRate = d.pitchRate;
      range.lastRollRate = d.rollRate;
      maxOpacityStep = Math.max(maxOpacityStep, Math.abs(d.opacity - priorOpacity[index]));
      const step = Math.hypot(d.wx - range.lastPosition[0], d.wy - range.lastPosition[1], d.wz - range.lastPosition[2]);
      if (time > 54.9 && time < 55.1) maxTransitionStep = Math.max(maxTransitionStep, step);
      range.lastPosition = [d.wx, d.wy, d.wz];

      const head = d.worldFrame(0);
      const projected = world.project(head.origin);
      assert.ok([projected.x, projected.y, projected.scale].every(Number.isFinite));
      maxHeadY = Math.max(maxHeadY, Math.abs(head.forward.y));
      maxHeadZ = Math.max(maxHeadZ, Math.abs(head.forward.z));
      const visible = time > 55 && d.opacity > 0.5
        && projected.x >= 0 && projected.x <= width
        && projected.y >= 0 && projected.y <= height;
      // An actual visible head and its world-frame direction prove the pass;
      // a maneuver label or an offscreen waypoint is not sufficient.
      const nearCamera = visible && projected.scale > 1.2 && head.forward.z < -0.8;
      const overhead = visible && projected.y <= height * 0.16;
      if (nearCamera) range.nearCameraSamples++;
      if (overhead) range.overheadSamples++;
      if ((nearCamera && !range.wasNearCamera) || (overhead && !range.wasOverhead)) {
        const record = {
          time, theme: d.theme, x: projected.x, y: projected.y,
          scale: projected.scale, forwardZ: head.forward.z,
          pitch: d.depthPitch, roll: d.roll, opacity: d.opacity,
          maneuver: d.maneuver,
        };
        if (nearCamera && !range.wasNearCamera) nearCameraRecords.push(record);
        if (overhead && !range.wasOverhead) overheadRecords.push(record);
      }
      range.wasNearCamera = nearCamera;
      range.wasOverhead = overhead;

      if (frame % 15 === 0) {
        assert.equal(d.nodes.length, 210);
        for (let i = 0; i < 210; i++) {
          const node = d.nodes[i];
          assert.ok([node.x, node.y, node.z, node.r, node.wx, node.wy, node.wz].every(Number.isFinite));
          if (i) {
            const previous = d.nodes[i - 1];
            maxSpacing = Math.max(maxSpacing,
              Math.hypot(node.wx - previous.wx, node.wy - previous.wy, node.wz - previous.wz) / (d.length / 209));
          }
        }
        for (const vector of [head.forward, head.down, head.side]) {
          assert.ok(Math.abs(Math.hypot(vector.x, vector.y, vector.z) - 1) < 1e-6);
        }
        assert.ok(Math.abs(dot(head.forward, head.down)) < 1e-6);
        assert.ok(Math.abs(dot(head.forward, head.side)) < 1e-6);
        assert.ok(Math.abs(dot(head.down, head.side)) < 1e-6);
      }
    }
  }

  assert.ok(maxSpacing < 1.7);
  assert.ok(maxTurn <= limits.turn + epsilon);
  assert.ok(maxAcceleration <= limits.turnAcceleration + epsilon);
  assert.ok(maxPitch <= limits.pitch + epsilon);
  assert.ok(maxRoll <= limits.roll + epsilon);
  assert.ok(maxPitchRate <= limits.pitchRate + epsilon);
  assert.ok(maxRollRate <= limits.rollRate + epsilon);
  assert.ok(maxPitchAcceleration <= limits.pitchAcceleration + epsilon);
  assert.ok(maxRollAcceleration <= limits.rollAcceleration + epsilon);
  assert.ok(nearCameraRecords.length > 0, `${width}x${height}: no visible head with scale > 1.2 and F.z < -0.8`);
  assert.ok(overheadRecords.length > 0, `${width}x${height}: no visible overhead head in the top 16%`);
  assert.ok(maxTransitionStep < 2);
  assert.ok(maxOpacityStep < 0.02);
  assert.ok(ranges.every(range => range.departures > 0));
  assert.ok(ranges.every(range => range.completedFadeReturns > 0));

  const originalPhase = world.phase;
  world.resize(720, 1280);
  world.step(1 / 30, duration + 1 / 30);
  world.resize(width, height);
  world.step(1 / 30, duration + 2 / 30);
  assert.equal(world.phase, originalPhase);
  assert.ok(world.dragons.every(d => d.nodes.every(node =>
    Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.r))));

  results.push({
    width, height, duration, limits,
    maxWorldSpacingRatio: maxSpacing, maxTurnRadiansPerSecond: maxTurn,
    maxTurnAcceleration: maxAcceleration,
    maxPitchRadians: maxPitch, maxRollRadians: maxRoll,
    maxPitchRateRadiansPerSecond: maxPitchRate, maxRollRateRadiansPerSecond: maxRollRate,
    maxPitchAcceleration, maxRollAcceleration,
    maxHeadVerticalComponent: maxHeadY, maxHeadDepthComponent: maxHeadZ,
    maxOpeningTransitionStep: maxTransitionStep, maxOpacityFrameStep: maxOpacityStep,
    nearCameraRecords, overheadRecords,
    dragons: ranges.map(range => {
      const {
        lastTurn, lastPitchRate, lastRollRate, lastPosition, behavior,
        opacityLow, wasNearCamera, wasOverhead, ...statistics
      } = range;
      return statistics;
    }),
  });
}
console.log(JSON.stringify({ passed: true, results }, null, 2));
