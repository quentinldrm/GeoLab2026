// ==================================================
// STATS UTILITIES - Calcul de statistiques LCZ/ICU
// ==================================================

'use strict';

/**
 * Formate un nombre avec des espaces entre les milliers
 * @param {number} num - Nombre à formater
 * @param {number} decimals - Nombre de décimales (défaut: 1)
 * @returns {string} - Nombre formaté
 */
function formatNumber(num, decimals = 1) {
    return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Calcule la surface des polygones d'une FeatureCollection GeoJSON
 * @param {Object} geojson - FeatureCollection GeoJSON
 * @param {string} attribute - Attribut à analyser (LCZ_PRIMAR, ICU_theori, etc.)
 * @param {string} source - Source des données ('wudapt', 'grid', 'geoclimate', etc.)
 * @returns {Object} - Statistiques par valeur d'attribut
 */
function calculateStats(geojson, attribute, source = 'geoclimate') {
    if (!geojson || !geojson.features) return {};

    const stats = {};

    geojson.features.forEach(feature => {
        let value = feature.properties[attribute];
        const geometry = feature.geometry;

        if (value === null || value === undefined) return;

        // Conversion WUDAPT : LCZ naturelles (11->101, 12->102, etc.)
        if (source === 'wudapt' && value >= 11 && value <= 17) {
            value = value + 90; // 11->101, 12->102, ..., 17->107
        }

        // Calculer la surface en utilisant la librairie turf
        let area = 0;
        if (geometry.type === 'Polygon') {
            area = calculatePolygonArea(geometry.coordinates);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                area += calculatePolygonArea(polygon);
            });
        }

        // Convertir de m² vers hectares
        area = area / 10000;

        if (!stats[value]) {
            stats[value] = {
                area: 0,
                count: 0
            };
        }

        stats[value].area += area;
        stats[value].count += 1;
    });

    return stats;
}

/**
 * Calcule l'aire d'un polygone en coordonnées géographiques (approximation sphérique)
 * @param {Array} coords - Coordonnées du polygone
 * @returns {number} - Aire en m²
 */
function calculatePolygonArea(coords) {
    // coords[0] contient les coordonnées extérieures du polygone
    const ring = coords[0];
    if (!ring || ring.length < 3) return 0;

    // Utiliser la formule de l'aire sphérique simplifiée
    let area = 0;
    const R = 6371000; // Rayon de la Terre en mètres

    for (let i = 0; i < ring.length - 1; i++) {
        const p1 = ring[i];
        const p2 = ring[i + 1];

        const lat1 = p1[1] * Math.PI / 180;
        const lat2 = p2[1] * Math.PI / 180;
        const lon1 = p1[0] * Math.PI / 180;
        const lon2 = p2[0] * Math.PI / 180;

        area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    area = Math.abs(area * R * R / 2);
    return area;
}

/**
 * Calcule les statistiques ICU (distribution par classes d'intensité)
 * @param {Object} geojson - FeatureCollection GeoJSON
 * @param {string} attribute - Attribut ICU
 * @returns {Object} - Statistiques par classe d'intensité
 */
function calculateICUStats(geojson, attribute) {
    if (!geojson || !geojson.features) return {};

    const classes = {
        'Très froid': { min: -Infinity, max: -2, area: 0, color: '#313695' },
        'Froid': { min: -2, max: -1, area: 0, color: '#4575b4' },
        'Frais': { min: -1, max: 0, area: 0, color: '#abd9e9' },
        'Neutre': { min: 0, max: 1, area: 0, color: '#ffffbf' },
        'Chaud': { min: 1, max: 2, area: 0, color: '#fdae61' },
        'Très chaud': { min: 2, max: 3, area: 0, color: '#f46d43' },
        'Extrême': { min: 3, max: Infinity, area: 0, color: '#a50026' }
    };

    geojson.features.forEach(feature => {
        const value = feature.properties[attribute];
        const geometry = feature.geometry;

        if (value === null || value === undefined) return;

        // Calculer la surface
        let area = 0;
        if (geometry.type === 'Polygon') {
            area = calculatePolygonArea(geometry.coordinates);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                area += calculatePolygonArea(polygon);
            });
        }

        // Convertir en hectares
        area = area / 10000;

        // Classer par plage de température
        for (const className in classes) {
            const range = classes[className];
            if (value >= range.min && value < range.max) {
                range.area += area;
                break;
            }
        }
    });

    return classes;
}

/**
 * Génère les données pour Chart.js à partir des statistiques LCZ
 * @param {Object} stats - Statistiques calculées
 * @returns {Object} - Données formatées pour Chart.js
 */
function prepareChartData(stats, type = 'lcz') {
    const sortedKeys = Object.keys(stats).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
    });

    const labels = [];
    const data = [];
    const colors = [];

    sortedKeys.forEach(key => {
        if (type === 'lcz') {
            const lczCode = parseInt(key);
            const label = lczCode >= 100
                ? `LCZ ${String.fromCharCode(64 + lczCode - 100)}`
                : `LCZ ${lczCode}`;
            labels.push(label);
            colors.push(MapUtils.lczColors[lczCode] || '#cccccc');
        } else {
            labels.push(key);
            colors.push(stats[key].color);
        }

        data.push(parseFloat(stats[key].area.toFixed(2)));
    });

    return { labels, data, colors };
}

/**
 * Calcule le total de la surface
 * @param {Object} stats - Statistiques
 * @returns {number} - Surface totale en hectares
 */
function getTotalArea(stats) {
    return Object.values(stats).reduce((sum, item) => sum + item.area, 0);
}
