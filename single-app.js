import { PoseSmoother } from './stability.js';
import { displayName, targetNames } from './targets.js';

const $ = id => document.getElementById(id);
const configuredName = document.querySelector('meta[name="limerick"]')?.content || '';
const routeName = configuredName || decodeURIComponent(location.pathname).split('/').filter(Boolean).at(-1) || '';
const targetName = targetNames.includes(routeName) ? routeName : null;
const assetUrl = extension => new URL(`assets/limericksarg/${targetName}.${extension}`, import.meta.url).href;
const targetUrl = targetName ? new URL('targets.mind', location.href).href : '';
let ar = null, active = false, starting = false, sound = false, target = null;

function status(text) { $('status').textContent = text; }

function configurePage() {
  if (targetName) {
    const title = displayName(targetName);
    document.title = `${title} · El libro cobra vida`;
    $('limerick-name').textContent = title;
    $('target-preview').src = assetUrl('jpg');
    $('target-preview').alt = `Ilustración del limerick ${title}.`;
    $('gallery').hidden = true;
    return;
  }
  $('experience').hidden = true;
  $('gallery').hidden = false;
  $('gallery').replaceChildren(...targetNames.map(name => {
    const link = document.createElement('a');
    link.href = `${name}/`; link.textContent = displayName(name); return link;
  }));
}

async function playOverlay() {
  if (!target || !active) return;
  try { await target.video.play(); $('resume').hidden = true; }
  catch { if (target && active) { $('resume').hidden = false; status('Dibujo encontrado. Tocá «Reproducir video».'); } }
}

function cleanup() {
  active = false;
  if (target) { target.video.pause(); target.video.currentTime = 0; }
  if (ar) {
    ar.renderer.setAnimationLoop(null); ar.controller?.stopProcessVideo();
    ar.video?.srcObject?.getTracks().forEach(track => track.stop()); ar.video?.remove();
    ar.renderer.dispose(); window.removeEventListener('resize', ar.resizeListener); ar.controller?.worker?.terminate();
  }
  if (target) { target.texture.dispose(); target.geometry.dispose(); target.material.dispose(); target.video.remove(); }
  ar = null; target = null; $('camera').replaceChildren(); $('ar').hidden = true;
  document.body.classList.remove('camera-open'); $('resume').hidden = true; $('guide').style.opacity = '1';
  $('start').disabled = false; $('exit').disabled = true;
}

function explainError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'No pudimos acceder a la cámara. Permití el acceso desde la configuración del navegador y volvé a probar.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No encontramos una cámara. Abrí este enlace en tu celular.';
  if (name === 'NotReadableError') return 'La cámara está ocupada. Cerrá otras aplicaciones que la estén usando y volvé a intentar.';
  return 'No pudimos iniciar la experiencia. Revisá tu conexión y probá abrir el enlace directamente en Safari o Chrome.';
}

$('start').addEventListener('click', async () => {
  if (!targetName || starting || active) return;
  $('error').hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $('error').textContent = 'Para usar la cámara, abrí este enlace HTTPS directamente en Safari o Chrome en tu celular.';
    $('error').hidden = false; return;
  }
  starting = true; $('start').disabled = true; sound = false;
  $('sound').textContent = 'Activar sonido'; $('sound').setAttribute('aria-pressed', 'false');
  $('ar').hidden = false; document.body.classList.add('camera-open'); status('Preparando la cámara…');
  try {
    const [THREE, {MindARThree}] = await Promise.all([import('three'), import('./vendor/mindar-image-three.prod.js')]);
    const response = await fetch(targetUrl); if (!response.ok) throw new Error('No se pudo cargar targets.mind');
    ar = new MindARThree({container:$('camera'), imageTargetSrc:targetUrl, maxTrack:1, uiLoading:'no', uiScanning:'no', uiError:'no', filterMinCF:0.0006, filterBeta:100, warmupTolerance:8, missTolerance:10});
    ar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const video = document.createElement('video');
    video.src = assetUrl('mp4'); video.preload = 'metadata'; video.playsInline = true; video.muted = true; video.loop = true;
    video.setAttribute('webkit-playsinline', ''); Object.assign(video.style, {position:'fixed', width:'1px', height:'1px', opacity:'0', pointerEvents:'none'}); document.body.appendChild(video);
    const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide, toneMapped:false});
    const displayedGroup = new THREE.Group(); displayedGroup.visible = false; displayedGroup.add(new THREE.Mesh(geometry, material)); ar.scene.add(displayedGroup);
    target = {video, texture, geometry, material, displayedGroup, poseSmoother:new PoseSmoother(THREE)};
    target.anchor = ar.addAnchor(0);
    target.anchor.onTargetFound = () => { target.poseSmoother.reset(); video.muted = !sound; $('guide').style.opacity = '0'; status(`¡Encontramos “${displayName(targetName)}”! La historia está en marcha.`); playOverlay(); };
    target.anchor.onTargetLost = () => { displayedGroup.visible = false; target.poseSmoother.reset(); video.pause(); $('resume').hidden = true; $('guide').style.opacity = '1'; status('Volvé a enfocar la imagen del libro para continuar.'); };
    await ar.start(); active = true;
    if (ar.controller.markerDimensions.length !== 1) throw new Error('El mapa debe contener una sola imagen');
    const [width, height] = ar.controller.markerDimensions[0]; target.displayedGroup.children[0].scale.y = height / width;
    if (document.hidden) { cleanup(); return; }
    $('exit').disabled = false;
    ar.renderer.setAnimationLoop(timeMs => {
      if (!active || !ar || !target) return;
      target.displayedGroup.visible = target.anchor.group.visible && target.poseSmoother.update(target.anchor.group.matrix, target.displayedGroup, timeMs);
      ar.renderer.render(ar.scene, ar.camera);
    });
    status('Apuntá a la imagen completa y mantené el celular quieto.');
  } catch(error) { console.error(error); cleanup(); $('error').textContent = explainError(error); $('error').hidden = false; }
  finally { starting = false; }
});

$('exit').addEventListener('click', () => {cleanup(); $('start').focus();});
$('resume').addEventListener('click', playOverlay);
$('replay').addEventListener('click', () => { if (target) { target.video.currentTime = 0; playOverlay(); } });
$('sound').addEventListener('click', async () => { sound = !sound; if (target) target.video.muted = !sound; $('sound').setAttribute('aria-pressed', String(sound)); $('sound').textContent = sound ? 'Silenciar' : 'Activar sonido'; await playOverlay(); });
document.addEventListener('visibilitychange', () => {if(document.hidden && active) cleanup();});
window.addEventListener('pagehide', () => {if(ar) cleanup();});

configurePage();
