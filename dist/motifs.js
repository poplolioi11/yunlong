/**
 * Faint, thick angular returning-cloud ornament at the picture's edges.
 * Newly drawn decorative paths, not an archaeological identification.
 * All coordinates are CSS pixels. The middle of the picture is never plotted.
 */
export class CloudMotifs {
  constructor(seed = 41) {
    this.seed = seed >>> 0;
    this.period = 43;
    // A stepped outline with a broad square-return curl and a smaller cloud hook.
    // Its few clear right-angle spirals deliberately avoid maze-like branches.
    this.paths = [
      [[-1.80, 0.85], [-1.80, -0.15], [-1.00, -0.15], [-1.00, -0.85],
        [1.50, -0.85], [1.50, 0.85], [0.15, 0.85], [0.15, -0.05],
        [0.80, -0.05]],
      [[1.50, 0.00], [2.15, 0.00], [2.15, 0.85], [2.75, 0.85],
        [2.75, 0.25]],
    ];
    this.placements = [
      { x: 0.36, y: 0.085, mirror: 1, vertical: false },
      { x: 0.93, y: 0.42, mirror: -1, vertical: true },
      { x: 0.65, y: 0.92, mirror: -1, vertical: false },
      { x: 0.075, y: 0.66, mirror: 1, vertical: true },
      { x: 0.63, y: 0.085, mirror: -1, vertical: false },
      { x: 0.93, y: 0.68, mirror: 1, vertical: true },
      { x: 0.35, y: 0.92, mirror: 1, vertical: false },
      { x: 0.075, y: 0.36, mirror: -1, vertical: true },
    ];
    this.colours = ['#a28d5c', '#6e5c3d', '#587367', '#936b50'];
    this._occupied = new Set();
  }

  draw(ctx, { width, height, time, cell = 8 }) {
    if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)
      || !Number.isFinite(time) || time < 0) return;
    const cycle = Math.floor(time / this.period);
    const phase = time - cycle * this.period;
    const start = 10 + (cycle % 4) * 1.6;
    const duration = 7.6 + (cycle % 3) * 1.1;
    if (phase <= start || phase >= start + duration) return;
    const progress = (phase - start) / duration;
    const envelope = Math.sin(progress * Math.PI) ** 2;
    const placement = this.placements[(cycle + this.seed) % this.placements.length];
    // Keep the whole ornament in an edge strip before the final safety clip.
    const size = placement.vertical
      ? Math.min(width * 0.105, height * 0.22)
      : Math.min(width * 0.22, height * 0.105);
    const sx = size * placement.mirror;
    const sy = size * 0.65;
    const cx = width * placement.x;
    const cy = height * placement.y;
    cell = Math.max(5, Number(cell) || 8);
    const row = cell * 1.10;
    const occupied = this._occupied;
    occupied.clear();

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${cell * 1.03}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.fillStyle = this.colours[cycle % this.colours.length];
    const put = (px, py, glyph, corner) => {
      if (px < 0 || py < 0 || px > width || py > height) return;
      // Include a full glyph margin, so visible ink also stays out of the centre.
      if (px + cell * 0.6 >= width * 0.22 && px - cell * 0.6 <= width * 0.78
        && py + row * 0.6 >= height * 0.18 && py - row * 0.6 <= height * 0.82) return;
      const key = Math.round(py / row) * (Math.ceil(width / cell) + 3) + Math.round(px / cell);
      if (occupied.has(key)) return;
      occupied.add(key);
      ctx.globalAlpha = envelope * (corner ? 0.22 : 0.18);
      ctx.fillText(glyph, px, py);
    };
    const plot = (x, y, glyph, horizontal, corner = false) => {
      const px = Math.round((cx + (placement.vertical ? y * sy : x * sx)) / cell) * cell;
      const py = Math.round((cy + (placement.vertical ? x * sx : y * sy)) / row) * row;
      const screenHorizontal = placement.vertical ? !horizontal : horizontal;
      // A three-cell brush is bold enough to read as old bronze cloud carving.
      for (let offset = -1; offset <= 1; offset++) {
        if (corner) {
          for (let across = -1; across <= 1; across++) {
            put(px + across * cell, py + offset * row, '+', true);
          }
        } else {
          put(px + (screenHorizontal ? 0 : offset * cell),
            py + (screenHorizontal ? offset * row : 0),
            screenHorizontal ? '=' : '|', false);
        }
      }
    };
    for (const path of this.paths) {
      for (let index = 0; index < path.length - 1; index++) {
        const a = path[index];
        const b = path[index + 1];
        const horizontal = a[1] === b[1];
        const screenHorizontal = placement.vertical ? !horizontal : horizontal;
        const pixels = horizontal ? Math.abs((b[0] - a[0]) * sx) : Math.abs((b[1] - a[1]) * sy);
        const count = Math.max(1, Math.ceil(pixels / (screenHorizontal ? cell : row)));
        plot(a[0], a[1], '+', horizontal, true);
        for (let sample = 1; sample < count; sample++) {
          const u = sample / count;
          plot(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u,
            screenHorizontal ? '=' : '|', horizontal);
        }
        if (index === path.length - 2) plot(b[0], b[1], '+', horizontal, true);
      }
    }
    ctx.restore();
  }
}
