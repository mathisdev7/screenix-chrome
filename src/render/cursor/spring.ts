const REST_VELOCITY_THRESHOLD = 0.0001;
const REST_DISPLACEMENT_THRESHOLD = 0.00001;
const CRITICAL_EPSILON = 0.01;

export interface SpringConfig {
  tension: number;
  mass: number;
  friction: number;
}

export const CLICK_SPRING_CONFIG: SpringConfig = { tension: 530, mass: 1, friction: 40 };

export const DRAG_SPRING_CONFIG: SpringConfig = { tension: 1000, mass: 1, friction: 40 };

export function scaledDefaultSpringConfig(speed: number): SpringConfig {
  return {
    tension: 600 + speed * 600,
    mass: Math.max(1.5 - speed * 1.1, 0.2),
    friction: 50 + speed * 20,
  };
}

function solveSpring1D(displacement: number, velocity: number, t: number, omega0: number, zeta: number): [number, number] {
  if (zeta < 1 - CRITICAL_EPSILON) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega0 * t);
    const cosTerm = Math.cos(omegaD * t);
    const sinTerm = Math.sin(omegaD * t);
    const a = displacement;
    const b = (velocity + displacement * zeta * omega0) / Math.max(omegaD, 1e-4);
    return [
      decay * (a * cosTerm + b * sinTerm),
      decay * ((b * omegaD - a * zeta * omega0) * cosTerm - (a * omegaD + b * zeta * omega0) * sinTerm),
    ];
  }

  if (zeta > 1 + CRITICAL_EPSILON) {
    const sqrtTerm = Math.sqrt(zeta * zeta - 1);
    const s1 = -omega0 * (zeta - sqrtTerm);
    const s2 = -omega0 * (zeta + sqrtTerm);
    const denominator = s1 - s2;
    if (Math.abs(denominator) < 1e-10) {
      const sAverage = 0.5 * (s1 + s2);
      const decay = Math.exp(sAverage * t);
      const linear = displacement + (velocity - displacement * sAverage) * t;
      return [decay * linear, decay * (velocity - displacement * sAverage + sAverage * linear)];
    }
    const c1 = (velocity - displacement * s2) / denominator;
    const c2 = displacement - c1;
    const e1 = Math.exp(s1 * t);
    const e2 = Math.exp(s2 * t);
    return [c1 * e1 + c2 * e2, c1 * s1 * e1 + c2 * s2 * e2];
  }

  const decay = Math.exp(-omega0 * t);
  const b = velocity + displacement * omega0;
  return [decay * (displacement + b * t), decay * (b - omega0 * (displacement + b * t))];
}

export class SpringCursor {
  posX = 0;
  posY = 0;
  velX = 0;
  velY = 0;
  targetX = 0;
  targetY = 0;
  private tension = 0;
  private mass = 1;
  private friction = 0;

  constructor(config: SpringConfig = scaledDefaultSpringConfig(0)) {
    this.updateConfig(config);
  }

  updateConfig(config: SpringConfig) {
    this.tension = config.tension;
    this.mass = Math.max(config.mass, 0.001);
    this.friction = config.friction;
  }

  setPosition(x: number, y: number) {
    this.posX = x;
    this.posY = y;
    this.velX = 0;
    this.velY = 0;
  }

  setTarget(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  get isAtRest(): boolean {
    return this.posX === this.targetX && this.posY === this.targetY && this.velX === 0 && this.velY === 0;
  }

  step(dtMs: number): { x: number; y: number } {
    if (dtMs <= 0) return { x: this.posX, y: this.posY };
    const t = dtMs / 1000;
    const omega0 = Math.sqrt(this.tension / this.mass);
    const zeta = this.friction / (2 * Math.sqrt(this.tension * this.mass));
    const [dispX, velX] = solveSpring1D(this.posX - this.targetX, this.velX, t, omega0, zeta);
    const [dispY, velY] = solveSpring1D(this.posY - this.targetY, this.velY, t, omega0, zeta);
    this.posX = this.targetX + dispX;
    this.posY = this.targetY + dispY;
    this.velX = velX;
    this.velY = velY;
    if (Math.hypot(dispX, dispY) < REST_DISPLACEMENT_THRESHOLD && Math.hypot(velX, velY) < REST_VELOCITY_THRESHOLD) {
      this.posX = this.targetX;
      this.posY = this.targetY;
      this.velX = 0;
      this.velY = 0;
    }
    return { x: this.posX, y: this.posY };
  }
}
