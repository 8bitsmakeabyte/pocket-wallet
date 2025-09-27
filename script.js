// =================== Defensive Audio + Game JS ===================
'use strict';

class AudioManager {
    constructor() {
        // Try to get existing audio element, otherwise create one
        this.backgroundMusic = document.getElementById('backgroundMusic') || this._createAudioElement();
        this.hoverSound = document.getElementById('hoverSound') || null;
        this.clickSound = document.getElementById('clickSound') || null;

        this.isMuted = false;
        this.isPlaying = false;
        this.volume = 0.5;

        this.init();
    }

    _createAudioElement() {
        const a = document.createElement('audio');
        a.id = 'backgroundMusic';
        a.preload = 'auto';
        a.loop = true;
        // Append but keep visually hidden
        a.style.display = 'none';
        document.body.appendChild(a);
        return a;
    }

    init() {
        if (this.backgroundMusic) {
            this.backgroundMusic.volume = this.volume * 0.3;
            this.backgroundMusic.addEventListener('play', () => { this.isPlaying = true; });
            this.backgroundMusic.addEventListener('pause', () => { this.isPlaying = false; });
            this.backgroundMusic.addEventListener('ended', () => { this.isPlaying = false; });
        }
        if (this.hoverSound) this.hoverSound.volume = this.volume * 0.8;
        if (this.clickSound) this.clickSound.volume = this.volume * 0.8;

        // Pause if user switches tab
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseBackgroundMusic();
            } else if (!this.isMuted && this.isPlaying) {
                this.resumeBackgroundMusic();
            }
        });
    }

    setTrack(src) {
        if (!this.backgroundMusic) return;
        if (this.backgroundMusic.src !== src) {
            this.backgroundMusic.src = src;
        }
    }

    load() {
        try { this.backgroundMusic.load(); } catch (e) { console.warn('Load failed', e); }
    }

    play() {
        if (!this.backgroundMusic) return Promise.reject(new Error('No backgroundMusic element'));
        return this.backgroundMusic.play().then(() => {
            this.isPlaying = true;
            return true;
        }).catch(err => {
            this.isPlaying = false;
            return Promise.reject(err);
        });
    }

    pauseBackgroundMusic() {
        if (this.backgroundMusic && this.isPlaying) {
            this.backgroundMusic.pause();
            this.isPlaying = false;
        }
    }

    resumeBackgroundMusic() {
        if (this.backgroundMusic && !this.isMuted && !this.isPlaying) {
            return this.play();
        }
        return Promise.resolve();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.pauseBackgroundMusic();
        } else if (this.isPlaying) {
            this.resumeBackgroundMusic().catch(() => {});
        }
        return this.isMuted;
    }

    playHoverSound() {
        if (!this.isMuted && this.hoverSound) {
            try {
                this.hoverSound.currentTime = 0;
                this.hoverSound.play().catch(() => {});
            } catch (e) {}
        }
    }

    playClickSound() {
        if (!this.isMuted && this.clickSound) {
            try {
                this.clickSound.currentTime = 0;
                this.clickSound.play().catch(() => {});
            } catch (e) {}
        }
    }
}


// =================== Particle System (click effect only) ===================
class ParticleSystem {
    constructor() {
        this.container = document.querySelector('.particle-system') || this._createContainer();
    }

    _createContainer() {
        const c = document.createElement('div');
        c.className = 'particle-system';
        c.style.position = 'fixed';
        c.style.left = '0';
        c.style.top = '0';
        c.style.width = '100%';
        c.style.height = '100%';
        c.style.pointerEvents = 'none';
        c.style.zIndex = '4';
        document.body.appendChild(c);
        return c;
    }

    // Keep only click effect
    createClickEffect(x, y) {
        const effects = ['✨', '💫', '⭐'];
        for (let i = 0; i < 5; i++) {
            const effect = document.createElement('div');
            effect.textContent = effects[Math.floor(Math.random() * effects.length)];
            effect.style.cssText = `
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                font-size: 20px;
                pointer-events: none;
                z-index: 20;
                animation: explode 0.8s ease-out forwards;
                transform-origin: center;
            `;
            this.container.appendChild(effect);
            setTimeout(() => { if (effect.parentNode) effect.parentNode.removeChild(effect); }, 800);
        }
    }
}


// =================== Game Manager (robust audio handling) ===================
class GameManager {
    constructor() {
        this.audioManager = new AudioManager();
        this.particleSystem = new ParticleSystem();

        // tracks
        this.tracks = [
            { src: "audio/song1.mp3", title: "How Far I'll Go", credits: "Alessia Cara" },
            { src: "audio/song2.mp3", title: "Steal The Show", credits: "Lauv" },
            { src: "audio/song3.mp3", title: "Golden", credits: "Kpop Demon Hunters" },
            { src: "audio/song4.mp3", title: "Your Idol", credits: "Kpop Demon Hunters" },
            { src: "audio/song5.mp3", title: "Soda Pop", credits: "Kpop Demon Hunters" }
        ];
        this.currentTrack = 0;

        // AudioContext used to unlock audio on some browsers
        this.audioCtx = null;

        // overlay for enabling audio (created on demand)
        this._enableOverlay = null;

        this.init();
    }

    init() {
        this.addMinimalStyles();
        this.ensureControls();
        this.setupSoundControl();
        this.setupMusicPlayer();
        this.setupKeyboardShortcuts();
        this.setupBallGuide();

        console.log('🎮 Pocket Wallet Game Initialized! 🎮');
    }

    addMinimalStyles() {
        if (document.getElementById('pw-debug-styles')) return;
        const css = `
            @keyframes floatUp { from { transform: translateY(0); } to { transform: translateY(-110vh); } }
            @keyframes explode { from { opacity:1; transform: translate(0,0) scale(1); } to { opacity:0; transform: translate(var(--dx, 0), var(--dy, -80px)) scale(.6); } }
            #pw-fallback-controls { position: fixed; right: 18px; bottom: 18px; background: rgba(0,0,0,0.6); color: white; padding:8px; border-radius:10px; z-index:9999; display:flex; gap:6px; align-items:center; font-family: sans-serif; }
            #pw-enable-overlay { position: fixed; inset:0; display:flex; align-items:center; justify-content:center; background: rgba(0,0,0,0.6); z-index:10000; }
            #pw-enable-overlay button { padding:12px 20px; font-size:16px; border-radius:8px; border:none; cursor:pointer; }
        `;
        const s = document.createElement('style');
        s.id = 'pw-debug-styles';
        s.appendChild(document.createTextNode(css));
        document.head.appendChild(s);
    }

    ensureControls() {
        // Try to find existing controls; if missing, create a small fallback bar.
        this.prevBtn = document.getElementById('prevTrack');
        this.playPauseBtn = document.getElementById('playPause');
        this.nextBtn = document.getElementById('nextTrack');
        this.trackInfoElem = document.getElementById('trackInfo');
        this.soundToggle = document.getElementById('soundToggle');

        if (!this.playPauseBtn || !this.prevBtn || !this.nextBtn || !this.trackInfoElem || !this.soundToggle) {
            // create fallback controls for testing / safety
            const existing = document.getElementById('pw-fallback-controls');
            if (existing) {
                this._injectControlsFrom(existing);
                return;
            }

            const container = document.createElement('div');
            container.id = 'pw-fallback-controls';

            const prev = document.createElement('button');
            prev.id = 'prevTrack';
            prev.textContent = '⏮';
            container.appendChild(prev);

            const play = document.createElement('button');
            play.id = 'playPause';
            play.textContent = '▶';
            container.appendChild(play);

            const next = document.createElement('button');
            next.id = 'nextTrack';
            next.textContent = '⏭';
            container.appendChild(next);

            const info = document.createElement('div');
            info.id = 'trackInfo';
            info.style.minWidth = '140px';
            info.style.fontSize = '13px';
            info.style.opacity = '0.9';
            info.textContent = 'No track loaded';
            container.appendChild(info);

            const sound = document.createElement('button');
            sound.id = 'soundToggle';
            sound.innerHTML = '<span class="sound-icon">🔊</span>';
            container.appendChild(sound);

            document.body.appendChild(container);

            // assign to instance variables
            this.prevBtn = prev;
            this.playPauseBtn = play;
            this.nextBtn = next;
            this.trackInfoElem = info;
            this.soundToggle = sound;
        }
    }

    _injectControlsFrom(node) {
        this.prevBtn = node.querySelector('#prevTrack') || document.getElementById('prevTrack');
        this.playPauseBtn = node.querySelector('#playPause') || document.getElementById('playPause');
        this.nextBtn = node.querySelector('#nextTrack') || document.getElementById('nextTrack');
        this.trackInfoElem = node.querySelector('#trackInfo') || document.getElementById('trackInfo');
        this.soundToggle = node.querySelector('#soundToggle') || document.getElementById('soundToggle');
    }

    setupMusicPlayer() {
        // Set first track (but do not auto-play)
        this.audioManager.setTrack(this.tracks[this.currentTrack].src);
        this.audioManager.load();
        this.updateTrackInfo();

        // Wire buttons (they exist now or were created)
        if (this.prevBtn) this.prevBtn.addEventListener('click', () => this.changeTrack(-1));
        if (this.nextBtn) this.nextBtn.addEventListener('click', () => this.changeTrack(1));
        if (this.playPauseBtn) this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    }

    updateTrackInfo() {
        const t = this.tracks[this.currentTrack];
        if (this.trackInfoElem) this.trackInfoElem.textContent = `${t.title} — ${t.credits}`;
    }

    changeTrack(direction) {
        this.currentTrack = (this.currentTrack + direction + this.tracks.length) % this.tracks.length;
        const url = this.tracks[this.currentTrack].src;
        this.audioManager.setTrack(url);
        this.audioManager.load();

        this.audioManager.play().then(() => {
            this.playPauseBtn && (this.playPauseBtn.textContent = '⏸');
            this.audioManager.isPlaying = true;
            this.removeEnableOverlay();
        }).catch(err => {
            console.warn('changeTrack play failed:', err);
            this.playPauseBtn && (this.playPauseBtn.textContent = '▶');
            // Show overlay to unlock audio
            this.handlePlayError(err);
        });

        this.updateTrackInfo();
    }

    togglePlayPause() {
        const music = this.audioManager.backgroundMusic;
        if (!music) {
            console.error('No audio element available');
            return;
        }

        if (this.audioManager.isPlaying) {
            this.audioManager.pauseBackgroundMusic();
            if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
            return;
        }

        // Attempt to play (user gesture required by browsers)
        this.audioManager.play().then(() => {
            if (this.playPauseBtn) this.playPauseBtn.textContent = '⏸';
            this.audioManager.isPlaying = true;
            this.removeEnableOverlay();
        }).catch(err => {
            console.warn('Play() failed:', err);
            if (this.playPauseBtn) this.playPauseBtn.textContent = '▶';
            this.handlePlayError(err);
        });
    }

    handlePlayError(err) {
        // Common reasons: autoplay blocked or network / CORS / file not found
        console.log('Play blocked/failed, creating enable overlay. Error:', err);
        this.showEnableOverlay();
    }

    showEnableOverlay() {
        if (this._enableOverlay) return; // already shown

        const overlay = document.createElement('div');
        overlay.id = 'pw-enable-overlay';

        const btn = document.createElement('button');
        btn.textContent = 'Enable audio — Click to start';
        overlay.appendChild(btn);

        btn.addEventListener('click', async () => {
            try {
                // Resume/create AudioContext on user gesture (helps Safari/Chrome)
                if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
                    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }

                // Ensure the audio element has src (re-assign to force fresh load if needed)
                const src = this.tracks[this.currentTrack].src;
                this.audioManager.setTrack(src);
                this.audioManager.load();

                await this.audioManager.play();
                this.playPauseBtn && (this.playPauseBtn.textContent = '⏸');
                this.removeEnableOverlay();
                console.log('Audio enabled by user gesture.');
            } catch (e) {
                console.error('Enable attempt failed:', e);
                // Keep overlay and let user try again. Also show console hint.
                alert('Could not start audio. Open DevTools > Network to check that audio files exist and are reachable.');
            }
        });

        document.body.appendChild(overlay);
        this._enableOverlay = overlay;
    }

    removeEnableOverlay() {
        if (this._enableOverlay && this._enableOverlay.parentNode) {
            this._enableOverlay.parentNode.removeChild(this._enableOverlay);
            this._enableOverlay = null;
        }
    }

    setupSoundControl() {
        const soundToggle = this.soundToggle;
        if (!soundToggle) return;

        soundToggle.addEventListener('click', (e) => {
            const rect = soundToggle.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // particle click effect
            this.particleSystem.createClickEffect(x, y);

            const isMuted = this.audioManager.toggleMute();
            const icon = soundToggle.querySelector('.sound-icon');
            if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
            else soundToggle.textContent = isMuted ? '🔇' : '🔊';
            this.audioManager.playClickSound();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'm' || e.key === 'M') {
                // toggle mute
                const isMuted = this.audioManager.toggleMute();
                const icon = this.soundToggle && this.soundToggle.querySelector('.sound-icon');
                if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
                else if (this.soundToggle) this.soundToggle.textContent = isMuted ? '🔇' : '🔊';
            } else if (e.key === ' ' || e.key === 'Spacebar') {
                // space toggles play/pause (prevent page scroll)
                e.preventDefault();
                this.togglePlayPause();
            } else if (e.key === 'ArrowRight') {
                this.changeTrack(1);
            } else if (e.key === 'ArrowLeft') {
                this.changeTrack(-1);
            }
        });
    }

    setupBallGuide() {
        const ballGuide = document.querySelector('.ball-guide');
        const spline = document.querySelector('spline-viewer');

        if (!ballGuide || !spline) return;

        spline.addEventListener('pointerdown', () => {
            ballGuide.style.display = 'none';
        }, { once: true });
    }
}


// =================== Initialize ===================
document.addEventListener('DOMContentLoaded', () => {
    try {
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.5s ease';

        setTimeout(() => {
            document.body.style.opacity = '1';
            window.gameManager = new GameManager();

            setTimeout(() => {
                console.log('🎮 Welcome to Pocket Wallet! 🎮');
                console.log('💡 Click ▶ to start music (or press Space). Press M to mute/unmute.');
            }, 600);
        }, 100);

    } catch (e) {
        console.error('Initialization error', e);
    }
});
