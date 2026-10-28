(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const root = document.documentElement;
  const body = document.body;
  const stage = $('#stage');
  const canvas = $('#effects');
  const ctx = canvas.getContext('2d');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { paused: motionPreference.matches, reduced: motionPreference.matches, intensity: 85, bpm: 128, mode: 'acid', sound: false, clock: 0, dropUntil: 0 };
  const palettes = { acid: ['#c6ff35', '#fb5bc6'], laser: ['#4bf1ed', '#ff65bc'], void: ['#b3a1ff', '#e8f075'] };
  let width = 1, height = 1, lastFrame = 0, frame = 0, dropTimer;
  let audioContext, master, noiseBuffer, nextStepTime = 0, step = 0, scheduler;
  let particles = [];
  let randomSeed = 12345;
  function random() { randomSeed = (randomSeed * 16807) % 2147483647; return (randomSeed - 1) / 2147483646; }
  $('#cat-dancer').innerHTML = window.CAT_ART || '<span style="font-size:220px" role="img" aria-label="Dancing cat">🐈</span>';

  function announce(message) { $('#announcement').textContent = message; }
  function updateRange(input) { input.style.setProperty('--fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`); }
  function updateTempo() {
    root.style.setProperty('--beat', `${60 / state.bpm}s`);
    root.style.setProperty('--dance', `${120 / state.bpm}s`);
    $('#tempo-value').value = state.bpm;
    updateRange($('#tempo'));
  }
  function updateIntensity() {
    root.style.setProperty('--energy', state.intensity / 100);
    $('#intensity-value').value = `${state.intensity}%`;
    $('#vibe-label').textContent = state.intensity < 30 ? 'CHILL' : state.intensity < 65 ? 'WIRED' : 'FERAL';
    updateRange($('#intensity'));
  }
  function syncPause() {
    body.classList.toggle('paused', state.paused);
    $('#pause-button').setAttribute('aria-pressed', String(state.paused));
    $('#pause-button').setAttribute('aria-label', state.paused ? 'Resume animation' : 'Pause animation');
    $('.pause-symbol').textContent = state.paused ? '▶' : 'Ⅱ';
    $('#live-label').textContent = state.paused ? 'CAT NAP' : 'LIVE & LOUD';
    $('#stage-caption').textContent = state.paused ? 'CURRENTLY: TAKING A CAT NAP' : 'CURRENTLY: ABSOLUTELY LOSING IT';
    syncAudio();
  }
  function syncReduced() {
    body.classList.toggle('reduced', state.reduced);
    $('#effects-button').setAttribute('aria-pressed', String(state.reduced));
    $('#effects-label').textContent = state.reduced ? 'FLASHING VISUALS OFF' : 'FLASHING VISUALS ON';
    $('.effects-action').textContent = state.reduced ? 'TURN UP EFFECTS ↗' : 'REDUCE EFFECTS ↗';
  }
  function togglePause() {
    state.paused = !state.paused;
    if (!state.paused) root.classList.add('motion-enabled');
    syncPause();
  }

  $('#intensity').addEventListener('input', (event) => { state.intensity = Number(event.target.value); updateIntensity(); });
  $('#tempo').addEventListener('input', (event) => { state.bpm = Number(event.target.value); updateTempo(); });
  document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.theme;
    body.dataset.mode = state.mode;
    document.querySelectorAll('[data-theme]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    announce(`${state.mode} visual theme selected.`);
  }));
  $('#pause-button').addEventListener('click', togglePause);
  $('#effects-button').addEventListener('click', () => { state.reduced = !state.reduced; syncReduced(); });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' && !event.repeat && !event.target.closest('button, input, a, textarea, select, [contenteditable]')) { event.preventDefault(); togglePause(); }
  });
  motionPreference.addEventListener('change', (event) => {
    if (event.matches) { state.reduced = true; state.paused = true; root.classList.remove('motion-enabled'); syncReduced(); syncPause(); }
  });

  $('#drop-button').addEventListener('click', () => {
    if (state.paused) { state.paused = false; root.classList.add('motion-enabled'); syncPause(); }
    state.dropUntil = state.clock + 1.6;
    clearTimeout(dropTimer);
    stage.classList.remove('dropping');
    void stage.offsetWidth;
    stage.classList.add('dropping');
    dropTimer = setTimeout(() => stage.classList.remove('dropping'), 1100);
    if (state.sound && audioContext) meow(audioContext.currentTime);
    announce('Meow dropped. The cat is going feral.');
  });
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else announce('Fullscreen is not supported by this browser.');
    } catch { announce('Fullscreen is unavailable in this window.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    const label = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
    $('#fullscreen').setAttribute('aria-label', label);
    $('#fullscreen').title = label;
  });

  // The beat is synthesized locally. Audio only starts after the sound button is pressed.
  function initAudio() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw new Error('Audio is not supported');
    audioContext = new Audio();
    master = audioContext.createGain();
    master.gain.value = 0.45;
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    master.connect(compressor); compressor.connect(audioContext.destination);
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.2, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  function tone(time, frequency, duration, volume, type = 'sine', endFrequency) {
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(volume, time + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(envelope); envelope.connect(master);
    oscillator.start(time); oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  function hat(time, volume, duration) {
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'highpass'; filter.frequency.value = 7500;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(master);
    source.start(time); source.stop(time + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }
  function meow(time) {
    tone(time, 760, 0.46, 0.13, 'sawtooth', 250);
    tone(time + 0.04, 1140, 0.40, 0.055, 'triangle', 380);
  }
  function scheduleAudio() {
    if (!audioContext || !state.sound || state.paused || document.hidden) return;
    while (nextStepTime < audioContext.currentTime + 0.12) {
      const beat = 60 / state.bpm;
      if (step % 4 === 0) tone(nextStepTime, 140, 0.24, 0.7, 'sine', 42);
      if (step % 4 === 2) hat(nextStepTime, 0.15, 0.09);
      if (step % 2 === 1) hat(nextStepTime, 0.065, 0.035);
      if (step % 8 === 4) { hat(nextStepTime, 0.24, 0.13); tone(nextStepTime, 170, 0.10, 0.16, 'triangle', 100); }
      const notes = [55, 55, 82.41, 65.41, 55, 110, 73.42, 65.41];
      if (step % 2 === 0) tone(nextStepTime, notes[(step / 2) % notes.length], beat * 0.32, 0.11, 'sawtooth');
      nextStepTime += beat / 4;
      step = (step + 1) % 32;
    }
  }
  function syncAudio() {
    clearInterval(scheduler);
    if (!audioContext) return;
    if (state.sound && !state.paused && !document.hidden) {
      audioContext.resume().catch(() => {});
      master.gain.setTargetAtTime(0.45, audioContext.currentTime, 0.02);
      nextStepTime = audioContext.currentTime + 0.04;
      step = 0;
      scheduler = setInterval(scheduleAudio, 25);
      scheduleAudio();
    } else {
      master.gain.setTargetAtTime(0, audioContext.currentTime, 0.015);
    }
  }
  $('#sound-button').addEventListener('click', async () => {
    try {
      if (!audioContext) initAudio();
      await audioContext.resume();
      state.sound = !state.sound;
      $('#sound-button').setAttribute('aria-pressed', String(state.sound));
      $('#sound-button span').textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
      $('#sound-button path').setAttribute('d', state.sound ? 'M11 4 5 9H2v6h3l6 5V4Zm5 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14' : 'M11 4 5 9H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6');
      syncAudio();
    } catch { announce('Your browser could not start audio. Visuals are still available.'); }
  });

  function resize() {
    width = stage.clientWidth; height = stage.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    if (ctx) ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: 64 }, () => ({ x: random(), y: random(), size: 1 + random() * 2, speed: 0.02 + random() * 0.07, phase: random() * Math.PI * 2 }));
    draw();
  }
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const [primary, secondary] = palettes[state.mode];
    const energy = state.intensity / 100;
    const time = state.clock;
    const dropping = time < state.dropUntil && !state.reduced;
    // Smooth, localized pulses stay below two flashes per second even at maximum tempo.
    const pulseRate = Math.min(state.bpm / 60, 2);
    const pulse = state.reduced ? 0.22 : Math.pow((Math.sin(time * pulseRate * Math.PI * 2) + 1) / 2, 4);
    const centerX = width * 0.5, centerY = height * 0.52;
    const count = state.reduced ? 10 : Math.round(20 + energy * 44);
    for (let i = 0; i < count; i++) {
      const particle = particles[i];
      if (!particle) continue;
      const x = (particle.x + Math.sin(time * .3 + particle.phase) * .025) * width;
      const y = ((particle.y - time * particle.speed * (state.reduced ? .15 : .6 + energy) % 1 + 2) % 1) * height;
      ctx.globalAlpha = state.reduced ? .2 : .2 + Math.sin(time * 2 + particle.phase) * .15;
      ctx.fillStyle = i % 3 ? primary : secondary;
      ctx.fillRect(x, y, particle.size, particle.size);
    }
    if (!state.reduced && energy > .08) {
      const rays = state.mode === 'void' ? 5 : 9;
      ctx.lineWidth = 1;
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2 + time * .13;
        const radius = width * .24;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
        ctx.lineTo(centerX + Math.cos(angle + Math.sin(time) * .1) * width, centerY + Math.sin(angle + Math.sin(time) * .1) * height);
        ctx.strokeStyle = i % 2 ? primary : secondary;
        ctx.globalAlpha = (.025 + pulse * .14) * energy + (dropping ? .13 : 0);
        ctx.stroke();
      }
      ctx.globalAlpha = (.025 + pulse * .09) * energy;
      ctx.strokeStyle = primary;
      ctx.lineWidth = 2;
      const ringRadius = Math.min(width, height) * (.28 + pulse * .04);
      ctx.beginPath(); ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2); ctx.stroke();
      // Thin chromatic scan strips give the stage its glitch texture without full-screen strobes.
      if (pulse > .8) {
        ctx.globalAlpha = .1 * energy;
        ctx.fillStyle = secondary;
        for (let i = 0; i < 3; i++) { const y = ((time * 31 + i * 113) % height); ctx.fillRect(width * .08, y, width * .84, 2 + i); }
      }
    }
    ctx.globalAlpha = 1;
  }
  function animate(now) {
    const delta = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0;
    lastFrame = now;
    if (!state.paused && !document.hidden) state.clock += delta;
    draw();
    if (!document.hidden) frame = requestAnimationFrame(animate);
  }
  document.addEventListener('visibilitychange', () => {
    body.classList.toggle('paused', state.paused || document.hidden);
    syncAudio();
    cancelAnimationFrame(frame);
    lastFrame = 0;
    if (!document.hidden) frame = requestAnimationFrame(animate);
  });
  new ResizeObserver(resize).observe(stage);
  updateTempo(); updateIntensity(); syncReduced(); syncPause(); resize();
  frame = requestAnimationFrame(animate);
})();
