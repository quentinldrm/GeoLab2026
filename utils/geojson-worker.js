// ==================================================
// WEB WORKER - Décompression et Parsing GeoJSON
// ==================================================

'use strict';

// Import de pako pour la décompression (si nécessaire)
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

self.addEventListener('message', async (e) => {
    const { action, url, data } = e.data;
    
    try {
        if (action === 'fetchAndParse') {
            // Télécharger le fichier
            const response = await fetch(url);
            const blob = await response.blob();
            
            // Lire comme ArrayBuffer
            const arrayBuffer = await blob.arrayBuffer();
            
            // Décompresser avec pako
            const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
            
            // Parser le JSON
            const geojson = JSON.parse(decompressed);
            
            // Renvoyer les données
            self.postMessage({
                success: true,
                data: geojson
            });
        } else if (action === 'parseJSON') {
            // Juste parser du JSON déjà décompressé
            const geojson = JSON.parse(data);
            
            self.postMessage({
                success: true,
                data: geojson
            });
        }
    } catch (error) {
        self.postMessage({
            success: false,
            error: error.message
        });
    }
});
