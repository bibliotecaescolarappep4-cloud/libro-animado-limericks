// Smooth the displayed pose while keeping it attached to the tracked drawing.
// Time constants are in seconds; exponential damping is independent of frame rate.
export class PoseSmoother {
  constructor(THREE) {
    this.position = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.initialized = false;
    this.lastTime = null;
  }

  reset() {
    this.initialized = false;
    this.lastTime = null;
  }

  update(matrix, displayed, timeMs) {
    matrix.decompose(this.position, this.rotation, this.scale);
    const values = [...this.position.toArray(), ...this.rotation.toArray(), ...this.scale.toArray()];
    if (!values.every(Number.isFinite) || Math.min(this.scale.x, this.scale.y, this.scale.z) <= 0) return false;
    if (!this.initialized) {
      displayed.position.copy(this.position);
      displayed.quaternion.copy(this.rotation);
      displayed.scale.copy(this.scale);
      this.initialized = true;
    } else {
      const dt = Math.max(0, (timeMs - this.lastTime) / 1000);
      displayed.position.lerp(this.position, 1 - Math.exp(-dt / 0.14));
      displayed.quaternion.slerp(this.rotation, 1 - Math.exp(-dt / 0.18));
      displayed.scale.lerp(this.scale, 1 - Math.exp(-dt / 0.20));
    }
    this.lastTime = timeMs;
    return true;
  }
}
