(() => {
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const smoothEl = document.getElementById('smooth');
  const shellEl = document.querySelector('.shell');
  const hero = document.querySelector('.hero');
  const profile = document.querySelector('.profile');

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Heavy / slow scroll (without libraries)
  const smoothScroll = (() => {
    if (prefersReduced) return null;
    if (!smoothEl || !shellEl) return null;

    const state = {
      current: 0,
      target: 0,
      max: 0,
      raf: 0,
      ease: 0.065,
    };

    const syncBodyHeight = () => {
      // With a fixed container, the document needs a scrollable height.
      // Use the actual rendered content height.
      const height = shellEl.getBoundingClientRect().height + 80; // footer spacing safety
      document.body.style.height = `${Math.max(window.innerHeight, Math.ceil(height))}px`;
    };

    const updateMax = () => {
      const doc = document.documentElement;
      const body = document.body;
      const height = Math.max(body.scrollHeight, doc.scrollHeight);
      const viewport = window.innerHeight;
      state.max = Math.max(0, height - viewport);
    };

    const onScroll = () => {
      state.target = clamp(window.scrollY || 0, 0, state.max);
    };

    const loop = () => {
      state.current += (state.target - state.current) * state.ease;
      if (Math.abs(state.target - state.current) < 0.1) state.current = state.target;

      smoothEl.style.transform = `translate3d(0, ${(-state.current).toFixed(3)}px, 0)`;

      state.raf = requestAnimationFrame(loop);
    };

    const init = () => {
      syncBodyHeight();
      updateMax();
      onScroll();
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = requestAnimationFrame(loop);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      syncBodyHeight();
      updateMax();
      onScroll();
    }, { passive: true });

    const ro = new ResizeObserver(() => {
      syncBodyHeight();
      updateMax();
      onScroll();
    });
    ro.observe(shellEl);

    init();

    return {
      get current() { return state.current; },
      get target() { return state.target; },
    };
  })();

  // Canvas background: slow smoke + grain, nearly invisible parallax
  const bg = (() => {
    const canvas = document.getElementById('bg');
    if (!canvas) return null;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return null;

    const state = {
      dpr: Math.max(1, Math.min(2, window.devicePixelRatio || 1)),
      w: 0,
      h: 0,
      t: 0,
      mx: 0,
      my: 0,
      raf: 0,
      last: performance.now(),
      grainPattern: null,
      smokeCanvas: null,
      smokeCtx: null,
      smokeBuf: null,
      smokeW: 0,
      smokeH: 0,
      smokePattern: null,
      smokeNext: 0,
    };

    const resize = () => {
      state.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      state.w = Math.floor(window.innerWidth);
      state.h = Math.floor(window.innerHeight);
      canvas.width = Math.floor(state.w * state.dpr);
      canvas.height = Math.floor(state.h * state.dpr);
      canvas.style.width = `${state.w}px`;
      canvas.style.height = `${state.h}px`;
      ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    };

    const createGrainPattern = () => {
      const tile = document.createElement('canvas');
      const size = 140;
      tile.width = size;
      tile.height = size;
      const tctx = tile.getContext('2d', { alpha: true });
      if (!tctx) return null;

      const img = tctx.createImageData(size, size);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = (Math.random() * 42) | 0;
      }
      tctx.putImageData(img, 0, 0);
      return ctx.createPattern(tile, 'repeat');
    };

    const initSmokeNoise = () => {
      const smokeCanvas = document.createElement('canvas');
      const sw = 160;
      const sh = 160;
      smokeCanvas.width = sw;
      smokeCanvas.height = sh;
      const smokeCtx = smokeCanvas.getContext('2d', { alpha: true });
      if (!smokeCtx) return null;

      state.smokeCanvas = smokeCanvas;
      state.smokeCtx = smokeCtx;
      state.smokeW = sw;
      state.smokeH = sh;
      state.smokeBuf = new Uint8Array(sw * sh);
      state.smokePattern = ctx.createPattern(smokeCanvas, 'repeat');
      state.smokeNext = 0;
      return true;
    };

    const updateSmokeNoise = () => {
      if (!state.smokeCanvas || !state.smokeCtx || !state.smokeBuf) return;

      const sw = state.smokeW;
      const sh = state.smokeH;
      const buf = state.smokeBuf;
      const img = state.smokeCtx.createImageData(sw, sh);
      const d = img.data;

      for (let i = 0; i < buf.length; i++) {
        const r = (Math.random() * 256) | 0;
        buf[i] = (buf[i] * 0.93 + r * 0.07) | 0;
        const n = buf[i] / 255;
        const a = Math.min(255, (n * n) * 92);

        const o = i * 4;
        d[o] = 18 + (n * 48) | 0;
        d[o + 1] = 22 + (n * 68) | 0;
        d[o + 2] = 28 + (n * 92) | 0;
        d[o + 3] = a | 0;
      }

      state.smokeCtx.putImageData(img, 0, 0);
      state.smokePattern = ctx.createPattern(state.smokeCanvas, 'repeat');

      state.smokeNext = state.t + 240 + Math.random() * 180;
    };

    const draw = (dt) => {
      const w = state.w;
      const h = state.h;
      ctx.clearRect(0, 0, w, h);

      // Deep black base
      ctx.fillStyle = '#050506';
      ctx.fillRect(0, 0, w, h);

      const scroll = smoothScroll ? smoothScroll.current : (window.scrollY || 0);
      const par = clamp(scroll / 900, 0, 1);
      const px = (state.mx - 0.5) * 10;
      const py = (state.my - 0.5) * 10;

      // Smoke as back noise (perf): low-res evolving noise tile, updated rarely
      if (state.smokePattern) {
        if (state.t >= state.smokeNext) updateSmokeNoise();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.filter = 'blur(20px)';

        const driftX = (state.t * 0.0035) % 160;
        const driftY = (state.t * 0.0026) % 160;
        const scale = 3.25;

        ctx.globalAlpha = 0.16;
        ctx.translate(-driftX + px * 0.35, -driftY + py * 0.35 + par * 10);
        ctx.scale(scale, scale);
        ctx.fillStyle = state.smokePattern;
        ctx.fillRect(0, 0, w / scale + 200, h / scale + 200);

        ctx.restore();
      }

      // Grain overlay (precomputed tile pattern)
      if (state.grainPattern) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = state.grainPattern;
        const gx = (state.t * 0.014) % 140;
        const gy = (state.t * 0.010) % 140;
        ctx.translate(-gx, -gy);
        ctx.fillRect(gx, gy, w + 140, h + 140);
        ctx.restore();
      }

      // Vignette
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.55, Math.min(w, h) * 0.1, w * 0.5, h * 0.55, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.62)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    };

    const loop = (now) => {
      const dt = now - state.last;
      state.last = now;
      state.t += dt;

      if (!prefersReduced) draw(dt);

      state.raf = requestAnimationFrame(loop);
    };

    const onPointer = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      // very slow follow
      state.mx += (x - state.mx) * 0.035;
      state.my += (y - state.my) * 0.035;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });

    resize();
    state.grainPattern = createGrainPattern();
    initSmokeNoise();
    updateSmokeNoise();
    state.mx = 0.5;
    state.my = 0.5;

    if (!prefersReduced) {
      state.raf = requestAnimationFrame(loop);
    }

    return { resize };
  })();

  // Rare glitch
  (() => {
    if (prefersReduced) return;
    let busy = false;

    const arm = () => {
      const next = 4200 + Math.random() * 9200;
      window.setTimeout(trigger, next);
    };

    const trigger = () => {
      if (busy) return;
      busy = true;

      const on = 90 + Math.random() * 170;
      document.documentElement.classList.add('glitching');

      const dx = (Math.random() - 0.5) * 2;
      const dy = (Math.random() - 0.5) * 2;
      if (hero) hero.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      if (profile) profile.style.transform = `translate3d(${(-dx).toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;

      window.setTimeout(() => {
        document.documentElement.classList.remove('glitching');
        if (hero) hero.style.transform = '';
        if (profile) profile.style.transform = '';
        busy = false;
        arm();
      }, on);
    };

    arm();
  })();
})();
