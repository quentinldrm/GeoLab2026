// ==================================================
// LOADER HELPER - Chargement GeoJSON optimisé
// ==================================================

'use strict';

class GeoJSONLoader {
    constructor() {
        this.worker = null;
        if (typeof Worker !== 'undefined') {
            try {
                // Déterminer le chemin du worker en fonction de l'emplacement du script
                const scriptPath = document.currentScript?.src || window.location.href;
                const isSubfolder = scriptPath.includes('/map/') || scriptPath.includes('/icu/') || scriptPath.includes('/compare/');
                const workerPath = isSubfolder ? '../utils/geojson-worker.js' : 'utils/geojson-worker.js';
                this.worker = new Worker(workerPath);
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
        
        // 2. Charger et décompresser directement (plus fiable que le worker pour les fichiers .gz)
        try {
            console.log(`Loading ${filename}...`);
            const response = await fetch(filename);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            
            // Vérifier que pako est disponible
            if (typeof pako === 'undefined') {
                throw new Error('pako library not loaded');
            }
            
            console.log(`Decompressing ${filename}... (${arrayBuffer.byteLength} bytes)`);
            
            // Décompresser avec pako - essayer d'abord ungzip, puis inflate en fallback
            let decompressed;
            try {
                const uint8Array = new Uint8Array(arrayBuffer);
                // Essayer ungzip d'abord (pour les fichiers .gz)
                try {
                    decompressed = pako.ungzip(uint8Array, { to: 'string' });
                    console.log('✓ Used pako.ungzip');
                } catch (ungzipErr) {
                    // Fallback sur inflate (pour les fichiers deflate)
                    console.log('ungzip failed, trying inflate...');
                    decompressed = pako.inflate(uint8Array, { to: 'string' });
                    console.log('✓ Used pako.inflate');
                }
            } catch (decompErr) {
                console.error('Decompression error:', decompErr);
                throw new Error(`Decompression failed: ${decompErr.message}`);
            }
            
            console.log(`Parsing ${filename}... (${decompressed.length} chars)`);
            const data = JSON.parse(decompressed);
            
            // Mettre en cache
            try {
                await window.cacheManager.set(cacheKey, data);
                console.log(`✓ Cached: ${cacheKey}`);
            } catch (err) {
                console.warn('Cache write error:', err);
            }
            
            return data;
        } catch (err) {
            console.error(`Error loading ${filename}:`, err);
            throw err;
        }
    }
}

// Instance globale
window.geojsonLoader = new GeoJSONLoader();
