const camera = document.getElementById("camera");
const layers = Array.from(document.querySelectorAll(".layer"));

// Must match CSS
const STEP = 1800;
const MAX_Z = STEP * (layers.length - 1);

// Scroll feel
let target = 0;
let z = 0;

// ✅ faster + more NAFAAS-like
const SPEED = 1;     // wheel sensitivity
const DAMP  = 0.12;    // smoothing

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

function updateLayerFX(zVal){
  // Fade/blur based on distance to camera (continuous, not switching)
  layers.forEach((el, i) => {
    const layerZ = i * STEP;            // conceptual distance markers
    const dist = Math.abs(zVal - layerZ);

    // 0..1 where 0 is close, 1 is far
    const t = clamp(dist / (STEP * 0.9), 0, 1);

    // opacity: close = 1, far = 0
    const opacity = 1 - t;

    // blur: close = 0, far = 10px
    const blur = t * 10;

    el.style.opacity = opacity.toFixed(3);
    el.style.filter = `blur(${blur.toFixed(1)}px)`;
    el.style.pointerEvents = opacity > 0.35 ? "auto" : "none";
  });
}

function animate(){
  z += (target - z) * DAMP;

  const progress = z / MAX_Z;
  const scale = 1 + Math.min(progress * 0.22, 0.18); // cap growth

  // ✅ this is the key fix: positive Z moves you INTO the page
  camera.style.transform = `translateZ(${z}px) scale(${scale})`;

  updateLayerFX(z);
  requestAnimationFrame(animate);
}


function onWheel(e){
  e.preventDefault();
  target = clamp(target + e.deltaY * SPEED, 0, MAX_Z);
}

let touchY = null;
function onTouchStart(e){
  if (e.touches && e.touches.length) touchY = e.touches[0].clientY;
}
function onTouchMove(e){
  if (touchY == null) return;
  e.preventDefault();
  const y = e.touches[0].clientY;
  const dy = touchY - y;
  touchY = y;
  target = clamp(target + dy * 22, 0, MAX_Z);
}

window.addEventListener("wheel", onWheel, { passive: false });
window.addEventListener("touchstart", onTouchStart, { passive: true });
window.addEventListener("touchmove", onTouchMove, { passive: false });

// Smooth transitions
layers.forEach(el => el.style.transition = "opacity 120ms linear, filter 120ms linear");

updateLayerFX(0);
animate();
