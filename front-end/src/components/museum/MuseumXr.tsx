import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Euler, Group, Matrix4, MeshBasicMaterial, PerspectiveCamera, Quaternion, Raycaster, Vector3, type Mesh } from 'three';
import { XrSessionController, type XrSnapshot } from '@/helpers/xrSession';
import { canTeleport, getSnapAxis, resolveXrIntersection, snapTurnOrigin, teleportOrigin, type XrTarget } from '@/helpers/xrInteraction';
import { getDisplayColliders, NAVIGATION } from '@/helpers/museumNavigation';
import { MUSEUM_ROOM_SIZE, type MuseumDisplay } from '@/interfaces/museumScene';
import { XrDetailsPanel } from './XrDetailsPanel';
import { bindXrRenderer } from '@/helpers/xrRendererBinding';

export function MuseumXr({ available, displays, selectedId, onSelect, onController, onStatus, onHover, onRendererReset }: {
  available: boolean; displays: readonly MuseumDisplay[]; selectedId: string | null; onSelect: (id: string) => void;
  onController: (controller: XrSessionController | null) => void; onStatus: (snapshot: XrSnapshot) => void; onHover: (id: string | null) => void;
  onRendererReset: () => void;
}) {
  const { camera, gl, scene, invalidate, get } = useThree();
  const origin = useMemo(() => new Group(), []);
  const ownerRef = useRef<XrSessionController | null>(null);
  const props = useRef({ displays, selectedId, onSelect, onHover, available }); props.current = { displays, selectedId, onSelect, onHover, available };
  const colliders = useMemo(() => getDisplayColliders(displays), [displays]);
  const collidersRef = useRef(colliders); collidersRef.current = colliders;
  const [session, setSession] = useState<XRSession | null>(null);
  const [page, setPage] = useState(0), [pageCount, setPageCount] = useState(1);
  const pageCountRef = useRef(pageCount); pageCountRef.current = pageCount;
  const pointers = useRef<(Group | null)[]>([]);
  const reticles = useRef<(Mesh | null)[]>([]);
  const runtime = useMemo(() => ({
    matrix: new Matrix4(), position: new Vector3(), direction: new Vector3(), rotation: new Quaternion(), scale: new Vector3(),
    head: new Vector3(), ray: new Raycaster(), targets: new Map<XRInputSource, XrTarget | null>(),
    pressed: new Set<XRInputSource>(), snapLatched: new Set<XRInputSource>(), lastSnap: 0,
    hover: null as string | null, dwellKey: '', dwellStart: 0, dwellFired: false,
    forward: new Vector3(0, 0, -1),
    poseValid: false,
  }), []);
  runtime.ray.far = 12;
  useEffect(() => { setPage(0); }, [selectedId]);
  useEffect(() => {
    let snapshot: { parent: typeof camera.parent; position: Vector3; quaternion: Quaternion; scale: Vector3; fov?: number; zoom: number } | null = null;
    let mounted = true;
    const resetInput = () => {
      runtime.targets.clear(); runtime.pressed.clear(); runtime.snapLatched.clear(); runtime.dwellKey = ''; runtime.hover = null;
      props.current.onHover(null);
    };
    const owner = new XrSessionController({ xr: navigator.xr, secure: window.isSecureContext,
      attach: async (nextSession, type, space) => {
        if (!mounted || !props.current.available) throw new Error('Renderer unavailable');
        snapshot = { parent: camera.parent, position: camera.position.clone(), quaternion: camera.quaternion.clone(), scale: camera.scale.clone(), fov: camera instanceof PerspectiveCamera ? camera.fov : undefined, zoom: camera.zoom };
        const yaw = new Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
        origin.position.set(camera.position.x, type === 'local' ? NAVIGATION.eyeHeight : 0, camera.position.z); origin.rotation.set(0, yaw, 0);
        origin.add(camera); camera.position.set(0, 0, 0); camera.quaternion.identity(); origin.updateMatrixWorld(true);
        get().events.disconnect?.();
        gl.xr.enabled = true; gl.xr.setReferenceSpaceType(type);
        await bindXrRenderer(gl, nextSession, onRendererReset);
        if (!mounted || owner.getSession() !== nextSession) return;
        gl.xr.setReferenceSpace(space);
        if (mounted) setSession(nextSession);
      },
      detach: () => {
        resetInput();
        if (snapshot) {
          origin.remove(camera); snapshot.parent?.add(camera);
          camera.position.copy(snapshot.position); camera.quaternion.copy(snapshot.quaternion); camera.scale.copy(snapshot.scale);
          camera.zoom = snapshot.zoom;
          if (camera instanceof PerspectiveCamera && snapshot.fov !== undefined) camera.fov = snapshot.fov;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true); snapshot = null;
        }
        if (mounted) { setSession(null); get().events.connect?.(gl.domElement); invalidate(); }
      },
    });
    ownerRef.current = owner; onController(owner);
    const unsubscribe = owner.subscribe(() => { if (mounted) onStatus(owner.getSnapshot()); });
    onStatus(owner.getSnapshot()); void owner.check();
    const end = () => { void owner.exit(); };
    window.addEventListener('pagehide', end);
    return () => {
      mounted = false; unsubscribe(); owner.dispose(); ownerRef.current = null; onController(null);
      window.removeEventListener('pagehide', end);
    };
  }, [camera, gl, scene, origin, invalidate, get, onController, onStatus, onRendererReset, runtime]);
  useEffect(() => { if (!available) void ownerRef.current?.exit(); }, [available]);

  const targetAt = (frame: XRFrame, source?: XRInputSource): XrTarget | null => {
    runtime.poseValid = false;
    const space = gl.xr.getReferenceSpace(); if (!space) return null;
    const pose = source ? frame.getPose(source.targetRaySpace, space) : frame.getViewerPose(space);
    if (!pose) return null;
    runtime.poseValid = true;
    runtime.matrix.fromArray(pose.transform.matrix); runtime.matrix.premultiply(origin.matrixWorld);
    runtime.position.setFromMatrixPosition(runtime.matrix); runtime.direction.set(0, 0, -1).transformDirection(runtime.matrix);
    runtime.ray.set(runtime.position, runtime.direction);
    // Sprite raycasting needs the viewing camera even for a controller ray.
    runtime.ray.camera = gl.xr.getCamera();
    return resolveXrIntersection(runtime.ray, scene);
  };
  const targetAtRef = useRef(targetAt); targetAtRef.current = targetAt;
  const activate = (target: XrTarget | null, allowTeleport: boolean) => {
    if (!target || ownerRef.current?.getSnapshot().phase !== 'active' || !props.current.available) return;
    if (target.action === 'exit') { void ownerRef.current.exit(); return; }
    if (target.action === 'next') { setPage(value => Math.min(pageCountRef.current - 1, value + 1)); return; }
    if (target.action === 'previous') { setPage(value => Math.max(0, value - 1)); return; }
    if (target.artifactId && props.current.displays.some(display => display.id === target.artifactId && !display.isOutsideRoom)) props.current.onSelect(target.artifactId);
    else if (allowTeleport && target.floor && canTeleport(runtime.head, target.point, MUSEUM_ROOM_SIZE, collidersRef.current)) {
      teleportOrigin(origin, runtime.head, target.point);
    }
  };
  const activateRef = useRef(activate); activateRef.current = activate;
  useEffect(() => {
    if (!session) return;
    const start = (event: XRInputSourceEvent) => { runtime.pressed.add(event.inputSource); };
    const end = (event: XRInputSourceEvent) => { runtime.pressed.delete(event.inputSource); };
    // Only `select` commits an action; start/end never duplicate it.
    const select = (event: XRInputSourceEvent) => {
      if (session.visibilityState !== 'visible' || !Array.from(session.inputSources).includes(event.inputSource)) return;
      activateRef.current(targetAtRef.current(event.frame, event.inputSource), true);
    };
    const reset = () => { runtime.targets.clear(); runtime.pressed.clear(); runtime.snapLatched.clear(); runtime.dwellKey = ''; };
    session.addEventListener('selectstart', start); session.addEventListener('selectend', end); session.addEventListener('select', select);
    session.addEventListener('inputsourceschange', reset); session.addEventListener('visibilitychange', reset);
    return () => {
      session.removeEventListener('selectstart', start); session.removeEventListener('selectend', end); session.removeEventListener('select', select);
      session.removeEventListener('inputsourceschange', reset); session.removeEventListener('visibilitychange', reset); reset();
    };
  }, [session, runtime]);
  useFrame((_, __, frame) => {
    if (!session || !frame || ownerRef.current?.getSnapshot().phase !== 'active' || !available || session.visibilityState !== 'visible') return;
    const space = gl.xr.getReferenceSpace(); if (!space) return;
    const viewer = frame.getViewerPose(space); if (!viewer) return;
    origin.updateMatrixWorld(true);
    runtime.head.setFromMatrixPosition(runtime.matrix.fromArray(viewer.transform.matrix).premultiply(origin.matrixWorld));
    const sources = Array.from(session.inputSources).filter(source => source.targetRayMode === 'tracked-pointer' || source.targetRayMode === 'gaze' || source.targetRayMode === 'screen');
    let hover: string | null = null;
    for (let index = 0; index < 2; index++) {
      const source = sources[index], pointer = pointers.current[index], reticle = reticles.current[index];
      if (!pointer || !reticle) continue;
      pointer.visible = !!source; reticle.visible = false;
      if (!source) continue;
      const target = targetAtRef.current(frame, source); runtime.targets.set(source, target);
      if (!runtime.poseValid) { pointer.visible = false; continue; }
      pointer.position.copy(runtime.position); pointer.quaternion.setFromUnitVectors(runtime.forward, runtime.direction);
      pointer.scale.z = target?.distance ?? 8;
      if (target) {
        reticle.visible = true; reticle.position.copy(target.point);
        const validFloor = target.floor && canTeleport(runtime.head, target.point, MUSEUM_ROOM_SIZE, collidersRef.current);
        if (reticle.material instanceof MeshBasicMaterial) reticle.material.color.set(validFloor ? '#33dcc3' : target.floor ? '#de684f' : '#f6dc8f');
        reticle.scale.setScalar(validFloor ? 1.8 : 1); hover ??= target.artifactId ?? null;
      }
      const axis = source.handedness === 'right' ? getSnapAxis(source) : 0;
      if (!axis) runtime.snapLatched.delete(source);
      else if (!runtime.snapLatched.has(source) && performance.now() - runtime.lastSnap > 350) {
        runtime.snapLatched.add(source); runtime.lastSnap = performance.now();
        snapTurnOrigin(origin, runtime.head, -Math.sign(axis) * Math.PI / 6);
      }
    }
    // With no native input source, head gaze can read/select/exit, never teleport.
    const gaze = pointers.current[2], gazeReticle = reticles.current[2];
    if (gaze && gazeReticle) {
      gaze.visible = sources.length === 0; gazeReticle.visible = false;
      if (!sources.length) {
        const target = targetAtRef.current(frame); gaze.position.copy(runtime.position); gaze.quaternion.setFromUnitVectors(runtime.forward, runtime.direction);
        gaze.scale.z = target?.distance ?? 4;
        const key = target?.action ?? target?.artifactId ?? '';
        if (key !== runtime.dwellKey) { runtime.dwellKey = key; runtime.dwellStart = performance.now(); runtime.dwellFired = false; }
        if (target && key) {
          gazeReticle.visible = true; gazeReticle.position.copy(target.point); hover = target.artifactId ?? null;
          if (!runtime.dwellFired && performance.now() - runtime.dwellStart > 1500) { runtime.dwellFired = true; activateRef.current(target, false); }
        }
      }
    }
    if (hover !== runtime.hover) { runtime.hover = hover; props.current.onHover(hover); }
  });
  return <>
    <primitive object={origin}>
      {session && <XrDetailsPanel display={displays.find(display => display.id === selectedId)} page={page} onPageCount={setPageCount} />}
    </primitive>
    {session && <>
      {[0, 1, 2].map(index => <group key={index} userData={{ xrIgnore: true }}>
        <group ref={node => { pointers.current[index] = node; }} visible={false}>
          <mesh position={[0, 0, -0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.003, 0.003, 1, 5]} /><meshBasicMaterial color="#33dcc3" />
          </mesh>
        </group>
        <mesh ref={node => { reticles.current[index] = node; }} visible={false}>
          <sphereGeometry args={[0.05, 10, 8]} /><meshBasicMaterial color="#33dcc3" depthTest={false} />
        </mesh>
      </group>)}
    </>}
  </>;
}
