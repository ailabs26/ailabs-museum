import type { WebGLRenderer } from 'three';
import { MuseumAuditRecorder } from './museumAudit';
import type { AuditMetadata, MuseumAuditRun } from './museumAuditMetrics';

export const auditRecorder = new MuseumAuditRecorder();
let rendererSequence = 0;
let attachedRenderers = 0;
let cleanupObservation: (() => void) | null = null;
let rendererEnvironment: MuseumAuditRun['environment'] = {};

function browserEnvironment(): MuseumAuditRun['environment'] {
  return {
    userAgent: navigator.userAgent, viewportWidth: innerWidth, viewportHeight: innerHeight,
    devicePixelRatio, hardwareConcurrencyHint: navigator.hardwareConcurrency,
    deviceMemoryGiBHint: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
    refreshRateHz: null, thermalState: null, gpuMemoryBytes: null, gpuTimeMs: null,
    timeOrigin: performance.timeOrigin, longTaskSupported: PerformanceObserver.supportedEntryTypes.includes('longtask'),
    ...rendererEnvironment,
  };
}

export function startMuseumAudit(metadata: AuditMetadata) {
  auditRecorder.start(metadata, performance.now(), new Date().toISOString(), browserEnvironment());
  const observer = PerformanceObserver.supportedEntryTypes.includes('longtask') ? new PerformanceObserver(list => acceptTasks(list.getEntries())) : null;
  const acceptTasks = (entries: PerformanceEntry[]) => entries.forEach(entry => {
    auditRecorder.event(entry.startTime, 'longtask', { durationMs: entry.duration });
  });
  try { observer?.observe({ type: 'longtask' }); }
  catch { auditRecorder.event(performance.now(), 'observer-error'); }
  const visibility = () => auditRecorder.event(performance.now(), document.hidden ? 'hidden' : 'visible');
  const resize = () => auditRecorder.event(performance.now(), 'viewport-changed');
  const pagehide = () => { auditRecorder.event(performance.now(), 'pagehide'); stopMuseumAudit(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', pagehide);
  window.addEventListener('resize', resize);
  if (document.hidden) visibility();
  cleanupObservation = () => {
    if (observer) { acceptTasks(observer.takeRecords()); observer.disconnect(); }
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('pagehide', pagehide);
    window.removeEventListener('resize', resize);
  };
}

export function stopMuseumAudit() {
  cleanupObservation?.(); cleanupObservation = null;
  return auditRecorder.stop(performance.now());
}

/** Installed only after explicit URL opt-in by the existing renderer lifecycle owner. */
export function attachMuseumAudit(renderer: WebGLRenderer, readWorkload: () => MuseumAuditRun['environment']) {
  const rendererId = ++rendererSequence;
  const context = renderer.getContext();
  const extension = context.getExtension('WEBGL_debug_renderer_info');
  rendererEnvironment = {
    rendererId, webglVersion: String(context.getParameter(context.VERSION)),
    renderer: extension ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL)) : 'unavailable',
  };
  attachedRenderers++;
  const environment = { ...rendererEnvironment };
  const render = renderer.render;
  let lastResourceAt = -Infinity;
  let captureStart: number | null = null;
  let previousWorkload: MuseumAuditRun['environment'] | null = null;
  let previousDimensions = '';
  const wrapped: WebGLRenderer['render'] = function (scene, camera) {
    if (!auditRecorder.isRecording) return render.call(renderer, scene, camera);
    const start = performance.now();
    const before = renderer.info.render.frame;
    try { render.call(renderer, scene, camera); }
    catch (error) { auditRecorder.event(performance.now(), 'render-error'); throw error; }
    const end = performance.now();
    if (context.isContextLost() || renderer.info.render.frame <= before) return;
    auditRecorder.frame(start, end - start, rendererId);
    // First successful submission of each capture records the current workload;
    // resource snapshots occur only on rendered frames, never on an idle timer.
    const startedAt = auditRecorder.startedAt;
    const isNewCapture = captureStart !== startedAt;
    if (isNewCapture) {
      captureStart = startedAt; lastResourceAt = -Infinity;
      auditRecorder.event(start, 'renderer-observed', environment);
    }
    const workload = readWorkload();
    const dimensions = `${renderer.domElement.width},${renderer.domElement.height},${innerWidth},${innerHeight},${devicePixelRatio},${renderer.xr.isPresenting}`;
    // Read plain props/dimensions, never traverse the scene. Emit state changes
    // even when shorter than the1Hz resource sampling interval.
    if (isNewCapture || workload !== previousWorkload || dimensions !== previousDimensions) {
      previousWorkload = workload; previousDimensions = dimensions;
      auditRecorder.event(start, 'workload', { ...workload, renderWidth: renderer.domElement.width, renderHeight: renderer.domElement.height,
        viewportWidth: innerWidth, viewportHeight: innerHeight, devicePixelRatio, xrPresenting: renderer.xr.isPresenting });
    }
    if (start - lastResourceAt < 1000) return;
    lastResourceAt = start;
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    auditRecorder.resource(start, { rendererId, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length ?? 0, heapBytes: heap?.usedJSHeapSize ?? null });
    auditRecorder.event(start, 'camera-checkpoint', { x: camera.position.x, y: camera.position.y, z: camera.position.z,
      qx: camera.quaternion.x, qy: camera.quaternion.y, qz: camera.quaternion.z, qw: camera.quaternion.w });
  };
  renderer.render = wrapped;
  const lost = () => auditRecorder.event(performance.now(), 'context-lost', { rendererId });
  const restored = () => auditRecorder.event(performance.now(), 'context-restored', { rendererId });
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  auditRecorder.event(performance.now(), 'renderer-attached', environment);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    if (renderer.render === wrapped) renderer.render = render;
    renderer.domElement.removeEventListener('webglcontextlost', lost);
    renderer.domElement.removeEventListener('webglcontextrestored', restored);
    attachedRenderers--;
    auditRecorder.event(performance.now(), 'renderer-detached', { rendererId });
    if (rendererEnvironment.rendererId === rendererId) rendererEnvironment = {};
  };
}

export const museumAuditApi = {
  start: startMuseumAudit, stop: stopMuseumAudit,
  snapshot: () => auditRecorder.snapshot(), exportJson: () => auditRecorder.exportJson(),
  state: () => ({ recording: auditRecorder.isRecording, attachedRenderers, observing: cleanupObservation !== null }),
};

declare global { interface Window { museumAudit?: typeof museumAuditApi } }
