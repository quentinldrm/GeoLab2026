// ==================================================
// PRELOADER - Préchargement intelligent des données
// ==================================================

'use strict';

class DataPreloader {
    constructor() {
        this.isPreloading = false;
        this.preloadedYears = new Set();
    }
    
    // Précharger les années en arrière-plan
    async preloadYears(currentYear, source = 'geoclimate') {
        if (this.isPreloading) return;
        
        const years = ['2015', '2020', '2025', '2025_RF'].filter(y => y !== currentYear);
        this.isPreloading = true;
        
        console.log('🔄 Préchargement des autres années...');
        
        // Précharger en parallèle mais avec délai pour ne pas bloquer
        for (const year of years) {
            if (this.preloadedYears.has(year)) continue;
            
            await this.preloadYear(year);
            await this.delay(1000); // 1 sec entre chaque
        }
        
        this.isPreloading = false;
        console.log('✓ Préchargement terminé');
    }
    
    async preloadYear(year) {
        try {
            const source = year === '2025_RF' ? 'rf' : 'geoclimate';
            const actualYear = year === '2025_RF' ? '2025' : year;
            const filename = source === 'rf'
                ? `../data/LCZ${actualYear}_RF_4326.geojson.gz`
                : `../data/LCZ${actualYear}_4326.geojson.gz`;
            const cacheKey = `${actualYear}_${source}`;
            
            // Vérifier si déjà en cache
            const cached = await window.cacheManager.get(cacheKey);
            if (cached) {
                this.preloadedYears.add(year);
                return;
            }
            
            // Charger et mettre en cache
            await window.geojsonLoader.loadGeoJSON(filename, cacheKey);
            this.preloadedYears.add(year);
            console.log(`✓ Préchargé: ${year}`);
            
        } catch (err) {
            console.warn(`Échec préchargement ${year}:`, err);
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Démarrer le préchargement après un délai
    startPreloading(currentYear, source = 'geoclimate', delayMs = 3000) {
        setTimeout(() => {
            this.preloadYears(currentYear, source);
        }, delayMs);
    }
}

// Instance globale
window.dataPreloader = new DataPreloader();
