// ==================================================
// SCRIPT LANDING PAGE - PNR VOSGES DU NORD
// ==================================================

'use strict';

// ==================================================
// 1. BARRE DE PROGRESSION SCROLL
// ==================================================

let progressBar = null;

function updateScrollProgress() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'scroll-progress';
        document.body.appendChild(progressBar);
    }
    
    progressBar.style.width = `${progress}%`;
}

// Throttle scroll pour performances
let scrollTimeout;
window.addEventListener('scroll', () => {
    if (!scrollTimeout) {
        scrollTimeout = setTimeout(() => {
            updateScrollProgress();
            scrollTimeout = null;
        }, 10);
    }
}, { passive: true });

// ==================================================
// 2. FADE IN SIMPLE AU SCROLL
// ==================================================
// Animations simplifiées pour un aspect plus professionnel

// ==================================================
// 3. BOUTON RETOUR EN HAUT
// ==================================================

function initScrollToTop() {
    const btn = document.createElement('button');
    btn.className = 'scroll-to-top';
    btn.innerHTML = '↑';
    btn.setAttribute('aria-label', 'Retour en haut');
    document.body.appendChild(btn);
    
    // Toggle visibilité au scroll
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.pageYOffset > 300);
    }, { passive: true });
    
    // Scroll smooth vers le haut
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// Initialiser uniquement sur landing page
if (document.body.classList.contains('landing-page')) {
    initScrollToTop();
}

// ==================================================
// 4. SMOOTH SCROLL POUR LIENS ANCRES
// ==================================================

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#' || href.length <= 1) return;
        
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ==================================================
// 5. ANIMATIONS SCROLL (INTERSECTION OBSERVER)
// ==================================================

// Observer pour sections de contenu
const sectionObserver = new IntersectionObserver(
    (entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translate3d(0, 0, 0)';
            }
        });
    },
    { threshold: 0.1, rootMargin: '0px 0px -100px 0px' }
);

// Préparer et observer les sections
document.querySelectorAll('.content-section').forEach(section => {
    Object.assign(section.style, {
        opacity: '0',
        transform: 'translate3d(0, 15px, 0)',
        transition: 'opacity 0.5s ease, transform 0.5s ease'
    });
    sectionObserver.observe(section);
});

// ==================================================
// 6. ANIMATION ÉCHELONNÉE CARTES
// ==================================================

const cardsGrid = document.querySelector('.cards-grid');

if (cardsGrid) {
    // Préparer les cartes
    const cards = cardsGrid.querySelectorAll('.nav-card');
    cards.forEach(card => {
        Object.assign(card.style, {
            opacity: '0',
            transform: 'translate3d(0, 15px, 0)',
            transition: 'opacity 0.4s ease, transform 0.4s ease'
        });
    });
    
    // Observer la grille
    const cardObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    cards.forEach((card, index) => {
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translate3d(0, 0, 0)';
                        }, index * 80);
                    });
                    cardObserver.disconnect(); // Observer une seule fois
                }
            });
        },
        { threshold: 0.2 }
    );
    
    cardObserver.observe(cardsGrid);
}

// ==================================================
// 7. ANIMATION CARTES OBJECTIFS
// ==================================================

const objectivesGrid = document.querySelector('.objectives-grid');

if (objectivesGrid) {
    const objectives = objectivesGrid.querySelectorAll('.objective-card');
    objectives.forEach(card => {
        Object.assign(card.style, {
            opacity: '0',
            transform: 'translate3d(0, 20px, 0)',
            transition: 'opacity 0.5s ease, transform 0.5s ease'
        });
    });
    
    const objectivesObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    objectives.forEach((card, index) => {
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'translate3d(0, 0, 0)';
                        }, index * 100);
                    });
                    objectivesObserver.disconnect();
                }
            });
        },
        { threshold: 0.1 }
    );
    
    objectivesObserver.observe(objectivesGrid);
}

// ==================================================
// INITIALISATION COMPLÈTE
// ==================================================

console.log('🎨 Animations landing page initialisées');
