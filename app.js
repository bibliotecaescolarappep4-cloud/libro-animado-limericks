import { PoseSmoother } from './stability.js';
const $ = id => document.getElementById(id);
const video = $('animation');
let ar = null, anchor = null, active = false, starting = false, visible = false, sound = false;
let texture, geometry, material;
let displayedGroup = null, poseSmoother = null;
function status(text) { $('status').textContent = text; }
async function playOverlay() {
  if (!visible || !active) return;
  try { await video.play(); $('resume').hidden = true; }
  catch { if (visible && active) { $('resume').hidden = false; status('Dibujo encontrado. Tocá «Reproducir video».'); } }
}
function cleanup() {
  active = false; visible = false;
  video.pause(); video.currentTime = 0;
  if (ar) {
    ar.renderer.setAnimationLoop(null);
    // Stop camera tracks even when initialization failed before a controller existed.
    ar.controller?.stopProcessVideo();
    ar.video?.srcObject?.getTracks().forEach(track => track.stop());
    ar.video?.remove();
    ar.renderer.dispose();
    window.removeEventListener('resize', ar.resizeListener);
    ar.controller?.worker?.terminate();
  }
  texture?.dispose(); geometry?.dispose(); material?.dispose();
  ar = null; anchor = null; displayedGroup = null; poseSmoother = null;
  $('camera').replaceChildren();
  $('ar').hidden = true; document.body.classList.remove('camera-open');
  $('resume').hidden = true; $('guide').style.opacity = '1';
  $('start').disabled = false; $('exit').disabled = true;
}
function explainError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'No pudimos acceder a la cámara. Permití el acceso desde la configuración del navegador y volvé a probar.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No encontramos una cámara. Abrí este enlace en tu celular.';
  if (name === 'NotReadableError') return 'La cámara está ocupada. Cerrá otras aplicaciones que la estén usando y volvé a intentar.';
  return 'No pudimos iniciar la experiencia. Revisá tu conexión y probá abrir el enlace directamente en Safari o Chrome. También podés usar «Ver el video».';
}
$('start').addEventListener('click', async () => {
  if (starting || active) return;
  $('error').hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $('error').textContent = 'Para usar la cámara, abrí este enlace HTTPS directamente en Safari o Chrome en tu celular.';
    $('error').hidden = false; return;
  }
  starting = true; $('start').disabled = true;
  sound = false; video.muted = true; $('sound').textContent = 'Activar sonido'; $('sound').setAttribute('aria-pressed','false');
  // Unlock inline playback within this user gesture, before loading the AR modules.
  const unlock = video.play().then(() => { if (!active || !visible) video.pause(); }).catch(() => {});
  $('ar').hidden = false; document.body.classList.add('camera-open'); status('Preparando la cámara…');
  try {
    const [THREE, {MindARThree}] = await Promise.all([import('three'), import('./vendor/mindar-image-three.prod.js')]);
    const targetResponse = await fetch('./assets/pagina-01.mind');
    if (!targetResponse.ok) throw new Error('No se pudo cargar el dibujo de referencia');
    ar = new MindARThree({container:$('camera'), imageTargetSrc:'./assets/pagina-01.mind', maxTrack:1, uiLoading:'no', uiScanning:'no', uiError:'no', filterMinCF:0.0006, filterBeta:100, warmupTolerance:8, missTolerance:10});
    ar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
    geometry = new THREE.PlaneGeometry(1, 589 / 785);
    material = new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide, toneMapped:false});
    const plane = new THREE.Mesh(geometry, material);
    anchor = ar.addAnchor(0);
    // Keep the raw tracking anchor separate so its noisy matrix cannot directly
    // move the video. The displayed group receives a smoothed, valid pose.
    displayedGroup = new THREE.Group(); displayedGroup.visible = false;
    displayedGroup.add(plane); ar.scene.add(displayedGroup);
    poseSmoother = new PoseSmoother(THREE);
    anchor.onTargetFound = () => {
      poseSmoother.reset();
      visible = true; $('guide').style.opacity = '0';
      status('¡Dibujo encontrado! La historia está en marcha.');
      playOverlay();
    };
    anchor.onTargetLost = () => {
      displayedGroup.visible = false; poseSmoother.reset();
      visible = false; video.pause(); $('resume').hidden = true;
      $('guide').style.opacity = '1'; status('Volvé a enfocar el dibujo para continuar.');
    };
    await unlock; video.currentTime = 0;
    await ar.start(); active = true;
    if (document.hidden) { cleanup(); return; }
    $('exit').disabled = false;
    ar.renderer.setAnimationLoop(timeMs => {
      if (!active || !ar) return;
      displayedGroup.visible = visible && anchor.group.visible &&
        poseSmoother.update(anchor.group.matrix, displayedGroup, timeMs);
      ar.renderer.render(ar.scene, ar.camera);
    });
    if (visible) await playOverlay(); else status('Apuntá al dibujo completo y mantené el celular quieto.');
  } catch(error) {
    cleanup(); $('error').textContent = explainError(error); $('error').hidden = false;
  } finally { starting = false; }
});
$('exit').addEventListener('click', () => {cleanup(); $('start').focus();});
$('resume').addEventListener('click', playOverlay);
$('replay').addEventListener('click', () => {video.currentTime = 0; playOverlay();});
$('sound').addEventListener('click', async () => {
  sound = !sound; video.muted = !sound;
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').textContent = sound ? 'Silenciar' : 'Activar sonido';
  await playOverlay();
});
// Release the camera if the tab is hidden. Returning requires a fresh button press.
document.addEventListener('visibilitychange', () => {if(document.hidden && active) cleanup();});
window.addEventListener('pagehide', () => {if(ar) cleanup();});
$('preview').addEventListener('click', () => { $('preview-dialog').showModal(); $('preview-video').play().catch(()=>{}); });
$('close-preview').addEventListener('click', () => $('preview-dialog').close());
$('preview-dialog').addEventListener('close', () => { $('preview-video').pause(); $('preview-video').currentTime = 0; });
