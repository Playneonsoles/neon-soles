/**
 * Pas estimés par l'accéléromètre (PWA). Sur iPhone, l'autorisation se demande depuis un geste de l'utilisateur.
 * L'APK Android (lot 6) utilisera le podomètre natif.
 */
export class StepCounter {
  steps = 0;
  private lowPass = 9.81;
  private lastStep = 0;
  private armed = true;

  static async requestPermission(): Promise<boolean> {
    const D = (globalThis as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (D?.requestPermission) return (await D.requestPermission().catch(() => "denied")) === "granted";
    return typeof D !== "undefined";
  }
  start() { window.addEventListener("devicemotion", this.onMotion); }
  stop() { window.removeEventListener("devicemotion", this.onMotion); }

  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const m = Math.hypot(a.x, a.y, a.z);
    this.lowPass = this.lowPass * 0.9 + m * 0.1;
    const dev = m - this.lowPass, now = performance.now();
    if (dev > 1.2 && this.armed && now - this.lastStep > 300) { this.steps++; this.lastStep = now; this.armed = false; }
    else if (dev < 0.4) this.armed = true;
  };
}
