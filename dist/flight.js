/**
 * Yunlong: five-element opening, then inertial seeded wandering in XYZ.
 * Bodies follow the actual head history by world-space arc length. The camera
 * uses perspective; world x/y are camera-centred and positive z is farther.
 */
const NODE_COUNT = 210;
const OPENING_SECONDS = 55;
const MAX_TURN = 0.045;
const MAX_TURN_ACCEL = 0.006;
const MAX_PITCH = 1.48;
const MAX_PITCH_RATE = 0.080;
const MAX_PITCH_ACCEL = 0.014;
const MAX_ROLL = 1.78;
const MAX_ROLL_RATE = 0.10;
const MAX_ROLL_ACCEL = 0.018;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const delta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const magnitude = a => Math.hypot(a.x, a.y, a.z);
const unit = (a, fallback = v3(1, 0, 0)) => { const n = magnitude(a); return n > 1e-9 ? v3(a.x / n, a.y / n, a.z / n) : { ...fallback }; };
function perpendicularDown(forward, previous) {
  let ref = previous || v3(0, 1, 0), amount = dot(ref, forward);
  let d = v3(ref.x - forward.x * amount, ref.y - forward.y * amount, ref.z - forward.z * amount);
  if (magnitude(d) < 1e-5) {
    ref = Math.abs(forward.y) < 0.88 ? v3(0, 1, 0) : v3(0, 0, 1); amount = dot(ref, forward);
    d = v3(ref.x - forward.x * amount, ref.y - forward.y * amount, ref.z - forward.z * amount);
  }
  return unit(d, v3(0, 1, 0));
}
const ELEMENTS = ['azure', 'red', 'gold', 'white', 'black'];
const ELEMENT_NAMES = ['wood', 'fire', 'earth', 'metal', 'water'];

export class FlightWorld {
  constructor(seed = 28) {
    this.width = 0; this.height = 0; this.focal = 900; this.time = 0;
    this.dragons = []; this.seed = seed >>> 0; this.openingDuration = OPENING_SECONDS;
    this.elementOrder = [...ELEMENTS]; this.phase = 'opening';
  }
  random() {
    this.seed += 0x6d2b79f5; let n = this.seed;
    n = Math.imul(n ^ (n >>> 15), n | 1); n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }
  dimensions(size = 1) {
    const s = Math.min(this.width, this.height), mobile = this.width < 700;
    return {
      worldRadius: clamp(s * 0.053, mobile ? 18 : 28, 50) * size,
      length: clamp(Math.max(this.width * 0.97, s * 1.72), mobile ? 680 : 1080, mobile ? 1050 : 1570) * size * 1.70,
      cruise: clamp(s * 0.13, 60, 108) * (0.84 + size * 0.16) * 0.48,
    };
  }
  project(point) {
    const scale = this.focal / Math.max(this.focal * 0.25, this.focal + point.z);
    return { x: this.width * 0.5 + point.x * scale, y: this.height * 0.5 + point.y * scale, scale, depth: scale };
  }
  openingMotion(dragon, time) {
    const aspect = this.width * 0.365 / (this.height * 0.285);
    const rate = Math.min(0.019, MAX_TURN * 0.90 / Math.max(aspect, 1 / aspect));
    const angle = dragon.elementIndex * Math.PI * 2 / 5 - 0.15 + time * rate;
    const scale = 1 + dragon.openingDepth, rx = this.width * 0.365 * scale, ry = this.height * 0.285 * scale;
    const point = v3(Math.cos(angle) * rx, Math.sin(angle) * ry,
      this.focal * (dragon.openingDepth + 0.020 * Math.sin(angle + dragon.phase)));
    const velocity = v3(-Math.sin(angle) * rx * rate, Math.cos(angle) * ry * rate,
      this.focal * 0.020 * Math.cos(angle + dragon.phase) * rate);
    const angularSpeed = rate * rx * ry / (rx * rx * Math.sin(angle) ** 2 + ry * ry * Math.cos(angle) ** 2);
    return { point, velocity, angularSpeed };
  }
  openingPoint(dragon, time) { return this.openingMotion(dragon, time).point; }
  resize(width, height) {
    width = Math.max(1, Number(width) || 1); height = Math.max(1, Number(height) || 1);
    const ow = this.width, oh = this.height, of = this.focal;
    this.width = width; this.height = height; this.focal = Math.max(780, Math.min(width, height) * 1.45);
    if (!this.dragons.length) {
      const specs = [
        { theme: 'gold', size: 1.0, depth: -0.04 },
        { theme: 'red', size: 0.83, depth: 0.22 },
        { theme: 'black', size: 0.91, depth: 0.10 },
        { theme: 'azure', size: 0.95, depth: 0.16 },
        { theme: 'white', size: 0.87, depth: 0.29 },
      ];
      this.dragons = specs.map((spec, id) => {
        const elementIndex = ELEMENTS.indexOf(spec.theme), phase = id * 1.79 + this.random() * 0.5;
        const d = {
          id, theme: spec.theme, size: spec.size, elementIndex, element: ELEMENT_NAMES[elementIndex],
          generates: ELEMENTS[(elementIndex + 1) % 5], overcomes: ELEMENTS[(elementIndex + 2) % 5],
          hasPearl: spec.theme === 'gold', ...this.dimensions(spec.size), openingDepth: spec.depth,
          depth: 1, radius: 0, heading: 0, depthPitch: 0, speed: 0, turn: 0, roll: 0, pitchRate: 0, rollRate: 0, travelSpeed: 0,
          time: this.time, phase, wx: 0, wy: 0, wz: 0, x: 0, y: 0,
          history: [], nodes: [], wind: v3(), opacity: 1, behavior: 'opening',
          waypoint: null, nextWaypointAt: 0, maneuver: 'cruise', pass: null, nextManeuverAt: 60 + id * 6, nextPassKind: id % 2 === 0 ? 'approach' : 'overhead', nextDeparture: OPENING_SECONDS + 110 + id * 43 + this.random() * 18,
          excursion: null, _headDown: null, _waveDown: null, _lastRecorded: null,
        };
        const initial = this.openingMotion(d, 0), p = initial.point, dir = unit(initial.velocity);
        d.wx = p.x; d.wy = p.y; d.wz = p.z;
        d.heading = Math.atan2(dir.y, dir.x); d.depthPitch = clamp(Math.atan2(dir.z, Math.hypot(dir.x, dir.y)), -MAX_PITCH, MAX_PITCH);
        d.speed = magnitude(initial.velocity); d.travelSpeed = d.speed; d.turn = initial.angularSpeed;
        d.project = point => this.project(point); d.worldFrame = index => this.frame(d, index);
        d.nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({ s: i / (NODE_COUNT - 1), x: 0, y: 0, z: 0, r: 0, nx: 0, ny: 1, wx: 0, wy: 0, wz: 0, wr: 0, _frame: null }));
        this.seedTrail(d); this.sampleSpine(d); return d;
      });
      return;
    }
    const sx = width / ow, sy = height / oh, sz = this.focal / of;
    const scalePoint = p => { if (p) { p.x *= sx; p.y *= sy; p.z *= sz; } };
    for (const d of this.dragons) {
      d.wx *= sx; d.wy *= sy; d.wz *= sz;
      d.heading = Math.atan2(Math.sin(d.heading) * sy, Math.cos(d.heading) * sx);
      d.depthPitch = clamp(d.depthPitch, -MAX_PITCH, MAX_PITCH);
      for (const p of d.history) scalePoint(p);
      scalePoint(d._lastRecorded); scalePoint(d.waypoint); scalePoint(d.wind);
      if (d.excursion) scalePoint(d.excursion.anchor);
      if(d.pass){scalePoint(d.pass.entry);scalePoint(d.pass.exit);}
      Object.assign(d, this.dimensions(d.size)); d._headDown = null; d._waveDown = null; this.sampleSpine(d);
    }
  }
  seedTrail(d) {
    const F = v3(Math.cos(d.heading) * Math.cos(d.depthPitch), Math.sin(d.heading) * Math.cos(d.depthPitch), Math.sin(d.depthPitch));
    const D = perpendicularDown(F), step = Math.max(3, d.worldRadius * 0.13);
    for (let distance = 0; distance <= d.length * 1.32; distance += step) {
      const s = distance / d.length, bend = Math.sin(s * 4.2 + d.phase) * d.worldRadius * 0.55 * Math.min(1, s * 4);
      d.history.push(v3(d.wx - F.x * distance + D.x * bend, d.wy - F.y * distance + D.y * bend, d.wz - F.z * distance + D.z * bend));
    }
    d._lastRecorded = v3(d.wx, d.wy, d.wz);
  }
  record(d) {
    const p = v3(d.wx, d.wy, d.wz), spacing = Math.max(2, d.worldRadius * 0.10);
    if (magnitude(sub(p, d._lastRecorded)) >= spacing) {
      d.history.splice(1, 0, { ...p }); d._lastRecorded = { ...p };
    }
    d.history[0] = p;
  }
  nearTarget(d) {
    // A giant cannot catch small centre targets inside its turning radius.
    // Cruise toward a distant forward fan; only the larger world edge calls
    // for a broad return. The viewport itself never triggers a turn.
    const outside = Math.abs(d.wx) > this.width * 2.5 || Math.abs(d.wy) > this.height * 2.5;
    if (outside) {
      d.waypointKind = 'broad-return';
      d.waypoint = v3((this.random() - 0.5) * this.width * 0.40,
        (this.random() - 0.5) * this.height * 0.30,
        this.focal * (0.04 + this.random() * 0.30));
      // Leave the return arc before it becomes another centre-chasing orbit.
      d.arrivalRadius = Math.max(this.width * 0.55, this.height * 0.42, d.cruise / MAX_TURN * 0.85);
    } else {
      d.waypointKind = 'cruise';
      const heading = d.heading + (this.random() - 0.5) * 1.10;
      const distance = d.cruise * (95 + this.random() * 45);
      d.waypoint = v3(d.wx + Math.cos(heading) * distance,
        d.wy + Math.sin(heading) * distance,
        this.focal * (-0.07 + this.random() * 0.45));
      d.arrivalRadius = Math.max(180, d.worldRadius * 4);
    }
    d.nextWaypointAt = this.time + 70 + this.random() * 45;
    if(!d.pass)d.maneuver='cruise';
  }
  beginPass(d){
    const kind=d.nextPassKind;d.nextPassKind=kind==='approach'?'overhead':'approach';
    d.maneuver=kind;
    d.pass={kind,start:this.time,stage:'entry',duration:kind==='approach'?185:175,
      entry:v3(0,kind==='overhead'?-this.height*.40:0,this.focal*(kind==='overhead'?-0.22:0.48)),
      exit:v3(kind==='overhead'?(d.wx<0?1:-1)*this.width*.78:0,kind==='overhead'?-this.height*.29:-this.height*.035,this.focal*(kind==='overhead'?-0.36:-0.56))};
  }
  beginExcursion(d) {
    const duration = 188 + this.random() * 34;
    d.excursion = { start: this.time, duration, sign: this.random() < 0.5 ? -1 : 1,
      anchor: v3(d.wx, d.wy, d.wz), heading: d.heading, pitch: d.depthPitch };
    d.behavior = 'far'; d.pass=null;d.maneuver='cruise';d.nextManeuverAt=this.time+duration+90;
  }
  step(dt, time, pointer = { x: 0, y: 0, active: false }) {
    if (!this.width || !this.height) return;
    dt = clamp(Number(dt) || 0, 0, 0.05); this.time = Number.isFinite(time) ? time : this.time + dt;
    this.phase = this.time < OPENING_SECONDS ? 'opening' : 'roaming';
    if(this.phase==='roaming'&&dt>0){
      const slots=2-this.dragons.filter(d=>d.behavior==='far'||d.behavior==='return').length;
      const waiting=this.dragons.filter(d=>d.behavior==='near'&&!d.pass&&this.time>=d.nextDeparture).sort((a,b)=>a.nextDeparture-b.nextDeparture);
      for(const d of waiting.slice(0,Math.max(0,slots)))this.beginExcursion(d);
    }
    for (const d of this.dragons) {
      if (dt > 0) {
        if (this.time <= OPENING_SECONDS) this.open(d, dt);
        else this.wander(d, dt, pointer);
      }
      d.time = this.time; this.sampleSpine(d);
    }
  }
  open(d, dt) {
    const motion = this.openingMotion(d, this.time), p = motion.point, velocity = motion.velocity;
    d.heading = Math.atan2(velocity.y, velocity.x); d.depthPitch = clamp(Math.atan2(velocity.z, Math.hypot(velocity.x, velocity.y)), -MAX_PITCH, MAX_PITCH);
    d.turn = motion.angularSpeed; d.speed = magnitude(velocity); d.travelSpeed = d.speed;
    d.roll = mix(d.roll, clamp(-d.turn * 1.25, -MAX_ROLL, MAX_ROLL), 1 - Math.exp(-dt * 0.45));
    d.wx = p.x; d.wy = p.y; d.wz = p.z; d.behavior = 'opening'; d.opacity = 1; this.record(d);
  }
  wander(d, dt, pointer) {
    if (d.behavior === 'opening') { d.behavior = 'near'; this.nearTarget(d); }
    if(d.behavior==='near'&&!d.pass&&this.time>=d.nextManeuverAt&&this.time<d.nextDeparture)this.beginPass(d);
    let desiredTurn, targetPitch, opacityTarget = 1;
    if (d.behavior === 'far') {
      const e = d.excursion, elapsed = this.time - e.start, progress = clamp(elapsed / e.duration, 0, 1);
      const ramp = smooth(0, 8, elapsed) * (1 - smooth(e.duration - 8, e.duration, elapsed));
      desiredTurn = e.sign * (Math.PI * 2 / (e.duration - 8)) * ramp;
      targetPitch = clamp(e.pitch * (1 - smooth(0, 25, elapsed)) + Math.sin(progress * Math.PI * 2) * 0.16, -MAX_PITCH, MAX_PITCH);
      opacityTarget = (1 - smooth(0.05, 0.23, progress)) + smooth(0.78, 0.99, progress);
      if (progress >= 1) {
        d.behavior = 'return'; d.waypoint = { ...e.anchor }; d.nextWaypointAt = this.time + 100;
        d.nextDeparture = this.time + 130 + this.random() * 100; d.excursion = null;
      }
    }
    if (d.behavior !== 'far') {
      let goal;
      if(d.pass){
        const pass=d.pass,elapsed=this.time-pass.start;
        if(pass.stage==='entry'&&(magnitude(sub(pass.entry,v3(d.wx,d.wy,d.wz)))<this.focal*.68||elapsed>36))pass.stage='pass';
        goal=pass.stage==='entry'?pass.entry:pass.exit;
        if(elapsed>pass.duration){d.pass=null;d.maneuver='cruise';d.nextManeuverAt=this.time+145+this.random()*85;this.nearTarget(d);goal=d.waypoint;}
      }else{
        if (!d.waypoint) this.nearTarget(d);
        const difference = sub(d.waypoint, v3(d.wx, d.wy, d.wz));
        const crossedWorldEdge = d.behavior === 'near' && d.waypointKind === 'cruise'
          && (Math.abs(d.wx) > this.width * 2.5 || Math.abs(d.wy) > this.height * 2.5);
        const arrival = d.behavior === 'return' ? Math.max(130, d.worldRadius * 3) : (d.arrivalRadius || Math.max(130, d.worldRadius * 3));
        if (Math.hypot(difference.x, difference.y) < arrival
          || this.time > d.nextWaypointAt || crossedWorldEdge) { d.behavior = 'near'; this.nearTarget(d); }
        goal=d.waypoint;
      }
      const wind=pointer.active?(pointer.y-this.height*.5)*(d.hasPearl?.025:.01):0;
      const targetHeading = Math.atan2(goal.y + wind - d.wy, goal.x - d.wx);
      desiredTurn = clamp(delta(d.heading, targetHeading) * 0.13, -MAX_TURN, MAX_TURN);
      const horizontal = Math.max(d.pass?90:500, Math.hypot(goal.x - d.wx, goal.y - d.wy));
      targetPitch = clamp(Math.atan2(goal.z - d.wz, horizontal), -MAX_PITCH, MAX_PITCH);
    }
    // A soft pull-up band plus a hard last-resort camera plane prevents
    // crossing the lens. Neither safeguard resets a world position.
    const minZ=-this.focal*.62;
    if(d.wz<minZ+this.focal*.18)targetPitch=Math.max(targetPitch,.58);
    targetPitch=clamp(targetPitch,-MAX_PITCH*.946,MAX_PITCH*.946);
    const acceleration = clamp((desiredTurn - d.turn) * 0.65, -MAX_TURN_ACCEL, MAX_TURN_ACCEL);
    d.turn = clamp(d.turn + acceleration * dt, -MAX_TURN, MAX_TURN);
    d.heading = Math.atan2(Math.sin(d.heading + d.turn * dt), Math.cos(d.heading + d.turn * dt));
    const targetPitchRate=clamp((targetPitch-d.depthPitch)*.28,-MAX_PITCH_RATE,MAX_PITCH_RATE);
    d.pitchRate+=clamp((targetPitchRate-d.pitchRate)*.65,-MAX_PITCH_ACCEL,MAX_PITCH_ACCEL)*dt;
    d.pitchRate=clamp(d.pitchRate,-MAX_PITCH_RATE,MAX_PITCH_RATE);
    const newPitch=clamp(d.depthPitch+d.pitchRate*dt,-MAX_PITCH,MAX_PITCH);
    if(newPitch!==d.depthPitch+d.pitchRate*dt)d.pitchRate=0;d.depthPitch=newPitch;
    const factor = 0.88 + Math.sin(this.time * 0.045 + d.phase) * 0.13 + Math.sin(this.time * 0.013 + d.phase * 0.7) * 0.05;
    const passSpeed=d.pass?(d.pass.kind==='approach'?(d.pass.stage==='entry'?.40:.60):.62):1;
    const targetSpeed = d.cruise * factor * passSpeed;
    d.speed += clamp((targetSpeed - d.speed) * 0.18, -d.cruise * 0.09, d.cruise * 0.09) * dt;
    const cameraFactor=d.depthPitch<0?smooth(minZ,minZ+this.focal*.30,d.wz):1;
    const targetTravel=d.speed*cameraFactor;
    d.travelSpeed+=clamp((targetTravel-d.travelSpeed)*.25,-d.cruise*.10,d.cruise*.10)*dt;
    const horizontalSpeed = d.travelSpeed * Math.cos(d.depthPitch);
    d.wx += Math.cos(d.heading) * horizontalSpeed * dt; d.wy += Math.sin(d.heading) * horizontalSpeed * dt;
    d.wz = Math.max(minZ,d.wz+Math.sin(d.depthPitch)*d.travelSpeed*dt);
    const passRoll=d.pass?Math.sin((this.time-d.pass.start)*.035)*(d.pass.kind==='overhead'?1.25:.90):0;
    const roll = clamp(-d.turn * 3.5 + Math.sin(this.time * 0.025 + d.phase) * 0.28+passRoll, -MAX_ROLL*.90, MAX_ROLL*.90);
    const targetRollRate=clamp((roll-d.roll)*.32,-MAX_ROLL_RATE,MAX_ROLL_RATE);
    d.rollRate+=clamp((targetRollRate-d.rollRate)*.65,-MAX_ROLL_ACCEL,MAX_ROLL_ACCEL)*dt;
    d.rollRate=clamp(d.rollRate,-MAX_ROLL_RATE,MAX_ROLL_RATE);
    const newRoll=clamp(d.roll+d.rollRate*dt,-MAX_ROLL,MAX_ROLL);if(newRoll!==d.roll+d.rollRate*dt)d.rollRate=0;d.roll=newRoll;
    const depthFade = 1 - smooth(this.focal * 0.82, this.focal * 1.65, d.wz);
    opacityTarget = clamp(opacityTarget * depthFade, 0, 1);
    d.opacity = mix(d.opacity, opacityTarget, 1 - Math.exp(-dt * 0.28));
    if (d.opacity < 0.002 && opacityTarget === 0) d.opacity = 0;
    this.record(d);
  }
  sampleSpine(d) {
    const trail = d.history; if (!trail.length) return;
    let cursor = 0, walked = 0, a = trail[0], b = trail[1] || a, segment = magnitude(sub(b, a));
    let lastTangent = v3(-Math.cos(d.heading) * Math.cos(d.depthPitch), -Math.sin(d.heading) * Math.cos(d.depthPitch), -Math.sin(d.depthPitch));
    let waveDown = d._waveDown;
    for (const node of d.nodes) {
      const distance = node.s * d.length;
      while (walked + segment < distance && cursor < trail.length - 2) {
        walked += segment; cursor++; a = trail[cursor]; b = trail[cursor + 1]; segment = magnitude(sub(b, a));
      }
      const fraction = segment > 1e-8 ? (distance - walked) / segment : 0;
      const tangent = segment > 1e-8 ? unit(sub(b, a), lastTangent) : lastTangent;
      const forward = v3(-tangent.x, -tangent.y, -tangent.z);
      waveDown = perpendicularDown(forward, waveDown); if(node.s===0) d._waveDown = { ...waveDown };
      const down = waveDown, side = unit(cross(forward, down));
      const s = node.s, amp = d.worldRadius * 0.39 * Math.pow(Math.sin(Math.PI * s), 0.9);
      const wave = Math.sin(this.time * 0.62 - s * 10.5 + d.phase) * amp;
      const twist = Math.cos(this.time * 0.47 - s * 8.8 + d.phase) * amp * 0.26;
      node.wx = mix(a.x, b.x, fraction) + down.x * wave + side.x * twist;
      node.wy = mix(a.y, b.y, fraction) + down.y * wave + side.y * twist;
      node.wz = mix(a.z, b.z, fraction) + down.z * wave + side.z * twist;
      node.wr = Math.max(0.65, d.worldRadius * (0.99 - s * 0.17) * Math.pow(1 - s, 0.27));
      if (s > 0.88) node.wr *= mix(1, 0.12, (s - 0.88) / 0.12);
      const p = this.project(v3(node.wx, node.wy, node.wz)); node.x = p.x; node.y = p.y; node.z = p.depth; node.r = node.wr * p.scale;
      lastTangent = tangent;
    }
    let baseDown = d._headDown;
    for (let index = 0; index < NODE_COUNT; index++) {
      const n = d.nodes[index], prev = d.nodes[Math.max(0, index - 1)], next = d.nodes[Math.min(NODE_COUNT - 1, index + 1)];
      let forward = unit(v3(prev.wx - next.wx, prev.wy - next.wy, prev.wz - next.wz),
        v3(Math.cos(d.heading) * Math.cos(d.depthPitch), Math.sin(d.heading) * Math.cos(d.depthPitch), Math.sin(d.depthPitch)));
      baseDown = perpendicularDown(forward, baseDown); const baseSide = unit(cross(forward, baseDown)); baseDown = unit(cross(baseSide, forward));
      if (index === 0) d._headDown = { ...baseDown };
      const roll = d.roll * (1 - n.s * 0.2) + Math.sin(this.time * 0.09 - n.s * 4 + d.phase) * 0.018;
      const co = Math.cos(roll), si = Math.sin(roll), down = v3(baseDown.x * co + baseSide.x * si, baseDown.y * co + baseSide.y * si, baseDown.z * co + baseSide.z * si),
        side = v3(baseSide.x * co - baseDown.x * si, baseSide.y * co - baseDown.y * si, baseSide.z * co - baseDown.z * si);
      n._frame = { origin: v3(n.wx, n.wy, n.wz), forward, down, side };
      const dx = next.x - prev.x, dy = next.y - prev.y, length = Math.hypot(dx, dy);
      n.nx = length > 1e-8 ? -dy / length : -Math.sin(d.heading); n.ny = length > 1e-8 ? dx / length : Math.cos(d.heading);
    }
    const head = this.project(v3(d.wx, d.wy, d.wz)); d.x = head.x; d.y = head.y; d.depth = head.depth; d.radius = d.worldRadius * head.scale;
    let kept = walked + segment, end = cursor + 1;
    while (end < trail.length - 1 && kept < d.length * 1.28) { kept += magnitude(sub(trail[end + 1], trail[end])); end++; }
    if (end < trail.length - 1) trail.length = end + 1;
    if (trail.length > 6000) trail.length = 6000;
  }
  frame(d, index) { return d.nodes[clamp(Math.round(index), 0, NODE_COUNT - 1)]._frame; }
}
