// ==================================================
// SCRIPT COMPARE.HTML - Version optimisée
// ==================================================

'use strict';

// ==================================================
// STATE & VARIABLES
// ==================================================

let leftLayer = null;
let rightLayer = null;
let currentLeftYear = '2015';
let currentRightYear = '2025';
let syncingMaps = false;
let pnrLayer = null;

const mapCenter = [48.9, 7.4];
const mapZoom = 11;

// ==================================================
// MAPS INITIALIZATION
// ==================================================

const mapLeft = L.map('mapLeft', { 
    zoomControl: false,
    attributionControl: false 
}).setView(mapCenter, mapZoom);

const mapRight = L.map('mapRight', { 
    zoomControl: false,
    attributionControl: false 
}).setView(mapCenter, mapZoom);

// Synchronize maps avec throttle pour éviter le lag
const syncLeftToRight = throttle(() => {
    if (!syncingMaps) {
        syncingMaps = true;
        mapRight.setView(mapLeft.getCenter(), mapLeft.getZoom(), { animate: false });
        syncingMaps = false;
    }
}, 50);

const syncRightToLeft = throttle(() => {
    if (!syncingMaps) {
        syncingMaps = true;
        mapLeft.setView(mapRight.getCenter(), mapRight.getZoom(), { animate: false });
        syncingMaps = false;
    }
}, 50);

mapLeft.on('move', syncLeftToRight);
mapRight.on('move', syncRightToLeft);


// Add base layers
[mapLeft, mapRight].forEach(map => {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 22
    }).addTo(map);
});

// Load PNR boundary
fetch('../data/PNR_VN_4326.geojson')
    .then(res => res.json())
    .then(data => {
        const style = { color: '#2d5016', weight: 3, fillOpacity: 0, dashArray: '10, 5' };
        pnrLayer = L.geoJSON(data, { style });
        [mapLeft, mapRight].forEach(map => {
            L.geoJSON(data, { style }).addTo(map);
        });
        
        // Initialize view on PNR bounds
        if (pnrLayer) {
            mapLeft.fitBounds(pnrLayer.getBounds());
        }
    })
    .catch(err => console.error('PNR load error:', err));

// ==================================================
// LCZ LAYER LOADING
// ==================================================

function loadLCZLayer(year, mapInstance, isLeft = true) {
    return new Promise((resolve, reject) => {
        const source = year === '2025_RF' ? 'rf' : 'geoclimate';
        const actualYear = year === '2025_RF' ? '2025' : year;
        const filename = source === 'rf' 
            ? `../data/LCZ${actualYear}_RF_4326.geojson.gz`
            : `../data/LCZ${actualYear}_4326.geojson.gz`;
        const lczAttribute = source === 'rf' ? 'LCZ' : 'LCZ_PRIMAR';
        const cacheKey = `${actualYear}_${source}`;
        
        window.geojsonLoader.loadGeoJSON(filename, cacheKey)
            .then(data => {
                const layer = createVectorLayer(data, lczAttribute, mapInstance);
                resolve(layer);
            })
            .catch(err => {
                console.error('Error loading layer:', err);
                reject(err);
            });
    });
}

// Fonction pour créer une couche vectorielle
function createVectorLayer(data, lczAttribute, mapInstance) {
    // Tolérance dynamique selon le niveau de zoom
    const zoom = mapInstance.getZoom();
    const tolerance = zoom > 14 ? 5 : zoom > 12 ? 8 : 12;
    
    const layer = L.vectorGrid.slicer(data, {
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
                const lczValue = properties[lczAttribute];
                const style = MapUtils.getLCZStyle(lczValue);
                style.stroke = false;
                style.weight = 0;
                return style;
            }
        }
    });
    
    layer.on('click', e => {
        const lczValue = e.layer.properties[lczAttribute];
        const name = MapUtils.lczNames[lczValue] || 'Non classé';
        const color = MapUtils.lczColors[lczValue] || '#808080';
        const lczDisplay = lczValue >= 100 ? String.fromCharCode(64 + lczValue - 100) : lczValue;
        
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
            maxWidth: 280,
            className: 'lcz-custom-popup'
        })
            .setLatLng(e.latlng)
            .setContent(`
                <div class="popup-lcz-container">
                    <div class="popup-lcz-header">
                        <div class="popup-lcz-color" style="background: ${color};"></div>
                        <div class="popup-lcz-info">
                            <div class="popup-lcz-code">LCZ ${lczDisplay}</div>
                            <div class="popup-lcz-name">${name}</div>
                        </div>
                    </div>
                    ${communeInfo}
                    <div class="popup-lcz-action">
                        <button class="popup-lcz-btn" onclick="openLczModal(${lczValue})">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <path d="M12 16v-4"></path>
                                <path d="M12 8h.01"></path>
                            </svg>
                            Plus d'informations
                        </button>
                    </div>
                </div>
            `)
            .openOn(mapInstance);
    });
    
    return layer;
}

async function updateMaps() {
    Loader.show('Chargement des deux cartes...');
    
    try {
        // Remove old layers
        if (leftLayer) mapLeft.removeLayer(leftLayer);
        if (rightLayer) mapRight.removeLayer(rightLayer);
        
        // Load both in parallel
        [leftLayer, rightLayer] = await Promise.all([
            loadLCZLayer(currentLeftYear, mapLeft, true),
            loadLCZLayer(currentRightYear, mapRight, false)
        ]);
        
        // Update year displays
        document.getElementById('leftYearDisplay').textContent = currentLeftYear;
        document.getElementById('rightYearDisplay').textContent = currentRightYear;
        
        Loader.hide();
    } catch (err) {
        Loader.hide();
        alert('Erreur de chargement');
    }
}

// ==================================================
// SEARCH FUNCTIONALITY
// ==================================================

let communesData = null;
let selectedCommuneLayerLeft = null;
let selectedCommuneLayerRight = null;
let dimOverlayLeft = null;
let dimOverlayRight = null;
let selectedCommuneName = null;

// Load communes data
fetch('../data/COMMUNES_PNR.geojson')
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

function selectCommune(feature) {
    // Remove previous selections
    if (selectedCommuneLayerLeft) {
        mapLeft.removeLayer(selectedCommuneLayerLeft);
    }
    if (selectedCommuneLayerRight) {
        mapRight.removeLayer(selectedCommuneLayerRight);
    }
    if (dimOverlayLeft) {
        mapLeft.removeLayer(dimOverlayLeft);
    }
    if (dimOverlayRight) {
        mapRight.removeLayer(dimOverlayRight);
    }
    
    // Create inverted mask (world polygon with commune as hole)
    const worldBounds = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]];
    
    // Extract commune coordinates (support MultiPolygon)
    let communeHoles = [];
    if (feature.geometry.type === 'Polygon') {
        communeHoles = feature.geometry.coordinates;
    } else if (feature.geometry.type === 'MultiPolygon') {
        communeHoles = feature.geometry.coordinates.flat(1);
    }
    
    // Create polygon with holes (world minus commune)
    const maskGeometry = {
        type: 'Polygon',
        coordinates: [worldBounds, ...communeHoles]
    };
    
    const maskStyle = {
        color: 'transparent',
        fillColor: 'white',
        fillOpacity: 1,
        interactive: false
    };
    
    dimOverlayLeft = L.geoJSON(maskGeometry, { style: maskStyle }).addTo(mapLeft);
    dimOverlayRight = L.geoJSON(maskGeometry, { style: maskStyle }).addTo(mapRight);
    
    // Add commune boundaries on top
    const communeStyle = {
        color: '#2d5016',
        weight: 4,
        fillOpacity: 0,
        fillColor: 'transparent'
    };
    
    selectedCommuneLayerLeft = L.geoJSON(feature, { style: communeStyle }).addTo(mapLeft);
    selectedCommuneLayerRight = L.geoJSON(feature, { style: communeStyle }).addTo(mapRight);
    
    // Save selected commune name
    selectedCommuneName = feature.properties.nom_offici;
    
    // Zoom to bounds
    const bounds = selectedCommuneLayerLeft.getBounds();
    mapLeft.fitBounds(bounds, { padding: [50, 50] });
    
    // Clear search input and suggestions
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    searchInput.value = feature.properties.nom_offici;
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    
    // Update stats with commune filter
    updateCompareStats();
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
        const population = feature.properties.population;
        return `
            <div class="suggestion-item" data-index="${communesData.indexOf(feature)}">
                <div class="suggestion-name">${nom}</div>
                <div class="suggestion-meta">${codeInsee}${population ? ' • ' + population.toLocaleString() + ' hab.' : ''}</div>
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
    if (selectedCommuneLayerLeft) {
        mapLeft.removeLayer(selectedCommuneLayerLeft);
        selectedCommuneLayerLeft = null;
    }
    if (selectedCommuneLayerRight) {
        mapRight.removeLayer(selectedCommuneLayerRight);
        selectedCommuneLayerRight = null;
    }
    if (dimOverlayLeft) {
        mapLeft.removeLayer(dimOverlayLeft);
        dimOverlayLeft = null;
    }
    if (dimOverlayRight) {
        mapRight.removeLayer(dimOverlayRight);
        dimOverlayRight = null;
    }
    
    selectedCommuneName = null;
    
    const searchInput = document.getElementById('searchInput');
    const suggestionsList = document.getElementById('suggestionsList');
    searchInput.value = '';
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
    
    syncingMaps = true;
    if (pnrLayer) {
        mapLeft.fitBounds(pnrLayer.getBounds());
    } else {
        mapLeft.setView([48.9, 7.4], 11);
    }
    syncingMaps = false;
    
    // Update stats without commune filter
    updateCompareStats();
}

// ==================================================
// EVENT LISTENERS
// ==================================================

// Year selection functions (called from HTML onchange)
window.loadLeftYear = function(year) {
    currentLeftYear = year;
    updateMapsWithStats();
};

window.loadRightYear = function(year) {
    currentRightYear = year;
    updateMapsWithStats();
};

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

// Slider de comparaison
const compareSlider = document.getElementById('compareSlider');
const leftSide = document.querySelector('.left-side');
const sliderHandle = document.querySelector('.slider-handle');

if (compareSlider && leftSide && sliderHandle) {
    const updateSliderPosition = () => {
        const value = parseFloat(compareSlider.value);
        
        // Update clip-path on left side container
        leftSide.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
        
        // Update handle position
        sliderHandle.style.left = `${value}%`;
    };
    
    compareSlider.addEventListener('input', updateSliderPosition);
    window.addEventListener('resize', updateSliderPosition);
    
    // Initialize
    setTimeout(updateSliderPosition, 100);
}

// ==================================================
// TUTORIAL INITIALIZATION
// ==================================================

new Tutorial('hasSeenCompareTutorial');

// ==================================================
// LEGEND TOGGLE
// ==================================================

function toggleLegend() {
    const legendBox = document.querySelector('.legend-box');
    if (legendBox) {
        legendBox.classList.toggle('open');
    }
}

// ==================================================
// STATS FUNCTIONALITY
// ==================================================

let compareChart = null;
let leftGeojsonData = null;
let rightGeojsonData = null;

// Widget toggle
function toggleWidget(widgetId) {
    const widget = document.getElementById(widgetId);
    const widgetContainer = widget?.closest('.map-widget');
    const toggleIcon = widgetContainer?.querySelector('.widget-toggle-icon');
    
    if (widgetContainer?.classList.contains('collapsed')) {
        widgetContainer.classList.remove('collapsed');
        if (toggleIcon) toggleIcon.textContent = '▲';
        if (widget) widget.style.display = 'block';
    } else {
        widgetContainer?.classList.add('collapsed');
        if (toggleIcon) toggleIcon.textContent = '▼';
        if (widget) widget.style.display = 'none';
    }
}

// Filter geojson data by commune
function filterDataByCommune(geojsonData, communeName) {
    if (!geojsonData || !communeName) return geojsonData;
    
    // Check if data has commune attributes
    const hasCommuneAttribute = geojsonData.features.some(f => 
        f.properties.nom_offici || f.properties.code_insee
    );
    
    if (!hasCommuneAttribute) {
        console.warn('Data does not have commune attributes (nom_offici/code_insee)');
        return geojsonData;
    }
    
    // Filter features by commune name
    const filteredFeatures = geojsonData.features.filter(feature => 
        feature.properties.nom_offici === communeName
    );
    
    return {
        type: 'FeatureCollection',
        features: filteredFeatures
    };
}

// Update statistics when data changes
function updateCompareStats() {
    const statsContent = document.getElementById('statsContent');
    const statsLoading = document.getElementById('statsLoading');
    
    if (!leftGeojsonData || !rightGeojsonData) return;
    
    if (statsLoading) statsLoading.style.display = 'flex';
    if (statsContent) statsContent.style.display = 'none';
    
    setTimeout(() => {
        const leftAttr = currentLeftYear === '2025_RF' ? 'LCZ' : 'LCZ_PRIMAR';
        const rightAttr = currentRightYear === '2025_RF' ? 'LCZ' : 'LCZ_PRIMAR';
        
        // Filter by commune if selected
        let leftDataToUse = leftGeojsonData;
        let rightDataToUse = rightGeojsonData;
        
        // Check which datasets have commune attributes
        const leftHasCommune = leftGeojsonData?.features?.some(f => 
            f.properties.nom_offici || f.properties.code_insee
        );
        const rightHasCommune = rightGeojsonData?.features?.some(f => 
            f.properties.nom_offici || f.properties.code_insee
        );
        
        if (selectedCommuneName) {
            // Filter left data if it has commune attributes
            if (leftHasCommune) {
                leftDataToUse = filterDataByCommune(leftGeojsonData, selectedCommuneName);
                console.log(`✓ Carte gauche (${currentLeftYear}) : filtré pour ${selectedCommuneName} → ${leftDataToUse.features.length} features`);
            } else {
                console.warn(`⚠ Carte gauche (${currentLeftYear}) : données sans attributs de commune. Affichage du PNR complet.`);
            }
            
            // Filter right data if it has commune attributes
            if (rightHasCommune) {
                rightDataToUse = filterDataByCommune(rightGeojsonData, selectedCommuneName);
                console.log(`✓ Carte droite (${currentRightYear}) : filtré pour ${selectedCommuneName} → ${rightDataToUse.features.length} features`);
            } else {
                console.warn(`⚠ Carte droite (${currentRightYear}) : données sans attributs de commune. Affichage du PNR complet.`);
            }
        }
        
        const leftStats = calculateStats(leftDataToUse, leftAttr);
        const rightStats = calculateStats(rightDataToUse, rightAttr);
        
        const leftTotal = getTotalArea(leftStats);
        const rightTotal = getTotalArea(rightStats);
        
        // Update context with warning if needed
        const statsContextValue = document.getElementById('statsContextValue');
        if (statsContextValue) {
            if (selectedCommuneName) {
                let contextText = selectedCommuneName;
                if (!leftHasCommune || !rightHasCommune) {
                    const missingYears = [];
                    if (!leftHasCommune) missingYears.push(currentLeftYear === '2025_RF' ? 'RF' : currentLeftYear);
                    if (!rightHasCommune) missingYears.push(currentRightYear === '2025_RF' ? 'RF' : currentRightYear);
                    contextText += ` ⚠️ (${missingYears.join(', ')} : données consolidées - filtrage impossible)`;
                }
                statsContextValue.textContent = contextText;
            } else {
                statsContextValue.textContent = 'Parc Naturel Régional';
            }
        }
        
        // Update summary
        document.getElementById('leftTotalArea').textContent = `${formatNumber(leftTotal, 0)} ha`;
        document.getElementById('rightTotalArea').textContent = `${formatNumber(rightTotal, 0)} ha`;
        document.getElementById('leftYearLabel').textContent = currentLeftYear === '2025_RF' ? 'RF' : currentLeftYear;
        document.getElementById('rightYearLabel').textContent = currentRightYear === '2025_RF' ? 'RF' : currentRightYear;
        document.getElementById('tableLeftYear').textContent = currentLeftYear === '2025_RF' ? 'RF' : currentLeftYear;
        document.getElementById('tableRightYear').textContent = currentRightYear === '2025_RF' ? 'RF' : currentRightYear;
        
        // Update chart
        renderCompareChart(leftStats, rightStats);
        
        // Update table
        fillCompareTable(leftStats, rightStats);
        
        if (statsLoading) statsLoading.style.display = 'none';
        if (statsContent) statsContent.style.display = 'block';
    }, 100);
}

// Render comparison chart
function renderCompareChart(leftStats, rightStats) {
    const canvas = document.getElementById('compareChart');
    if (!canvas) return;
    
    // Get all unique LCZ codes
    const allKeys = new Set([...Object.keys(leftStats), ...Object.keys(rightStats)]);
    const sortedKeys = Array.from(allKeys).sort((a, b) => parseInt(a) - parseInt(b));
    
    const labels = [];
    const leftData = [];
    const rightData = [];
    const colors = [];
    
    sortedKeys.forEach(key => {
        const lczCode = parseInt(key);
        const label = lczCode >= 100 
            ? `LCZ ${String.fromCharCode(64 + lczCode - 100)}`
            : `LCZ ${lczCode}`;
        labels.push(label);
        leftData.push(leftStats[key]?.area || 0);
        rightData.push(rightStats[key]?.area || 0);
        colors.push(MapUtils.lczColors[lczCode] || '#cccccc');
    });
    
    if (compareChart) {
        compareChart.destroy();
    }
    
    const leftYearLabel = currentLeftYear === '2025_RF' ? 'RF' : currentLeftYear;
    const rightYearLabel = currentRightYear === '2025_RF' ? 'RF' : currentRightYear;
    
    compareChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: leftYearLabel,
                    data: leftData,
                    backgroundColor: colors.map(c => c + 'CC'),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: rightYearLabel,
                    data: rightData,
                    backgroundColor: colors.map(c => c + '80'),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 15,
                        padding: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y, 1) + ' ha';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: {
                        font: { size: 10 },
                        callback: value => formatNumber(value, 0) + ' ha'
                    }
                }
            }
        }
    });
}

// Fill comparison table
function fillCompareTable(leftStats, rightStats) {
    const tbody = document.getElementById('compareStatsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Get all unique LCZ codes
    const allKeys = new Set([...Object.keys(leftStats), ...Object.keys(rightStats)]);
    const sortedKeys = Array.from(allKeys).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedKeys.forEach(key => {
        const lczCode = parseInt(key);
        const label = lczCode >= 100 
            ? `LCZ ${String.fromCharCode(64 + lczCode - 100)}`
            : `LCZ ${lczCode}`;
        const name = MapUtils.lczNames[lczCode] || 'Non classé';
        const color = MapUtils.lczColors[lczCode] || '#cccccc';
        
        const leftArea = leftStats[key]?.area || 0;
        const rightArea = rightStats[key]?.area || 0;
        const delta = rightArea - leftArea;
        const deltaSign = delta > 0 ? '+' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 2px;"></span>
                    <span style="font-weight: 500;">${label}</span>
                    <span style="font-size: 11px; color: #666;">${name}</span>
                </div>
            </td>
            <td style="text-align: right; white-space: nowrap;">${formatNumber(leftArea, 1)}</td>
            <td style="text-align: right; white-space: nowrap;">${formatNumber(rightArea, 1)}</td>
            <td style="text-align: right; color: ${delta > 0 ? '#27ae60' : delta < 0 ? '#e74c3c' : '#7f8c8d'}; font-weight: 500; white-space: nowrap;">
                ${deltaSign}${formatNumber(delta, 1)}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load geojson data for stats
async function loadGeojsonForStats(year) {
    const source = year === '2025_RF' ? 'rf' : 'geoclimate';
    const actualYear = year === '2025_RF' ? '2025' : year;
    const filename = source === 'rf' 
        ? `../data/LCZ${actualYear}_RF_4326.geojson.gz`
        : `../data/LCZ${actualYear}_4326.geojson.gz`;
    
    try {
        const res = await fetch(filename);
        if (!res.ok) throw new Error('File not found');
        return await res.json();
    } catch (err) {
        console.error(`Error loading ${filename}:`, err);
        return null;
    }
}

// Wrap original updateMaps to add stats loading
async function updateMapsWithStats() {
    Loader.show('Chargement des deux cartes...');
    
    try {
        // Remove old layers
        if (leftLayer) mapLeft.removeLayer(leftLayer);
        if (rightLayer) mapRight.removeLayer(rightLayer);
        
        // Load both in parallel
        [leftLayer, rightLayer, leftGeojsonData, rightGeojsonData] = await Promise.all([
            loadLCZLayer(currentLeftYear, mapLeft, true),
            loadLCZLayer(currentRightYear, mapRight, false),
            loadGeojsonForStats(currentLeftYear),
            loadGeojsonForStats(currentRightYear)
        ]);
        
        // Update year displays
        document.getElementById('leftYearDisplay').textContent = currentLeftYear === '2025_RF' ? 'RF' : currentLeftYear;
        document.getElementById('rightYearDisplay').textContent = currentRightYear === '2025_RF' ? 'RF' : currentRightYear;
        
        // Update stats
        updateCompareStats();
        
        Loader.hide();
    } catch (err) {
        console.error('Loading error:', err);
        Loader.hide();
    }
}

// ==================================================
// INITIAL LOAD
// ==================================================

// Initialiser le cache puis charger les cartes
window.cacheManager.init().then(() => {
    console.log('✓ Cache initialized');
    updateMapsWithStats();
}).catch(err => {
    console.warn('Cache init failed, continuing without cache:', err);
    updateMapsWithStats();
});

// ==================================================
// ACCESSIBILITY - KEYBOARD SHORTCUTS
// ==================================================

document.addEventListener('keydown', (e) => {
    // Ignore shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Except Escape to close suggestions
        if (e.key === 'Escape' && suggestionsList) {
            suggestionsList.style.display = 'none';
            e.target.blur();
        }
        return;
    }
    
    switch(e.key) {
        case 'Escape':
            // Close tutorial if open
            const tutorialOverlay = document.getElementById('tutorialOverlay');
            if (tutorialOverlay && !tutorialOverlay.classList.contains('hidden')) {
                tutorialOverlay.classList.add('hidden');
                e.preventDefault();
            }
            // Close any open popups
            mapLeft.closePopup();
            mapRight.closePopup();
            break;
            
        case '?':
        case 'h':
        case 'H':
            // Open help/tutorial
            const helpBtn = document.getElementById('helpBtn');
            if (helpBtn) {
                helpBtn.click();
                e.preventDefault();
            }
            break;
            
        case 'r':
        case 'R':
            // Reset selection
            if (!e.ctrlKey && !e.metaKey) {
                resetSelection();
                e.preventDefault();
            }
            break;
            
        case 'f':
        case 'F':
            // Focus search (Ctrl+F)
            if (e.ctrlKey || e.metaKey) {
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                    e.preventDefault();
                }
            }
            break;
            
        case 'ArrowLeft':
            // Move slider left
            if (compareSlider && document.activeElement !== compareSlider) {
                const currentValue = parseFloat(compareSlider.value);
                compareSlider.value = Math.max(0, currentValue - 5);
                compareSlider.dispatchEvent(new Event('input'));
                e.preventDefault();
            }
            break;
            
        case 'ArrowRight':
            // Move slider right
            if (compareSlider && document.activeElement !== compareSlider) {
                const currentValue = parseFloat(compareSlider.value);
                compareSlider.value = Math.min(100, currentValue + 5);
                compareSlider.dispatchEvent(new Event('input'));
                e.preventDefault();
            }
            break;
    }
});
