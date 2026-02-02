// ==================================================
// SCRIPT ICU.HTML - Version optimisée
// ==================================================

'use strict';

// ==================================================
// ICU COLOR SCALE
// ==================================================

function getICUColor(deltaT) {
    if (deltaT == null) return '#cccccc';
    if (deltaT < -2) return '#313695';
    if (deltaT < -1) return '#4575b4';
    if (deltaT < -0.5) return '#74add1';
    if (deltaT < 0) return '#abd9e9';
    if (deltaT < 0.5) return '#e0f3f8';
    if (deltaT < 1) return '#ffffbf';
    if (deltaT < 1.5) return '#fee090';
    if (deltaT < 2) return '#fdae61';
    if (deltaT < 3) return '#f46d43';
    if (deltaT < 4) return '#d73027';
    return '#a50026';
}

// ==================================================
// STATE & VARIABLES
// ==================================================

let icuLayer = null;
let pnrLayer = null;
let currentYear = 2025;
let currentSource = 'geoclimate';
let currentOpacity = 1.0;
let icuChart = null;
let currentData = null;

// Cache pour éviter de recharger les données
const dataCache = new Map();

// Performance settings
const SIMPLIFY_TOLERANCE = 0.00005; // Simplification très légère

// ==================================================
// MAP INITIALIZATION
// ==================================================

const map = MapUtils.createMap('mapid');

// Load PNR boundary
fetch('Data/PNR_VN_4326.geojson')
    .then(res => res.json())
    .then(data => {
        pnrLayer = L.geoJSON(data, {
            style: { color: '#2d5016', weight: 3, fillOpacity: 0.1, fillColor: '#2d5016' },
            interactive: false
        }).addTo(map);
        map.fitBounds(pnrLayer.getBounds());
    })
    .catch(err => console.warn('PNR boundary not available:', err.message));

// ==================================================
// ICU LAYER MANAGEMENT
// ==================================================

function updateMap(year, source = 'geoclimate') {
    currentYear = year;
    currentSource = source;
    
    Loader.show('Chargement des données ICU...');
    
    if (icuLayer) map.removeLayer(icuLayer);
    
    // Update year display
    const yearDisplay = document.getElementById('currentYear');
    if (yearDisplay) {
        yearDisplay.textContent = source === 'rf' ? `${year} (RF)` : year;
    }
    
    const filename = source === 'rf' 
        ? `Data/LCZ${year}_RF_4326.geojson.gz`
        : `Data/LCZ${year}_4326.geojson.gz`;
    
    const icuAttribute = source === 'rf' ? 'UHI_Delta' : 'ICU_theori';
    const cacheKey = `${year}_${source}`;
    
    // Utiliser le loader optimisé
    window.geojsonLoader.loadGeoJSON(filename, cacheKey)
        .then(data => {
            currentData = data;
            createICULayer(data, icuAttribute);
            updateStats(data, icuAttribute);
            Loader.hide();
        })
        .catch(err => {
            console.error('Error loading ICU:', err);
            Loader.hide();
            alert(`Erreur de chargement : ${filename}`);
        });
}

// Fonction de simplification de géométries
function simplifyRing(ring, tolerance) {
    if (ring.length <= 4) return ring;
    
    // Pour les petits anneaux, ne pas simplifier
    if (ring.length < 50) return ring;
    
    // Simplification Douglas-Peucker basique
    const simplified = [ring[0]];
    let prevPoint = ring[0];
    
    for (let i = 1; i < ring.length - 1; i++) {
        const point = ring[i];
        const dx = Math.abs(point[0] - prevPoint[0]);
        const dy = Math.abs(point[1] - prevPoint[1]);
        
        // Garder le point si la distance est significative
        if (dx > tolerance || dy > tolerance) {
            simplified.push(point);
            prevPoint = point;
        }
    }
    
    // Toujours garder le dernier point (fermeture du polygone)
    simplified.push(ring[ring.length - 1]);
    
    // Vérifier qu'on a au moins 4 points
    return simplified.length >= 4 ? simplified : ring;
}

// Fonction pour créer la couche ICU
function createICULayer(data, icuAttribute) {
    if (icuLayer) {
        map.removeLayer(icuLayer);
        icuLayer = null;
    }
    
    // Tolérance dynamique selon le niveau de zoom
    const zoom = map.getZoom();
    const tolerance = zoom > 14 ? 5 : zoom > 12 ? 8 : 12;
    
    icuLayer = L.vectorGrid.slicer(data, {
        interactive: true,
        rendererFactory: L.svg.tile,
        maxNativeZoom: 15,
        maxZoom: 22,
        tolerance: tolerance,
        getFeatureId: f => f.properties.FID || f.properties.OBJECTID || f.properties.insee,
        vectorTileLayerOptions: {
            interactive: true,
            bubblingMouseEvents: false
        },
        vectorTileLayerStyles: {
            sliced: properties => {
                const deltaT = properties[icuAttribute];
                return {
                    fill: true,
                    fillColor: getICUColor(deltaT),
                    fillOpacity: deltaT != null ? currentOpacity : currentOpacity * 0.3,
                    stroke: false,
                    weight: 0
                };
            }
        }
    });
    
    icuLayer.on('click', e => {
        const deltaT = e.layer.properties[icuAttribute];
        const lczValue = e.layer.properties[currentSource === 'rf' ? 'LCZ' : 'LCZ_PRIMAR'];
        const lczName = MapUtils.lczNames[lczValue] || 'Non classé';
        const color = getICUColor(deltaT);
        const lczDisplay = lczValue >= 100 ? String.fromCharCode(64 + lczValue - 100) : lczValue;
        
        const tempText = deltaT != null ? deltaT.toFixed(2) + ' °C' : 'N/A';
        const tempClass = deltaT != null ? (deltaT > 2 ? 'high' : deltaT > 1 ? 'medium' : 'low') : 'na';
        
        // Convertir hex en RGB pour les styles avec opacité
        const hexToRgb = (hex) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : {r: 255, g: 255, b: 255};
        };
        
        const rgb = hexToRgb(color);
        const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
        
        // Assombrir les couleurs claires pour meilleure lisibilité
        const getDarkerColor = (hex) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            if (brightness > 200) {
                return `rgb(${Math.floor(r * 0.5)}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)})`;
            }
            return hex;
        };
        
        const textColor = deltaT != null ? getDarkerColor(color) : '#999';
        
        // Get commune info if available
        const communeName = e.layer.properties.nom_offici || null;
        const codeInsee = e.layer.properties.code_insee || null;
        const communeInfo = (communeName && codeInsee) 
            ? `<div class="popup-location">
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                       <circle cx="12" cy="10" r="3"/>
                   </svg>
                   <span><strong>${communeName}</strong> • ${codeInsee}</span>
               </div>`
            : '';
        
        L.popup({
            className: 'icu-custom-popup',
            closeButton: true,
            maxWidth: 300
        })
            .setLatLng(e.latlng)
            .setContent(`
                <div class="popup-icu-container">
                    <div class="popup-icu-header" style="background: linear-gradient(135deg, rgba(${rgbString}, 0.12), rgba(${rgbString}, 0.06)); border-bottom-color: rgba(${rgbString}, 0.15);">
                        <div class="popup-icu-color" style="background: ${color};"></div>
                        <div class="popup-icu-info">
                            <div class="popup-icu-label" style="color: ${textColor};">Îlot de chaleur</div>
                            <div class="popup-icu-temp temp-${tempClass}" style="color: ${textColor};">${tempText}</div>
                        </div>
                    </div>
                    ${communeInfo}
                    <div class="popup-icu-details">
                        <div class="popup-icu-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                            <span>Zone LCZ ${lczDisplay}</span>
                        </div>
                        <div class="popup-icu-row">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${textColor}" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>${lczName}</span>
                        </div>
                    </div>
                </div>
            `)
            .openOn(map);
    });
    
    icuLayer.addTo(map);
}

// ==================================================
// STATISTICS FUNCTIONALITY
// ==================================================

function updateStats(geojsonData, attribute) {
    const statsLoading = document.getElementById('statsLoading');
    const statsContent = document.getElementById('statsContent');
    
    if (statsLoading) statsLoading.style.display = 'flex';
    if (statsContent) statsContent.style.display = 'none';
    
    // Calculer les statistiques avec un léger délai
    setTimeout(() => {
        const stats = calculateICUStats(geojsonData, attribute);
        const totalArea = Object.values(stats).reduce((sum, item) => sum + item.area, 0);
        
        // Calculer la température moyenne pondérée
        let sumWeighted = 0;
        let sumArea = 0;
        geojsonData.features.forEach(feature => {
            const value = feature.properties[attribute];
            if (value !== null && value !== undefined) {
                const geometry = feature.geometry;
                let area = 0;
                if (geometry.type === 'Polygon') {
                    area = calculatePolygonArea(geometry.coordinates) / 10000;
                } else if (geometry.type === 'MultiPolygon') {
                    geometry.coordinates.forEach(polygon => {
                        area += calculatePolygonArea(polygon) / 10000;
                    });
                }
                sumWeighted += value * area;
                sumArea += area;
            }
        });
        const avgTemp = sumArea > 0 ? sumWeighted / sumArea : 0;
        
        // Mettre à jour les résumés
        document.getElementById('totalArea').textContent = `${formatNumber(totalArea, 0)} ha`;
        document.getElementById('avgTemp').textContent = `${avgTemp.toFixed(2)}°C`;
        
        // Préparer les données pour le graphique
        const chartData = prepareChartData(stats, 'icu');
        
        // Créer/Mettre à jour le graphique
        renderICUChart(chartData);
        
        // Remplir le tableau
        fillICUStatsTable(stats, totalArea);
        
        if (statsLoading) statsLoading.style.display = 'none';
        if (statsContent) statsContent.style.display = 'block';
    }, 100);
}

function renderICUChart(chartData) {
    const canvas = document.getElementById('icuChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire l'ancien graphique s'il existe
    if (icuChart) {
        icuChart.destroy();
    }
    
    icuChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Surface (ha)',
                data: chartData.data,
                backgroundColor: chartData.colors,
                borderColor: chartData.colors.map(c => c),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y} ha`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Surface (hectares)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Classe d\'intensité'
                    }
                }
            }
        }
    });
}

function fillICUStatsTable(stats, totalArea) {
    const tbody = document.getElementById('statsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Ordre logique : du froid au chaud
    const orderedClasses = ['Très froid', 'Froid', 'Frais', 'Neutre', 'Chaud', 'Très chaud', 'Extrême'];
    
    orderedClasses.forEach(className => {
        const value = stats[className];
        if (!value || value.area === 0) return;
        
        const percentage = ((value.area / totalArea) * 100).toFixed(1);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${value.color}; border-radius: 2px;"></span>
                    <span style="font-weight: 500;">${className}</span>
                </div>
            </td>
            <td style="text-align: right;">${formatNumber(value.area, 1)}</td>
            <td style="text-align: right;">${percentage}%</td>
        `;
        tbody.appendChild(row);
    });
}

// ==================================================
// SEARCH FUNCTIONALITY
// ==================================================

let communesData = null;
let selectedCommuneLayer = null;
let dimOverlay = null;

// Load communes data
fetch('Data/COMMUNES_PNR.geojson')
    .then(res => res.json())
    .then(data => {
        communesData = data.features;
    })
    .catch(err => console.error('Error loading communes:', err));

function searchCommunes(query) {
    if (!communesData || !query) return [];
    
    const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    return communesData
        .filter(feature => {
            const nom = feature.properties.nom_offici || '';
            const codeInsee = feature.properties.code_insee || '';
            const normalizedNom = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            return normalizedNom.includes(normalizedQuery) || codeInsee.includes(query);
        })
        .sort((a, b) => {
            const nomA = a.properties.nom_offici || '';
            const nomB = b.properties.nom_offici || '';
            return nomA.localeCompare(nomB);
        })
        .slice(0, 8);
}

// Filter ICU data by commune geometry using bounding box intersection
// Filter ICU data by commune - supports both formats:
// - New format: features have 'nom_offici' attribute (from QGIS intersection)
// - Old format: consolidated MultiPolygon without commune attributes
function filterDataByCommune(geojsonData, communeName) {
    if (!geojsonData || !communeName) return geojsonData;
    
    // Check if data has commune attributes (new format from QGIS intersection)
    const hasCommuneAttribute = geojsonData.features.length > 0 && 
                                 geojsonData.features[0].properties && 
                                 'nom_offici' in geojsonData.features[0].properties;
    
    if (hasCommuneAttribute) {
        // New format: simple attribute filtering (fast and precise!)
        console.log('Using new format (QGIS intersection) - filtering by nom_offici');
        const filteredFeatures = geojsonData.features.filter(feature => 
            feature.properties.nom_offici === communeName
        );
        
        console.log(`Filtered: ${filteredFeatures.length} features for ${communeName}`);
        
        return {
            type: 'FeatureCollection',
            features: filteredFeatures
        };
    } else {
        // Old format: consolidated data, cannot filter by commune
        console.warn('Using old format (consolidated data) - commune filtering not available');
        return geojsonData;
    }
}

function selectCommune(feature) {
    // Remove previous selection
    if (selectedCommuneLayer) {
        map.removeLayer(selectedCommuneLayer);
    }
    if (dimOverlay) {
        map.removeLayer(dimOverlay);
    }
    
    // Create inverted mask (world polygon with commune as hole)
    const worldBounds = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]];
    
    // Extract commune coordinates (support MultiPolygon)
    let communeHoles = [];
    if (feature.geometry.type === 'Polygon') {
        communeHoles = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'MultiPolygon') {
        // For MultiPolygon, take all polygon coordinates
        communeHoles = feature.geometry.coordinates.flat(1);
    }
    
    // Create polygon with holes (world minus commune)
    const maskGeometry = {
        type: 'Polygon',
        coordinates: [worldBounds, ...communeHoles]
    };
    
    dimOverlay = L.geoJSON(maskGeometry, {
        style: {
            color: 'transparent',
            fillColor: 'white',
            fillOpacity: 0.6,
            interactive: false
        },
        pane: 'overlayPane'  // Place it in overlayPane, below the ICU layer
    }).addTo(map);
    
    // Ensure ICU layer is on top
    if (icuLayer) {
        icuLayer.bringToFront();
    }
    
    // Add commune boundary on top
    selectedCommuneLayer = L.geoJSON(feature, {
        style: {
            color: '#2d5016',
            weight: 4,
            fillOpacity: 0,
            fillColor: 'transparent',
            interactive: false
        }
    }).addTo(map);
    
    // Zoom to bounds
    const bounds = selectedCommuneLayer.getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
    
    // Clear search input and suggestions
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    searchInput.value = feature.properties.nom_offici;
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    
    // Filter statistics by commune (if data format supports it)
    if (currentData) {
        const communeName = feature.properties.nom_offici;
        const filteredData = filterDataByCommune(currentData, communeName);
        const currentAttribute = 'ICU_theori';
        updateStats(filteredData, currentAttribute);
        
        // Update context label
        const contextValue = document.getElementById('statsContextValue');
        if (contextValue) {
            // Check if filtering worked (new format) or not (old format)
            if (filteredData.features.length < currentData.features.length) {
                contextValue.textContent = communeName;
                contextValue.style.fontSize = '';
            } else {
                contextValue.textContent = 'Parc Naturel Régional (données consolidées)';
                contextValue.style.fontSize = '0.8rem';
            }
        }
    }
}

function updateSuggestions() {
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    const query = searchInput.value.trim();
    
    if (query.length < 2) {
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';
        return;
    }
    
    const results = searchCommunes(query);
    
    if (results.length === 0) {
        suggestionsList.innerHTML = '<div class="suggestion-item no-result">Aucune commune trouvée</div>';
        suggestionsList.style.display = 'block';
        return;
    }
    
    suggestionsList.innerHTML = results.map(feature => {
        const nom = feature.properties.nom_offici;
        const codeInsee = feature.properties.code_insee;
        return `
            <div class="suggestion-item" data-index="${communesData.indexOf(feature)}">
                <div class="suggestion-name">${nom}</div>
                <div class="suggestion-meta">${codeInsee}</div>
            </div>
        `;
    }).join('');
    
    suggestionsList.style.display = 'block';
    
    // Add click handlers
    suggestionsList.querySelectorAll('.suggestion-item').forEach(item => {
        if (!item.classList.contains('no-result')) {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                selectCommune(communesData[index]);
            });
        }
    });
}

function resetSelection() {
    if (selectedCommuneLayer) {
        map.removeLayer(selectedCommuneLayer);
        selectedCommuneLayer = null;
    }
    if (dimOverlay) {
        map.removeLayer(dimOverlay);
        dimOverlay = null;
    }
    
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    searchInput.value = '';
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    
    if (pnrLayer) {
        map.fitBounds(pnrLayer.getBounds());
    } else {
        map.setView([48.9, 7.4], 11);
    }
    
    // Reset statistics to full PNR
    if (currentData) {
        const currentAttribute = 'ICU_theori';
        updateStats(currentData, currentAttribute);
        
        // Update context label
        const contextValue = document.getElementById('statsContextValue');
        if (contextValue) {
            contextValue.textContent = 'Parc Naturel Régional';
        }
    }
}

// ==================================================
// EVENT LISTENERS
// ==================================================

// Year selector
document.querySelectorAll('.year-option').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.year-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const year = btn.dataset.year;
        const source = btn.dataset.source || 'geoclimate';
        updateMap(year, source);
    });
});

// Search
const searchInput = document.getElementById('searchInput');
const suggestionsList = document.getElementById('suggestionsList');

if (searchInput) {
    searchInput.addEventListener('input', updateSuggestions);
    searchInput.addEventListener('focus', updateSuggestions);
    
    // Close suggestions on click outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
            suggestionsList.style.display = 'none';
        }
    });
}

document.getElementById('searchBtn')?.addEventListener('click', () => {
    if (searchInput.value.trim().length >= 2) {
        const results = searchCommunes(searchInput.value.trim());
        if (results.length > 0) {
            selectCommune(results[0]);
        }
    }
});

if (searchInput) {
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const results = searchCommunes(searchInput.value.trim());
            if (results.length > 0) {
                selectCommune(results[0]);
            }
        }
    });
}

// Reset button
document.getElementById('resetBtn')?.addEventListener('click', resetSelection);

// ==================================================
// TUTORIAL INITIALIZATION
// ==================================================

new Tutorial('hasSeenIcuTutorial');

// ==================================================
// LEGEND TOGGLE
// ==================================================

// ==================================================
// LAYER CONTROLS SETUP (Opacity + Basemap)
// ==================================================

document.addEventListener('DOMContentLoaded', () => {
    const opacitySlider = document.getElementById('opacitySlider');
    const opacityValue = document.getElementById('opacityValue');
    const basemapToggle = document.getElementById('basemapToggle');
    const basemapLabel = document.getElementById('basemapLabel');
    
    // Opacity Control
    if (opacitySlider && opacityValue) {
        opacitySlider.addEventListener('input', (e) => {
            currentOpacity = e.target.value / 100;
            opacityValue.textContent = `${e.target.value}%`;
            
            // Changer directement l'opacité de la couche
            if (icuLayer && icuLayer.setOpacity) {
                icuLayer.setOpacity(currentOpacity);
                // Forcer le redraw pour mise à jour immédiate
                if (icuLayer.redraw) icuLayer.redraw();
            }
        });
    }
    
    // Basemap Toggle Control
    if (basemapToggle && basemapLabel && map._baseLayers) {
        const basemapIcon = document.getElementById('basemapIcon');
        
        basemapToggle.addEventListener('click', () => {
            if (map._currentBaseLayer === 'light') {
                // Switch to satellite
                map.removeLayer(map._baseLayers.light);
                map.addLayer(map._baseLayers.satellite);
                map._currentBaseLayer = 'satellite';
                basemapLabel.textContent = 'Carte';
                // Changer l'icône pour la carte (map)
                if (basemapIcon) {
                    basemapIcon.innerHTML = '<path d="M3 6l6-3 6 3 6-3v13l-6 3-6-3-6 3V6z"/><path d="M9 3v13M15 6v13"/>';
                }
            } else {
                // Switch to light
                map.removeLayer(map._baseLayers.satellite);
                map.addLayer(map._baseLayers.light);
                map._currentBaseLayer = 'light';
                basemapLabel.textContent = 'Satellite';
                // Changer l'icône pour le satellite (globe)
                if (basemapIcon) {
                    basemapIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';
                }
            }
            
            // Remettre les couches au-dessus du fond de carte
            if (pnrLayer) pnrLayer.bringToFront();
            if (icuLayer) icuLayer.bringToFront();
        });
    }
});

// ==================================================
// NOUVEAUX WIDGETS - Coordonnées, Stats, Mini-carte
// ==================================================

// Toggle widget collapse/expand
function toggleWidget(widgetId) {
    const widget = document.getElementById(widgetId);
    if (widget) {
        widget.parentElement.classList.toggle('collapsed');
    }
}
window.toggleWidget = toggleWidget;

// ==================================================
// Widget Coordonnées & Zoom
// ==================================================

const coordsLat = document.getElementById('coordsLat');
const coordsLon = document.getElementById('coordsLon');

// Update coordinates on mouse move
map.on('mousemove', (e) => {
    if (coordsLat && coordsLon) {
        coordsLat.textContent = e.latlng.lat.toFixed(4) + '°';
        coordsLon.textContent = e.latlng.lng.toFixed(4) + '°';
    }
});

// ==================================================
// INITIAL LOAD
// ==================================================

// Initialiser le cache puis charger la carte
window.cacheManager.init().then(() => {
    console.log('✓ Cache initialized');
    updateMap(2025, 'geoclimate');
    // Démarrer le préchargement des autres années après 3 secondes
    window.dataPreloader.startPreloading('2025', 'geoclimate', 3000);
}).catch(err => {
    console.warn('Cache init failed, continuing without cache:', err);
    updateMap(2025, 'geoclimate');
});
