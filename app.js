import { PoseSmoother } from './stability.js';
import { targetNames } from './targets.js';

const $ = id => document.getElementById(id);
const targetPath = name => `./assets/limericksarg/${name}.mp4`;
let ar = null, active = false, starting = false, sound = false;
let targets = [], activeTarget = null;

function status(text) { $('status').textContent = text; }

async function playOverlay() {
  if (!activeTarget || !active) return;
  try {
    await activeTarget.video.play();
    $('resume').hidden = true;
  } catch {
    if (activeTarget && active) {
      $('resume').hidden = false;
      status('Dibujo encontrado. Tocá «Reproducir video».');
    }
  }
}

function cleanup() {
  active = false;
  targets.forEach(target => { target.video.pause(); target.video.currentTime = 0; });
  if (ar) {
    ar.renderer.setAnimationLoop(null);
    ar.controller?.stopProcessVideo();
    ar.video?.srcObject?.getTracks().forEach(track => track.stop());
    ar.video?.remove();
    ar.renderer.dispose();
    window.removeEventListener('resize', ar.resizeListener);
    ar.controller?.worker?.terminate();
  }
  targets.forEach(({texture, geometry, material, video}) => {
    texture.dispose(); geometry.dispose(); material.dispose(); video.remove();
  });
  ar = null; targets = []; activeTarget = null;
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
  return 'No pudimos iniciar la experiencia. Revisá tu conexión y probá abrir el enlace directamente en Safari o Chrome.';
}

$('start').addEventListener('click', async () => {
  if (starting || active) return;
  $('error').hidden = true;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    $('error').textContent = 'Para usar la cámara, abrí este enlace HTTPS directamente en Safari o Chrome en tu celular.';
    $('error').hidden = false;
    return;
  }
  starting = true; $('start').disabled = true;
  sound = false; $('sound').textContent = 'Activar sonido'; $('sound').setAttribute('aria-pressed', 'false');
  $('ar').hidden = false; document.body.classList.add('camera-open'); status('Preparando la cámara…');
  try {
    const [THREE, {MindARThree}] = await Promise.all([import('three'), import('./vendor/mindar-image-three.prod.js')]);
    const targetResponse = await fetch('./assets/targets.mind');
    if (!targetResponse.ok) throw new Error('No se pudo cargar el mapa de imágenes');
    ar = new MindARThree({container:$('camera'), imageTargetSrc:'./assets/targets.mind', maxTrack:1, uiLoading:'no', uiScanning:'no', uiError:'no', filterMinCF:0.0006, filterBeta:100, warmupTolerance:8, missTolerance:10});
    ar.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    targets = targetNames.map((name, index) => {
      const video = document.createElement('video');
      video.src = targetPath(name); video.preload = 'metadata';
      video.playsInline = true; video.muted = true; video.loop = true; video.setAttribute('webkit-playsinline', '');
      Object.assign(video.style, {position:'fixed', width:'1px', height:'1px', opacity:'0', pointerEvents:'none'});
      document.body.appendChild(video);
      const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide, toneMapped:false});
      const displayedGroup = new THREE.Group(); displayedGroup.visible = false;
      displayedGroup.add(new THREE.Mesh(geometry, material)); ar.scene.add(displayedGroup);
      const target = {name, video, texture, geometry, material, displayedGroup, poseSmoother:new PoseSmoother(THREE)};
      target.anchor = ar.addAnchor(index);
      target.anchor.onTargetFound = () => {
        if (activeTarget && activeTarget !== target) activeTarget.video.pause();
        activeTarget = target; target.poseSmoother.reset();
        video.muted = !sound; $('guide').style.opacity = '0';
        status(`¡Encontramos “${name.replaceAll('-', ' ')}”! La historia está en marcha.`);
        playOverlay();
      };
      target.anchor.onTargetLost = () => {
        displayedGroup.visible = false; target.poseSmoother.reset(); video.pause();
        if (activeTarget === target) {
          activeTarget = null; $('resume').hidden = true; $('guide').style.opacity = '1';
          status('Volvé a enfocar una imagen del libro para continuar.');
        }
      };
      return target;
    });

    await ar.start(); active = true;
    if (ar.controller.markerDimensions.length !== targets.length) throw new Error('La lista de videos no coincide con targets.mind');
    targets.forEach((target, index) => {
      const [width, height] = ar.controller.markerDimensions[index];
      target.displayedGroup.children[0].scale.y = height / width;
    });
    if (document.hidden) { cleanup(); return; }
    $('exit').disabled = false;
    ar.renderer.setAnimationLoop(timeMs => {
      if (!active || !ar) return;
      targets.forEach(target => {
        target.displayedGroup.visible = target === activeTarget && target.anchor.group.visible &&
          target.poseSmoother.update(target.anchor.group.matrix, target.displayedGroup, timeMs);
      });
      ar.renderer.render(ar.scene, ar.camera);
    });
    if (activeTarget) await playOverlay(); else status('Apuntá a una imagen completa y mantené el celular quieto.');
  } catch(error) {
    cleanup(); $('error').textContent = explainError(error); $('error').hidden = false;
  } finally { starting = false; }
});

$('exit').addEventListener('click', () => {cleanup(); $('start').focus();});
$('resume').addEventListener('click', playOverlay);
$('replay').addEventListener('click', () => {
  if (activeTarget) { activeTarget.video.currentTime = 0; playOverlay(); }
});
$('sound').addEventListener('click', async () => {
  sound = !sound;
  if (activeTarget) activeTarget.video.muted = !sound;
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').textContent = sound ? 'Silenciar' : 'Activar sonido';
  await playOverlay();
});
document.addEventListener('visibilitychange', () => {if(document.hidden && active) cleanup();});
window.addEventListener('pagehide', () => {if(ar) cleanup();});
