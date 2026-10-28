// A fully spatial Chinese dragon head for the low-resolution ASCII mask.
// Local coordinates: +x muzzle, +y underside, +/-z the two sides of the head.
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map(v => v * k);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
const mean = points => mul(points.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / points.length);
const rgb = (c, k = 1) => `rgb(${c.map(v => Math.round(clamp(v*k, 0, 255))).join(',')})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const finite = p => p.every(Number.isFinite);

/** Draw into the caller's mask; frame.at and depthAt supply the camera transform. */
export function drawDragonHead(ctx, frame, palette, time = 0) {
  if (!ctx || !frame || typeof frame.at !== 'function') return;
  const r = Math.max(1, Number(frame.r) || 1);
  const at = (p) => frame.at(p[0], p[1], p[2]);
  const depth = typeof frame.depthAt === 'function'
    ? p => frame.depthAt(p[0], p[1], p[2])
    : p => p[2];
  const P = palette;
  const objects = [];
  let serial = 0;
  // Depth derivatives are a camera direction in the head's local coordinates.
  // Surface details are omitted on the far side, as well as being depth sorted.
  const view = unit([
    depth([1, 0, 0]) - depth([-1, 0, 0]),
    depth([0, 1, 0]) - depth([0, -1, 0]),
    depth([0, 0, 1]) - depth([0, 0, -1]),
  ]);
  const visible = (normal, threshold = -.045) => dot(unit(normal), view) > threshold;
  const insert = (kind, points, data) => {
    const z = depth(mean(points));
    if (Number.isFinite(z)) objects.push({kind, points, z, serial: serial++, ...data});
  };
  const ellipsoid = (center, radii, fill, normal) => {
    if (!normal || visible(normal)) insert('ellipsoid', [center], {radii, fill});
  };
  const face = (points, fill, normal) => {
    if (!normal || visible(normal)) insert('face', points, {fill});
  };
  const curve = (points, stroke, width, normal, samples = 9) => {
    if (normal && !visible(normal)) return;
    const vertices = [];
    for (let i = 0; i <= samples; i++) {
      const u = i / samples, v = 1-u;
      vertices.push(points[0].map((a, k) => v*v*v*a + 3*v*v*u*points[1][k] + 3*v*u*u*points[2][k] + u*u*u*points[3][k]));
    }
    insert('curve', vertices, {stroke, width});
  };
  // Square-section tapered tubes have real spatial faces. Their near faces
  // independently join the common painter queue, rather than overlaying the face.
  const hornSegment = (a, b, ra, rb) => {
    const tangent = unit(sub(b, a));
    const reference = Math.abs(tangent[1]) < .83 ? [0, 1, 0] : [0, 0, 1];
    const u = unit(cross(tangent, reference)), v = cross(tangent, u);
    const ring = (p, radius) => Array.from({length: 4}, (_, j) => {
      const angle = j * Math.PI/2 + Math.PI/4;
      return add(p, add(mul(u, Math.cos(angle)*radius), mul(v, Math.sin(angle)*radius)));
    });
    const A = ring(a, ra), B = ring(b, rb);
    for (let j = 0; j < 4; j++) {
      const k = (j+1)%4, normal = unit(add(sub(A[j], a), sub(A[k], a)));
      const light = clamp(.84 + dot(normal, [.28, -.69, -.24])*.20, .60, 1.03);
      face([A[j], A[k], B[k], B[j]], rgb(P.rim, light), normal);
    }
  };
  const horn = (points, widths) => {
    for (let i = 1; i < points.length; i++) hornSegment(points[i-1], points[i], widths[i-1], widths[i]);
  };

  // A collar of separate swept tufts encircles the occiput, including the unseen
  // side. It therefore remains a mane in a roll, overhead pass, or rear view.
  for (let j = 0; j < 12; j++) {
    const angle = j/12*TAU, y = Math.sin(angle), z = Math.cos(angle);
    const flutter = Math.sin(time*.57-j*.79)*.065;
    const outer = [y*(1.25+flutter), z*(1.32+flutter)];
    face([
      [-.72, y*.70-z*.15, z*.77+y*.15],
      [-1.28, outer[0]-z*.16, outer[1]+y*.16],
      [-2.43-Math.abs(z)*.16, y*1.08+flutter, z*1.26],
      [-1.32, y*.70+z*.17, z*.79-y*.17],
    ], rgb(P.mane, .76+(1-y)*.09));
    curve([
      [-.91, y*.75, z*.85], [-1.34, y*1.21, z*1.30],
      [-1.92, y*1.28+flutter, z*1.38], [-2.45, y*1.08+flutter, z*1.26],
    ], rgb(P.light, .82), .052);
  }

  // Both antlers have distinct outward and inward tines in all three axes.
  // Their roots are bone-covered, not detached pale lines above the head.
  for (const side of [-1, 1]) {
    ellipsoid([-.60, -.77, side*.72], [.39, .39, .35], rgb(P.shadow, .96));
    ellipsoid([-.54, -.89, side*.78], [.27, .30, .27], rgb(P.base, 1.07));
    horn([
      [-.57, -.94, side*.80], [-.91, -1.72, side*1.04],
      [-.96, -2.50, side*1.23], [-.45, -3.20, side*1.48],
      [-.23, -3.47, side*1.56],
    ], [.25, .21, .155, .082, .012]);
    horn([
      [-.88, -1.67, side*1.04], [-1.58, -2.02, side*1.52],
      [-1.89, -2.65, side*1.79],
    ], [.17, .115, .012]);
    horn([
      [-.95, -2.45, side*1.23], [-1.39, -2.89, side*.99],
      [-1.27, -3.34, side*1.10],
    ], [.13, .075, .009]);
  }

  // The skull, cheeks, tall bridge, bovine muzzle, and jaw are actual volumes.
  // Separate z radii prevent the face from collapsing into a side-view cutout.
  ellipsoid([-.77, .04, 0], [.80, .88, .88], rgb(P.shadow, 1.04));
  ellipsoid([-.15, -.03, 0], [1.22, 1.00, 1.04], rgb(P.base));
  ellipsoid([.35, -.34, 0], [1.00, .78, .99], rgb(P.light, .84));
  ellipsoid([.27, -.78, 0], [.77, .30, .71], rgb(P.light, .95), [.18, -1, 0]);
  ellipsoid([1.22, -.26, 0], [.99, .43, .58], rgb(P.base, 1.08));
  ellipsoid([1.66, .20, 0], [1.03, .63, .88], rgb(P.light, .91));
  ellipsoid([1.52, .64, 0], [.96, .30, .77], rgb(P.base, .97));
  ellipsoid([2.37, .10, 0], [.62, .46, .83], rgb(P.base, 1.11));
  ellipsoid([2.79, .07, 0], [.23, .35, .71], rgb(P.light, .91), [1, 0, 0]);
  ellipsoid([2.05, -.31, 0], [.60, .20, .64], rgb(P.light, 1.01), [.35, -1, 0]);

  for (const side of [-1, 1]) {
    const normal = [.42, -.10, side*.91];
    const sideNormal = [.12, .08, side];
    ellipsoid([.10, .22, side*.74], [.77, .59, .43], rgb(P.base, .93));
    ellipsoid([.29, .34, side*.92], [.57, .39, .23], rgb(P.light, .89), sideNormal);
    // Swept pointed ear / temporal plate, with an inset fold; no circular ears.
    face([
      [-.40, -.46, side*.91], [-1.30, -.96, side*1.47],
      [-1.40, -.28, side*1.37], [-.60, .12, side*.93],
    ], rgb(P.base, .87), [-.05, -.12, side]);
    face([
      [-.59, -.41, side*1.00], [-1.21, -.77, side*1.45],
      [-1.10, -.26, side*1.37],
    ], rgb(P.shadow, .88), [-.05, -.12, side]);
    face([
      [.13, -.04, side*1.04], [-.55, -.39, side*1.08],
      [-1.12, -.10, side*1.12], [-.47, .34, side*.99],
    ], rgb(P.light, .84), sideNormal);

    // Dark sockets, restrained bright irises, narrow pupils. All three radii
    // matter: the iris' z radius is .25, preserving its frontal projected width.
    ellipsoid([.63, -.43, side*.86], [.45, .235, .36], rgb(P.shadow, .48), normal);
    ellipsoid([.85, -.43, side*1.01], [.24, .14, .25], rgb(mix(P.eye, P.light, .20), .96), normal);
    ellipsoid([.96, -.40, side*1.10], [.073, .108, .085], rgb(P.shadow, .34), normal);
    if (r > 25) ellipsoid([1.00, -.44, side*1.11], [.035, .032, .040], rgb(P.eye, 1.02), normal);
    // Lower lid is a spatial arc; the heavy upper orbital bone comes forward
    // far enough to overhang the eye when the dragon faces the camera.
    curve([
      [.25, -.29, side*.99], [.60, -.20, side*1.16],
      [1.03, -.25, side*1.17], [1.16, -.40, side*.91],
    ], rgb(P.base, .88), .105, normal);
    ellipsoid([1.08, -.64, side*1.10], [.42, .21, .29], rgb(P.light, 1.02), [.42, -.46, side*.78]);
    face([
      [.92, -.80, side*1.32], [1.16, -.64, side*1.36],
      [1.36, -.48, side*1.18], [1.39, -.29, side*.76],
      [1.18, -.45, side*.70], [.89, -.71, side*1.06],
    ], rgb(P.rim, .93), [.50, -.45, side*.80]);
    curve([
      [.45, -.86, side*.96], [.02, -1.14, side*1.03],
      [-.48, -1.20, side*1.11], [-1.02, -.99, side*1.23],
    ], rgb(P.light, .96), .085, [.2, -.7, side*.7]);

    // Two raised nasal wings and two separate dark apertures on the front-side
    // surface. The apertures retain height and breadth in a direct frontal view.
    const noseNormal = [.86, -.12, side*.46];
    ellipsoid([2.78, -.075, side*.47], [.21, .235, .28], rgb(P.light, 1.03), noseNormal);
    ellipsoid([2.94, -.06, side*.49], [.105, .12, .18], rgb(P.shadow, .43), noseNormal);
    curve([
      [2.85, -.20, side*.30], [2.96, -.30, side*.43],
      [2.98, -.22, side*.69], [2.87, -.06, side*.72],
    ], rgb(P.rim, .94), .073, noseNormal);

    // A closed mouth set high on a firm jaw. Neither teeth nor a black open
    // mouth wedge is generated, including while viewed from underneath.
    curve([
      [.52, .51, side*.95], [.96, .56, side*.99],
      [1.37, .55, side*.94], [1.70, .54, side*.87],
    ], rgb(P.shadow, .52), .078, [.18, .35, side*.9]);
    curve([
      [1.70, .54, side*.87], [2.08, .53, side*.83],
      [2.47, .48, side*.76], [2.82, .48, side*.62],
    ], rgb(P.shadow, .52), .078, [.55, .18, side*.8]);
    curve([
      [.40, .48, side*.93], [.79, .91, side*.86],
      [1.92, .92, side*.73], [2.64, .54, side*.66],
    ], rgb(P.light, .88), .085, [.18, .55, side*.83]);
    curve([
      [-.07, .18, side*1.07], [.12, .47, side*1.18],
      [.38, .53, side*1.10], [.60, .47, side*.99],
    ], rgb(P.shadow, .73), .078, sideNormal);
  }
  // The front lip connects the side mouth lines around the curved nose, and
  // stays above the lower jaw rather than forming a catfish-like flat slit.
  curve([
    [2.82, .48, -.62], [3.05, .39, -.35],
    [3.05, .39, .35], [2.82, .48, .62],
  ], rgb(P.shadow, .50), .078, [1, .30, 0]);
  curve([
    [2.61, .55, -.58], [2.84, .75, -.30],
    [2.84, .75, .30], [2.61, .55, .58],
  ], rgb(P.light, .96), .080, [.5, .75, 0]);
  curve([
    [.91, -1.00, 0], [1.40, -.69, -.08],
    [1.94, -.49, .04], [2.47, -.32, 0],
  ], rgb(P.rim, .76), .075, [.30, -1, 0]);

  // A small tuft under the chin plus individual fine jaw filaments. The long
  // paired muzzle whiskers belong to the parent renderer and are not repeated.
  ellipsoid([.50, .78, 0], [.45, .28, .48], rgb(P.mane, .90));
  for (let j = 0; j < 6; j++) {
    const side = (j-2.5)/2.5, flutter = Math.sin(time*.65+j*.91)*.075;
    curve([
      [.60-Math.abs(side)*.16, .86, side*.42],
      [.40, 1.18, side*.57],
      [-.12-Math.abs(side)*.33, 1.83, side*.65+flutter],
      [-.75-Math.abs(side)*.45, 1.64+flutter, side*.72],
    ], rgb(j%2 ? P.rim : P.mane, j%2 ? .84 : 1.02), .051);
  }

  // Project each ellipsoid's three local radius vectors. The eigenvalues of
  // their 2x2 covariance produce its spatial silhouette for any head rotation.
  const projectedEllipse = (center, radii) => {
    const o = at(center), axes = [];
    if (!finite(o)) return null;
    for (let axis = 0; axis < 3; axis++) {
      const a = center.slice(), b = center.slice();
      a[axis] += radii[axis]; b[axis] -= radii[axis];
      const A = at(a), B = at(b);
      if (!finite(A) || !finite(B)) return null;
      axes.push([(A[0]-B[0])*.5, (A[1]-B[1])*.5]);
    }
    const A = axes.reduce((s, p) => s+p[0]*p[0], 0);
    const B = axes.reduce((s, p) => s+p[0]*p[1], 0);
    const C = axes.reduce((s, p) => s+p[1]*p[1], 0);
    const discriminant = Math.hypot(A-C, 2*B);
    const rx = Math.sqrt(Math.max(.0001, (A+C+discriminant)/2));
    const ry = Math.sqrt(Math.max(.0001, (A+C-discriminant)/2));
    return {o, rx, ry, angle: .5*Math.atan2(2*B, A-C)};
  };
  const localScale = p => {
    const o = at(p);
    let sum = 0;
    for (let k = 0; k < 3; k++) {
      const q = p.slice(); q[k] += .1;
      const b = at(q); sum += (b[0]-o[0])**2 + (b[1]-o[1])**2;
    }
    const scale = Math.sqrt(sum/.02);
    return Number.isFinite(scale) ? scale : r;
  };

  objects.sort((a, b) => a.z-b.z || a.serial-b.serial);
  ctx.save();
  try {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const object of objects) {
      if (object.kind === 'ellipsoid') {
        const e = projectedEllipse(object.points[0], object.radii);
        if (!e) continue;
        ctx.beginPath(); ctx.ellipse(e.o[0], e.o[1], e.rx, e.ry, e.angle, 0, TAU);
        ctx.fillStyle = object.fill; ctx.fill();
        continue;
      }
      const vertices = object.points.map(at);
      if (!vertices.every(finite)) continue;
      ctx.beginPath();
      for (let j = 0; j < vertices.length; j++) {
        if (j) ctx.lineTo(vertices[j][0], vertices[j][1]);
        else ctx.moveTo(vertices[j][0], vertices[j][1]);
      }
      if (object.kind === 'face') {
        ctx.closePath(); ctx.fillStyle = object.fill; ctx.fill();
      } else {
        ctx.strokeStyle = object.stroke;
        ctx.lineWidth = Math.max(.45, localScale(mean(object.points))*object.width);
        ctx.stroke();
      }
    }
  } finally {
    ctx.restore();
  }
}
