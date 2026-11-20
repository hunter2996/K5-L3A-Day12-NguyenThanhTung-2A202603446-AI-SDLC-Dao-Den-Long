(function () {
  'use strict';

  const sim = window.LanternSim;
  const THREE = window.THREE;

  const urlParams = new URLSearchParams(window.location.search || '');
  const IS_BENCH = urlParams.get('bench') === '1';
  const BENCH_SEED = Number(urlParams.get('seed')) || 42;
  const BENCH_DURATION_S = Number(urlParams.get('duration')) || 30;

  // --- Standard Palette (Ticket-02 + Ticket-03 Colorblind Support) ---
  const PALETTE = {
    skyNight: 0x0E1430,
    fogNight: 0x1B2350,
    grass: 0x2F5D50,
    sand: 0xC9B48A,
    wood: 0x6B4A2F,
    cloudSea: 0x12384A,
    lanternLit: 0xFFB347,
    lanternCore: 0xFFE9B0,
    lanternOff: 0x5B5F6E,
    moteCore: 0xFFF6C2,
    moteHalo: 0xFFE58A,
    shadeBody: 0x120A1A,
    shadeRim: 0x7A3CFF,
    shadeRimColorblind: 0x00B3FF,
    shadeStun: 0x3A3450,
    mayTunic: 0xE8E2D0,
    mayCrimson: 0xC8102E,
    goldAccent: 0xF2C14E,
    dangerUi: 0xFF5A5F,
    drifter: 0x8FA3B8
  };

  const SETTINGS_KEY = 'dao-den-long-settings-v2';
  const LOCAL_LB_KEY = 'dao-den-long-leaderboard-v1';

  const DEFAULT_KEYBINDS = {
    moveUp: 'KeyW',
    moveDown: 'KeyS',
    moveLeft: 'KeyA',
    moveRight: 'KeyD',
    jump: 'Space',
    dash: 'ShiftLeft',
    interact: 'KeyE',
    pulse: 'KeyQ',
    pause: 'Escape'
  };

  const ACTION_LABELS = {
    moveUp: 'Đi lên',
    moveDown: 'Đi xuống',
    moveLeft: 'Sang trái',
    moveRight: 'Sang phải',
    jump: 'Nhảy',
    dash: 'Lướt',
    interact: 'Tương tác',
    pulse: 'Tỏa Sáng',
    pause: 'Tạm dừng'
  };

  const NIGHT_INTROS = {
    1: {
      title: 'Đêm 1 — Đảo Bến',
      subtitle: '5 Đèn Lồng Lớn · Cần ≥ 3 đèn tới bình minh (04:00) · Ngọn Lửa: 3',
      speech: 'Ông Đăng: "Mây ơi, dầu đèn đêm nay hao dần theo từng giây. Hãy thắp và giữ ít nhất 3 Đèn Lồng Lớn sáng tới bình minh!"'
    },
    2: {
      title: 'Đêm 2 — Đảo Cau',
      subtitle: '6 Đèn Lồng Lớn · Cần ≥ 4 đèn tới bình minh (04:30) · Gió Lạc & Bùa Gió',
      speech: 'Ông Đăng: "Đảo Cau có cầu tre hẹp và Gió Lạc rình cướp ánh sáng. Châm thêm dầu cho đèn dưới 30% trước khi Bóng Mực kéo tới hút cạn!"'
    },
    3: {
      title: 'Đêm 3 — Đảo Chuông',
      subtitle: '7 Đèn Lồng Lớn · Cần ≥ 5 đèn tới bình minh (05:00) · 3 Tầng & Gió Mạnh',
      speech: 'Ông Đăng: "Đêm cuối dài 5 phút với gió mạnh từng hồi. Mỗi lần thắp lại chỉ tốn 5 đom đóm, và sức chứa tăng dần lên tối đa 20!"'
    }
  };

  function formatKeyLabel(code) {
    if (!code) return '?';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'Space') return 'Space';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'Escape') return 'Esc';
    if (code === 'ArrowUp') return '↑';
    if (code === 'ArrowDown') return '↓';
    if (code === 'ArrowLeft') return '←';
    if (code === 'ArrowRight') return '→';
    return code;
  }

  // --- Settings Persistence ---
  function loadSettings() {
    const def = {
      volume: 0.8,
      sensitivity: 1.0,
      colorblind: false,
      subtitles: true,
      reduceMotion: false,
      largeText: false,
      keybinds: Object.assign({}, DEFAULT_KEYBINDS)
    };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const kb = Object.assign({}, DEFAULT_KEYBINDS);
        if (parsed.keybinds && typeof parsed.keybinds === 'object') {
          Object.keys(DEFAULT_KEYBINDS).forEach((k) => {
            if (typeof parsed.keybinds[k] === 'string' && parsed.keybinds[k]) {
              kb[k] = parsed.keybinds[k];
            }
          });
        }
        return {
          volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : def.volume,
          sensitivity: typeof parsed.sensitivity === 'number' ? Math.max(0.3, Math.min(2.5, parsed.sensitivity)) : def.sensitivity,
          colorblind: Boolean(parsed.colorblind),
          subtitles: parsed.subtitles !== undefined ? Boolean(parsed.subtitles) : true,
          reduceMotion: Boolean(parsed.reduceMotion),
          largeText: Boolean(parsed.largeText),
          keybinds: kb
        };
      }
    } catch (_) {
      // Ignore storage failures
    }
    return def;
  }

  function saveSettings(cfg) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(cfg));
    } catch (_) {
      // Ignore storage failures
    }
  }

  const userSettings = loadSettings();

  function getShadeRimHex() {
    return userSettings.colorblind ? PALETTE.shadeRimColorblind : PALETTE.shadeRim;
  }

  // --- Procedural Web Audio (Polyphonic Night Music + Full SFX) ---
  class CozyAudio {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.compressor = null;
      this.muted = false;
      this.musicTimer = null;
      this.musicStep = 0;
    }

    ensure() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.compressor = this.ctx.createDynamicsCompressor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
        this.applyVolume();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    applyVolume() {
      if (this.masterGain && this.ctx) {
        const v = this.muted ? 0 : userSettings.volume;
        this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      this.applyVolume();
      if (!this.muted) this.playPickup(2);
      return this.muted;
    }

    startAmbientMusic() {
      this.ensure();
      if (this.musicTimer) return;
      // Warm A-minor / C-major fairy-tale pentatonic loop (melody + warm bass pad)
      const melody = [
        440.0, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25,
        392.0, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0
      ];
      const bass = [220.0, 174.61, 261.63, 196.0];
      this.musicTimer = setInterval(() => {
        if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
        const step = this.musicStep % melody.length;
        const isGameplay = Boolean(running && gameState && gameState.gameState === 'playing');
        const levelMul = isGameplay ? 1.0 : 0.45;
        if (step % 4 === 0) {
          const bFreq = bass[Math.floor(step / 4) % bass.length];
          this.tone(bFreq, 1.75, 'triangle', 0.08 * levelMul, 0);
        }
        const mFreq = melody[step];
        this.tone(mFreq, 0.65, 'sine', 0.095 * levelMul, 0);
        if (step % 2 === 0) {
          this.tone(mFreq * 2, 0.42, 'sine', 0.025 * levelMul, 0.04);
        }
        this.musicStep += 1;
      }, 480);
    }

    tone(freq, duration, type, gainPeak, delay, endFreq) {
      const ctx = this.ensure();
      if (!ctx || !this.masterGain || this.muted) return;
      const t0 = ctx.currentTime + (delay || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
      }
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, gainPeak || 0.1), t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.04);
    }

    playPickup(carried) {
      const pent = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const f = pent[(Math.max(1, carried) - 1) % pent.length];
      this.tone(f, 0.22, 'sine', 0.14, 0);
      this.tone(f * 1.5, 0.18, 'triangle', 0.06, 0.03);
    }

    playDeposit() {
      this.tone(440, 0.24, 'triangle', 0.11, 0);
      this.tone(659.25, 0.28, 'sine', 0.11, 0.05);
    }

    playLanternLit() {
      [392.0, 493.88, 587.33, 783.99].forEach((f, idx) => this.tone(f, 0.75, 'sine', 0.12, idx * 0.06));
    }

    playPulse() {
      this.tone(587.33, 0.42, 'triangle', 0.14, 0);
      this.tone(880.0, 0.48, 'sine', 0.13, 0.04);
      this.tone(1174.66, 0.42, 'sine', 0.08, 0.08);
    }

    playJump() {
      this.tone(280, 0.17, 'sine', 0.11, 0, 540);
    }

    playDash() {
      this.tone(680, 0.18, 'triangle', 0.13, 0, 240);
    }

    playCharm() {
      [659.25, 880.0, 1174.66].forEach((f, idx) => this.tone(f, 0.35, 'sine', 0.11, idx * 0.05));
    }

    playShadeSpawn() {
      this.tone(190, 0.48, 'sawtooth', 0.075, 0, 90);
    }

    playHit() {
      this.tone(160, 0.26, 'sawtooth', 0.13, 0);
      this.tone(105, 0.32, 'triangle', 0.14, 0.04);
    }

    playWindWarning() {
      this.tone(360, 0.65, 'sine', 0.09, 0, 520);
    }

    playCountdownTick() {
      this.tone(880, 0.1, 'square', 0.06, 0);
    }

    playWin() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.12, i * 0.09));
    }

    playLose() {
      [329.63, 293.66, 246.94, 196.0].forEach((f, i) => this.tone(f, 0.52, 'triangle', 0.11, i * 0.13));
    }

    playNoiseSweep(dur, startFreq, endFreq, peakGain) {
      const ctx = this.ensure();
      if (!ctx || !this.masterGain || this.muted) return;
      const t0 = ctx.currentTime;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.8;
      filter.frequency.setValueAtTime(startFreq, t0);
      filter.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(peakGain, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(t0);
    }

    playTornado() {
      this.playNoiseSweep(0.55, 280, 980, 0.28);
      this.tone(320, 0.35, 'triangle', 0.1, 0, 720);
    }

    playWindWall() {
      this.playNoiseSweep(0.65, 520, 210, 0.25);
      this.tone(523.25, 0.4, 'sine', 0.1, 0.02);
      this.tone(783.99, 0.45, 'sine', 0.08, 0.08);
    }

    playAirSlash() {
      this.playNoiseSweep(0.32, 950, 2200, 0.26);
      [880.0, 1174.66, 1567.98].forEach((f, idx) => {
        this.tone(f, 0.22, 'triangle', 0.12, idx * 0.075, f * 0.72);
      });
    }
  }

  // --- DOM Elements ---
  const canvas = document.getElementById('game-canvas');
  const damageFlash = document.getElementById('damage-flash');
  const lanternArrow = document.getElementById('lantern-arrow');
  const lanternArrowIcon = document.getElementById('lantern-arrow-icon');
  const lanternArrowLabel = document.getElementById('lantern-arrow-label');
  const shadeArrow = document.getElementById('shade-arrow');
  const shadeArrowIcon = document.getElementById('shade-arrow-icon');
  const shadeArrowLabel = document.getElementById('shade-arrow-label');

  const hud = document.getElementById('hud');
  const hudFlames = document.getElementById('hud-flames');
  const hudCharmPill = document.getElementById('hud-charm-pill');
  const hudCharmS = document.getElementById('hud-charm-s');
  const hudWindPill = document.getElementById('hud-wind-pill');
  const hudLowFuelPill = document.getElementById('hud-lowfuel-pill');
  const hudNightTitle = document.getElementById('hud-night-title');
  const hudTimer = document.getElementById('hud-timer');
  const hudFps = document.getElementById('hud-fps');
  const hudLanternCount = document.getElementById('hud-lantern-count');
  const hudScore = document.getElementById('hud-score');
  const hudCarried = document.getElementById('hud-carried');
  const hudMoteSlots = document.getElementById('hud-mote-slots');
  const hudSubtitles = document.getElementById('hud-subtitles');
  const hudPrompt = document.getElementById('hud-prompt');
  const hudWhisper = document.getElementById('hud-whisper');

  const skillDashBox = document.getElementById('skill-dash');
  const skillDashKey = document.getElementById('skill-dash-key');
  const hudDashCd = document.getElementById('hud-dash-cd');
  const skillPulseBox = document.getElementById('skill-pulse');
  const skillPulseKey = document.getElementById('skill-pulse-key');
  const hudPulseCd = document.getElementById('hud-pulse-cd');
  const skillTornadoBox = document.getElementById('skill-tornado');
  const hudTornadoCd = document.getElementById('hud-tornado-cd');
  const skillWindWallBox = document.getElementById('skill-windwall');
  const hudWindWallCd = document.getElementById('hud-windwall-cd');
  const skillAirSlashBox = document.getElementById('skill-airslash');
  const hudAirSlashCd = document.getElementById('hud-airslash-cd');

  const menuOverlay = document.getElementById('menu-overlay');
  const menuControlsGrid = document.getElementById('menu-controls-grid');
  const introOverlay = document.getElementById('intro-overlay');
  const introTitle = document.getElementById('intro-title');
  const introSubtitle = document.getElementById('intro-subtitle');
  const introSpeech = document.getElementById('intro-speech');
  const pauseOverlay = document.getElementById('pause-overlay');
  const pauseSubtitle = document.getElementById('pause-subtitle');
  const settingsOverlay = document.getElementById('settings-overlay');
  const leaderboardOverlay = document.getElementById('leaderboard-overlay');
  const leaderboardTbody = document.getElementById('leaderboard-tbody');
  const leaderboardEmpty = document.getElementById('leaderboard-empty');
  const endOverlay = document.getElementById('end-overlay');
  const endTitle = document.getElementById('end-title');
  const endSubtitle = document.getElementById('end-subtitle');
  const endStory = document.getElementById('end-story');
  const endBreakdown = document.getElementById('end-breakdown');
  const lbSaveBox = document.getElementById('lb-save-box');
  const inputLbName = document.getElementById('input-lb-name');
  const btnSaveScore = document.getElementById('btn-save-score');
  const lbSaveMsg = document.getElementById('lb-save-msg');

  const inputVolume = document.getElementById('input-volume');
  const labelVolume = document.getElementById('label-volume');
  const inputSens = document.getElementById('input-sens');
  const labelSens = document.getElementById('label-sens');
  const inputColorblind = document.getElementById('input-colorblind');
  const inputSubtitles = document.getElementById('input-subtitles');
  const inputReduceMotion = document.getElementById('input-reduce-motion');
  const inputLargeText = document.getElementById('input-large-text');
  const keybindsGrid = document.getElementById('keybinds-grid');
  const keybindError = document.getElementById('keybind-error');
  const btnResetKeybinds = document.getElementById('btn-reset-keybinds');

  const btnMute = document.getElementById('btn-mute');
  const btnPause = document.getElementById('btn-pause');
  const btnPlayCampaign = document.getElementById('btn-play-campaign');
  const btnOpenLeaderboard = document.getElementById('btn-open-leaderboard');
  const btnCloseLeaderboard = document.getElementById('btn-close-leaderboard');
  const btnOpenSettingsMenu = document.getElementById('btn-open-settings-menu');
  const btnBeginNight = document.getElementById('btn-begin-night');
  const btnIntroMenu = document.getElementById('btn-intro-menu');
  const btnResume = document.getElementById('btn-resume');
  const btnRestartNight = document.getElementById('btn-restart-night');
  const btnPauseSettings = document.getElementById('btn-pause-settings');
  const btnPauseMenu = document.getElementById('btn-pause-menu');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnNextNight = document.getElementById('btn-next-night');
  const btnRetryNight = document.getElementById('btn-retry-night');
  const btnEndMenu = document.getElementById('btn-end-menu');

  // --- Three.js Renderer & Scene ---
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyNight);
  const fog = new THREE.FogExp2(PALETTE.fogNight, 0.012);
  scene.fog = fog;

  const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 320);

  // Ambient Light obeys exact Ticket-02 formula: 0.15 + 0.55 * (lit / total)
  const hemiLight = new THREE.HemisphereLight(0x9cb0ff, PALETTE.cloudSea, 0.15);
  scene.add(hemiLight);

  const moonLight = new THREE.DirectionalLight(0xcddbff, 0.68);
  moonLight.position.set(-28, 48, -26);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 5;
  moonLight.shadow.camera.far = 160;
  const dCam = 60;
  moonLight.shadow.camera.left = -dCam;
  moonLight.shadow.camera.right = dCam;
  moonLight.shadow.camera.top = dCam;
  moonLight.shadow.camera.bottom = -dCam;
  scene.add(moonLight);

  // --- Shared Sea of Clouds + Sky Backdrop ---
  const skyGroup = new THREE.Group();
  const seaPlane = new THREE.Mesh(
    new THREE.CircleGeometry(240, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.cloudSea })
  );
  seaPlane.rotation.x = -Math.PI / 2;
  seaPlane.position.y = -4.5;
  skyGroup.add(seaPlane);

  const starPositions = [];
  for (let i = 0; i < 420; i++) {
    const th = Math.random() * Math.PI * 2;
    const ph = Math.random() * Math.PI * 0.44;
    const rad = 140 + Math.random() * 25;
    starPositions.push(
      rad * Math.cos(ph) * Math.cos(th),
      rad * Math.sin(ph) + 14,
      rad * Math.cos(ph) * Math.sin(th)
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  skyGroup.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: PALETTE.moteCore, size: 0.65 })));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 20, 20),
    new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore })
  );
  moon.position.set(-60, 62, -55);
  skyGroup.add(moon);
  scene.add(skyGroup);

  // --- Dynamic Per-Night Environment Group ---
  let envGroup = null;
  let windLeavesGroup = null;
  let cloudsRingGroup = null;

  function addTreeMesh(group, x, y, z, scale) {
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x24493f, roughness: 0.88 });
    const s = scale || 1;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 2.5 * s, 7), woodMat);
    trunk.position.set(x, y + 1.25 * s, z);
    trunk.castShadow = true;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.4 * s, 3.0 * s, 8), leafMat);
    c1.position.set(x, y + 3.0 * s, z);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.0 * s, 2.3 * s, 8), leafMat);
    c2.position.set(x, y + 4.3 * s, z);
    c2.castShadow = true;
    group.add(trunk, c1, c2);
  }

  function addLaunchpadVisual(group, x, y, z) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.05, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: PALETTE.goldAccent, emissive: 0x996b14, emissiveIntensity: 0.55 })
    );
    pad.position.set(x, y + 0.08, z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.92, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternCore, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.18, z);
    group.add(pad, ring);
  }

  function buildNightEnvironment(night) {
    if (envGroup) {
      scene.remove(envGroup);
      envGroup.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
      });
    }
    envGroup = new THREE.Group();
    windLeavesGroup = null;

    const grassMat = new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 0.9 });
    const sandMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9 });
    const woodMat = new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.88 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, roughness: 0.86 });

    // Drifting cloud puffs around island (single InstancedMesh draw call)
    cloudsRingGroup = new THREE.Group();
    const cloudGeo = new THREE.SphereGeometry(4.0, 10, 8);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: PALETTE.cloudSea,
      emissive: 0x0c2430,
      roughness: 1.0,
      transparent: true,
      opacity: 0.85
    });
    const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, 40);
    const cloudDummy = new THREE.Object3D();
    const cloudBaseR = night === 2 ? 78 : 50;
    const cloudCenterX = night === 2 ? 35 : 0;
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const r = cloudBaseR + (i % 4) * 7;
      cloudDummy.position.set(cloudCenterX + Math.sin(a) * r, -2.5 + (i % 3) * 0.5, Math.cos(a) * r);
      cloudDummy.scale.set(1.7, 0.5, 1.3);
      cloudDummy.updateMatrix();
      cloudInst.setMatrixAt(i, cloudDummy.matrix);
    }
    cloudInst.instanceMatrix.needsUpdate = true;
    cloudsRingGroup.add(cloudInst);
    envGroup.add(cloudsRingGroup);

    if (night === 1) {
      // Đảo Bến (R = 40 m)
      const island = new THREE.Mesh(new THREE.CylinderGeometry(40, 38.5, 2.4, 64), grassMat);
      island.position.y = -1.2;
      island.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.RingGeometry(38.2, 40.0, 64), sandMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.y = 0.02;
      rim.receiveShadow = true;
      const plaza = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.5, 0.12, 32), sandMat);
      plaza.position.y = 0.03;
      plaza.receiveShadow = true;
      envGroup.add(island, rim, plaza);

      // Decorative pier & Cụ Đò (Phase 1 creative touch — disabled in benchmark mode)
      if (!IS_BENCH) {
        const pier = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.22, 6.5), woodMat);
        pier.position.set(0, 0.11, -39.5);
        const elderRobe = new THREE.Mesh(
          new THREE.ConeGeometry(0.4, 1.2, 10),
          new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff })
        );
        elderRobe.position.set(-1.1, 0.82, -37.5);
        const elderHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), sandMat);
        elderHead.position.set(-1.1, 1.55, -37.5);
        const elderHat = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.26, 12), sandMat);
        elderHat.position.set(-1.1, 1.76, -37.5);
        envGroup.add(pier, elderRobe, elderHead, elderHat);
      }

      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.25;
        addTreeMesh(envGroup, Math.cos(a) * 35.5, 0, Math.sin(a) * 35.5, 1.0);
      }
    } else if (night === 2) {
      // Đảo Cau: 2 islands R=28 at (0,0) and (70,0) + Bamboo bridge x=[26,44], z=[-2,2]
      [0, 70].forEach((cx) => {
        const isl = new THREE.Mesh(new THREE.CylinderGeometry(28, 26.8, 2.4, 48), grassMat);
        isl.position.set(cx, -1.2, 0);
        isl.receiveShadow = true;
        const rim = new THREE.Mesh(new THREE.RingGeometry(26.2, 28.0, 48), sandMat);
        rim.rotation.x = -Math.PI / 2;
        rim.position.set(cx, 0.02, 0);
        rim.receiveShadow = true;
        envGroup.add(isl, rim);

        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.35;
          // Tall areca palms (cây cau) on edge
          const px = cx + Math.cos(a) * 24.8;
          const pz = Math.sin(a) * 24.8;
          if (Math.abs(pz) < 3.5 && (px > 22 && px < 48)) continue;
          addTreeMesh(envGroup, px, 0, pz, 1.15);
        }
      });

      // Bamboo Bridge (x in [26, 44], z in [-2, 2], no railings)
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.24, 4), woodMat);
      bridge.position.set(35, -0.1, 0);
      bridge.receiveShadow = true;
      bridge.castShadow = true;
      envGroup.add(bridge);
      for (let bx = 26.5; bx <= 43.5; bx += 0.9) {
        const slat = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.0, 6), sandMat);
        slat.rotation.x = Math.PI / 2;
        slat.position.set(bx, 0.02, 0);
        envGroup.add(slat);
      }

      // 2 Launchpads
      addLaunchpadVisual(envGroup, 20, 0, 18);
      addLaunchpadVisual(envGroup, 50, 0, -18);
    } else if (night === 3) {
      // Đảo Chuông: R = 45, 3 Tiers + 2 Ramps + Launchpad + Bell Tower + Wind Leaves
      const t0 = new THREE.Mesh(new THREE.CylinderGeometry(45, 43.5, 2.4, 64), grassMat);
      t0.position.y = -1.2;
      t0.receiveShadow = true;
      const t0Rim = new THREE.Mesh(new THREE.RingGeometry(43.2, 45.0, 64), sandMat);
      t0Rim.rotation.x = -Math.PI / 2;
      t0Rim.position.y = 0.02;
      envGroup.add(t0, t0Rim);

      // Tier 1: Half-annulus r=[12,24], z > 0, Y=3
      const tier1Shape = new THREE.Shape();
      tier1Shape.moveTo(24, 0);
      tier1Shape.absarc(0, 0, 24, 0, Math.PI, false);
      tier1Shape.lineTo(-12, 0);
      tier1Shape.absarc(0, 0, 12, Math.PI, 0, true);
      tier1Shape.closePath();
      const tier1Geo = new THREE.ExtrudeGeometry(tier1Shape, { depth: 3.0, bevelEnabled: false, curveSegments: 32 });
      const tier1Mesh = new THREE.Mesh(tier1Geo, grassMat);
      tier1Mesh.rotation.x = Math.PI / 2;
      tier1Mesh.position.y = 3.0;
      tier1Mesh.receiveShadow = true;
      tier1Mesh.castShadow = true;
      envGroup.add(tier1Mesh);

      // Tier 2: Disk r=8, Y=6 + stone cliff collar for clear visual depth
      const tier2Mesh = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 36), grassMat);
      tier2Mesh.position.y = 3.0;
      tier2Mesh.receiveShadow = true;
      tier2Mesh.castShadow = true;
      const rimDoubleMat = new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.9, side: THREE.DoubleSide });
      const tier2Rim = new THREE.Mesh(new THREE.RingGeometry(7.6, 8.05, 36), rimDoubleMat);
      tier2Rim.rotation.x = -Math.PI / 2;
      tier2Rim.position.y = 6.02;
      const tier1Rim = new THREE.Mesh(new THREE.RingGeometry(23.5, 24.05, 36, 1, 0, Math.PI), rimDoubleMat);
      tier1Rim.rotation.x = Math.PI / 2;
      tier1Rim.position.y = 3.02;
      envGroup.add(tier2Mesh, tier2Rim, tier1Rim);

      // 2 Ramps at 30 deg & 150 deg (s in [24, 30], width 3 m, Y=0 to Y=3)
      const slopeLen = Math.hypot(6, 3);
      const slopeAng = Math.atan2(3, 6);
      [Math.PI / 6, (5 * Math.PI) / 6].forEach((theta) => {
        const pivot = new THREE.Group();
        pivot.rotation.y = -theta;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(slopeLen, 0.24, 3.0), woodMat);
        ramp.position.set(27.0, 1.5 - 0.12, 0);
        ramp.rotation.z = -slopeAng;
        ramp.receiveShadow = true;
        ramp.castShadow = true;
        pivot.add(ramp);
        envGroup.add(pivot);
      });

      // Launchpad on Tier 1 at (0, 3, 13)
      addLaunchpadVisual(envGroup, 0, 3, 13);

      // Bell Tower at center of Tier 2 (r=2 m, h=8 m, Y=6..14)
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 8.0, 16), stoneMat);
      tower.position.set(0, 10.0, 0);
      tower.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.8, 16), woodMat);
      roof.position.set(0, 14.9, 0);
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.72, 1.0, 12),
        new THREE.MeshStandardMaterial({ color: PALETTE.goldAccent, emissive: 0x6b4d12, roughness: 0.35 })
      );
      bell.position.set(0, 12.6, 0);
      envGroup.add(tower, roof, bell);

      // Wind leaf particles for Strong Wind telegraph & gust
      windLeavesGroup = new THREE.Group();
      const leafGeo = new THREE.BoxGeometry(0.28, 0.04, 0.14);
      const leafMat = new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent });
      for (let i = 0; i < 45; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set((Math.random() - 0.5) * 60, 0.8 + Math.random() * 6, (Math.random() - 0.5) * 60);
        windLeavesGroup.add(leaf);
      }
      windLeavesGroup.visible = false;
      envGroup.add(windLeavesGroup);
    }

    scene.add(envGroup);
  }

  // --- Build Mây (Standard Palette: #E8E2D0 tunic, #C8102E scarf, #C9B48A nón lá) ---
  function buildPlayerMesh() {
    const group = new THREE.Group();
    const bodyGroup = new THREE.Group();
    group.add(bodyGroup);

    const robe = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 1.05, 12),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayTunic, roughness: 0.75 })
    );
    robe.position.y = 0.58;
    robe.castShadow = true;
    bodyGroup.add(robe);

    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.08, 8, 16),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayCrimson, roughness: 0.65 })
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.05;
    bodyGroup.add(scarf);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xf9dfc4, roughness: 0.65 })
    );
    head.position.y = 1.24;
    head.castShadow = true;
    bodyGroup.add(head);

    const nonLa = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 0.34, 20),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 0.85, side: THREE.DoubleSide })
    );
    nonLa.position.y = 1.48;
    nonLa.castShadow = true;
    bodyGroup.add(nonLa);

    // Small hanging lantern on Nón Lá
    const lanternPivot = new THREE.Group();
    lanternPivot.position.set(0, 1.33, 0.52);
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.22, 6),
      new THREE.MeshBasicMaterial({ color: PALETTE.wood })
    );
    cord.position.y = -0.11;
    const miniLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.2, 8),
      new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit })
    );
    miniLantern.position.y = -0.26;
    const playerLight = new THREE.PointLight(PALETTE.lanternLit, 2.0, 16, 1.8);
    playerLight.position.set(0, -0.26, 0);
    lanternPivot.add(cord, miniLantern, playerLight);
    bodyGroup.add(lanternPivot);

    // Charm aura ring
    const charmAuraMat = new THREE.MeshBasicMaterial({
      color: PALETTE.mayCrimson,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    const charmAura = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 24), charmAuraMat);
    charmAura.rotation.x = -Math.PI / 2;
    charmAura.position.y = 0.08;
    group.add(charmAura);

    // Pulse shockwave ring
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternCore,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.85, 40), pulseRingMat);
    pulseRing.rotation.x = -Math.PI / 2;
    pulseRing.position.y = 0.15;
    scene.add(pulseRing);

    scene.add(group);
    return { group, bodyGroup, lanternPivot, playerLight, charmAuraMat, pulseRing, pulseRingMat };
  }

  const playerVis = buildPlayerMesh();

  // --- Entity Pools ---
  const lanternMeshes = new Map();
  const moteMeshes = new Map();
  const shadeMeshes = new Map();
  const drifterMeshes = new Map();
  const charmMeshes = new Map();

  const sharedMoteGeo = new THREE.SphereGeometry(0.24, 10, 10);
  const sharedMoteGlowGeo = new THREE.SphereGeometry(0.46, 10, 10);
  const sharedMoteMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteCore });
  const sharedMoteGlowMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.36 });
  const sharedDroppedGlowMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternLit, transparent: true, opacity: 0.45 });
  const sharedShadowGeo = new THREE.CircleGeometry(0.3, 12);
  const sharedShadowMat = new THREE.MeshBasicMaterial({ color: PALETTE.moteHalo, transparent: true, opacity: 0.25 });

  function createLanternVisual(lantern) {
    const group = new THREE.Group();
    group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.95, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.lanternOff, roughness: 0.88 })
    );
    base.position.y = 0.28;
    base.castShadow = true;
    base.receiveShadow = true;
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.3, 1.85, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.85 })
    );
    pillar.position.y = 1.45;
    pillar.castShadow = true;

    // Lantern head pivot at base of paper body so unlit state squashes cleanly by 20%
    const headGroup = new THREE.Group();
    headGroup.position.y = 2.22;

    const coreMat = new THREE.MeshStandardMaterial({
      color: PALETTE.lanternOff,
      emissive: 0x1a1c28,
      emissiveIntensity: 0.35,
      roughness: 0.45
    });
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.44, 1.05, 8), coreMat);
    core.position.y = 0.53;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: PALETTE.wood, roughness: 0.8 })
    );
    roof.position.y = 1.33;
    roof.castShadow = true;

    // Non-color distinction when unlit: torn-paper jagged slits + squashed 20% profile
    const tearGroup = new THREE.Group();
    const tearMat = new THREE.MeshBasicMaterial({ color: 0x141620, side: THREE.DoubleSide });
    for (let tIdx = 0; tIdx < 4; tIdx++) {
      const ang = (tIdx / 4) * Math.PI * 2 + 0.3;
      const slash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), tearMat);
      slash.position.set(Math.sin(ang) * 0.51, 0.53 + (tIdx % 2 === 0 ? 0.1 : -0.1), Math.cos(ang) * 0.51);
      slash.rotation.y = ang;
      slash.rotation.z = tIdx % 2 === 0 ? 0.55 : -0.55;
      tearGroup.add(slash);
    }
    headGroup.add(core, roof, tearGroup);

    // Overhead Fuel Bar (billboarded in syncVisuals, visible only while lit)
    const fuelBarGroup = new THREE.Group();
    fuelBarGroup.position.y = 4.35;
    const barBorder = new THREE.Mesh(
      new THREE.PlaneGeometry(1.54, 0.24),
      new THREE.MeshBasicMaterial({ color: 0x090d1e, side: THREE.DoubleSide })
    );
    const barBg = new THREE.Mesh(
      new THREE.PlaneGeometry(1.42, 0.14),
      new THREE.MeshBasicMaterial({ color: 0x262d47, side: THREE.DoubleSide })
    );
    barBg.position.z = 0.004;
    const fuelFillMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternCore,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1
    });
    const fuelFill = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.14), fuelFillMat);
    fuelFill.position.z = 0.008;
    const thresholdTick = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xf5f1e6, side: THREE.DoubleSide })
    );
    thresholdTick.position.set(-0.71 + 0.3 * 1.42, 0, 0.012);
    fuelBarGroup.add(barBorder, barBg, fuelFill, thresholdTick);
    fuelBarGroup.visible = false;

    const pointLight = new THREE.PointLight(PALETTE.lanternLit, 0, 24, 1.5);
    pointLight.position.y = 2.8;

    const safeRingMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternLit,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    const safeRing = new THREE.Mesh(
      new THREE.RingGeometry(sim.DEFAULT_TUNING.safe_radius - 0.16, sim.DEFAULT_TUNING.safe_radius, 48),
      safeRingMat
    );
    safeRing.rotation.x = -Math.PI / 2;
    safeRing.position.y = 0.06;

    const safeDiscMat = new THREE.MeshBasicMaterial({
      color: PALETTE.lanternCore,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0
    });
    const safeDisc = new THREE.Mesh(
      new THREE.CircleGeometry(sim.DEFAULT_TUNING.safe_radius, 48),
      safeDiscMat
    );
    safeDisc.rotation.x = -Math.PI / 2;
    safeDisc.position.y = 0.04;

    const pips = [];
    for (let i = 0; i < sim.DEFAULT_TUNING.lantern_cost; i++) {
      const pipMat = new THREE.MeshBasicMaterial({ color: PALETTE.lanternOff });
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), pipMat);
      group.add(pip);
      pips.push({ mesh: pip, mat: pipMat });
    }

    group.add(base, pillar, headGroup, fuelBarGroup, pointLight, safeRing, safeDisc);
    scene.add(group);
    return { group, headGroup, tearGroup, fuelBarGroup, fuelFill, fuelFillMat, coreMat, pointLight, safeRingMat, safeDiscMat, pips };
  }

  function createMoteVisual(mote) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(sharedMoteGeo, sharedMoteMat);
    const glow = new THREE.Mesh(sharedMoteGlowGeo, mote.kind === 'dropped' ? sharedDroppedGlowMat : sharedMoteGlowMat);
    const groundMarker = new THREE.Mesh(sharedShadowGeo, sharedShadowMat);
    groundMarker.rotation.x = -Math.PI / 2;
    groundMarker.position.y = 0.04;
    group.add(core, glow, groundMarker);
    group.position.set(mote.pos[0], mote.pos[1], mote.pos[2]);
    scene.add(group);
    return { group, core, glow };
  }

  const sharedShadeOuterGeo = new THREE.SphereGeometry(0.74, 14, 10);
  const sharedShadeCoreGeo = new THREE.SphereGeometry(0.45, 12, 8);
  const sharedShadeEyesGeo = (function () {
    const gL = new THREE.SphereGeometry(0.085, 6, 6);
    gL.translate(-0.16, 1.06, 0.42);
    const gR = new THREE.SphereGeometry(0.085, 6, 6);
    gR.translate(0.16, 1.06, 0.42);
    const posL = gL.attributes.position.array;
    const posR = gR.attributes.position.array;
    const mergedPos = new Float32Array(posL.length + posR.length);
    mergedPos.set(posL, 0);
    mergedPos.set(posR, posL.length);
    const idxL = gL.index.array;
    const idxR = gR.index.array;
    const vertOffset = posL.length / 3;
    const mergedIdx = new Uint16Array(idxL.length + idxR.length);
    mergedIdx.set(idxL, 0);
    for (let i = 0; i < idxR.length; i++) mergedIdx[idxL.length + i] = idxR[i] + vertOffset;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    geo.setIndex(new THREE.BufferAttribute(mergedIdx, 1));
    gL.dispose();
    gR.dispose();
    return geo;
  }());
  const sharedShadeStarGeo = new THREE.OctahedronGeometry(0.12, 0);
  const sharedShadeStarMat = new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent });
  const sharedShadeDrainGeo = new THREE.RingGeometry(0.78, 1.08, 18);

  const shadeMatPool = {
    rimHex: null,
    normal: {
      outer: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, transparent: true, opacity: 0.46, depthWrite: false }),
      body: new THREE.MeshLambertMaterial({ color: 0x261042, emissive: PALETTE.shadeRim, emissiveIntensity: 0.42, transparent: true, opacity: 0.76 }),
      eye: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim })
    },
    recoil: {
      outer: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, transparent: true, opacity: 0.42, depthWrite: false }),
      body: new THREE.MeshLambertMaterial({ color: 0x261042, emissive: PALETTE.shadeRim, emissiveIntensity: 0.42, transparent: true, opacity: 0.76 }),
      eye: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim })
    },
    drain: {
      outer: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, transparent: true, opacity: 0.6, depthWrite: false }),
      body: new THREE.MeshLambertMaterial({ color: 0x261042, emissive: PALETTE.shadeRim, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }),
      eye: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim }),
      aura: new THREE.MeshBasicMaterial({ color: PALETTE.shadeRim, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    },
    stunned: {
      outer: new THREE.MeshBasicMaterial({ color: PALETTE.shadeStun, transparent: true, opacity: 0.52, depthWrite: false }),
      body: new THREE.MeshLambertMaterial({ color: PALETTE.shadeStun, emissive: PALETTE.shadeStun, emissiveIntensity: 0.35, transparent: true, opacity: 0.74 }),
      eye: new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent })
    },
    stunnedAir: {
      outer: new THREE.MeshBasicMaterial({ color: 0x9ef0ff, transparent: true, opacity: 0.54, depthWrite: false }),
      body: new THREE.MeshLambertMaterial({ color: PALETTE.shadeStun, emissive: PALETTE.shadeStun, emissiveIntensity: 0.35, transparent: true, opacity: 0.74 }),
      eye: new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent })
    }
  };

  function syncShadePoolColors(rimHex) {
    if (shadeMatPool.rimHex === rimHex) return;
    shadeMatPool.rimHex = rimHex;
    ['normal', 'recoil', 'drain'].forEach((k) => {
      shadeMatPool[k].outer.color.setHex(rimHex);
      shadeMatPool[k].body.emissive.setHex(rimHex);
      shadeMatPool[k].eye.color.setHex(rimHex);
    });
    shadeMatPool.drain.aura.color.setHex(rimHex);
  }

  function createShadeVisual(shade) {
    const group = new THREE.Group();
    syncShadePoolColors(getShadeRimHex());
    const outerOrb = new THREE.Mesh(sharedShadeOuterGeo, shadeMatPool.normal.outer);
    outerOrb.position.y = 1.0;

    const coreOrb = new THREE.Mesh(sharedShadeCoreGeo, shadeMatPool.normal.body);
    coreOrb.position.y = 1.0;
    coreOrb.castShadow = !IS_BENCH;

    const eyesMesh = new THREE.Mesh(sharedShadeEyesGeo, shadeMatPool.normal.eye);

    const stunRing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const st = new THREE.Mesh(sharedShadeStarGeo, sharedShadeStarMat);
      const a = (i / 3) * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.56, 1.95, Math.sin(a) * 0.56);
      stunRing.add(st);
    }
    stunRing.visible = false;

    const drainAura = new THREE.Mesh(sharedShadeDrainGeo, shadeMatPool.drain.aura);
    drainAura.rotation.x = -Math.PI / 2;
    drainAura.position.y = 0.08;
    drainAura.visible = false;

    group.add(coreOrb, outerOrb, eyesMesh, stunRing, drainAura);
    group.position.set(shade.pos[0], 0, shade.pos[2]);
    scene.add(group);
    return { group, coreOrb, outerOrb, eyesMesh, stunRing, drainAura, lastStateKey: 'normal' };
  }

  function createDrifterVisual(drifter) {
    const group = new THREE.Group();
    const silkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.drifter,
      emissive: 0x3b4d63,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    });
    const segments = [];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.55 - i * 0.08, 0.08, 0.85), silkMat);
      seg.position.set(0, 0, -i * 0.72);
      group.add(seg);
      segments.push(seg);
    }
    group.position.set(drifter.pos[0], drifter.pos[1], drifter.pos[2]);
    scene.add(group);
    return { group, silkMat, segments };
  }

  function createCharmVisual(charm) {
    const group = new THREE.Group();
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.85, 0.1),
      new THREE.MeshStandardMaterial({ color: PALETTE.mayCrimson, emissive: 0x6b0818, emissiveIntensity: 0.5 })
    );
    tag.position.y = 0.9;
    const border = new THREE.Mesh(
      new THREE.BoxGeometry(0.63, 0.93, 0.06),
      new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent })
    );
    border.position.y = 0.9;
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.8, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.goldAccent, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.06;
    group.add(tag, border, halo);
    group.position.set(charm.pos[0], charm.pos[1], charm.pos[2]);
    scene.add(group);
    return { group, tag, border };
  }

  const activeTornados = [];
  const activeWindWalls = [];
  const activeSlashArcs = [];

  function clearPools() {
    lanternMeshes.forEach((v) => scene.remove(v.group));
    lanternMeshes.clear();
    moteMeshes.forEach((v) => scene.remove(v.group));
    moteMeshes.clear();
    shadeMeshes.forEach((v) => scene.remove(v.group));
    shadeMeshes.clear();
    drifterMeshes.forEach((v) => scene.remove(v.group));
    drifterMeshes.clear();
    charmMeshes.forEach((v) => scene.remove(v.group));
    charmMeshes.clear();
    [activeTornados, activeWindWalls, activeSlashArcs].forEach((list) => {
      while (list.length > 0) {
        const fx = list.pop();
        scene.remove(fx.group);
      }
    });
  }

  // --- Creative Browser Skills: [J] Lốc Xoáy Mini, [K] Tường Gió, [L] Trảm Không ---
  const TORNADO_COOLDOWN_S = 5.0;
  const WINDWALL_COOLDOWN_S = 8.0;
  let tornadoCooldown = 0;
  let windWallCooldown = 0;
  let airSlashHoldTimer = 0;
  let airSlashHoldHeight = 0;
  let skyFlashTimer = 0;

  function hasAirborneEnemy() {
    if (!gameState) return false;
    for (let i = 0; i < gameState.shades.length; i++) {
      if ((gameState.shades[i].airborneTimer || 0) > 0.05) return true;
    }
    return false;
  }

  function castTornado() {
    if (!running || !gameState || gameState.gameState !== 'playing') return;
    if (tornadoCooldown > 0.05) return;
    tornadoCooldown = TORNADO_COOLDOWN_S;
    audio.playTornado();

    const p = gameState.player;
    const ang = p.facingAngle || 0;
    let dirX = Math.sin(ang);
    let dirZ = Math.cos(ang);

    // Gentle forward-cone assist (<= 35 deg) toward nearest Shade within 18m
    let bestAssistDist = 18.0;
    for (let i = 0; i < gameState.shades.length; i++) {
      const s = gameState.shades[i];
      const dx = s.pos[0] - p.pos[0];
      const dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.2 && d < bestAssistDist) {
        const dot = (dx / d) * dirX + (dz / d) * dirZ;
        if (dot >= 0.8) {
          bestAssistDist = d;
          dirX = dx / d;
          dirZ = dz / d;
          p.facingAngle = Math.atan2(dirX, dirZ);
        }
      }
    }

    const group = new THREE.Group();
    const funnelMat = new THREE.MeshBasicMaterial({
      color: 0xa5e8ff,
      transparent: true,
      opacity: 0.55,
      wireframe: true
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xe6fbff,
      transparent: true,
      opacity: 0.42
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 12, 1, true), funnelMat);
    cone.rotation.x = Math.PI;
    cone.position.y = 1.45;
    const innerCone = new THREE.Mesh(new THREE.ConeGeometry(0.65, 2.5, 10), coreMat);
    innerCone.rotation.x = Math.PI;
    innerCone.position.y = 1.35;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.3, 24),
      new THREE.MeshBasicMaterial({ color: 0xc2f2ff, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    group.add(cone, innerCone, ring);

    const startX = p.pos[0] + dirX * 1.1;
    const startZ = p.pos[2] + dirZ * 1.1;
    group.position.set(startX, p.pos[1], startZ);
    scene.add(group);

    activeTornados.push({
      group,
      x: startX,
      y: p.pos[1],
      z: startZ,
      dirX,
      dirZ,
      speed: 16.0,
      age: 0,
      duration: 1.25,
      hitIds: new Set()
    });
    updateHud();
  }

  function castWindWall() {
    if (!running || !gameState || gameState.gameState !== 'playing') return;
    if (windWallCooldown > 0.05) return;
    windWallCooldown = WINDWALL_COOLDOWN_S;
    audio.playWindWall();

    const p = gameState.player;
    const ang = p.facingAngle || 0;
    let dirX = Math.sin(ang);
    let dirZ = Math.cos(ang);

    // Gentle forward-cone assist (<= 35 deg) toward nearest Shade within 18m
    let bestAssistDist = 18.0;
    for (let i = 0; i < gameState.shades.length; i++) {
      const s = gameState.shades[i];
      const dx = s.pos[0] - p.pos[0];
      const dz = s.pos[2] - p.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.2 && d < bestAssistDist) {
        const dot = (dx / d) * dirX + (dz / d) * dirZ;
        if (dot >= 0.8) {
          bestAssistDist = d;
          dirX = dx / d;
          dirZ = dz / d;
          p.facingAngle = Math.atan2(dirX, dirZ);
        }
      }
    }
    const wx = p.pos[0] + dirX * 3.5;
    const wz = p.pos[2] + dirZ * 3.5;

    const group = new THREE.Group();
    const wallMat = new THREE.MeshBasicMaterial({
      color: 0x8be4ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.36
    });
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.2, 0.35), wallMat);
    wallMesh.position.y = 1.6;
    const trimMat = new THREE.MeshBasicMaterial({
      color: PALETTE.goldAccent,
      transparent: true,
      opacity: 0.85
    });
    const topTrim = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.12, 0.42), trimMat);
    topTrim.position.y = 3.2;
    const botTrim = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.12, 0.42), trimMat);
    botTrim.position.y = 0.06;

    const streaks = [];
    for (let i = -3; i <= 3; i++) {
      const sMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 2.8, 0.46),
        new THREE.MeshBasicMaterial({ color: 0xe6fbff, transparent: true, opacity: 0.55 })
      );
      sMesh.position.set(i * 0.95, 1.6, 0);
      group.add(sMesh);
      streaks.push(sMesh);
    }

    group.add(wallMesh, topTrim, botTrim);
    group.position.set(wx, p.pos[1], wz);
    group.rotation.y = ang;
    scene.add(group);

    activeWindWalls.push({
      group,
      wallMat,
      trimMat,
      streaks,
      x: wx,
      y: p.pos[1],
      z: wz,
      nx: dirX,
      nz: dirZ,
      tx: dirZ,
      tz: -dirX,
      halfWidth: 3.6,
      halfThick: 0.85,
      age: 0,
      duration: 4.0
    });
    updateHud();
  }

  function spawnAirSlashVfx(cx, cy, cz) {
    const group = new THREE.Group();
    const mats = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x9ef0ff : PALETTE.goldAccent,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
      });
      const arc = new THREE.Mesh(new THREE.RingGeometry(1.1, 2.0, 20, 1, 0, Math.PI * 1.15), mat);
      arc.rotation.set((i - 1) * 0.55, i * 1.1, i * 0.85);
      group.add(arc);
      mats.push(mat);
    }
    group.position.set(cx, cy, cz);
    scene.add(group);
    activeSlashArcs.push({ group, mats, age: 0, duration: 0.45 });
  }

  function castAirSlash() {
    if (!running || !gameState || gameState.gameState !== 'playing') return;
    const airborneTargets = [];
    for (let i = 0; i < gameState.shades.length; i++) {
      const s = gameState.shades[i];
      if ((s.airborneTimer || 0) > 0.05) {
        airborneTargets.push(s);
      }
    }
    if (airborneTargets.length === 0) return;

    const p = gameState.player;
    airborneTargets.sort((a, b) => sim.distXZ(p.pos, a.pos) - sim.distXZ(p.pos, b.pos));
    const primary = airborneTargets[0];
    const targetAirY = (primary.pos[1] - primary.heightOffset) + (primary.airborneY || 2.8);

    // Dash Mây in mid-air next to the airborne enemy
    let dx = primary.pos[0] - p.pos[0];
    let dz = primary.pos[2] - p.pos[2];
    const d = Math.hypot(dx, dz) || 1;
    p.pos[0] = primary.pos[0] - (dx / d) * 1.4;
    p.pos[2] = primary.pos[2] - (dz / d) * 1.4;
    p.pos[1] = Math.max(p.pos[1], targetAirY - 0.5);
    p.vel[0] = 0;
    p.vel[1] = 0;
    p.vel[2] = 0;
    p.grounded = false;
    p.facingAngle = Math.atan2(dx, dz);

    airSlashHoldTimer = 0.45;
    airSlashHoldHeight = p.pos[1];
    skyFlashTimer = userSettings.reduceMotion ? 0 : 0.18;
    if (!userSettings.reduceMotion) camShakeTimer = 0.22;
    audio.playAirSlash();

    // Perform mid-air wind-light purification slashes on all airborne targets nearby
    for (let i = 0; i < airborneTargets.length; i++) {
      const s = airborneTargets[i];
      if (sim.distXZ(primary.pos, s.pos) <= 6.5) {
        s.state = 'stunned';
        s.stateTicksLeft = Math.max(s.stateTicksLeft, 150);
        s.targetLanternId = null;
        s.drainTicks = 0;
        s.airborneTimer = Math.max(s.airborneTimer, 0.55);
        s.airborneVy = 1.2;
        const px = s.pos[0] - p.pos[0];
        const pz = s.pos[2] - p.pos[2];
        const pd = Math.hypot(px, pz) || 1;
        const nx = s.pos[0] + (px / pd) * 4.5;
        const nz = s.pos[2] + (pz / pd) * 4.5;
        const baseG = s.pos[1] - s.heightOffset;
        if (sim.getGroundHeight(gameState.night, nx, nz, baseG) !== null) {
          s.pos[0] = nx;
          s.pos[2] = nz;
        }
        spawnAirSlashVfx(s.pos[0], baseG + (s.airborneY || 2.5) + 0.8, s.pos[2]);
      }
    }
    hudWhisper.textContent = 'Trảm Không! Mây lao lên không trung xua tan Bóng Mực!';
    updateHud();
  }

  function blockEntityWithWindWall(entityPos, wall, isShade) {
    const dx = entityPos[0] - wall.x;
    const dz = entityPos[2] - wall.z;
    const fwdDist = dx * wall.nx + dz * wall.nz;
    const sideDist = dx * wall.tx + dz * wall.tz;
    if (Math.abs(sideDist) <= wall.halfWidth && Math.abs(fwdDist) < wall.halfThick) {
      const sign = fwdDist >= 0 ? 1 : -1;
      const push = wall.halfThick - Math.abs(fwdDist) + 0.08;
      entityPos[0] += wall.nx * sign * push;
      entityPos[2] += wall.nz * sign * push;
      if (isShade) {
        // Keep vertical offset clean
      }
    }
  }

  function updateCreativeSkills(dt) {
    if (tornadoCooldown > 0) tornadoCooldown = Math.max(0, tornadoCooldown - dt);
    if (windWallCooldown > 0) windWallCooldown = Math.max(0, windWallCooldown - dt);

    // Mid-air hold during [L] Air Slash
    if (airSlashHoldTimer > 0 && gameState) {
      airSlashHoldTimer = Math.max(0, airSlashHoldTimer - dt);
      gameState.player.pos[1] = airSlashHoldHeight;
      gameState.player.vel[1] = 0;
      gameState.player.grounded = false;
    }

    // Update airborne Shades lifted by [J] Mini Tornado
    if (gameState) {
      for (let i = 0; i < gameState.shades.length; i++) {
        const s = gameState.shades[i];
        if ((s.airborneTimer || 0) > 0) {
          s.airborneTimer = Math.max(0, s.airborneTimer - dt);
          s.airborneVy = (s.airborneVy || 0) - 9.5 * dt;
          s.airborneY = Math.max(0, (s.airborneY || 0) + s.airborneVy * dt);
          if (s.airborneTimer === 0) {
            s.airborneY = 0;
            s.airborneVy = 0;
          }
        }
      }
    }

    // Update [J] Mini Tornado projectiles
    for (let i = activeTornados.length - 1; i >= 0; i--) {
      const tor = activeTornados[i];
      tor.age += dt;
      tor.x += tor.dirX * tor.speed * dt;
      tor.z += tor.dirZ * tor.speed * dt;
      tor.group.position.set(tor.x, tor.y, tor.z);
      tor.group.rotation.y += dt * 16;

      if (gameState) {
        for (let sIdx = 0; sIdx < gameState.shades.length; sIdx++) {
          const s = gameState.shades[sIdx];
          if (tor.hitIds.has(s.id)) continue;
          if (Math.hypot(s.pos[0] - tor.x, s.pos[2] - tor.z) <= 2.4) {
            tor.hitIds.add(s.id);
            s.state = 'stunned';
            s.stateTicksLeft = Math.max(s.stateTicksLeft, 120);
            s.targetLanternId = null;
            s.drainTicks = 0;
            s.airborneTimer = 1.9;
            s.airborneY = Math.max(s.airborneY || 0, 0.4);
            s.airborneVy = 8.6;
          }
        }
      }

      if (tor.age >= tor.duration) {
        scene.remove(tor.group);
        tor.group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
        activeTornados.splice(i, 1);
      }
    }

    // Update [K] Wind Walls and block Shades & Drifters
    for (let i = activeWindWalls.length - 1; i >= 0; i--) {
      const w = activeWindWalls[i];
      w.age += dt;
      const fade = Math.min(1, (w.duration - w.age) / 0.6);
      w.wallMat.opacity = 0.36 * fade;
      w.trimMat.opacity = 0.85 * fade;
      for (let k = 0; k < w.streaks.length; k++) {
        w.streaks[k].position.y = 1.6 + Math.sin(elapsedVisual * 10 + k) * 0.25;
      }

      if (gameState) {
        for (let sIdx = 0; sIdx < gameState.shades.length; sIdx++) {
          blockEntityWithWindWall(gameState.shades[sIdx].pos, w, true);
        }
        for (let dIdx = 0; dIdx < gameState.drifters.length; dIdx++) {
          const dr = gameState.drifters[dIdx];
          if (dr.state === 'chase') {
            blockEntityWithWindWall(dr.pos, w, false);
          }
        }
      }

      if (w.age >= w.duration) {
        scene.remove(w.group);
        w.group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
        w.wallMat.dispose();
        w.trimMat.dispose();
        activeWindWalls.splice(i, 1);
      }
    }

    // Update [L] Mid-Air Slash VFX
    for (let i = activeSlashArcs.length - 1; i >= 0; i--) {
      const fx = activeSlashArcs[i];
      fx.age += dt;
      const t = Math.min(1, fx.age / fx.duration);
      fx.group.rotation.y += dt * 14;
      const sc = 1 + t * 0.85;
      fx.group.scale.set(sc, sc, sc);
      for (let m = 0; m < fx.mats.length; m++) {
        fx.mats[m].opacity = (1 - t) * 0.95;
      }
      if (fx.age >= fx.duration) {
        scene.remove(fx.group);
        fx.group.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
        fx.mats.forEach((m) => m.dispose());
        activeSlashArcs.splice(i, 1);
      }
    }
  }

  // --- Campaign & Session State ---
  const audio = new CozyAudio();
  let currentNight = 1;
  let campaignScores = { 1: 0, 2: 0, 3: 0 };
  let wonNights = { 1: false, 2: false, 3: false };
  let campaignSeed = Math.floor(Math.random() * 1000000) + 1;
  let currentNightSeed = campaignSeed;
  let gameState = null;
  let running = false;
  let accumulator = 0;
  let lastTime = performance.now();
  let elapsedVisual = 0;
  let prevLastSecond = -1;
  let settingsReturnTo = 'menu';
  let listeningAction = null;
  let camShakeTimer = 0;
  let subtitleTimer = 0;
  let activeSubtitleText = '';
  let shadeAlertTimer = 0;
  let alertShadeId = null;
  let prevWeakLanternCount = 0;

  let camYaw = 0;
  let camPitch = 0.42;
  let camDist = 14.0;
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  const keys = Object.create(null);
  let jumpQueued = false;
  let interactQueued = false;
  let pulseQueued = false;
  let dashQueued = false;
  let jumpHeld = false;
  let interactHeld = false;
  let pulseHeld = false;
  let dashHeld = false;

  const statsTracker = { deposited: 0, stuns: 0, drainStuns: 0, firstLights: 0, relights: 0 };
  let lastMoteSlotCapacity = 0;

  function showSubtitle(text, seconds) {
    if (!userSettings.subtitles) return;
    activeSubtitleText = (userSettings.colorblind ? '⚠ ' : '') + text;
    subtitleTimer = seconds || 3.5;
  }

  function initHudMoteSlots(cap) {
    const targetCap = cap || 10;
    if (lastMoteSlotCapacity === targetCap && hudMoteSlots.children.length === targetCap) return;
    lastMoteSlotCapacity = targetCap;
    hudMoteSlots.innerHTML = '';
    for (let i = 0; i < targetCap; i++) {
      const slot = document.createElement('div');
      slot.className = 'mote-slot';
      hudMoteSlots.appendChild(slot);
    }
  }
  initHudMoteSlots(10);

  function showOnlyOverlay(target) {
    [menuOverlay, introOverlay, pauseOverlay, settingsOverlay, leaderboardOverlay, endOverlay].forEach((el) => {
      if (el === target) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  }

  function prepareNightIntro(night, resetCampaign) {
    currentNight = night;
    if (resetCampaign) {
      campaignScores = { 1: 0, 2: 0, 3: 0 };
      wonNights = { 1: false, 2: false, 3: false };
      campaignSeed = Math.floor(Math.random() * 1000000) + 1;
    }
    const info = NIGHT_INTROS[night];
    introTitle.textContent = info.title;
    introSubtitle.textContent = info.subtitle;
    introSpeech.textContent = info.speech;
    running = false;
    loadNightPreview(night);
    showOnlyOverlay(introOverlay);
  }

  function loadNightPreview(night) {
    clearPools();
    buildNightEnvironment(night);
    currentNightSeed = campaignSeed + (night - 1);
    gameState = sim.createGame({ seed: currentNightSeed, night: night });
    for (let i = 0; i < gameState.lanterns.length; i++) {
      const l = gameState.lanterns[i];
      lanternMeshes.set(l.id, createLanternVisual(l));
    }
    for (let i = 0; i < gameState.charms.length; i++) {
      const c = gameState.charms[i];
      charmMeshes.set(c.id, createCharmVisual(c));
    }
    camYaw = night === 3 ? Math.PI : 0;
    camPitch = 0.42;
    camDist = night === 3 ? 16.5 : 14.0;
    syncVisuals(0);
    updateHud();
  }

  function beginActiveNight() {
    statsTracker.deposited = 0;
    statsTracker.stuns = 0;
    statsTracker.drainStuns = 0;
    statsTracker.firstLights = 0;
    statsTracker.relights = 0;
    accumulator = 0;
    tornadoCooldown = 0;
    windWallCooldown = 0;
    airSlashHoldTimer = 0;
    skyFlashTimer = 0;
    camShakeTimer = 0;
    subtitleTimer = 0;
    activeSubtitleText = '';
    shadeAlertTimer = 0;
    alertShadeId = null;
    prevWeakLanternCount = 0;
    prevLastSecond = -1;
    jumpQueued = interactQueued = pulseQueued = dashQueued = false;
    running = true;
    showOnlyOverlay(null);
    audio.startAmbientMusic();
    hudNightTitle.textContent = NIGHT_INTROS[currentNight].title;
    hudWhisper.textContent = NIGHT_INTROS[currentNight].speech;
    updateHud();
  }

  function togglePause() {
    if (!gameState || gameState.gameState === 'won' || gameState.gameState === 'lost') return;
    if (gameState.gameState === 'playing') {
      sim.step(gameState, { pause: true });
      running = false;
      pauseSubtitle.textContent = NIGHT_INTROS[currentNight].title;
      showOnlyOverlay(pauseOverlay);
    } else if (gameState.gameState === 'paused') {
      sim.step(gameState, { pause: true });
      running = true;
      showOnlyOverlay(null);
    }
  }

  function projectEdgeIndicator(worldPos, offsetY, el, iconEl, labelEl, labelText, forceEdgeOnScreen) {
    const v = new THREE.Vector3(worldPos[0], worldPos[1] + offsetY, worldPos[2]);
    v.project(camera);
    const onScreen = v.z < 1.0 && Math.abs(v.x) <= 0.92 && Math.abs(v.y) <= 0.88;
    if (onScreen && !forceEdgeOnScreen) {
      el.style.display = 'none';
      return;
    }
    let nx = v.x;
    let ny = v.y;
    if (v.z >= 1.0) {
      nx = -nx;
      ny = -ny;
    }
    const maxCoord = Math.max(Math.abs(nx), Math.abs(ny)) || 1;
    nx = (nx / maxCoord) * 0.86;
    ny = (ny / maxCoord) * 0.78;
    const screenX = Math.max(95, Math.min(window.innerWidth - 95, (nx * 0.5 + 0.5) * window.innerWidth));
    const screenY = Math.max(138, Math.min(window.innerHeight - 155, (-ny * 0.5 + 0.5) * window.innerHeight));
    const angleDeg = (Math.atan2(-ny, nx) * 180) / Math.PI;
    el.style.display = 'flex';
    el.style.left = Math.round(screenX) + 'px';
    el.style.top = Math.round(screenY) + 'px';
    iconEl.style.transform = 'rotate(' + angleDeg + 'deg)';
    labelEl.textContent = labelText;
  }

  function updateOffscreenArrow() {
    if (!gameState || !running || IS_BENCH) {
      lanternArrow.style.display = 'none';
      shadeArrow.style.display = 'none';
      return;
    }
    let nearest = null;
    let bestD = Infinity;
    for (let i = 0; i < gameState.lanterns.length; i++) {
      const l = gameState.lanterns[i];
      const isWeakLit = l.lit && l.fuelUnits < 1800;
      if (l.lit && !isWeakLit) continue;
      const d = sim.dist3D(gameState.player.pos, l.pos);
      if (d < bestD) {
        bestD = d;
        nearest = l;
      }
    }
    if (!nearest) {
      lanternArrow.style.display = 'none';
    } else {
      const tag = nearest.lit ? (' (' + Math.round(nearest.fuelUnits / 60) + '% dầu)') : (' (' + Math.round(bestD) + 'm)');
      projectEdgeIndicator(nearest.pos, 2.5, lanternArrow, lanternArrowIcon, lanternArrowLabel, nearest.id + tag, false);
    }

    // Off-screen / spawn indicator arrow for newly spawned Bóng Mực (accessibility cue)
    if (userSettings.subtitles && shadeAlertTimer > 0 && alertShadeId) {
      const spawned = gameState.shades.find((s) => s.id === alertShadeId);
      if (spawned) {
        const sd = Math.round(sim.distXZ(gameState.player.pos, spawned.pos));
        projectEdgeIndicator(spawned.pos, 1.0, shadeArrow, shadeArrowIcon, shadeArrowLabel, 'Bóng Mực ' + spawned.id + ' (' + sd + 'm)', true);
      } else {
        shadeArrow.style.display = 'none';
      }
    } else {
      shadeArrow.style.display = 'none';
    }
  }

  function updateHud() {
    if (!gameState) return;
    const p = gameState.player;
    const t = gameState.tuning;
    const snap = sim.getSnapshot(gameState);
    const currentCapacity = snap.player.capacity;

    // Flames
    hudFlames.innerHTML = '';
    for (let i = 0; i < t.flames; i++) {
      const pip = document.createElement('div');
      pip.className = i < p.flames ? 'flame-pip' : 'flame-pip extinguished';
      hudFlames.appendChild(pip);
    }

    // Wind charm active pill
    if (p.charmTicks > 0) {
      hudCharmPill.classList.remove('hidden');
      hudCharmS.textContent = (p.charmTicks / 60).toFixed(1) + 's';
    } else {
      hudCharmPill.classList.add('hidden');
    }

    // Night 3 Strong Wind indicator
    if (gameState.wind.active) {
      hudWindPill.classList.remove('hidden');
      hudWindPill.textContent = 'Gió mạnh (' + gameState.wind.dir_deg + '°)';
    } else if (gameState.windWarning) {
      hudWindPill.classList.remove('hidden');
      hudWindPill.textContent = (userSettings.colorblind ? '⚠ ' : '') + 'Sắp có gió mạnh!';
    } else {
      hudWindPill.classList.add('hidden');
    }

    // Low fuel / draining warning pill + low-fuel transition subtitle
    const anyDraining = gameState.shades.some((s) => s.state === 'drain');
    const weakLanterns = gameState.lanterns.filter((l) => l.lit && l.fuelUnits < 1800);
    if (weakLanterns.length > prevWeakLanternCount) {
      const ids = weakLanterns.map((l) => l.id).join(', ');
      showSubtitle('Đèn ' + ids + ' yếu (<30% dầu) — mất vùng an toàn!', 3.8);
    }
    prevWeakLanternCount = weakLanterns.length;

    if (anyDraining || weakLanterns.length > 0) {
      hudLowFuelPill.classList.remove('hidden');
      const prefix = userSettings.colorblind ? '⚠ ' : '';
      hudLowFuelPill.textContent = anyDraining ? (prefix + 'Bóng Mực đang hút dầu!') : (prefix + 'Có đèn sắp cạn dầu (<30%)');
    } else {
      hudLowFuelPill.classList.add('hidden');
    }

    // Timer mm:ss (turns danger color & blinks <= 30 s) + 10 s final subtitle
    const secTotal = Math.ceil(gameState.timeLeftS);
    const mins = Math.floor(secTotal / 60);
    const secs = secTotal % 60;
    const timerStr = String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    const isTimerDanger = secTotal <= 30;
    hudTimer.textContent = (isTimerDanger && userSettings.colorblind ? '⚠ ' : '') + timerStr;
    hudTimer.classList.toggle('danger', isTimerDanger);
    if (running && gameState.gameState === 'playing' && secTotal <= 10 && secTotal > 0 && secTotal !== prevLastSecond) {
      prevLastSecond = secTotal;
      audio.playCountdownTick();
    }

    // Visual Subtitles Banner (Bóng Mực spawn, gió sắp thổi, 10 s cuối, đèn <30)
    if (userSettings.subtitles && running && gameState.gameState === 'playing') {
      const cbPrefix = userSettings.colorblind ? '⚠ ' : '';
      if (secTotal <= 10 && secTotal > 0) {
        hudSubtitles.textContent = cbPrefix + '10 giây cuối trước bình minh (' + secTotal + 's)!';
        hudSubtitles.classList.remove('hidden');
      } else if (subtitleTimer > 0 && activeSubtitleText) {
        hudSubtitles.textContent = activeSubtitleText;
        hudSubtitles.classList.remove('hidden');
      } else if (gameState.windWarning) {
        hudSubtitles.textContent = cbPrefix + 'Gió mạnh sắp thổi trên Đảo Chuông!';
        hudSubtitles.classList.remove('hidden');
      } else if (weakLanterns.length > 0) {
        hudSubtitles.textContent = cbPrefix + 'Đèn ' + weakLanterns.map((l) => l.id).join(', ') + ' sắp cạn dầu (<30%)!';
        hudSubtitles.classList.remove('hidden');
      } else {
        hudSubtitles.classList.add('hidden');
      }
    } else {
      hudSubtitles.classList.add('hidden');
    }

    // Lantern count lit / total (with required dawn count) & score
    const litCount = gameState.lanterns.filter((l) => l.lit).length;
    const requiredLit = Math.ceil(t.win_ratio * gameState.lanterns.length - 1e-9);
    hudLanternCount.textContent = litCount + '/' + gameState.lanterns.length + ' (Cần ' + requiredLit + ')';
    hudScore.textContent = String(gameState.score);

    // Progressive Firefly capacity slots
    initHudMoteSlots(currentCapacity);
    hudCarried.textContent = p.carried + '/' + currentCapacity;
    const slots = hudMoteSlots.children;
    for (let i = 0; i < slots.length; i++) {
      slots[i].classList.toggle('filled', i < p.carried);
    }

    // Cooldown icons
    if (p.charmTicks > 0) {
      hudDashCd.textContent = 'Không hồi chiêu!';
      skillDashBox.classList.remove('cooldown');
    } else if (p.dashCooldownTicks > 0) {
      hudDashCd.textContent = (p.dashCooldownTicks / 60).toFixed(1) + 's';
      skillDashBox.classList.add('cooldown');
    } else {
      hudDashCd.textContent = 'Sẵn sàng';
      skillDashBox.classList.remove('cooldown');
    }

    if (p.pulseCooldownTicks > 0) {
      hudPulseCd.textContent = (p.pulseCooldownTicks / 60).toFixed(1) + 's';
      skillPulseBox.classList.add('cooldown');
    } else if (p.carried < t.pulse_cost) {
      hudPulseCd.textContent = 'Cần ' + t.pulse_cost;
      skillPulseBox.classList.add('cooldown');
    } else {
      hudPulseCd.textContent = 'Sẵn sàng (-3)';
      skillPulseBox.classList.remove('cooldown');
    }

    if (tornadoCooldown > 0.05) {
      hudTornadoCd.textContent = tornadoCooldown.toFixed(1) + 's';
      skillTornadoBox.classList.add('cooldown');
    } else {
      hudTornadoCd.textContent = 'Sẵn sàng';
      skillTornadoBox.classList.remove('cooldown');
    }

    if (windWallCooldown > 0.05) {
      hudWindWallCd.textContent = windWallCooldown.toFixed(1) + 's';
      skillWindWallBox.classList.add('cooldown');
    } else {
      hudWindWallCd.textContent = 'Sẵn sàng';
      skillWindWallBox.classList.remove('cooldown');
    }

    if (hasAirborneEnemy()) {
      hudAirSlashCd.textContent = 'Sẵn sàng!';
      skillAirSlashBox.classList.remove('cooldown');
      skillAirSlashBox.classList.add('ready-glow');
    } else {
      hudAirSlashCd.textContent = 'Chờ hất tung';
      skillAirSlashBox.classList.add('cooldown');
      skillAirSlashBox.classList.remove('ready-glow');
    }

    // Interact prompt near unlit/relightable or non-full lit lantern
    let nearbyLantern = null;
    let bestDist = Infinity;
    for (let i = 0; i < gameState.lanterns.length; i++) {
      const l = gameState.lanterns[i];
      if (l.lit && l.fuelUnits >= 5940) continue;
      const d = sim.distXZ(p.pos, l.pos);
      if (d <= t.interact_radius && Math.abs(p.pos[1] - l.pos[1]) <= 1.5 && d < bestDist) {
        bestDist = d;
        nearbyLantern = l;
      }
    }
    if (nearbyLantern) {
      const interactKeyLabel = formatKeyLabel(userSettings.keybinds.interact);
      if (!nearbyLantern.lit) {
        const reqCost = nearbyLantern.everLit ? t.relight_cost : t.lantern_cost;
        const label = nearbyLantern.everLit ? 'Thắp lại' : 'Nạp ánh sáng';
        hudPrompt.textContent = interactKeyLabel + ' — ' + label + ' (' + nearbyLantern.deposited + '/' + reqCost + ')';
      } else {
        const fuelVal = Math.round(nearbyLantern.fuelUnits / 60);
        const needMotes = Math.ceil((100 - fuelVal) / 10);
        hudPrompt.textContent = interactKeyLabel + ' — Châm dầu (' + fuelVal + '% · tối đa +' + needMotes + ' đom đóm)';
      }
      hudPrompt.classList.add('visible');
    } else {
      hudPrompt.classList.remove('visible');
    }
  }

  function getCampaignLeaderboardSummary() {
    let wonScore = 0;
    let nightsWon = 0;
    for (let n = 1; n <= 3; n++) {
      if (wonNights[n]) {
        nightsWon += 1;
        wonScore += campaignScores[n] || 0;
      }
    }
    return { score: wonScore, nights_won: nightsWon, seed: currentNightSeed };
  }

  function showGameOver(reason) {
    running = false;
    lanternArrow.style.display = 'none';
    shadeArrow.style.display = 'none';
    const won = gameState.gameState === 'won';
    const t = gameState.tuning;
    const litCount = gameState.lanterns.filter((l) => l.lit).length;
    const requiredLit = Math.ceil(t.win_ratio * gameState.lanterns.length - 1e-9);

    if (won) {
      audio.playWin();
      wonNights[currentNight] = true;
      campaignScores[currentNight] = gameState.score;
      const summary = getCampaignLeaderboardSummary();
      const totalCampaign = summary.score;

      if (currentNight < 3) {
        endTitle.textContent = NIGHT_INTROS[currentNight].title + ' — Đã Qua Đêm!';
        endSubtitle.textContent = 'Giữ sáng ' + litCount + '/' + gameState.lanterns.length + ' đèn tới bình minh';
        endStory.textContent = 'Ánh đèn vàng ấm trụ vững tới sáng. Hãy sẵn sàng bước sang Đêm tiếp theo!';
        btnNextNight.classList.remove('hidden');
        btnRetryNight.className = 'btn-secondary';
        lbSaveBox.classList.add('hidden');
      } else {
        endTitle.textContent = 'Bình Minh Đã Đến!';
        endSubtitle.textContent = 'Chúc mừng — Giữ đảo sáng qua cả 3 Đêm!';
        endStory.textContent =
          'Ánh sáng vàng ấm tràn ngập Đảo Bến, Đảo Cau và Đảo Chuông tới bình minh. Ông Đăng và Cụ Đò mỉm cười đón ánh nắng cùng Mây!';
        btnNextNight.classList.add('hidden');
        btnRetryNight.className = 'btn-primary';
        lbSaveBox.classList.remove('hidden');
      }

      let dawnLanternBonus = 0;
      for (let i = 0; i < gameState.lanterns.length; i++) {
        if (gameState.lanterns[i].lit) {
          dawnLanternBonus += 50 + Math.floor(gameState.lanterns[i].fuelUnits / 60);
        }
      }
      const flameBonus = gameState.player.flames * t.score.per_flame_left;
      const stunScore = statsTracker.stuns * t.score.per_stun + statsTracker.drainStuns * 10;
      endBreakdown.innerHTML =
        '<span>Đom đóm đã nạp / châm dầu (' + statsTracker.deposited + ')</span><strong>+' + (statsTracker.deposited * t.score.per_mote) + '</strong>' +
        '<span>Thắp lần đầu (' + statsTracker.firstLights + ')</span><strong>+' + (statsTracker.firstLights * t.score.per_lantern) + '</strong>' +
        '<span>Thắp lại (' + statsTracker.relights + ')</span><strong>+' + (statsTracker.relights * 40) + '</strong>' +
        '<span>Tỏa Sáng trúng Bóng Mực (' + statsTracker.stuns + ')</span><strong>+' + stunScore + '</strong>' +
        '<span>Thưởng bình minh đèn sáng (' + litCount + ')</span><strong>+' + dawnLanternBonus + '</strong>' +
        '<span>Thưởng Ngọn Lửa còn lại (' + gameState.player.flames + ')</span><strong>+' + flameBonus + '</strong>' +
        '<span class="score-total">Điểm Đêm ' + currentNight + '</span><strong class="score-total">' + gameState.score + '</strong>' +
        '<span>Tổng điểm các Đêm thắng (' + summary.nights_won + '/3)</span><strong>' + totalCampaign + '</strong>';
    } else {
      audio.playLose();
      btnNextNight.classList.add('hidden');
      btnRetryNight.className = 'btn-primary';
      lbSaveBox.classList.remove('hidden');
      const dashKeyLabel = formatKeyLabel(userSettings.keybinds.dash);
      const pulseKeyLabel = formatKeyLabel(userSettings.keybinds.pulse);
      endTitle.textContent = reason === 'no_flames' ? 'Ngọn Lửa Đã Tắt...' : 'Bình Minh Đến Chưa Đủ Đèn!';
      endSubtitle.textContent = NIGHT_INTROS[currentNight].title + ' — Thất bại';
      endStory.textContent = reason === 'no_flames'
        ? ('Mây đã mất hết 3 Ngọn Lửa. Hãy tận dụng Lướt [' + dashKeyLabel + '], Tỏa Sáng [' + pulseKeyLabel + '] và vùng sáng quanh Đèn đang sáng!')
        : ('Bình minh tới nhưng chỉ có ' + litCount + '/' + gameState.lanterns.length + ' đèn sáng (cần tối thiểu ' + requiredLit + '). Hãy châm dầu và thắp lại kịp lúc!');
      const summary = getCampaignLeaderboardSummary();
      endBreakdown.innerHTML =
        '<span>Điểm đạt được trong Đêm</span><strong>' + gameState.score + '</strong>' +
        '<span>Tổng điểm lưu bảng xếp hạng (' + summary.nights_won + ' Đêm thắng)</span><strong>' + summary.score + '</strong>';
    }

    if (!lbSaveBox.classList.contains('hidden')) {
      btnSaveScore.disabled = false;
      lbSaveMsg.classList.add('hidden');
      lbSaveMsg.textContent = '';
    }
    showOnlyOverlay(endOverlay);
  }

  function handleSimEvents(events, preShadeStates) {
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.name === 'mote_picked') {
        audio.playPickup(ev.data.carried);
      } else if (ev.name === 'deposit' || ev.name === 'refuel') {
        statsTracker.deposited += ev.data.amount;
        audio.playDeposit();
      } else if (ev.name === 'lantern_lit') {
        if (ev.data.relight) statsTracker.relights += 1;
        else statsTracker.firstLights += 1;
        audio.playLanternLit();
      } else if (ev.name === 'lantern_out') {
        audio.playHit();
        const msg = 'Đèn ' + ev.data.lantern_id + ' đã cạn dầu! Chỉ cần 5 đom đóm để thắp lại.';
        hudWhisper.textContent = (userSettings.colorblind ? '⚠ ' : '') + msg;
        showSubtitle(msg, 3.5);
      } else if (ev.name === 'fuel_drain') {
        hudWhisper.textContent = (userSettings.colorblind ? '⚠ ' : '') + 'Bóng Mực ' + ev.data.shade_id + ' đang hút dầu Đèn ' + ev.data.lantern_id + ' (' + ev.data.fuel + '%)!';
      } else if (ev.name === 'pulse') {
        statsTracker.stuns += ev.data.stunned_ids.length;
        if (preShadeStates) {
          for (let k = 0; k < ev.data.stunned_ids.length; k++) {
            if (preShadeStates[ev.data.stunned_ids[k]] === 'drain') {
              statsTracker.drainStuns += 1;
            }
          }
        }
        audio.playPulse();
      } else if (ev.name === 'dash') {
        audio.playDash();
      } else if (ev.name === 'charm_picked') {
        audio.playCharm();
        hudWhisper.textContent = 'Bùa Gió kích hoạt 10 giây: chạy nhanh 7.2 m/s & Lướt không hồi chiêu!';
      } else if (ev.name === 'shade_spawned') {
        audio.playShadeSpawn();
        alertShadeId = ev.data.id;
        shadeAlertTimer = 5.0;
        showSubtitle('Bóng Mực ' + ev.data.id + ' vừa xuất hiện!', 4.0);
      } else if (ev.name === 'drifter_steal') {
        audio.playHit();
        hudWhisper.textContent = 'Gió Lạc vừa cướp ' + ev.data.amount + ' đom đóm! Dùng Tỏa Sáng đánh trúng nó để lấy lại!';
      } else if (ev.name === 'player_hit') {
        audio.playHit();
        if (!userSettings.reduceMotion) {
          camShakeTimer = 0.28;
          damageFlash.style.opacity = '1';
          setTimeout(() => { damageFlash.style.opacity = '0'; }, 240);
        }
      } else if (ev.name === 'game_over') {
        showGameOver(ev.data.reason);
      }
    }
  }

  let wasWindWarning = false;

  function syncVisuals(dt) {
    if (!gameState) return;
    elapsedVisual += dt;

    const p = gameState.player;
    playerVis.group.visible = p.respawnTicks === 0;
    playerVis.group.position.set(p.pos[0], p.pos[1], p.pos[2]);
    playerVis.group.rotation.y = p.facingAngle;

    const speedH = Math.hypot(p.vel[0], p.vel[2]);
    const isMoving = speedH > 0.3;
    playerVis.bodyGroup.position.y = isMoving && p.grounded ? Math.abs(Math.sin(elapsedVisual * 12)) * 0.1 : 0;
    playerVis.lanternPivot.rotation.x = p.dashTicks > 0 ? 0.55 : (isMoving ? 0.28 + Math.sin(elapsedVisual * 11) * 0.16 : Math.sin(elapsedVisual * 2.5) * 0.06);
    playerVis.playerLight.intensity = 1.6 + Math.min(p.carried, 10) * 0.2;
    playerVis.charmAuraMat.opacity = p.charmTicks > 0 ? 0.55 + Math.sin(elapsedVisual * 8) * 0.2 : 0;

    if (p.invulnTicks > 0) {
      playerVis.bodyGroup.visible = Math.floor(elapsedVisual * 16) % 2 === 0;
    } else {
      playerVis.bodyGroup.visible = true;
    }

    if (gameState.pulseVisualTimer > 0) {
      const prog = 1 - gameState.pulseVisualTimer / 0.6;
      const radScale = 1 + prog * (gameState.tuning.pulse_radius * 1.15);
      playerVis.pulseRing.position.set(gameState.lastPulsePos[0], gameState.lastPulsePos[1] + 0.15, gameState.lastPulsePos[2]);
      playerVis.pulseRing.scale.set(radScale, radScale, 1);
      playerVis.pulseRingMat.opacity = (1 - prog) * 0.85;
    } else {
      playerVis.pulseRingMat.opacity = 0;
    }

    // Lanterns + Ambient Intensity + 1 Hz Low-Fuel Blink + Squash/Torn-Paper Unlit State
    const blink1Hz = Math.sin(elapsedVisual * Math.PI * 2) >= 0;
    let litCount = 0;
    for (let i = 0; i < gameState.lanterns.length; i++) {
      const l = gameState.lanterns[i];
      const vis = lanternMeshes.get(l.id);
      if (!vis) continue;
      if (l.lit) {
        litCount += 1;
        const isWeak = l.fuelUnits < 1800;
        const fuelFrac = Math.max(0.01, Math.min(1, l.fuelUnits / 6000));
        vis.headGroup.scale.set(1, 1, 1);
        vis.tearGroup.visible = false;
        vis.fuelBarGroup.visible = true;
        vis.fuelBarGroup.quaternion.copy(camera.quaternion);
        vis.fuelFill.scale.x = fuelFrac;
        vis.fuelFill.position.x = -0.71 * (1 - fuelFrac);

        if (isWeak) {
          const dangerHex = userSettings.colorblind ? 0xffffff : PALETTE.dangerUi;
          vis.fuelFillMat.color.setHex(dangerHex);
          vis.fuelFillMat.opacity = blink1Hz ? 0.98 : 0.28;
          vis.coreMat.color.setHex(blink1Hz ? PALETTE.lanternCore : PALETTE.lanternLit);
          vis.coreMat.emissive.setHex(PALETTE.lanternLit);
          vis.coreMat.emissiveIntensity = blink1Hz ? 1.85 : 0.55;
          vis.pointLight.intensity = blink1Hz ? 2.8 : 0.9;
          vis.safeRingMat.opacity = 0;
          vis.safeDiscMat.opacity = 0;
        } else {
          vis.fuelFillMat.color.setHex(PALETTE.lanternCore);
          vis.fuelFillMat.opacity = 0.96;
          vis.coreMat.color.setHex(PALETTE.lanternCore);
          vis.coreMat.emissive.setHex(PALETTE.lanternLit);
          vis.coreMat.emissiveIntensity = 1.85 + Math.sin(elapsedVisual * 4 + i) * 0.16;
          vis.pointLight.intensity = 3.2;
          vis.safeRingMat.opacity = 0.52;
          vis.safeDiscMat.opacity = 0.08;
        }
      } else {
        // Non-color distinction: squashed 20% vertically + dark torn-paper marks
        vis.headGroup.scale.set(1.06, 0.8, 1.06);
        vis.tearGroup.visible = true;
        vis.fuelBarGroup.visible = false;
        vis.coreMat.color.setHex(PALETTE.lanternOff);
        vis.coreMat.emissive.setHex(0x1a1c28);
        const reqCost = l.everLit ? gameState.tuning.relight_cost : gameState.tuning.lantern_cost;
        vis.coreMat.emissiveIntensity = 0.35 + (l.deposited / reqCost) * 0.7;
        vis.pointLight.intensity = l.deposited > 0 ? 0.5 : 0;
        vis.safeRingMat.opacity = 0;
        vis.safeDiscMat.opacity = 0;
      }
      const reqCostPip = l.everLit ? gameState.tuning.relight_cost : gameState.tuning.lantern_cost;
      for (let k = 0; k < vis.pips.length; k++) {
        const pip = vis.pips[k];
        pip.mesh.visible = !l.lit && k < reqCostPip;
        if (pip.mesh.visible) {
          const angle = elapsedVisual * 1.3 + (k / reqCostPip) * Math.PI * 2;
          pip.mesh.position.set(Math.cos(angle) * 0.88, 2.75 + Math.sin(elapsedVisual * 3 + k) * 0.06, Math.sin(angle) * 0.88);
          pip.mat.color.setHex(k < l.deposited ? PALETTE.lanternCore : PALETTE.lanternOff);
        }
      }
    }

    const totalLanterns = gameState.lanterns.length || 1;
    hemiLight.intensity = 0.15 + 0.55 * (litCount / totalLanterns);
    if (cloudsRingGroup) cloudsRingGroup.rotation.y += dt * 0.02;

    // Night 3 Wind Leaves VFX & Warning SFX + Subtitle
    if (gameState.windWarning && !wasWindWarning) {
      audio.playWindWarning();
      showSubtitle('Gió mạnh sắp thổi (' + gameState.wind.dir_deg + '°)!', 4.0);
    }
    wasWindWarning = gameState.windWarning;
    if (windLeavesGroup) {
      const showLeaves = gameState.windWarning || gameState.wind.active;
      windLeavesGroup.visible = showLeaves;
      if (showLeaves) {
        const wRad = (gameState.wind.dir_deg * Math.PI) / 180;
        const leafSpeed = gameState.wind.active ? 22 : 9;
        const vx = Math.cos(wRad) * leafSpeed * dt;
        const vz = Math.sin(wRad) * leafSpeed * dt;
        windLeavesGroup.children.forEach((leaf) => {
          leaf.position.x += vx;
          leaf.position.z += vz;
          leaf.rotation.y += dt * 5;
          if (leaf.position.x > 45) leaf.position.x -= 90;
          if (leaf.position.x < -45) leaf.position.x += 90;
          if (leaf.position.z > 45) leaf.position.z -= 90;
          if (leaf.position.z < -45) leaf.position.z += 90;
        });
      }
    }

    // Motes sync (reuse Set cleanly to eliminate per-frame allocations)
    syncVisuals._moteIds = syncVisuals._moteIds || new Set();
    const activeMoteIds = syncVisuals._moteIds;
    activeMoteIds.clear();
    for (let i = 0; i < gameState.motes.length; i++) {
      const m = gameState.motes[i];
      if (!IS_BENCH) activeMoteIds.add(m.id);
      let vis = moteMeshes.get(m.id);
      if (!vis) {
        vis = createMoteVisual(m);
        moteMeshes.set(m.id, vis);
      }
      vis.group.position.set(m.pos[0], m.pos[1], m.pos[2]);
      const floatY = 0.72 + Math.sin(elapsedVisual * 3.6 + i * 1.1) * 0.2;
      vis.core.position.y = floatY;
      vis.glow.position.y = floatY;
      if (m.kind === 'dropped' && m.ttlTicks <= 120) {
        vis.group.visible = Math.floor(elapsedVisual * 14) % 2 === 0;
      } else {
        vis.group.visible = true;
      }
    }
    if (moteMeshes.size !== gameState.motes.length) {
      moteMeshes.forEach((vis, id) => {
        if (!activeMoteIds.has(id)) {
          scene.remove(vis.group);
          moteMeshes.delete(id);
        }
      });
    }

    // Shades sync (pooled shared materials per state)
    syncVisuals._shadeIds = syncVisuals._shadeIds || new Set();
    const activeShadeIds = syncVisuals._shadeIds;
    activeShadeIds.clear();
    syncShadePoolColors(getShadeRimHex());
    shadeMatPool.drain.outer.opacity = 0.58 + Math.sin(elapsedVisual * 10) * 0.12;
    const shadeLerp = dt > 0 ? Math.min(1, dt * 18) : 1;
    for (let i = 0; i < gameState.shades.length; i++) {
      const s = gameState.shades[i];
      if (!IS_BENCH) activeShadeIds.add(s.id);
      let vis = shadeMeshes.get(s.id);
      if (!vis) {
        vis = createShadeVisual(s);
        shadeMeshes.set(s.id, vis);
      }
      const targetGroundY = s.pos[1] - s.heightOffset;
      const airOffset = s.airborneY || 0;
      vis.group.position.x += (s.pos[0] - vis.group.position.x) * shadeLerp;
      vis.group.position.z += (s.pos[2] - vis.group.position.z) * shadeLerp;
      vis.group.position.y = targetGroundY + airOffset + Math.sin(elapsedVisual * 4.2 + i) * 0.1;
      vis.group.rotation.y = airOffset > 0.1 ? (vis.group.rotation.y + dt * 12) : s.facingAngle;

      if (s.state === 'spawning') {
        const sc = Math.max(0.25, 1 - s.stateTicksLeft / 60);
        vis.group.scale.set(sc, sc, sc);
      } else if (vis.group.scale.x !== 1) {
        vis.group.scale.set(1, 1, 1);
      }

      const stateKey = s.state === 'stunned'
        ? (airOffset > 0.1 ? 'stunnedAir' : 'stunned')
        : (s.state === 'drain' ? 'drain' : (s.state === 'recoil' ? 'recoil' : 'normal'));
      if (vis.lastStateKey !== stateKey) {
        vis.lastStateKey = stateKey;
        const mset = shadeMatPool[stateKey];
        vis.outerOrb.material = mset.outer;
        vis.coreOrb.material = mset.body;
        vis.eyesMesh.material = mset.eye;
        vis.stunRing.visible = s.state === 'stunned';
        vis.drainAura.visible = s.state === 'drain';
      }
      if (s.state === 'stunned') {
        vis.stunRing.rotation.y += dt * 5;
      } else if (s.state === 'drain') {
        const auraScale = 1 + Math.sin(elapsedVisual * 8) * 0.15;
        vis.drainAura.scale.set(auraScale, auraScale, 1);
      }
    }
    if (shadeMeshes.size !== gameState.shades.length) {
      shadeMeshes.forEach((vis, id) => {
        if (!activeShadeIds.has(id)) {
          scene.remove(vis.group);
          shadeMeshes.delete(id);
        }
      });
    }

    // Drifters sync
    for (let i = 0; i < gameState.drifters.length; i++) {
      const d = gameState.drifters[i];
      let vis = drifterMeshes.get(d.id);
      if (d.state === 'removed') {
        if (vis) {
          scene.remove(vis.group);
          drifterMeshes.delete(d.id);
        }
        continue;
      }
      if (!vis) {
        vis = createDrifterVisual(d);
        drifterMeshes.set(d.id, vis);
      }
      vis.group.position.set(d.pos[0], d.pos[1] + Math.sin(elapsedVisual * 5 + i) * 0.25, d.pos[2]);
      vis.silkMat.color.setHex(d.stolen > 0 ? PALETTE.goldAccent : PALETTE.drifter);
      for (let sIdx = 0; sIdx < vis.segments.length; sIdx++) {
        vis.segments[sIdx].position.y = Math.sin(elapsedVisual * 8 + sIdx * 0.9) * 0.16;
      }
    }

    // Charms sync
    for (let i = 0; i < gameState.charms.length; i++) {
      const c = gameState.charms[i];
      let vis = charmMeshes.get(c.id);
      if (!vis) {
        vis = createCharmVisual(c);
        charmMeshes.set(c.id, vis);
      }
      vis.group.visible = c.available;
      if (c.available) {
        vis.tag.rotation.y += dt * 2.4;
        vis.border.rotation.y = vis.tag.rotation.y;
      }
    }

    if (shadeAlertTimer > 0) shadeAlertTimer = Math.max(0, shadeAlertTimer - dt);
    if (subtitleTimer > 0) subtitleTimer = Math.max(0, subtitleTimer - dt);
    if (camShakeTimer > 0) camShakeTimer = Math.max(0, camShakeTimer - dt);

    // Skill Flash (suppressed in reduce-motion mode)
    if (!userSettings.reduceMotion && skyFlashTimer > 0) {
      skyFlashTimer = Math.max(0, skyFlashTimer - dt);
      const amt = skyFlashTimer / 0.25;
      scene.background.setHex(PALETTE.skyNight).lerp(new THREE.Color(0x88b4ff), amt * 0.45);
      hemiLight.intensity += amt * 1.2;
    } else {
      skyFlashTimer = 0;
      scene.background.setHex(PALETTE.skyNight);
    }

    // Camera follow (skipped during bench orbit; shake suppressed when reduceMotion is ON)
    if (!IS_BENCH) {
      let sx = 0;
      let sy = 0;
      if (!userSettings.reduceMotion && camShakeTimer > 0) {
        const amp = (camShakeTimer / 0.28) * 0.35;
        sx = Math.sin(elapsedVisual * 55) * amp;
        sy = Math.cos(elapsedVisual * 47) * amp * 0.7;
      }
      const camX = p.pos[0] + Math.sin(camYaw) * Math.cos(camPitch) * camDist + sx;
      const camZ = p.pos[2] + Math.cos(camYaw) * Math.cos(camPitch) * camDist;
      const camY = p.pos[1] + 1.4 + Math.sin(camPitch) * camDist + sy;
      camera.position.set(camX, camY, camZ);
      camera.lookAt(p.pos[0], p.pos[1] + 1.15, p.pos[2]);
      updateOffscreenArrow();
    }
  }

  function isKeyBoundToAction(code) {
    const kb = userSettings.keybinds;
    return Object.keys(kb).some((act) => kb[act] === code);
  }

  function buildBrowserInputFrame(dt) {
    if (keys['KeyZ'] && !isKeyBoundToAction('KeyZ')) camYaw += 1.9 * userSettings.sensitivity * dt;
    if (keys['KeyX'] && !isKeyBoundToAction('KeyX')) camYaw -= 1.9 * userSettings.sensitivity * dt;

    const kb = userSettings.keybinds;
    let fwd = 0;
    let right = 0;
    if (keys[kb.moveUp] || (!isKeyBoundToAction('ArrowUp') && keys['ArrowUp'])) fwd += 1;
    if (keys[kb.moveDown] || (!isKeyBoundToAction('ArrowDown') && keys['ArrowDown'])) fwd -= 1;
    if (keys[kb.moveRight] || (!isKeyBoundToAction('ArrowRight') && keys['ArrowRight'])) right += 1;
    if (keys[kb.moveLeft] || (!isKeyBoundToAction('ArrowLeft') && keys['ArrowLeft'])) right -= 1;

    const fwdX = -Math.sin(camYaw);
    const fwdZ = -Math.cos(camYaw);
    const rightX = Math.cos(camYaw);
    const rightZ = -Math.sin(camYaw);

    let mx = right * rightX + fwd * fwdX;
    let mz = right * rightZ + fwd * fwdZ;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }

    const wantJump = jumpHeld || jumpQueued;
    const wantInteract = interactHeld || interactQueued;
    const wantPulse = pulseHeld || pulseQueued;
    const wantDash = dashHeld || dashQueued;
    jumpQueued = interactQueued = pulseQueued = dashQueued = false;

    return {
      move: [mx, mz],
      cam_yaw_deg: 0,
      jump: wantJump,
      interact: wantInteract,
      pulse: wantPulse,
      dash: wantDash,
      pause: false
    };
  }

  let fpsFrameCount = 0;
  let fpsLastSample = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    fpsFrameCount += 1;
    if (now - fpsLastSample >= 500) {
      const fps = Math.round((fpsFrameCount * 1000) / (now - fpsLastSample));
      if (hudFps) hudFps.textContent = fps + ' FPS';
      fpsFrameCount = 0;
      fpsLastSample = now;
    }
    const rawDt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    if (running && gameState && gameState.gameState === 'playing') {
      accumulator += rawDt;
      let stepped = false;
      while (accumulator >= sim.DT) {
        const preShadeStates = {};
        for (let si = 0; si < gameState.shades.length; si++) {
          preShadeStates[gameState.shades[si].id] = gameState.shades[si].state;
        }
        const frame = buildBrowserInputFrame(sim.DT);
        const events = sim.step(gameState, frame);
        if (airSlashHoldTimer > 0) {
          gameState.player.pos[1] = airSlashHoldHeight;
          gameState.player.vel[1] = 0;
          gameState.player.grounded = false;
        }
        handleSimEvents(events, preShadeStates);
        accumulator -= sim.DT;
        stepped = true;
        if (gameState.gameState !== 'playing') break;
      }
      updateCreativeSkills(rawDt);
      if (stepped || activeTornados.length > 0 || activeWindWalls.length > 0 || shadeAlertTimer > 0 || subtitleTimer > 0) updateHud();
    }

    syncVisuals(rawDt);
    renderer.render(scene, camera);
  }

  // --- Input Listeners ---
  // Unlock Web Audio cleanly on first pointer or keyboard interaction
  function unlockAudioOnGesture() {
    if (!IS_BENCH) audio.startAmbientMusic();
  }
  window.addEventListener('pointerdown', unlockAudioOnGesture, { once: true, passive: true });

  function matchesDashKey(code) {
    return code === userSettings.keybinds.dash || (userSettings.keybinds.dash === 'ShiftLeft' && code === 'ShiftRight');
  }

  window.addEventListener('keydown', (e) => {
    if (IS_BENCH) return;
    if (document.activeElement === inputLbName) return;

    if (listeningAction) {
      e.preventDefault();
      e.stopPropagation();
      const newCode = e.code;
      let conflictAct = null;
      const kb = userSettings.keybinds;
      Object.keys(kb).forEach((act) => {
        if (act !== listeningAction && kb[act] === newCode) conflictAct = act;
      });
      if (conflictAct) {
        keybindError.textContent = 'Phím [' + formatKeyLabel(newCode) + '] đang dùng cho "' + ACTION_LABELS[conflictAct] + '" — hãy chọn phím khác!';
        keybindError.classList.remove('hidden');
        listeningAction = null;
        renderKeybindsGrid();
        return;
      }
      kb[listeningAction] = newCode;
      listeningAction = null;
      keybindError.classList.add('hidden');
      saveSettings(userSettings);
      renderKeybindsGrid();
      applyAccessibilitySettings();
      return;
    }

    audio.startAmbientMusic();
    keys[e.code] = true;
    const kb = userSettings.keybinds;

    if ((e.code === kb.pause || (kb.pause === 'Escape' && e.code === 'KeyP' && !isKeyBoundToAction('KeyP'))) && !e.repeat) {
      if (settingsOverlay.classList.contains('hidden') && menuOverlay.classList.contains('hidden') && introOverlay.classList.contains('hidden') && endOverlay.classList.contains('hidden') && leaderboardOverlay.classList.contains('hidden')) {
        togglePause();
      }
      return;
    }
    if (!running) return;
    if (e.code === kb.jump) {
      e.preventDefault();
      if (!jumpHeld) {
        jumpQueued = true;
        if (gameState && gameState.player.grounded) audio.playJump();
      }
      jumpHeld = true;
    } else if (e.code === kb.interact || (kb.interact === 'KeyE' && e.code === 'KeyF' && !isKeyBoundToAction('KeyF'))) {
      if (!interactHeld) interactQueued = true;
      interactHeld = true;
    } else if (e.code === kb.pulse) {
      if (!pulseHeld) pulseQueued = true;
      pulseHeld = true;
    } else if (matchesDashKey(e.code)) {
      if (!dashHeld) dashQueued = true;
      dashHeld = true;
    } else if (e.code === 'KeyJ' && !e.repeat && !isKeyBoundToAction('KeyJ')) {
      castTornado();
    } else if (e.code === 'KeyK' && !e.repeat && !isKeyBoundToAction('KeyK')) {
      castWindWall();
    } else if (e.code === 'KeyL' && !e.repeat && !isKeyBoundToAction('KeyL')) {
      castAirSlash();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    const kb = userSettings.keybinds;
    if (e.code === kb.jump) jumpHeld = false;
    if (e.code === kb.interact || (kb.interact === 'KeyE' && e.code === 'KeyF' && !isKeyBoundToAction('KeyF'))) interactHeld = false;
    if (e.code === kb.pulse) pulseHeld = false;
    if (matchesDashKey(e.code)) dashHeld = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    } else if (e.button === 2 && running) {
      pulseQueued = true;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    camYaw -= dx * 0.006 * userSettings.sensitivity;
    camPitch = Math.max(0.16, Math.min(1.15, camPitch + dy * 0.005 * userSettings.sensitivity));
  });

  window.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camDist = Math.max(7.5, Math.min(24.0, camDist + e.deltaY * 0.01));
  }, { passive: false });

  window.addEventListener('blur', () => {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    jumpHeld = interactHeld = pulseHeld = dashHeld = isDragging = false;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Button, Accessibility & Leaderboard Wiring ---
  function renderMenuControls() {
    if (!menuControlsGrid) return;
    const kb = userSettings.keybinds;
    const moveStr = [kb.moveUp, kb.moveLeft, kb.moveDown, kb.moveRight].map(formatKeyLabel).join('');
    menuControlsGrid.innerHTML =
      '<div><span class="kbd">' + moveStr + '</span> Di chuyển</div>' +
      '<div><span class="kbd">' + formatKeyLabel(kb.jump) + '</span> Nhảy</div>' +
      '<div><span class="kbd">' + formatKeyLabel(kb.dash) + '</span> Lướt (Dash)</div>' +
      '<div><span class="kbd">' + formatKeyLabel(kb.interact) + '</span> Nạp / Châm dầu</div>' +
      '<div><span class="kbd">' + formatKeyLabel(kb.pulse) + ' / Chuột phải</span> Tỏa Sáng (-3)</div>' +
      '<div><span class="kbd">J / K / L</span> Lốc / Tường / Trảm</div>' +
      '<div><span class="kbd">Kéo chuột / Z X</span> Xoay camera</div>' +
      '<div><span class="kbd">' + formatKeyLabel(kb.pause) + '</span> Tạm dừng</div>';
  }

  function renderKeybindsGrid() {
    if (!keybindsGrid) return;
    keybindsGrid.innerHTML = '';
    const kb = userSettings.keybinds;
    Object.keys(DEFAULT_KEYBINDS).forEach((action) => {
      const row = document.createElement('div');
      row.className = 'keybind-row';
      const lbl = document.createElement('span');
      lbl.textContent = ACTION_LABELS[action];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-keybind' + (listeningAction === action ? ' listening' : '');
      btn.textContent = listeningAction === action ? 'Nhấn phím...' : formatKeyLabel(kb[action]);
      btn.setAttribute('data-action', action);
      btn.addEventListener('click', () => {
        listeningAction = action;
        keybindError.classList.add('hidden');
        renderKeybindsGrid();
      });
      row.appendChild(lbl);
      row.appendChild(btn);
      keybindsGrid.appendChild(row);
    });
  }

  function applyAccessibilitySettings() {
    document.body.classList.toggle('colorblind', Boolean(userSettings.colorblind));
    document.body.classList.toggle('reduce-motion', Boolean(userSettings.reduceMotion));
    document.body.classList.toggle('large-text', Boolean(userSettings.largeText));
    if (skillDashKey) skillDashKey.textContent = '[' + formatKeyLabel(userSettings.keybinds.dash) + ']';
    if (skillPulseKey) skillPulseKey.textContent = '[' + formatKeyLabel(userSettings.keybinds.pulse) + ']';
    if (btnPause) btnPause.textContent = 'Tạm dừng [' + formatKeyLabel(userSettings.keybinds.pause) + ']';
    renderMenuControls();
    renderKeybindsGrid();
  }
  applyAccessibilitySettings();

  inputVolume.value = String(Math.round(userSettings.volume * 100));
  labelVolume.textContent = inputVolume.value + '%';
  inputSens.value = String(Math.round(userSettings.sensitivity * 100));
  labelSens.textContent = userSettings.sensitivity.toFixed(1) + 'x';
  if (inputColorblind) {
    inputColorblind.checked = Boolean(userSettings.colorblind);
    inputColorblind.addEventListener('change', () => {
      userSettings.colorblind = Boolean(inputColorblind.checked);
      saveSettings(userSettings);
      applyAccessibilitySettings();
      updateHud();
    });
  }
  if (inputSubtitles) {
    inputSubtitles.checked = Boolean(userSettings.subtitles);
    inputSubtitles.addEventListener('change', () => {
      userSettings.subtitles = Boolean(inputSubtitles.checked);
      saveSettings(userSettings);
      updateHud();
    });
  }
  if (inputReduceMotion) {
    inputReduceMotion.checked = Boolean(userSettings.reduceMotion);
    inputReduceMotion.addEventListener('change', () => {
      userSettings.reduceMotion = Boolean(inputReduceMotion.checked);
      saveSettings(userSettings);
      applyAccessibilitySettings();
    });
  }
  if (inputLargeText) {
    inputLargeText.checked = Boolean(userSettings.largeText);
    inputLargeText.addEventListener('change', () => {
      userSettings.largeText = Boolean(inputLargeText.checked);
      saveSettings(userSettings);
      applyAccessibilitySettings();
    });
  }
  if (btnResetKeybinds) {
    btnResetKeybinds.addEventListener('click', () => {
      userSettings.keybinds = Object.assign({}, DEFAULT_KEYBINDS);
      listeningAction = null;
      keybindError.classList.add('hidden');
      saveSettings(userSettings);
      applyAccessibilitySettings();
      updateHud();
    });
  }

  // --- Local Leaderboard Helpers ---
  function getLocalIsoTz() {
    const d = new Date();
    const tzMin = -d.getTimezoneOffset();
    const sign = tzMin >= 0 ? '+' : '-';
    const abs = Math.abs(tzMin);
    const pad = (n) => String(n).padStart(2, '0');
    return (
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      sign + pad(Math.floor(abs / 60)) + ':' + pad(abs % 60)
    );
  }

  function readLocalLbCache() {
    try {
      const raw = localStorage.getItem(LOCAL_LB_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function sortAndTrimLb(entries) {
    return entries.slice().sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return Date.parse(a.achieved_at) - Date.parse(b.achieved_at);
    }).slice(0, 10);
  }

  async function fetchLeaderboardEntries() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.entries)) {
          try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(data.entries)); } catch (_) {}
          return data.entries;
        }
      }
    } catch (_) {
      // Offline / file:// fallback
    }
    return sortAndTrimLb(readLocalLbCache());
  }

  async function saveLeaderboardEntry(entry) {
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.entries)) {
          try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(data.entries)); } catch (_) {}
          return { ok: true, entries: data.entries };
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        return { ok: false, error: errData.error || 'Tên không hợp lệ (3-12 ký tự chữ/số/_)' };
      }
    } catch (_) {
      // Fallback localStorage when opened via file://
    }
    const list = readLocalLbCache();
    list.push(entry);
    const top10 = sortAndTrimLb(list);
    try { localStorage.setItem(LOCAL_LB_KEY, JSON.stringify(top10)); } catch (_) {}
    return { ok: true, entries: top10 };
  }

  async function openLeaderboardModal() {
    const entries = await fetchLeaderboardEntries();
    leaderboardTbody.innerHTML = '';
    if (!entries.length) {
      leaderboardEmpty.classList.remove('hidden');
    } else {
      leaderboardEmpty.classList.add('hidden');
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const tr = document.createElement('tr');
        const tdRank = document.createElement('td'); tdRank.textContent = String(i + 1);
        const tdName = document.createElement('td'); tdName.textContent = e.name;
        const tdScore = document.createElement('td'); tdScore.textContent = String(e.score);
        const tdNights = document.createElement('td'); tdNights.textContent = e.nights_won + '/3';
        const tdSeed = document.createElement('td'); tdSeed.textContent = String(e.seed);
        tr.append(tdRank, tdName, tdScore, tdNights, tdSeed);
        leaderboardTbody.appendChild(tr);
      }
    }
    showOnlyOverlay(leaderboardOverlay);
  }

  if (btnOpenLeaderboard) {
    btnOpenLeaderboard.addEventListener('click', openLeaderboardModal);
  }
  if (btnCloseLeaderboard) {
    btnCloseLeaderboard.addEventListener('click', () => {
      showOnlyOverlay(menuOverlay);
    });
  }
  if (btnSaveScore) {
    btnSaveScore.addEventListener('click', async () => {
      const nameVal = (inputLbName.value || '').trim();
      if (!/^[\p{L}0-9_]{3,12}$/u.test(nameVal)) {
        lbSaveMsg.textContent = 'Tên phải dài 3–12 ký tự [A-Za-z0-9_] hoặc chữ có dấu!';
        lbSaveMsg.classList.remove('hidden');
        return;
      }
      const stats = getCampaignLeaderboardSummary();
      const entry = {
        name: nameVal,
        score: stats.score,
        nights_won: stats.nights_won,
        achieved_at: getLocalIsoTz(),
        seed: stats.seed
      };
      const result = await saveLeaderboardEntry(entry);
      if (result.ok) {
        lbSaveMsg.textContent = 'Đã lưu vào Bảng xếp hạng!';
        lbSaveMsg.classList.remove('hidden');
        btnSaveScore.disabled = true;
      } else {
        lbSaveMsg.textContent = result.error;
        lbSaveMsg.classList.remove('hidden');
      }
    });
  }

  inputVolume.addEventListener('input', () => {
    userSettings.volume = Number(inputVolume.value) / 100;
    labelVolume.textContent = inputVolume.value + '%';
    saveSettings(userSettings);
    audio.applyVolume();
  });
  inputVolume.addEventListener('change', () => {
    audio.playPickup(3);
  });

  inputSens.addEventListener('input', () => {
    userSettings.sensitivity = Number(inputSens.value) / 100;
    labelSens.textContent = userSettings.sensitivity.toFixed(1) + 'x';
    saveSettings(userSettings);
  });

  btnPlayCampaign.addEventListener('click', () => {
    audio.ensure();
    prepareNightIntro(1, true);
  });

  document.querySelectorAll('[data-start-night]').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.ensure();
      const n = Number(btn.getAttribute('data-start-night'));
      prepareNightIntro(n, true);
    });
  });

  btnBeginNight.addEventListener('click', () => {
    audio.ensure();
    beginActiveNight();
  });

  btnIntroMenu.addEventListener('click', () => {
    showOnlyOverlay(menuOverlay);
  });

  btnPause.addEventListener('click', togglePause);
  btnResume.addEventListener('click', togglePause);

  btnRestartNight.addEventListener('click', () => {
    prepareNightIntro(currentNight, false);
  });

  btnPauseMenu.addEventListener('click', () => {
    running = false;
    showOnlyOverlay(menuOverlay);
  });

  btnOpenSettingsMenu.addEventListener('click', () => {
    settingsReturnTo = 'menu';
    listeningAction = null;
    keybindError.classList.add('hidden');
    renderKeybindsGrid();
    showOnlyOverlay(settingsOverlay);
  });

  btnPauseSettings.addEventListener('click', () => {
    settingsReturnTo = 'pause';
    listeningAction = null;
    keybindError.classList.add('hidden');
    renderKeybindsGrid();
    showOnlyOverlay(settingsOverlay);
  });

  btnCloseSettings.addEventListener('click', () => {
    listeningAction = null;
    showOnlyOverlay(settingsReturnTo === 'pause' ? pauseOverlay : menuOverlay);
  });

  btnNextNight.addEventListener('click', () => {
    if (currentNight < 3) {
      prepareNightIntro(currentNight + 1, false);
    }
  });

  btnRetryNight.addEventListener('click', () => {
    if (currentNight === 3 && gameState && gameState.gameState === 'won') {
      prepareNightIntro(1, true);
    } else {
      prepareNightIntro(currentNight, false);
    }
  });

  btnEndMenu.addEventListener('click', () => {
    showOnlyOverlay(menuOverlay);
  });

  btnMute.addEventListener('click', () => {
    const muted = audio.toggleMute();
    btnMute.textContent = muted ? 'Âm thanh: Tắt' : 'Âm thanh: Bật';
  });

  skillDashBox.addEventListener('click', () => { if (running) dashQueued = true; });
  skillPulseBox.addEventListener('click', () => { if (running) pulseQueued = true; });
  skillTornadoBox.addEventListener('click', () => { audio.ensure(); castTornado(); });
  skillWindWallBox.addEventListener('click', () => { audio.ensure(); castWindWall(); });
  skillAirSlashBox.addEventListener('click', () => { audio.ensure(); castAirSlash(); });

  function startBenchmarkMode() {
    showOnlyOverlay(null);
    if (hud) hud.classList.add('hidden');
    lanternArrow.style.display = 'none';
    shadeArrow.style.display = 'none';

    clearPools();
    buildNightEnvironment(1);
    gameState = sim.createBenchGame(BENCH_SEED);
    for (let i = 0; i < gameState.lanterns.length; i++) {
      lanternMeshes.set(gameState.lanterns[i].id, createLanternVisual(gameState.lanterns[i]));
    }
    for (let i = 0; i < gameState.motes.length; i++) {
      moteMeshes.set(gameState.motes[i].id, createMoteVisual(gameState.motes[i]));
    }
    for (let i = 0; i < gameState.shades.length; i++) {
      shadeMeshes.set(gameState.shades[i].id, createShadeVisual(gameState.shades[i]));
    }

    camera.position.set(30, 15, 0);
    camera.lookAt(0, 0, 0);
    syncVisuals(0);
    renderer.render(scene, camera);

    fetch('/api/bench-ready', { method: 'POST' }).catch(() => {});

    let gpuDesc = 'Three.js r147 WebGL';
    try {
      const gl = renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      if (rName) gpuDesc = 'Three.js r147 WebGL (' + rName + ')';
    } catch (_) {}

    const WARMUP_MS = 3000;
    const MEASURE_MS = BENCH_DURATION_S * 1000;
    const benchStartNow = performance.now();
    let benchPrevNow = benchStartNow;
    let measureStartNow = null;
    const dts = [];
    let sentDone = false;

    function benchTick(now) {
      if (sentDone) return;
      const frameDtMs = Math.max(0.01, now - benchPrevNow);
      benchPrevNow = now;
      const elapsedMs = now - benchStartNow;

      const elapsedS = elapsedMs / 1000;
      const theta = (2 * Math.PI * elapsedS) / 15.0;
      camera.position.set(30 * Math.cos(theta), 15, -30 * Math.sin(theta));
      camera.lookAt(0, 0, 0);

      accumulator += Math.min(frameDtMs / 1000, 0.1);
      while (accumulator >= sim.DT) {
        sim.step(gameState, {});
        accumulator -= sim.DT;
      }
      syncVisuals(frameDtMs / 1000);
      renderer.render(scene, camera);

      if (elapsedMs >= WARMUP_MS) {
        if (measureStartNow === null) {
          measureStartNow = now;
        } else {
          dts.push(frameDtMs);
          if (now - measureStartNow >= MEASURE_MS) {
            sentDone = true;
            const n = dts.length || 1;
            const sumDt = dts.reduce((acc, v) => acc + v, 0) || 1;
            const avgFps = (1000 * n) / sumDt;
            const desc = dts.slice().sort((a, b) => b - a);
            const k = Math.max(1, Math.ceil(0.01 * n));
            let topSum = 0;
            for (let i = 0; i < k; i++) topSum += desc[i];
            const p1LowFps = 1000 / (topSum / k);
            const asc = desc.slice().reverse();
            const p95Idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
            const frameMsP95 = asc[p95Idx];

            fetch('/api/bench-done', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                frames: n,
                avg_fps: avgFps,
                p1_low_fps: p1LowFps,
                frame_ms_p95: frameMsP95,
                renderer: gpuDesc
              })
            }).catch(() => {});
            return;
          }
        }
      }
      requestAnimationFrame(benchTick);
    }
    requestAnimationFrame(benchTick);
  }

  // Boot either Benchmark Mode (?bench=1) or Main Menu Preview
  if (IS_BENCH) {
    startBenchmarkMode();
  } else {
    loadNightPreview(1);
    requestAnimationFrame(animate);
  }
})();
