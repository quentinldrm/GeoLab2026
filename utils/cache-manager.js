// ==================================================
// CACHE MANAGER - IndexedDB pour cache persistant
// ==================================================

'use strict';

class CacheManager {
    constructor(dbName = 'GeoLabCache', version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Créer le store si nécessaire
                if (!db.objectStoreNames.contains('geojsonData')) {
                    db.createObjectStore('geojsonData', { keyPath: 'key' });
                }
            };
        });
    }
    
    async get(key) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geojsonData'], 'readonly');
            const store = transaction.objectStore('geojsonData');
            const request = store.get(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                if (request.result) {
                    console.log(`✓ Cache HIT: ${key}`);
                    resolve(request.result.data);
                } else {
                    console.log(`✗ Cache MISS: ${key}`);
                    resolve(null);
                }
            };
        });
    }
    
    async set(key, data) {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geojsonData'], 'readwrite');
            const store = transaction.objectStore('geojsonData');
            const request = store.put({
                key: key,
                data: data,
                timestamp: Date.now()
            });
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log(`✓ Cache SET: ${key}`);
                resolve();
            };
        });
    }
    
    async clear() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geojsonData'], 'readwrite');
            const store = transaction.objectStore('geojsonData');
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                console.log('✓ Cache cleared');
                resolve();
            };
        });
    }
    
    async getCacheSize() {
        if (!this.db) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['geojsonData'], 'readonly');
            const store = transaction.objectStore('geojsonData');
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const data = request.result;
                const sizeBytes = new Blob([JSON.stringify(data)]).size;
                const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
                resolve({ count: data.length, sizeMB });
            };
        });
    }
}

// Instance globale
window.cacheManager = new CacheManager();
