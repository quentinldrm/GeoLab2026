// ==================================================
// LOADER HELPER - Chargement GeoJSON optimisé
// ==================================================

'use strict';

class GeoJSONLoader {
    constructor() {
        this.worker = null;
        if (typeof Worker !== 'undefined') {
            try {
                this.worker = new Worker('../utils/geojson-worker.js');
            } catch (err) {
                console.warn('Worker non disponible:', err);
            }
        }
    }
    
    async loadGeoJSON(filename, cacheKey) {
        // 1. Vérifier cache IndexedDB
        try {
            const cached = await window.cacheManager.get(cacheKey);
            if (cached) {
                console.log(`✓ Loaded from cache: ${cacheKey}`);
                return cached;
            }
        } catch (err) {
            console.warn('Cache read error:', err);
        }
        
        // 2. Charger avec Worker si disponible
        if (this.worker) {
            return new Promise((resolve, reject) => {
                this.worker.postMessage({ action: 'fetchAndParse', url: filename });
                
                this.worker.onmessage = async (e) => {
                    if (e.data.success) {
                        const data = e.data.data;
                        
                        // Mettre en cache
                        try {
                            await window.cacheManager.set(cacheKey, data);
                        } catch (err) {
                            console.warn('Cache write error:', err);
                        }
                        
                        resolve(data);
                    } else {
                        reject(new Error(e.data.error));
                    }
                };
                
                this.worker.onerror = (err) => reject(err);
            });
        }
        
        // 3. Fallback : chargement classique avec pako
        try {
            const response = await fetch(filename);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
            const data = JSON.parse(decompressed);
            
            // Mettre en cache
            try {
                await window.cacheManager.set(cacheKey, data);
            } catch (err) {
                console.warn('Cache write error:', err);
            }
            
            return data;
        } catch (err) {
            console.error('Loading error:', err);
            throw err;
        }
    }
}

// Instance globale
window.geojsonLoader = new GeoJSONLoader();
