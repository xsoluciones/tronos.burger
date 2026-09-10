// app/lib/bellSound.js
// Generador de sonido de campana de alta potencia para recepción de pedidos POS
// Reproduce 2 campanadas sonoras consecutivas de 3 segundos cada una (6 segundos total)

let isBellActive = false;

/**
 * Desbloquea el AudioContext en la primera interacción del usuario
 * para garantizar permisos plenos del navegador.
 */
export const unlockAudio = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    setTimeout(() => {
      try {
        if (ctx.state !== 'closed') ctx.close();
      } catch (e) {}
    }, 500);
  } catch (e) {}
};

/**
 * Reproduce el timbre de campana potente ("muy duro") dos veces seguidas
 * cada una con duración de 3 segundos (total 6 segundos).
 * @param {number} volume - Nivel de volumen entre 0.1 y 1.0 (por defecto 1.0 = Máximo)
 */
export const playLoudBell = (volume = 1.0) => {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Compresor de dinámica para maximizar volumen percibido ("muy duro") sin saturación ni clipping
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, ctx.currentTime);
    compressor.knee.setValueAtTime(8, ctx.currentTime);
    compressor.ratio.setValueAtTime(10, ctx.currentTime);
    compressor.attack.setValueAtTime(0.002, ctx.currentTime);
    compressor.release.setValueAtTime(0.2, ctx.currentTime);

    // Ganancia Master al volumen máximo
    const masterGain = ctx.createGain();
    const safeVolume = Math.min(Math.max(volume, 0.1), 1.0);
    masterGain.gain.setValueAtTime(safeVolume, ctx.currentTime);

    masterGain.connect(compressor);
    compressor.connect(ctx.destination);

    // Frecuencia base de campana brillante: E5 (659.25 Hz)
    const baseFreq = 659.25;

    // Armónicos acústicos metálicos de campana (subtono, fundamental, tercera menor, quinta, octava, brillo superior, golpe)
    const harmonics = [
      { ratio: 0.5, gain: 0.5, type: 'sine', decay: 3.0 },
      { ratio: 1.0, gain: 0.95, type: 'sine', decay: 2.9 },
      { ratio: 1.189, gain: 0.8, type: 'sine', decay: 2.7 },
      { ratio: 1.5, gain: 0.65, type: 'sine', decay: 2.4 },
      { ratio: 2.0, gain: 0.55, type: 'sine', decay: 2.0 },
      { ratio: 2.76, gain: 0.45, type: 'triangle', decay: 1.5 },
      { ratio: 4.07, gain: 0.35, type: 'triangle', decay: 0.9 },
      { ratio: 5.4, gain: 0.3, type: 'square', decay: 0.25 },
    ];

    const triggerStrike = (startTime) => {
      harmonics.forEach(({ ratio, gain: hGain, type, decay }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(baseFreq * ratio, startTime);

        // Calidez y sutil vibrato metálico
        if (ratio === 1.0 || ratio === 1.189) {
          osc.frequency.linearRampToValueAtTime(baseFreq * ratio * 0.997, startTime + decay);
        }

        // Ataque de percusión instantáneo y potente (4 milisegundos)
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(hGain, startTime + 0.004);

        // Decaimiento exponencial de 3 segundos
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + decay);
      });
    };

    // ── Campanada 1: Inicia en t = 0s (duración de resonancia: 3 segundos) ──
    triggerStrike(ctx.currentTime);

    // ── Campanada 2: Inicia en t = 3.0s (duración de resonancia: 3 segundos) ──
    triggerStrike(ctx.currentTime + 3.0);

    isBellActive = true;
    setTimeout(() => {
      isBellActive = false;
      try {
        if (ctx.state !== 'closed') ctx.close();
      } catch (e) {}
    }, 6500);

    return ctx;
  } catch (err) {
    console.warn('Error en timbre de campana:', err);
  }
};
