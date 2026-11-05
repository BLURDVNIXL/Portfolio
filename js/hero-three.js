/**
 * Daniel Portfolio — 3D Generative Valley Hero
 * - Lazy-loaded Three.js via IntersectionObserver
 * - Shaders GLSL compressés & minifiés
 * - Asservissement dynamique caméra à la souris + dérive procédurale continue
 * - Gestion audio dynamique (Synthétiseur procédural Web Audio ou MP3 personnalisé via Panel Admin)
 */

// Shaders minifiés (GLSL compressés sans espaces superflus ni commentaires)
const FlowerShader = {
  uniforms: {
    uTime: { value: 0 },
    uMouse: { value: null },
    uMousePush: { value: 1.2 },
    uTransition: { value: 0 },
    uCameraPos: { value: null },
    uResolution: { value: null },
    uColorA: { value: null },
    uColorB: { value: null },
    uColorC: { value: null }
  },
  vertexShader: `attribute float aPhase,aScale;attribute vec3 aBasePos;attribute vec2 aMix;varying vec2 vMix;uniform float uTime,uMousePush,uTransition;uniform vec2 uMouse,uResolution;uniform vec3 uCameraPos;float h1(float n){return fract(sin(n)*43758.5453);}float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*vn(p);p*=2.;a*=.5;}return v;}void main(){vMix=aMix;vec3 pos=aBasePos;float dist=length(pos-uCameraPos);float grow=smoothstep(90.,12.,dist);float scale=aScale*mix(.12,1.,grow);vec4 sp=projectionMatrix*modelViewMatrix*vec4(pos,1.);vec2 ndc=sp.xy/sp.w;vec2 d=ndc-(uMouse*2.-1.);float md=length(d);pos.xy+=(d/max(md,.0001))*smoothstep(uMousePush,0.,md)*.45;pos+=normalize(pos-uCameraPos)*uTransition*(.4+.6*h1(aPhase))*42.;pos.y+=sin(uTime*.8+aPhase)*.16*scale;float w=fbm(pos.xz*.012+uTime*.14)-.5;pos.x+=w*scale*.8;pos.z+=w*scale*.45;vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(scale*(300./-mv.z)*uResolution.y*.001,.5,70.);}`,
  fragmentShader: `varying vec2 vMix;uniform vec3 uColorA,uColorB,uColorC;uniform float uTransition;void main(){float r=length(gl_PointCoord-.5)*2.;vec3 c=mix(mix(uColorA,uColorB,vMix.x),uColorC,vMix.y)+vec3(1.,.65,.3)*(1.-smoothstep(0.,.55,r))*.85;float a=smoothstep(1.,.1,r)*(1.-uTransition*.35);if(a<.01)discard;gl_FragColor=vec4(c,a);}`
};

const DustShader = {
  uniforms: {
    uTime: { value: 0 },
    uTransition: { value: 0 },
    uCameraPos: { value: null },
    uResolution: { value: null }
  },
  vertexShader: `attribute float aSeed;attribute vec3 aBasePos;varying float vSeed;uniform float uTime,uTransition;uniform vec3 uCameraPos;uniform vec2 uResolution;float h1(float n){return fract(sin(n)*43758.5453);}void main(){vSeed=aSeed;vec3 pos=aBasePos;pos.y+=sin(uTime*.4+aSeed*20.)*2.5;pos.x+=sin(uTime*.06+aSeed*40.)*6.;pos.z+=cos(uTime*.05+aSeed*30.)*6.;pos+=normalize(pos-uCameraPos)*uTransition*h1(aSeed)*90.;vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.+h1(aSeed*7.)*2.)*(200./-mv.z)*uResolution.y*.001,.4,4.);}`,
  fragmentShader: `varying float vSeed;uniform float uTransition;void main(){float r=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.1,r)*(.22+.2*sin(vSeed*90.))*(1.-uTransition*.6);if(a<.004)discard;gl_FragColor=vec4(.96,.92,.8,a);}`
};

const RayShader = {
  uniforms: { uTime: { value: 0 }, uResolution: { value: null } },
  vertexShader: `attribute float aAngle,aDist,aY,aScale;varying float vScale;uniform float uTime;uniform vec2 uResolution;void main(){vScale=aScale;float a=aAngle+uTime*.02;vec4 mv=modelViewMatrix*vec4(cos(a)*aDist,aY,sin(a)*aDist,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aScale*(420./-mv.z)*uResolution.y*.001;}`,
  fragmentShader: `varying float vScale;void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv)*2.;float a=(smoothstep(1.,.2,r)*.25+smoothstep(.5,0.,abs(uv.x)*7.)*smoothstep(1.,-.4,uv.y)*.6)*vScale*.16;if(a<.004)discard;gl_FragColor=vec4(1.,.72,.34,a);}`
};

const NoiseShader = {
  uniforms: { uTime: { value: 0 }, tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float uTime;uniform sampler2D tDiffuse;varying vec2 vUv;float r(vec2 c){return fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);}void main(){float n=r(vUv+fract(uTime))*2.-1.;vec4 c=texture2D(tDiffuse,vUv);c.rgb+=n*.035;c.rgb*=1.-.025*sin(vUv.y*900.+uTime*4.);gl_FragColor=c;}`
};

const VignetteShader = {
  uniforms: { uIntensity: { value: 0.32 }, tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float uIntensity;uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);c.rgb*=1.-smoothstep(.42,1.,length(vUv-.5)*1.42)*uIntensity;gl_FragColor=c;}`
};

const ShiftShader = {
  uniforms: { uAmount: { value: 0.0012 }, tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `uniform float uAmount;uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec2 o=vec2(uAmount,0.);gl_FragColor=vec4(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b,1.);}`
};

function terrainHeight(x, z) {
  let y = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 8;
  y += Math.sin(x * 0.02 + 10) * Math.cos(z * 0.03) * 15;
  y += Math.sin(x * 0.1) * 3 + Math.sin(z * 0.08) * 2;
  y -= Math.max(0, 15 - Math.hypot(x, z) * 0.3);
  return y;
}

export function initHeroThree() {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hero-canvas');
  const loader = document.getElementById('loader');
  const uiInner = document.getElementById('hero-ui-inner');
  const soundBtn = document.getElementById('sound');
  const goBtn = document.getElementById('go');

  if (!hero || !canvas) return;

  const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isInitialized = false;

  // Configuration audio dynamique chargée depuis l'API
  let audioConfig = {
    mode: 'playlist',
    customUrl: '',
    volume: 0.55,
    title: "Musiques d'ambiance libres de droit (Aléatoire)",
    playlist: [
      {
        id: 'track-1',
        title: 'Sérénité Crépusculaire (Sketch No. 1)',
        artist: 'Emil Davydov',
        license: 'Creative Commons · Libre de droit',
        url: '/audio/ambient-1.mp3'
      },
      {
        id: 'track-2',
        title: "Don't Say Goodbye (Ambiance Éthérée)",
        artist: 'Candlegravity',
        license: 'Creative Commons · Libre de droit',
        url: '/audio/ambient-2.mp3'
      },
      {
        id: 'track-3',
        title: 'Nocturne Spatial (Sketch No. 2)',
        artist: 'Emil Davydov',
        license: 'Creative Commons · Libre de droit',
        url: '/audio/ambient-3.mp3'
      },
      {
        id: 'track-4',
        title: 'Harmonies Flottantes (Sketch No. 3)',
        artist: 'Emil Davydov',
        license: 'Creative Commons · Libre de droit',
        url: '/audio/ambient-4.mp3'
      }
    ]
  };

  fetch('/api/config')
    .then(r => r.json())
    .then(data => {
      if (data && data.audio) {
        audioConfig = { ...audioConfig, ...data.audio };
      }
    })
    .catch(() => {});

  const triggerFallback = () => {
    if (hero.classList.contains('ready')) return;
    hero.classList.add('no-webgl', 'ready');
  };
  const fallbackTimer = setTimeout(triggerFallback, 7000);

  // Lazy-load Three.js avec IntersectionObserver
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && !isInitialized) {
        isInitialized = true;
        observer.disconnect();
        startThree();
      }
    }
  }, { rootMargin: '100px 0px' });

  observer.observe(hero);

  async function startThree() {
    try {
      const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { ShaderPass }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
        import('three/examples/jsm/postprocessing/ShaderPass.js')
      ]);

      clearTimeout(fallbackTimer);

      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance'
        });
      } catch (e) {
        triggerFallback();
        return;
      }

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      scene.fog = new THREE.FogExp2(0x000000, 0.004);
      const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);

      // Uniforms
      FlowerShader.uniforms.uMouse.value = new THREE.Vector2(0.5, 0.5);
      FlowerShader.uniforms.uCameraPos.value = new THREE.Vector3();
      FlowerShader.uniforms.uResolution.value = new THREE.Vector2(1, 1);
      FlowerShader.uniforms.uColorA.value = new THREE.Color(0xff2a5f); // Rouge éclatant
      FlowerShader.uniforms.uColorB.value = new THREE.Color(0x8e38ff); // Violet
      FlowerShader.uniforms.uColorC.value = new THREE.Color(0x286aff); // Bleu

      DustShader.uniforms.uCameraPos.value = new THREE.Vector3();
      DustShader.uniforms.uResolution.value = new THREE.Vector2(1, 1);
      RayShader.uniforms.uResolution.value = new THREE.Vector2(1, 1);

      // Terrain
      const gTerrain = new THREE.PlaneGeometry(400, 400, 160, 160);
      gTerrain.rotateX(-Math.PI / 2);
      const p = gTerrain.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
      gTerrain.computeVertexNormals();
      const terrain = new THREE.Mesh(
        gTerrain,
        new THREE.MeshBasicMaterial({ color: 0x050504, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
      );
      scene.add(terrain);

      // Fleurs génératives (7 500 points pour fluidité 60fps constante)
      const flowerCount = 7500;
      const fPos = new Float32Array(flowerCount * 3), fBase = new Float32Array(flowerCount * 3);
      const fPhase = new Float32Array(flowerCount), fScale = new Float32Array(flowerCount), fMix = new Float32Array(flowerCount * 2);
      for (let i = 0; i < flowerCount; i++) {
        let x, z, y, tries = 0;
        do {
          const a = Math.random() * Math.PI * 2, r = Math.pow(Math.random(), 0.68) * 180;
          x = Math.cos(a) * r; z = Math.sin(a) * r; y = terrainHeight(x, z);
        } while (y > 5 && ++tries < 8);
        fPos.set([x, y + 0.12, z], i * 3);
        fPhase[i] = Math.random() * Math.PI * 2;
        fScale[i] = 0.45 + Math.random() * 1.15;
        const leaf = Math.random() < 0.3;
        fMix[i * 2] = leaf ? 0 : 0.25 + Math.random() * 0.75;
        fMix[i * 2 + 1] = leaf ? 1 : 0;
      }
      fBase.set(fPos);
      const gFlowers = new THREE.BufferGeometry();
      gFlowers.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
      gFlowers.setAttribute('aBasePos', new THREE.BufferAttribute(fBase, 3));
      gFlowers.setAttribute('aPhase', new THREE.BufferAttribute(fPhase, 1));
      gFlowers.setAttribute('aScale', new THREE.BufferAttribute(fScale, 1));
      gFlowers.setAttribute('aMix', new THREE.BufferAttribute(fMix, 2));
      const flowers = new THREE.Points(gFlowers, new THREE.ShaderMaterial({
        ...FlowerShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      scene.add(flowers);

      // Poussières lumineuses (2 600 points)
      const dustCount = 2600;
      const dPos = new Float32Array(dustCount * 3), dBase = new Float32Array(dustCount * 3), dSeed = new Float32Array(dustCount);
      for (let i = 0; i < dustCount; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 190;
        dPos.set([Math.cos(a) * r, 2 + Math.random() * 28, Math.sin(a) * r], i * 3);
        dSeed[i] = Math.random();
      }
      dBase.set(dPos);
      const gDust = new THREE.BufferGeometry();
      gDust.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
      gDust.setAttribute('aBasePos', new THREE.BufferAttribute(dBase, 3));
      gDust.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1));
      const dust = new THREE.Points(gDust, new THREE.ShaderMaterial({
        ...DustShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      scene.add(dust);

      // Rayons
      const rayCount = 44;
      const rAngle = new Float32Array(rayCount), rDist = new Float32Array(rayCount), rY = new Float32Array(rayCount), rSc = new Float32Array(rayCount);
      for (let i = 0; i < rayCount; i++) {
        rAngle[i] = Math.random() * Math.PI * 2;
        rDist[i] = 50 + Math.random() * 90;
        rY[i] = -4 + Math.random() * 24;
        rSc[i] = 0.6 + Math.random() * 1.4;
      }
      const gRays = new THREE.BufferGeometry();
      gRays.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rayCount * 3), 3));
      gRays.setAttribute('aAngle', new THREE.BufferAttribute(rAngle, 1));
      gRays.setAttribute('aDist', new THREE.BufferAttribute(rDist, 1));
      gRays.setAttribute('aY', new THREE.BufferAttribute(rY, 1));
      gRays.setAttribute('aScale', new THREE.BufferAttribute(rSc, 1));
      const rays = new THREE.Points(gRays, new THREE.ShaderMaterial({
        ...RayShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      }));
      scene.add(rays);

      // Post-Processing
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.55, 0.08);
      const noise = new ShaderPass(NoiseShader);
      const vignette = new ShaderPass(VignetteShader);
      const shift = new ShaderPass(ShiftShader);
      composer.addPass(bloom);
      composer.addPass(noise);
      composer.addPass(vignette);
      composer.addPass(shift);
      if (REDUCE) shift.uniforms.uAmount.value = 0;

      // Courbe spline de la caméra
      const pts = [];
      for (let i = 0; i <= 160; i++) {
        const t = i / 160, a = t * Math.PI * 2.4;
        const r = 62 + Math.sin(t * Math.PI * 4) * 26;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const baseY = 8 + Math.sin(t * Math.PI * 6) * 3 + Math.sin(t * Math.PI * 1.5) * 1.5;
        pts.push(new THREE.Vector3(x, Math.max(baseY, terrainHeight(x, z) + 4), z));
      }
      const path = new THREE.CatmullRomCurve3(pts, true);

      // État de l'animation & asservissement à la souris
      const state = {
        progress: 0,
        lastProgress: 0,
        drift: REDUCE ? 0 : 0.000045, // Dérive continue conservée
        transition: 0,
        dir: 0,
        mouse: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 },
        camOffset: { x: 0, y: 0, z: 0 },
        lookOffset: { x: 0, y: 0 },
        velocity: 0,
        lastScrollY: window.scrollY
      };

      const wrap01 = (v) => ((v % 1) + 1) % 1;
      const clamp01 = (v) => Math.min(1, Math.max(0, v));

      // Écoute de la souris sur tout l'écran pour adapter la caméra
      window.addEventListener('pointermove', (e) => {
        state.mouse.tx = e.clientX / window.innerWidth;
        state.mouse.ty = e.clientY / window.innerHeight;
      }, { passive: true });

      // Support gyroscope sur mobile
      if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
        window.addEventListener('deviceorientation', (e) => {
          if (e.gamma !== null && e.beta !== null) {
            state.mouse.tx = clamp01(0.5 + (e.gamma / 45) * 0.4);
            state.mouse.ty = clamp01(0.5 + ((e.beta - 30) / 45) * 0.4);
          }
        }, { passive: true });
      }

      let scrollLead = 0;
      window.addEventListener('scroll', () => {
        scrollLead = Math.min(scrollLead + (window.scrollY - state.lastScrollY) * 0.00004, 0.12);
        state.lastScrollY = window.scrollY;

        const h = hero.clientHeight || window.innerHeight;
        const t = clamp01(window.scrollY / (h * 0.7));
        if (uiInner) {
          uiInner.style.opacity = String(1 - t);
          uiInner.style.transform = `translateY(${t * -34}px)`;
        }
        hero.classList.toggle('scrolled', t > 0.5);
      }, { passive: true });

      // ============================================
      // GESTION AUDIO DYNAMIQUE (Synthé ou Custom MP3)
      // ============================================
      const audio = {
        ctx: null,
        masterGain: null,
        lp: null,
        src: null,
        customEl: null,
        muted: true,
        on: false,
        muffled: false,
        buf: null,
        currentTrack: null,
        lastTrackIndex: -1
      };

      function initProceduralAudio() {
        if (audio.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audio.ctx = new AC();

        // Master gain
        audio.masterGain = audio.ctx.createGain();
        audio.masterGain.gain.setValueAtTime(0, audio.ctx.currentTime);

        // Lowpass filter
        audio.lp = audio.ctx.createBiquadFilter();
        audio.lp.type = 'lowpass';
        audio.lp.frequency.setValueAtTime(14000, audio.ctx.currentTime);
        audio.lp.Q.value = 1.0;

        audio.masterGain.connect(audio.lp);
        audio.lp.connect(audio.ctx.destination);

        // Harmonious ethereal soundscape loop (20 seconds)
        const sr = audio.ctx.sampleRate;
        const len = sr * 20;
        const buf = audio.ctx.createBuffer(2, len, sr);

        // Harmonic frequencies (D2, A2, D3, F3, A3, C4, E4)
        const freqs = [73.4, 110.0, 146.8, 174.6, 220.0, 261.6, 329.6];

        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch);
          const panPhase = ch * 0.5 * Math.PI;

          for (let i = 0; i < len; i++) {
            const t = i / sr;
            let sample = 0;

            // Warm sine pad with chorus detune
            for (let f = 0; f < freqs.length; f++) {
              const freq = freqs[f] * (1 + 0.0015 * Math.sin(t * 0.25 + f + panPhase));
              const amp = 0.08 / (1 + f * 0.35);
              sample += Math.sin(t * freq * 2 * Math.PI) * amp;
              sample += Math.sin(t * freq * 4 * Math.PI) * (amp * 0.2);
            }

            // Valley wind breeze
            const wind = (Math.random() * 2 - 1) * 0.015 * (0.6 + 0.4 * Math.sin(t * 0.3 + panPhase));
            sample += wind;

            // Breathing envelope for seamless loop
            const swell = 0.75 + 0.25 * Math.sin(t * (2 * Math.PI / 20));
            d[i] = sample * swell;
          }
        }

        audio.buf = buf;
        audio.on = true;
      }

      const trackPill = document.getElementById('ambient-track-pill');
      const trackTitleEl = document.getElementById('ambient-track-title');
      const skipBtn = document.getElementById('btn-skip-track');

      function updateTrackPill(track) {
        if (!trackPill) return;
        if (track) {
          if (trackTitleEl) {
            trackTitleEl.textContent = track.title ? `${track.title} — ${track.artist || 'Libre de droit'}` : 'Ambiance libre de droit';
            trackTitleEl.title = `${track.title || ''} (${track.license || 'Libre de droit'})`;
          }
          trackPill.classList.add('active');
        } else {
          trackPill.classList.remove('active');
        }
      }

      function getRandomTrack(playlist) {
        if (!playlist || playlist.length === 0) return null;
        if (playlist.length === 1) return playlist[0];
        let nextIdx = Math.floor(Math.random() * playlist.length);
        if (nextIdx === audio.lastTrackIndex) {
          nextIdx = (nextIdx + 1) % playlist.length;
        }
        audio.lastTrackIndex = nextIdx;
        return playlist[nextIdx];
      }

      async function playNextRandomTrack() {
        const playlist = (audioConfig.playlist && audioConfig.playlist.length > 0)
          ? audioConfig.playlist
          : [
              { id: '1', title: 'Sérénité Crépusculaire', artist: 'Emil Davydov', license: 'Creative Commons · Libre de droit', url: '/audio/ambient-1.mp3' },
              { id: '2', title: "Don't Say Goodbye", artist: 'Candlegravity', license: 'Creative Commons · Libre de droit', url: '/audio/ambient-2.mp3' },
              { id: '3', title: 'Nocturne Spatial', artist: 'Emil Davydov', license: 'Creative Commons · Libre de droit', url: '/audio/ambient-3.mp3' },
              { id: '4', title: 'Harmonies Flottantes', artist: 'Emil Davydov', license: 'Creative Commons · Libre de droit', url: '/audio/ambient-4.mp3' }
            ];

        const track = getRandomTrack(playlist);
        if (!track) return;
        audio.currentTrack = track;
        updateTrackPill(track);

        const targetVol = audioConfig.volume !== undefined ? Number(audioConfig.volume) : 0.55;

        if (audio.customEl) {
          audio.customEl.pause();
          audio.customEl = null;
        }

        // Fade out procedural if playing
        if (audio.masterGain && audio.ctx) {
          try {
            const now = audio.ctx.currentTime;
            audio.masterGain.gain.cancelScheduledValues(now);
            audio.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
          } catch (_) {}
        }

        audio.customEl = new Audio(track.url);
        audio.customEl.crossOrigin = 'anonymous';
        audio.customEl.volume = audio.muffled ? (targetVol * 0.5) : targetVol;

        audio.customEl.addEventListener('ended', () => {
          // Play next random royalty-free track automatically
          playNextRandomTrack();
        });

        try {
          await audio.customEl.play();
          audio.muted = false;
          soundBtn.setAttribute('aria-pressed', 'true');
          soundBtn.setAttribute('title', "Couper l'ambiance sonore");
        } catch (err) {
          console.warn('[Audio] Échec lecture audio, bascule sur synthèse procédurale:', err);
          playProcedural(targetVol);
        }
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          playNextRandomTrack();
        });
      }

      function setMuffle(m) {
        if (audio.muffled === m) return;
        audio.muffled = m;
        const targetVol = audioConfig.volume !== undefined ? Number(audioConfig.volume) : 0.55;

        if (audio.customEl && !audio.muted) {
          audio.customEl.volume = m ? (targetVol * 0.5) : targetVol;
        }

        if (audio.on && audio.ctx && audio.lp) {
          const now = audio.ctx.currentTime;
          audio.lp.frequency.cancelScheduledValues(now);
          audio.lp.frequency.linearRampToValueAtTime(m ? 500 : 14000, now + 1.2);
        }
      }

      if (goBtn) {
        goBtn.addEventListener('pointerenter', () => { state.dir = 1; });
        goBtn.addEventListener('pointerleave', () => { state.dir = -1; });
        goBtn.addEventListener('focus', () => { state.dir = 1; });
        goBtn.addEventListener('blur', () => { state.dir = -1; });
      }

      // Playback toggle handler
      async function handleSoundToggle() {
        // Sync latest config from server (admin may have changed custom audio or volume)
        try {
          const res = await fetch('/api/config');
          const data = await res.json();
          if (data && data.audio) {
            audioConfig = { ...audioConfig, ...data.audio };
          }
        } catch (_) {}

        const targetVol = audioConfig.volume !== undefined ? Number(audioConfig.volume) : 0.55;
        const mode = audioConfig.mode || 'playlist';

        if (!audio.muted) {
          // Pause / Mute
          if (audio.customEl) {
            audio.customEl.pause();
          }
          if (audio.masterGain && audio.ctx) {
            try {
              const now = audio.ctx.currentTime;
              audio.masterGain.gain.cancelScheduledValues(now);
              audio.masterGain.gain.linearRampToValueAtTime(0, now + 0.3);
            } catch (_) {}
          }
          audio.muted = true;
          updateTrackPill(null);
          soundBtn.setAttribute('aria-pressed', 'false');
          soundBtn.setAttribute('title', "Activer l'ambiance sonore");
          return;
        }

        // Unmute / Play
        if (mode === 'procedural') {
          if (audio.customEl) audio.customEl.pause();
          playProcedural(targetVol);
          updateTrackPill({ title: 'Synthèse Procédurale Vallée 3D', artist: 'Génération temps réel' });
        } else if (mode === 'custom' && audioConfig.customUrl) {
          if (!audio.customEl || audio.customEl.src !== audioConfig.customUrl) {
            if (audio.customEl) audio.customEl.pause();
            audio.customEl = new Audio(audioConfig.customUrl);
            audio.customEl.loop = true;
            audio.customEl.crossOrigin = 'anonymous';
          }
          try {
            audio.customEl.volume = audio.muffled ? (targetVol * 0.5) : targetVol;
            await audio.customEl.play();
            audio.muted = false;
            updateTrackPill({ title: audioConfig.title || 'Piste audio personnalisée', artist: 'Daniel Adjiri' });
          } catch (err) {
            playProcedural(targetVol);
          }
        } else {
          // Mode 'playlist' (Default) -> Musiques d'ambiance libres de droit de manière aléatoire
          playNextRandomTrack();
        }

        soundBtn.setAttribute('aria-pressed', String(!audio.muted));
        soundBtn.setAttribute('title', audio.muted ? "Activer l'ambiance sonore" : "Couper l'ambiance sonore");
      }

      function playProcedural(targetVol) {
        initProceduralAudio();
        if (!audio.ctx) return;

        if (audio.ctx.state === 'suspended') {
          audio.ctx.resume();
        }

        const now = audio.ctx.currentTime;
        if (audio.muted) {
          if (!audio.src) {
            audio.src = audio.ctx.createBufferSource();
            audio.src.buffer = audio.buf;
            audio.src.loop = true;
            audio.src.connect(audio.masterGain);
            audio.src.start(0);
          }
          audio.masterGain.gain.cancelScheduledValues(now);
          audio.masterGain.gain.setValueAtTime(audio.masterGain.gain.value, now);
          audio.masterGain.gain.linearRampToValueAtTime(targetVol, now + 1.2);
          audio.muted = false;
        } else {
          audio.masterGain.gain.cancelScheduledValues(now);
          audio.masterGain.gain.setValueAtTime(audio.masterGain.gain.value, now);
          audio.masterGain.gain.linearRampToValueAtTime(0, now + 0.4);
          audio.muted = true;
        }
      }

      if (soundBtn) {
        soundBtn.addEventListener('click', handleSoundToggle);
      }

      // Redimensionnement
      const res = new THREE.Vector2(1, 1);
      function resize() {
        const w = hero.clientWidth, h = hero.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        try {
          composer.setSize(w, h);
        } catch (e) {
          console.warn('[Three.js] Composer resize fallback', e);
        }
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        res.set(w * dpr, h * dpr);
        flowers.material.uniforms.uResolution.value.copy(res);
        dust.material.uniforms.uResolution.value.copy(res);
        rays.material.uniforms.uResolution.value.copy(res);
      }
      new ResizeObserver(resize).observe(hero);
      resize();

      // Boucle d'animation principale optimisée (0 allocation par frame, 60fps garanti)
      let raf = 0, last = performance.now(), visible = true, ready = false;
      const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
      const targetCamPos = new THREE.Vector3();
      const lookTarget = new THREE.Vector3();

      function frame(time) {
        const dt = Math.min(time - last || 16.66, 60);
        last = time;

        const step = dt / 2200;
        if (state.dir === 1) {
          state.transition = Math.min(1, state.transition + step);
          if (state.transition >= 1) state.dir = 0;
        } else if (state.dir === -1) {
          state.transition = Math.max(0, state.transition - step);
          if (state.transition <= 0) state.dir = 0;
        }
        setMuffle(state.transition > 0.1);

        // Progression fluide et continue sans à-coups ni lag asymptotique
        state.progress = wrap01(state.progress + state.drift * (dt / 16.66) + scrollLead * 0.04);
        scrollLead *= 0.90;

        // Lissage fluide du curseur souris (amortissement doux)
        state.mouse.x += (state.mouse.tx - state.mouse.x) * 0.08;
        state.mouse.y += (state.mouse.ty - state.mouse.y) * 0.08;

        // Échantillonnage sur la spline
        path.getPointAt(state.progress, tmpA);
        path.getPointAt(wrap01(state.progress + 0.02), tmpB);

        // Normalisation souris (-1 à 1)
        const mouseNormX = (state.mouse.x - 0.5) * 2;
        const mouseNormY = (state.mouse.y - 0.5) * 2;

        // Déplacement physique de la caméra
        targetCamPos.x = tmpA.x + mouseNormX * 6.0;
        targetCamPos.y = Math.max(tmpA.y - mouseNormY * 4.0, terrainHeight(tmpA.x, tmpA.z) + 3.0);
        targetCamPos.z = tmpA.z + mouseNormX * 2.5;

        // Point de regard avec influence de la souris
        lookTarget.x = tmpB.x + mouseNormX * 12.0;
        lookTarget.y = tmpB.y - mouseNormY * 9.0;
        lookTarget.z = tmpB.z;

        const e = 1 - Math.pow(1 - state.transition, 3);
        const lerpFactor = state.transition > 0 ? Math.min(0.06 + e * 0.04, 0.1) : 0.06;
        camera.position.lerp(targetCamPos, lerpFactor);

        // Roulis cinématique fluide via camera.up (évite conflit quaternion / Euler)
        camera.up.set(mouseNormX * 0.09 * (1 - e), 1, 0).normalize();
        if (state.transition > 0) {
          lookTarget.y -= e * 8;
        }
        camera.lookAt(lookTarget);

        let dv = state.progress - state.lastProgress;
        dv -= Math.round(dv);
        state.velocity = Math.abs(dv) * 1000;
        state.lastProgress = state.progress;
        vignette.uniforms.uIntensity.value += (clamp01(0.3 + state.velocity * 40) - vignette.uniforms.uIntensity.value) * 0.05;
        if (!REDUCE) shift.uniforms.uAmount.value += (clamp01(0.0009 + state.velocity * 0.012) - shift.uniforms.uAmount.value) * 0.05;

        const t = time * 0.001;
        const fu = flowers.material.uniforms;
        fu.uTime.value = t;
        fu.uTransition.value = state.transition;
        fu.uCameraPos.value.copy(camera.position);
        fu.uMouse.value.set(state.mouse.x, 1 - state.mouse.y);
        fu.uMousePush.value = REDUCE ? 0 : 1.2;

        const du = dust.material.uniforms;
        du.uTime.value = t;
        du.uTransition.value = state.transition;
        du.uCameraPos.value.copy(camera.position);

        rays.material.uniforms.uTime.value = t;
        noise.uniforms.uTime.value = t;

        try {
          composer.render();
        } catch {
          renderer.render(scene, camera);
        }

        if (!ready) {
          ready = true;
          hero.classList.add('ready');
          if (loader) loader.setAttribute('aria-hidden', 'true');
        }

        raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
      }

      const heroVisibilityObserver = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf && !document.hidden) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      });
      heroVisibilityObserver.observe(hero);

      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && visible && !raf) {
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      });

      raf = requestAnimationFrame(frame);
    } catch (err) {
      console.warn('[Hero 3D] Erreur initialisation, bascule fallback:', err);
      triggerFallback();
    }
  }
}
