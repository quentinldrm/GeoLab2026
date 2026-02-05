// ==================================================
// COMMON.JS - Fonctions partagées entre les pages
// ==================================================

'use strict';

// ==================================================
// UTILITY FUNCTIONS
// ==================================================

// Fonction de throttle pour limiter la fréquence d'exécution
function throttle(func, delay) {
    let lastCall = 0;
    let timeoutId = null;

    return function (...args) {
        const now = Date.now();

        if (now - lastCall >= delay) {
            lastCall = now;
            func.apply(this, args);
        } else {
            // S'assurer que la dernière demande sera exécutée
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                func.apply(this, args);
            }, delay - (now - lastCall));
        }
    };
}

// Fonction de debounce pour éviter les exécutions répétées
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// ==================================================
// TUTORIAL SYSTEM
// ==================================================

class Tutorial {
    constructor(storageKey, steps) {
        this.storageKey = storageKey;
        this.steps = steps;
        this.currentStep = 1;
        this.overlay = document.getElementById('tutorialOverlay');

        if (!this.overlay) return;

        this.elements = {
            steps: this.overlay.querySelectorAll('.tutorial-step'),
            prevBtn: document.getElementById('prevStep'),
            nextBtn: document.getElementById('nextStep'),
            closeBtn: document.getElementById('closeTutorial'),
            progressDots: this.overlay.querySelectorAll('.progress-dot'),
            helpBtn: document.getElementById('helpBtn'),
            dontShowAgain: document.getElementById('dontShowAgain')
        };

        this.init();
    }

    init() {
        // Check if first visit
        if (!localStorage.getItem(this.storageKey)) {
            setTimeout(() => this.show(), 500);
        }

        // Event listeners
        this.elements.nextBtn?.addEventListener('click', () => this.next());
        this.elements.prevBtn?.addEventListener('click', () => this.prev());
        this.elements.closeBtn?.addEventListener('click', () => this.hide());
        this.elements.helpBtn?.addEventListener('click', () => this.show());

        this.elements.progressDots.forEach(dot => {
            dot.addEventListener('click', () => {
                this.currentStep = parseInt(dot.dataset.step);
                this.updateStep();
            });
        });

        // Close on outside click
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay && !this.overlay.classList.contains('hidden')) {
                this.hide();
            }
        });
    }

    show() {
        this.currentStep = 1;
        this.updateStep();
        this.overlay?.classList.remove('hidden');
    }

    hide() {
        this.overlay?.classList.add('hidden');
        if (this.elements.dontShowAgain?.checked) {
            localStorage.setItem(this.storageKey, 'true');
        }
    }

    next() {
        const maxSteps = this.elements.steps.length;
        if (this.currentStep < maxSteps) {
            this.currentStep++;
            this.updateStep();
        } else {
            this.hide();
        }
    }

    prev() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateStep();
        }
    }

    updateStep() {
        // Update step visibility
        this.elements.steps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Update progress dots
        this.elements.progressDots.forEach((dot, index) => {
            dot.classList.toggle('active', index + 1 === this.currentStep);
        });

        // Update buttons
        if (this.elements.prevBtn) {
            this.elements.prevBtn.disabled = this.currentStep === 1;
        }
        if (this.elements.nextBtn) {
            this.elements.nextBtn.textContent = this.currentStep === this.elements.steps.length ? 'Terminer' : 'Suivant';
        }
    }
}

// ==================================================
// METHODOLOGY MODAL
// ==================================================

function openMethodologyModal() {
    const modal = document.getElementById('methodologyModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeMethodologyModal() {
    const modal = document.getElementById('methodologyModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Close modal on outside click or Escape
document.addEventListener('click', (e) => {
    const modal = document.getElementById('methodologyModal');
    if (modal && e.target === modal) {
        closeMethodologyModal();
    }
});

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('methodologyModal');
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
        closeMethodologyModal();
    }
});

// ==================================================
// LOADER UTILITIES
// ==================================================

const Loader = {
    show(message = 'Chargement...') {
        const loader = document.getElementById('loader');
        if (loader) {
            const textEl = loader.querySelector('p');
            if (textEl) textEl.textContent = message;
            loader.classList.remove('hidden');
        }
    },

    hide() {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
    },

    updateProgress(percent, message) {
        const loader = document.getElementById('loader');
        if (!loader) return;

        let progressBar = loader.querySelector('.progress-bar');
        if (!progressBar) {
            progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = '<div class="progress-fill"></div>';
            loader.appendChild(progressBar);
        }

        const fill = progressBar.querySelector('.progress-fill');
        if (fill) fill.style.width = `${percent}%`;

        if (message) {
            const textEl = loader.querySelector('p');
            if (textEl) textEl.textContent = message;
        }
    }
};

// ==================================================
// LEAFLET MAP UTILITIES
// ==================================================

const MapUtils = {
    // Create base map
    createMap(elementId, center = [48.9, 7.4], zoom = 11) {
        const map = L.map(elementId, { zoomControl: false }).setView(center, zoom);

        // Ne pas ajouter de zoom control (supprimé)

        // Create base layers
        const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 22
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '&copy; Esri &copy; DigitalGlobe',
            maxZoom: 22
        });

        // Add default layer
        lightLayer.addTo(map);

        // Store layers on map object for later access
        map._baseLayers = {
            light: lightLayer,
            satellite: satelliteLayer
        };
        map._currentBaseLayer = 'light';

        return map;
    },

    // LCZ colors
    lczColors: {
        1: '#8b0101', 2: '#cc0200', 3: '#fc0001', 4: '#be4c03',
        5: '#ff6602', 6: '#ff9856', 7: '#fbed08', 8: '#bcbcba',
        9: '#ffcca7', 10: '#57555a',
        101: '#006700', 102: '#05aa05', 103: '#648423', 104: '#bbdb7a',
        105: '#010101', 106: '#fdf6ae', 107: '#6d67fd'
    },

    // LCZ names in French
    lczNames: {
        1: 'Compact haute densité', 2: 'Compact moyenne densité',
        3: 'Compact basse densité', 4: 'Ouvert haute densité',
        5: 'Ouvert moyenne densité', 6: 'Ouvert basse densité',
        7: 'Léger basse densité', 8: 'Large basse densité',
        9: 'Clairsemé', 10: 'Industrie lourde',
        101: 'Arbres denses', 102: 'Arbres dispersés',
        103: 'Buissons, arbustes', 104: 'Plantes basses',
        105: 'Roche nue / pavé', 106: 'Sol nu / sable',
        107: 'Eau'
    },

    // Style function for LCZ
    getLCZStyle(lczValue) {
        return {
            fill: true,
            fillColor: this.lczColors[lczValue] || '#808080',
            fillOpacity: 1,
            stroke: true,
            color: 'rgba(255,255,255,0.3)',
            weight: 0.5
        };
    }
};

// Export for global use
window.Tutorial = Tutorial;
window.openMethodologyModal = openMethodologyModal;
window.closeMethodologyModal = closeMethodologyModal;
window.Loader = Loader;
window.MapUtils = MapUtils;
window.throttle = throttle;
window.debounce = debounce;
