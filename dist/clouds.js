/**
 * Seeded, resolution-independent ASCII cloud banks.
 * All coordinates are CSS pixels; the caller owns DPR scaling.
 *
 * prepare() builds a 20 px light field once per frame. sample() only bilinearly
 * reads that field, and returns ONE reusable object (including its tint array).
 * Consume its values immediately; do not retain the returned object.
 */
export class CloudField {
  constructor(seed = 17) {
    let state = seed >>> 0;
    const random = () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };

    this.banks = [];
    this._prepared = null;
    this._field = null;
    this._sample = { light: 0, shade: 0, tint: [1, 1, 1], veil: 0 };
    // Near banks only cross small parts of the picture, then disperse.
    const layout = [
      [0.08, 0.27, 0.45, 0.115, false],
      [0.80, 0.22, 0.40, 0.105, false],
      [0.45, 0.49, 0.51, 0.100, false],
      [0.12, 0.70, 0.43, 0.115, false],
      [0.88, 0.76, 0.48, 0.125, false],
      [0.52, 0.94, 0.55, 0.090, false],
      [0.02, 0.50, 0.29, 0.095, true],
      [0.87, 0.57, 0.32, 0.100, true],
      [0.52, 0.48, 0.29, 0.080, true],
    ];

    for (let index = 0; index < layout.length; index++) {
      const [x, y, sx, sy, front] = layout[index];
      const phase = random() * Math.PI * 2;
      const points = [];
      const add = (px, py, opacity, rank) => {
        points.push({
          x: px,
          y: py,
          opacity: opacity * (0.65 + random() * 0.35),
          glyph: '.,:;~--='[Math.floor(random() * 8)],
          rank: rank ?? random(),
        });
      };

      // The sampled light field uses this same sinusoidal filament centre.
      for (let strand = 0; strand < 7; strand++) {
        const offset = (strand - 3) * 0.060;
        for (let sample = 0; sample <= 154; sample++) {
          const px = sample / 77 - 1;
          const envelope = Math.max(0, 1 - px * px);
          const py = Math.sin(px * 3.7 + phase) * 0.20
            + Math.sin(px * 8.2 + phase * 0.6) * 0.055
            + offset * (0.35 + envelope);
          add(px, py, envelope * (0.36 + 0.11 * (3 - Math.abs(strand - 3))));
        }
      }

      for (let curl = 0; curl < 3; curl++) {
        const cx = -0.64 + curl * 0.60 + (random() - 0.5) * 0.16;
        const cy = Math.sin(cx * 3.7 + phase) * 0.20;
        const direction = random() > 0.5 ? 1 : -1;
        const curlPhase = random() * Math.PI;
        for (let strand = 0; strand < 3; strand++) {
          for (let sample = 0; sample <= 105; sample++) {
            const progress = sample / 105;
            const angle = progress * Math.PI * 2.3 * direction + curlPhase;
            const radius = 0.24 * (1 - progress) + 0.014 + strand * 0.012;
            add(cx + Math.cos(angle) * radius,
              cy + Math.sin(angle) * radius * 1.6,
              0.45 + Math.sin(progress * Math.PI) * 0.30);
          }
        }
      }

      this.banks.push({
        x, y, sx, sy, front, phase, points,
        bright: index % 2 === 0,
        warm: index % 4 < 2,
        speed: (0.0025 + random() * 0.0028) * (front ? 1.5 : 1),
        brightness: 0.80 + random() * 0.20,
        occupied: new Set(),
        frame: { active: false },
      });
    }
  }

  prepare({ width, height, time = 0, density = 0.7 } = {}) {
    if (!(Number.isFinite(width) && Number.isFinite(height)
      && width > 0 && height > 0 && Number.isFinite(time))) return this;
    density = Math.max(0, Math.min(1, Number(density) || 0));
    const previous = this._prepared;
    if (previous && previous.width === width && previous.height === height
      && previous.time === time && previous.density === density) return this;
    // Regular CSS-pixel spacing, with a conservative cap for extreme canvases.
    const spacing = Math.max(20, Math.max(width, height) / 240);
    const columns = Math.ceil(width / spacing) + 1;
    const rows = Math.ceil(height / spacing) + 1;
    const length = columns * rows;
    if (!this._field || this._field.light.length !== length) {
      this._field = {
        light: new Float32Array(length), shade: new Float32Array(length),
        r: new Float32Array(length), g: new Float32Array(length),
        b: new Float32Array(length), veil: new Float32Array(length),
      };
    }
    const field = this._field;
    field.light.fill(0); field.shade.fill(0); field.veil.fill(0);
    field.r.fill(0); field.g.fill(0); field.b.fill(0);
    const dx = width / (columns - 1);
    const dy = height / (rows - 1);
    this._prepared = { width, height, time, density, columns, rows, dx, dy };

    for (const bank of this.banks) {
      const frame = bank.frame;
      const breathing = 0.5 + 0.5 * Math.sin(time * (bank.front ? 0.20 : 0.085) + bank.phase);
      const pulse = bank.front
        ? 0.07 + 0.93 * Math.pow(breathing, 2.1)
        : 0.35 + 0.65 * Math.pow(breathing, 1.15);
      const gust = Math.sin(time * 0.17 + bank.phase * 1.7);
      const position = ((bank.x + time * bank.speed + 0.65) % 2.30 + 2.30) % 2.30 - 0.65;
      frame.cx = position * width;
      frame.cy = (bank.y + Math.sin(time * 0.11 + bank.phase) * 0.014 + gust * 0.006) * height;
      frame.sx = bank.sx * width;
      frame.sy = bank.sy * height * (1.24 + breathing * 0.22);
      frame.pulse = pulse;
      frame.breathing = breathing;
      frame.active = density > 0 && frame.cx + frame.sx >= 0 && frame.cx - frame.sx <= width;
      // Light and dark banks retain their identity while their colour breathes.
      const warmth = 0.5 + 0.5 * Math.sin(time * 0.045 + bank.phase);
      const colourMix = bank.warm ? 0.60 + warmth * 0.40 : warmth * 0.40;
      const cool = bank.bright ? [151, 177, 183] : [65, 75, 85];
      const warm = bank.bright ? [184, 178, 148] : [107, 82, 59];
      const red = Math.round(cool[0] + (warm[0] - cool[0]) * colourMix);
      const green = Math.round(cool[1] + (warm[1] - cool[1]) * colourMix);
      const blue = Math.round(cool[2] + (warm[2] - cool[2]) * colourMix);
      frame.colour = `rgb(${red},${green},${blue})`;
      frame.maskRGB = bank.bright ? '27,35,39' : '5,8,11';
      frame.maskX = frame.cx + frame.sx * 0.08;
      frame.maskSX = frame.sx * (0.48 + breathing * 0.13);
      frame.maskSY = frame.sy * (0.50 + breathing * 0.16);
      frame.maskCore = (0.05 + density * 0.71) * pulse;
      frame.maskRim = density * 0.24 * pulse;
      if (!frame.active) continue;

      const minX = Math.max(0, Math.floor((frame.cx - frame.sx) / dx));
      const maxX = Math.min(columns - 1, Math.ceil((frame.cx + frame.sx) / dx));
      const minY = Math.max(0, Math.floor((frame.cy - frame.sy * 0.80) / dy));
      const maxY = Math.min(rows - 1, Math.ceil((frame.cy + frame.sy * 0.80) / dy));
      const strength = density * pulse * (bank.front ? 0.94 : 0.80);
      const lightStrength = bank.bright ? 0.27 : -0.34;
      const tintR = bank.bright ? -0.01 + colourMix * 0.15 : -0.10 + colourMix * 0.13;
      const tintG = bank.bright ? 0.075 - colourMix * 0.015 : -0.055 - colourMix * 0.035;
      const tintB = bank.bright ? 0.13 - colourMix * 0.21 : 0.025 - colourMix * 0.24;
      for (let gx = minX; gx <= maxX; gx++) {
        const px = gx * dx;
        const ux = (px - frame.cx) / frame.sx;
        const envelope = Math.max(0, 1 - ux * ux);
        const centre = Math.sin(ux * 3.7 + bank.phase) * 0.20
          + Math.sin(ux * 8.2 + bank.phase * 0.6) * 0.055;
        for (let gy = minY; gy <= maxY; gy++) {
          const py = gy * dy;
          const uy = (py - frame.cy) / frame.sy;
          // A soft envelope around the actual filament geometry; this is light,
          // rather than an attempt to rasterise individual punctuation marks.
          const distance = Math.abs(uy - centre) / (0.29 + envelope * 0.19);
          const edge = Math.max(0, 1 - distance);
          const coverage = envelope * edge * edge * (3 - 2 * edge) * strength;
          const index = gy * columns + gx;
          field.light[index] += coverage * lightStrength;
          field.shade[index] += coverage * (bank.bright ? 0.025 : 0.84);
          field.r[index] += coverage * tintR;
          field.g[index] += coverage * tintG;
          field.b[index] += coverage * tintB;
          if (bank.front) {
            const mx = (px - frame.maskX) / frame.maskSX;
            const my = (py - frame.cy) / frame.maskSY;
            const radius = Math.sqrt(mx * mx + my * my);
            if (radius < 1) {
              // Same three radial stops as the front draw pass.
              const alpha = radius < 0.45
                ? frame.maskCore + (frame.maskRim - frame.maskCore) * radius / 0.45
                : frame.maskRim * (1 - radius) / 0.55;
              field.veil[index] = 1 - (1 - field.veil[index]) * (1 - alpha);
            }
          }
        }
      }
    }
    for (let index = 0; index < length; index++) {
      field.light[index] = Math.max(-0.35, Math.min(0.30, field.light[index]));
      field.shade[index] = Math.min(1, field.shade[index]);
      field.r[index] = Math.max(-0.25, Math.min(0.20, field.r[index]));
      field.g[index] = Math.max(-0.25, Math.min(0.20, field.g[index]));
      field.b[index] = Math.max(-0.25, Math.min(0.20, field.b[index]));
    }
    return this;
  }

  sample(x, y, options) {
    if (options) this.prepare(options);
    else if (!this._prepared) this.prepare({ width: 1440, height: 900, time: 0 });
    const result = this._sample;
    const prepared = this._prepared;
    if (!prepared || !Number.isFinite(x) || !Number.isFinite(y)
      || x < 0 || y < 0 || x > prepared.width || y > prepared.height) {
      result.light = 0; result.shade = 0; result.veil = 0;
      result.tint[0] = 1; result.tint[1] = 1; result.tint[2] = 1;
      return result;
    }
    const gx = x / prepared.dx;
    const gy = y / prepared.dy;
    const ix = Math.min(prepared.columns - 2, Math.floor(gx));
    const iy = Math.min(prepared.rows - 2, Math.floor(gy));
    const tx = gx - ix;
    const ty = gy - iy;
    const a = iy * prepared.columns + ix;
    const b = a + 1;
    const c = a + prepared.columns;
    const d = c + 1;
    const field = this._field;
    // Fixed six bilinear reads: no bank loops, trigonometry, or allocations.
    result.light = this._read(field.light, a, b, c, d, tx, ty);
    result.shade = this._read(field.shade, a, b, c, d, tx, ty);
    result.veil = this._read(field.veil, a, b, c, d, tx, ty);
    result.tint[0] = 1 + this._read(field.r, a, b, c, d, tx, ty);
    result.tint[1] = 1 + this._read(field.g, a, b, c, d, tx, ty);
    result.tint[2] = 1 + this._read(field.b, a, b, c, d, tx, ty);
    return result;
  }

  _read(values, a, b, c, d, tx, ty) {
    const top = values[a] + (values[b] - values[a]) * tx;
    return top + (values[c] + (values[d] - values[c]) * tx - top) * ty;
  }

  draw(ctx, { width, height, time, density = 0.5, front = false, cell = 8 }) {
    if (!(Number.isFinite(width) && Number.isFinite(height)
      && width > 0 && height > 0 && Number.isFinite(time))) return;
    this.prepare({ width, height, time, density });
    density = this._prepared.density;
    if (density === 0) return;
    cell = Math.max(4, Number(cell) || 8);
    const row = cell * 1.15;
    const visibleFraction = 0.27 + density * 0.65;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(7, cell * 1.15)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    for (const bank of this.banks) {
      const frame = bank.frame;
      if (bank.front !== front || !frame.active) continue;
      if (front) {
        ctx.save();
        ctx.translate(frame.maskX, frame.cy);
        ctx.scale(frame.maskSX, frame.maskSY);
        const mask = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        mask.addColorStop(0, `rgba(${frame.maskRGB},${frame.maskCore.toFixed(3)})`);
        mask.addColorStop(0.45, `rgba(${frame.maskRGB},${frame.maskRim.toFixed(3)})`);
        mask.addColorStop(1, `rgba(${frame.maskRGB},0)`);
        ctx.globalAlpha = 1;
        ctx.fillStyle = mask;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      }
      ctx.fillStyle = frame.colour;
      const occupied = bank.occupied;
      occupied.clear();
      for (const point of bank.points) {
        if (point.rank > visibleFraction * (0.78 + frame.pulse * 0.22)) continue;
        const px = Math.round((frame.cx + point.x * frame.sx) / cell) * cell;
        const py = Math.round((frame.cy + point.y * frame.sy) / row) * row;
        if (px < -cell || py < -row || px > width + cell || py > height + row) continue;
        const key = Math.round(py / row) * (Math.ceil(width / cell) + 3) + Math.round(px / cell);
        if (occupied.has(key)) continue;
        occupied.add(key);
        ctx.globalAlpha = point.opacity * bank.brightness
          * (front ? 0.76 : 0.57) * (0.30 + density * 0.70) * frame.pulse;
        ctx.fillText(point.glyph, px, py);
      }
    }
    ctx.restore();
  }
}
