const { normalizeScaleValues } = require('./normalize');

class ScaleSimulator {
  constructor(config = {}, scaleConfig = {}) {
    const merged = { ...scaleConfig, ...config };
    this.maxCapacity = merged.maxCapacity ?? merged.maxWeight ?? 50.0;
    this.resolution = merged.resolution ?? 0.001;
    this.noise = merged.noise ?? 0.002;
    this.updateRate = merged.updateRate ?? 100;
    this.unit = merged.unit || 'kg';

    this.currentGross = 0;
    this.currentTare = 0;
    this.stable = true;
    this.stabilityCounter = 0;
    this.lastRoundedGross = 0;
    this.settling = false;
    this.settlingTarget = 0;
    this.settlingProgress = 0;
    this.driftRate = 0;
    this.disturbanceUntil = 0;
  }

  gaussRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  tick() {
    const now = Date.now();
    if (this.disturbanceUntil > now) {
      this.stable = false;
      this.stabilityCounter = 0;
    }

    if (this.settling) {
      this.settlingProgress += 1;
      const steps = Math.max(1, 3000 / this.updateRate);
      const t = this.settlingProgress / steps;

      if (t < 1.0) {
        const overshoot = 1.0 + 0.03 * Math.sin(t * Math.PI * 3) * (1 - t);
        const approach = 1 - (1 - t) ** 2.5;
        this.currentGross =
          this.currentTare + this.settlingTarget * approach * overshoot + this.driftRate * t;
        this.stable = false;
        this.stabilityCounter = 0;
      } else {
        this.currentGross = this.currentTare + this.settlingTarget + this.driftRate;
        this.settling = false;
        this.stabilityCounter = 0;
      }
    } else if (this.driftRate) {
      this.currentGross += this.driftRate * (this.updateRate / 1000);
    }

    const gaussNoise = this.gaussRandom() * this.noise;
    const displayGross = this.currentGross + gaussNoise;
    const roundedGross =
      Math.round(displayGross / this.resolution) * this.resolution;

    if (!this.settling && this.disturbanceUntil <= now) {
      if (Math.abs(roundedGross - this.lastRoundedGross) < this.resolution) {
        this.stabilityCounter += 1;
        if (this.stabilityCounter > 2000 / this.updateRate) {
          this.stable = true;
        }
      } else {
        this.stabilityCounter = 0;
        this.stable = false;
      }
    }
    this.lastRoundedGross = roundedGross;

    const net = roundedGross - this.currentTare;
    return normalizeScaleValues({
      grossWeight: Math.max(0, roundedGross),
      netWeight: Math.max(0, net),
      tareWeight: this.currentTare,
      stable: this.stable,
      unit: this.unit,
      overload: roundedGross > this.maxCapacity,
      status: roundedGross > this.maxCapacity ? 1 : 0,
    });
  }

  tare() {
    this.currentTare = this.currentGross;
    this.stable = true;
    this.stabilityCounter = 0;
    return this.currentTare;
  }

  addWeight(amount) {
    const baseNet = Math.max(0, this.currentGross - this.currentTare);
    this.settling = true;
    this.settlingTarget = baseNet + amount;
    this.settlingProgress = 0;
    this.stable = false;
    this.stabilityCounter = 0;
  }

  reset() {
    this.currentGross = 0;
    this.currentTare = 0;
    this.stable = true;
    this.settling = false;
    this.settlingTarget = 0;
    this.settlingProgress = 0;
    this.driftRate = 0;
    this.disturbanceUntil = 0;
  }

  simulateDrift(rate) {
    this.driftRate = rate;
  }

  simulateDisturbance() {
    this.disturbanceUntil = Date.now() + 1500;
    this.stable = false;
    this.stabilityCounter = 0;
  }
}

class TemperatureSimulator {
  constructor(config = {}) {
    this.updateRate = config.updateRate ?? 1000;
    this.temperature = config.initialTemp ?? 22.5;
    this.target = this.temperature;
    this.stable = true;
    this.stabilityCounter = 0;
  }

  tick() {
    const diff = this.target - this.temperature;
    if (Math.abs(diff) > 0.01) {
      this.temperature += diff * 0.15;
      this.stable = false;
      this.stabilityCounter = 0;
    } else {
      this.temperature += (Math.random() - 0.5) * 0.02;
      this.stabilityCounter += 1;
      this.stable = this.stabilityCounter > 3;
    }

    return {
      temperature: Math.round(this.temperature * 100) / 100,
      stable: this.stable,
      unit: '°C',
      status: 0,
    };
  }

  setTarget(value) {
    this.target = value;
    this.stable = false;
    this.stabilityCounter = 0;
  }

  reset() {
    this.temperature = 22.5;
    this.target = 22.5;
    this.stable = true;
  }
}

module.exports = { ScaleSimulator, TemperatureSimulator };
