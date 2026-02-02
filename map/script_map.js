// ==================================================
// SCRIPT MAP.HTML - Version optimisée
// ==================================================

'use strict';

// ==================================================
// STATE & VARIABLES
// ==================================================

let lczLayer = null;
let pnrLayer = null;
let currentYear = 2025;
let currentSource = 'geoclimate';
let currentOpacity = 1.0;
let lczChart = null;
let currentData = null;

// ==================================================
// MAP INITIALIZATION
// ==================================================

const map = MapUtils.createMap('mapid');

// Load PNR boundary
fetch('../data/PNR_VN_4326.geojson')
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
// LCZ LAYER MANAGEMENT
// ==================================================

function updateMap(year, source = 'geoclimate') {
    currentYear = year;
    currentSource = source;
    
    Loader.show('Chargement des données LCZ...');
    
    if (lczLayer) map.removeLayer(lczLayer);
    
    // Update year display
    const yearDisplay = document.getElementById('currentYear');
    if (yearDisplay) {
        yearDisplay.textContent = source === 'rf' ? `${year} (RF)` : year;
    }
    
    const filename = source === 'rf' 
        ? `../data/LCZ${year}_RF_4326.geojson.gz`
        : `../data/LCZ${year}_4326.geojson.gz`;
    
    const lczAttribute = source === 'rf' ? 'LCZ' : 'LCZ_PRIMAR';
    const cacheKey = `${year}_${source}`;
    
    // Utiliser le loader optimisé
    window.geojsonLoader.loadGeoJSON(filename, cacheKey)
        .then(data => {
            currentData = data;
            createLCZLayer(data, lczAttribute);
            updateStats(data, lczAttribute);
            Loader.hide();
        })
        .catch(err => {
            console.error('Error loading LCZ:', err);
            Loader.hide();
            alert(`Erreur de chargement : ${filename}`);
        });
}

// Fonction pour créer la couche LCZ
function createLCZLayer(data, lczAttribute) {
    if (lczLayer) {
        map.removeLayer(lczLayer);
        lczLayer = null;
    }
    
    // Tolérance dynamique selon le niveau de zoom
    const zoom = map.getZoom();
    const tolerance = zoom > 14 ? 5 : zoom > 12 ? 8 : 12;
    
    lczLayer = L.vectorGrid.slicer(data, {
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
                style.fillOpacity = currentOpacity;
                style.stroke = false;
                style.weight = 0;
                return style;
            }
        }
    });
    
    lczLayer.on('click', e => {
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
            .openOn(map);
    });
    
    lczLayer.addTo(map);
}

// ==================================================
// STATISTICS FUNCTIONALITY
// ==================================================

function updateStats(geojsonData, attribute) {
    const statsLoading = document.getElementById('statsLoading');
    const statsContent = document.getElementById('statsContent');
    
    if (statsLoading) statsLoading.style.display = 'flex';
    if (statsContent) statsContent.style.display = 'none';
    
    // Calculer les statistiques avec un léger délai pour laisser l'UI répondre
    setTimeout(() => {
        const stats = calculateStats(geojsonData, attribute);
        const totalArea = getTotalArea(stats);
        const typesCount = Object.keys(stats).length;
        
        // Mettre à jour les résumés
        document.getElementById('totalArea').textContent = `${formatNumber(totalArea, 0)} ha`;
        document.getElementById('typesCount').textContent = typesCount;
        
        // Préparer les données pour le graphique
        const chartData = prepareChartData(stats, 'lcz');
        
        // Créer/Mettre à jour le graphique
        renderChart(chartData);
        
        // Remplir le tableau
        fillStatsTable(stats, totalArea);
        
        if (statsLoading) statsLoading.style.display = 'none';
        if (statsContent) statsContent.style.display = 'block';
    }, 100);
}

function renderChart(chartData) {
    const canvas = document.getElementById('lczChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Détruire l'ancien graphique s'il existe
    if (lczChart) {
        lczChart.destroy();
    }
    
    lczChart = new Chart(ctx, {
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
                        text: 'Type LCZ'
                    }
                }
            }
        }
    });
}

function fillStatsTable(stats, totalArea) {
    const tbody = document.getElementById('statsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Trier par surface décroissante
    const sortedEntries = Object.entries(stats).sort((a, b) => b[1].area - a[1].area);
    
    sortedEntries.forEach(([key, value]) => {
        const lczCode = parseInt(key);
        const label = lczCode >= 100 
            ? `LCZ ${String.fromCharCode(64 + lczCode - 100)}`
            : `LCZ ${lczCode}`;
        const name = MapUtils.lczNames[lczCode] || 'Non classé';
        const color = MapUtils.lczColors[lczCode] || '#cccccc';
        const percentage = ((value.area / totalArea) * 100).toFixed(1);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="display: inline-block; width: 12px; height: 12px; background: ${color}; border-radius: 2px;"></span>
                    <span style="font-weight: 500;">${label}</span>
                    <span style="font-size: 11px; color: #666;">${name}</span>
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

// ==================================================
// SEARCH FUNCTIONALITY
// ==================================================

let communesData = null;
let selectedCommuneLayer = null;
let dimOverlay = null;

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

// Filter LCZ data by commune - supports both formats:
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
        pane: 'overlayPane'  // Place it in overlayPane, below the LCZ layer
    }).addTo(map);
    
    // Ensure LCZ layer is on top
    if (lczLayer) {
        lczLayer.bringToFront();
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
        const currentAttribute = currentSource === 'rf' ? 'LCZ' : 'LCZ_PRIMAR';
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
        const currentAttribute = currentSource === 'rf' ? 'LCZ' : 'LCZ_PRIMAR';
        updateStats(currentData, currentAttribute);
        
        // Update context label
        const contextValue = document.getElementById('statsContextValue');
        if (contextValue) {
            contextValue.textContent = 'Parc Naturel Régional';
            contextValue.style.fontSize = '';
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

new Tutorial('hasSeenMapTutorial');

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
// LCZ MODAL (Details)
// ==================================================

const lczDescriptions = {
    1: { 
        title: 'Compact haute densité', 
        desc: `<strong>Caractéristiques :</strong> Zone dense de bâtiments très hauts (> 10 étages) formant des canyons urbains profonds. Surface bâtie > 40%, espaces verts < 10%.<br><br>
        <strong>Impact thermique :</strong> Forte accumulation de chaleur diurne et nocturne. Réduction importante du refroidissement nocturne due au piégeage radiatif. Îlot de chaleur urbain maximal (+4 à +8°C).<br><br>
        <strong>Exemples :</strong> Centres-villes denses, quartiers d'affaires (La Défense, Manhattan).`
    },
    2: { 
        title: 'Compact moyenne densité', 
        desc: `<strong>Caractéristiques :</strong> Bâtiments de hauteur moyenne (3-9 étages) densément disposés. Surface bâtie 40-70%, espaces verts 10-20%. Rues étroites avec peu de végétation.<br><br>
        <strong>Impact thermique :</strong> Accumulation thermique importante, refroidissement nocturne limité. Îlot de chaleur urbain marqué (+3 à +6°C).<br><br>
        <strong>Exemples :</strong> Quartiers résidentiels urbains anciens, centres historiques (Strasbourg centre, vieille ville de Nice).`
    },
    3: { 
        title: 'Compact basse densité', 
        desc: `<strong>Caractéristiques :</strong> Bâtiments bas (1-3 étages) en continuité formant des blocs compacts. Surface bâtie 40-70%, espaces verts < 20%. Matériaux variés.<br><br>
        <strong>Impact thermique :</strong> Réchauffement modéré à fort, surtout en journée. Refroidissement nocturne partiel. Îlot de chaleur urbain (+2 à +5°C).<br><br>
        <strong>Exemples :</strong> Villages alsaciens compacts, lotissements en bande, zones pavillonnaires denses.`
    },
    4: { 
        title: 'Ouvert haute densité', 
        desc: `<strong>Caractéristiques :</strong> Tours et immeubles très hauts (> 10 étages) bien espacés dans un parc paysager. Surface bâtie 20-40%, espaces verts 30-60%.<br><br>
        <strong>Impact thermique :</strong> Contrastes thermiques importants entre zones ensoleillées et ombragées. Bon refroidissement nocturne grâce aux espaces ouverts. Îlot de chaleur modéré (+1 à +3°C).<br><br>
        <strong>Exemples :</strong> Grands ensembles, tours dans un parc (Meinau à Strasbourg, grands ensembles années 60-70).`
    },
    5: { 
        title: 'Ouvert moyenne densité', 
        desc: `<strong>Caractéristiques :</strong> Bâtiments de hauteur moyenne (3-9 étages) espacés avec végétation entre les structures. Surface bâtie 20-40%, espaces verts 30-50%.<br><br>
        <strong>Impact thermique :</strong> Réchauffement modéré, bon équilibre entre bâti et végétation. Refroidissement nocturne efficace. Îlot de chaleur faible (+1 à +3°C).<br><br>
        <strong>Exemples :</strong> Quartiers résidentiels aérés, petits collectifs avec jardins (quartiers périurbains récents).`
    },
    6: { 
        title: 'Ouvert basse densité', 
        desc: `<strong>Caractéristiques :</strong> Maisons individuelles avec jardins privatifs. Surface bâtie < 25%, espaces verts > 60%. Végétation arborée abondante (feuillus/conifères).<br><br>
        <strong>Impact thermique :</strong> Faible accumulation de chaleur grâce à la végétation et l'évapotranspiration. Excellent refroidissement nocturne. Îlot de fraîcheur (+0 à +2°C).<br><br>
        <strong>Exemples :</strong> Zones pavillonnaires, villages ruraux, hameaux du PNR des Vosges du Nord.`
    },
    7: { 
        title: 'Léger basse densité', 
        desc: `<strong>Caractéristiques :</strong> Structures légères et temporaires, constructions basses avec espaces ouverts. Matériaux légers (bois, tôle). Surface bâtie < 20%.<br><br>
        <strong>Impact thermique :</strong> Peu d'accumulation thermique, réchauffement et refroidissement rapides. Comportement thermique proche des zones naturelles.<br><br>
        <strong>Exemples :</strong> Zones de loisirs, campings, cabanes, structures agricoles légères.`
    },
    8: { 
        title: 'Large basse densité', 
        desc: `<strong>Caractéristiques :</strong> Grands bâtiments (hangars, entrepôts, centres commerciaux) de faible hauteur (< 3 étages) bien espacés. Surface bâtie 30-50%, peu de végétation.<br><br>
        <strong>Impact thermique :</strong> Réchauffement diurne important des toitures et parkings. Refroidissement nocturne rapide. Îlot de chaleur diurne marqué (+2 à +4°C).<br><br>
        <strong>Exemples :</strong> Zones commerciales (Rivetoile), entrepôts logistiques, hypermarchés avec parkings.`
    },
    9: { 
        title: 'Clairsemé', 
        desc: `<strong>Caractéristiques :</strong> Bâtiments très dispersés (< 10% de surface bâtie) dans un environnement naturel dominant. Végétation naturelle ou agricole > 80%.<br><br>
        <strong>Impact thermique :</strong> Comportement thermique quasi-naturel. Pas d'îlot de chaleur urbain. Températures proches des zones rurales environnantes.<br><br>
        <strong>Exemples :</strong> Hameaux isolés, fermes dispersées, constructions en zone forestière du PNR.`
    },
    10: { 
        title: 'Industrie lourde', 
        desc: `<strong>Caractéristiques :</strong> Zones industrielles avec structures métalliques, silos, cheminées. Matériaux : métal, béton, pierre. Très peu de végétation (< 5%). Émissions de chaleur anthropique.<br><br>
        <strong>Impact thermique :</strong> Forte accumulation diurne et nocturne. Chaleur anthropique additionnelle. Îlot de chaleur très marqué (+4 à +10°C), même la nuit.<br><br>
        <strong>Exemples :</strong> Usines sidérurgiques, raffineries, zones industrielles lourdes (Fos-sur-Mer, zones portuaires).`
    },
    101: { 
        title: 'Arbres denses (A)', 
        desc: `<strong>Caractéristiques :</strong> Forêts denses avec couvert arboré > 75%. Strate arborée haute (> 10m). Ombrage maximal, sous-bois développé.<br><br>
        <strong>Impact thermique :</strong> Forte régulation thermique par évapotranspiration et ombrage. Fraîcheur diurne importante (-3 à -6°C par rapport aux zones ouvertes). Îlot de fraîcheur urbain.<br><br>
        <strong>Exemples :</strong> Forêts domaniales des Vosges du Nord, massifs forestiers (chênaies, hêtraies, sapinières).`
    },
    102: { 
        title: 'Arbres dispersés (B)', 
        desc: `<strong>Caractéristiques :</strong> Arbres éparpillés (couvert 25-75%) avec espaces ouverts entre eux. Végétation herbacée en sous-strate. Arbres d'alignement, bosquets.<br><br>
        <strong>Impact thermique :</strong> Régulation thermique modérée. Ombrage partiel, évapotranspiration moyenne. Fraîcheur diurne (-1 à -3°C).<br><br>
        <strong>Exemples :</strong> Vergers, parcs urbains arborés, alignements d'arbres, prairies avec arbres fruitiers.`
    },
    103: { 
        title: 'Buissons, arbustes (C)', 
        desc: `<strong>Caractéristiques :</strong> Végétation arbustive basse (< 2m). Maquis, landes, haies, friches arbustives. Couvert végétal dense mais bas.<br><br>
        <strong>Impact thermique :</strong> Régulation thermique faible à modérée. Ombrage limité mais évapotranspiration présente. Comportement intermédiaire (-0,5 à -2°C).<br><br>
        <strong>Exemples :</strong> Friches, haies bocagères, landes des sommets vosgiens, zones en recolonisation forestière.`
    },
    104: { 
        title: 'Plantes basses (D)', 
        desc: `<strong>Caractéristiques :</strong> Végétation herbacée basse (< 50cm). Prairies, pelouses, cultures agricoles, terrains de sport. Couvert végétal > 90%.<br><br>
        <strong>Impact thermique :</strong> Évapotranspiration importante mais ombrage nul. Réchauffement diurne marqué en été, refroidissement nocturne efficace. Amplitude thermique forte.<br><br>
        <strong>Exemples :</strong> Prairies agricoles, cultures céréalières, pelouses urbaines, terrains de football.`
    },
    105: { 
        title: 'Roche nue / pavé (E)', 
        desc: `<strong>Caractéristiques :</strong> Surfaces minérales imperméables > 90%. Roche nue, parkings asphaltés, routes, places pavées. Aucune végétation.<br><br>
        <strong>Impact thermique :</strong> Accumulation thermique maximale en journée. Surfaces très chaudes au toucher (> 50°C l'été). Refroidissement nocturne rapide mais températures élevées. Îlot de chaleur fort (+5 à +12°C le jour).<br><br>
        <strong>Exemples :</strong> Parkings, routes, carrières, affleurements rocheux, places minérales.`
    },
    106: { 
        title: 'Sol nu / sable (F)', 
        desc: `<strong>Caractéristiques :</strong> Surfaces sableuses ou terreuses non végétalisées. Sol nu, chantiers, terrains agricoles labourés, plages. Matériaux meubles et clairs.<br><br>
        <strong>Impact thermique :</strong> Fort réchauffement diurne mais refroidissement nocturne très rapide. Amplitude thermique extrême. Albédo élevé (réflexion solaire).<br><br>
        <strong>Exemples :</strong> Chantiers, carrières de sable, terrains vagues, vignes en hiver, sols labourés.`
    },
    107: { 
        title: 'Eau (G)', 
        desc: `<strong>Caractéristiques :</strong> Plans d'eau permanents ou temporaires. Rivières, étangs, lacs, réservoirs, mares. Surface aquatique > 90%.<br><br>
        <strong>Impact thermique :</strong> Forte inertie thermique. Régulation des températures par évaporation. Fraîcheur diurne en été (-2 à -4°C à proximité). Réchauffement lent, refroidissement lent. Modération des extrêmes.<br><br>
        <strong>Exemples :</strong> Étangs des Vosges du Nord, Ill, Sauer, Moder, plans d'eau de loisirs, réservoirs.`
    }
};

function openLczModal(lczCode) {
    const info = lczDescriptions[lczCode];
    if (!info) return;
    
    const modal = document.getElementById('lczModal');
    const color = MapUtils.lczColors[lczCode] || '#808080';
    
    // Parse description sections
    const sections = info.desc.split('<br><br>');
    
    document.getElementById('modalColor').style.background = color;
    document.getElementById('modalTitle').textContent = info.title;
    document.getElementById('modalCode').textContent = `LCZ ${lczCode >= 100 ? String.fromCharCode(64 + lczCode - 100) : lczCode}`;
    
    // Create formatted content with icons
    document.getElementById('modalBody').innerHTML = `
        <div class="lcz-detail-section">
            <div class="lcz-section-icon" style="background: linear-gradient(135deg, ${color}22, ${color}11);">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
            </div>
            <div class="lcz-section-content">${sections[0]}</div>
        </div>
        
        <div class="lcz-detail-section">
            <div class="lcz-section-icon" style="background: linear-gradient(135deg, #ff660022, #ff660011);">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff6600" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="12" y1="18" x2="12" y2="12"></line>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
            </div>
            <div class="lcz-section-content">${sections[1] || ''}</div>
        </div>
        
        <div class="lcz-detail-section">
            <div class="lcz-section-icon" style="background: linear-gradient(135deg, #0088cc22, #0088cc11);">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0088cc" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            </div>
            <div class="lcz-section-content">${sections[2] || ''}</div>
        </div>
    `;
    
    modal.style.display = 'flex';
}

function closeLczModal(event) {
    if (!event || event.target.id === 'lczModal' || event.target.classList.contains('lcz-modal-close')) {
        document.getElementById('lczModal').style.display = 'none';
    }
}

// Attach click events to legend items
document.addEventListener('DOMContentLoaded', () => {
    const legendItems = document.querySelectorAll('.legend-item');
    const lczCodes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 101, 102, 103, 104, 105, 106, 107];
    
    legendItems.forEach((item, index) => {
        if (index < lczCodes.length) {
            item.style.cursor = 'pointer';
            item.onclick = () => openLczModal(lczCodes[index]);
        }
    });
    
    // ==================================================
    // LAYER CONTROLS SETUP (Opacity + Basemap)
    // ==================================================
    
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
            if (lczLayer && lczLayer.setOpacity) {
                lczLayer.setOpacity(currentOpacity);
                // Forcer le redraw pour mise à jour immédiate
                if (lczLayer.redraw) lczLayer.redraw();
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
            if (lczLayer) lczLayer.bringToFront();
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
const mapScale = document.getElementById('mapScale');

// Update coordinates on mouse move
map.on('mousemove', (e) => {
    if (coordsLat && coordsLon) {
        coordsLat.textContent = e.latlng.lat.toFixed(4) + '°';
        coordsLon.textContent = e.latlng.lng.toFixed(4) + '°';
    }
});

// Update scale on zoom or move
function updateMapScale() {
    if (!mapScale) return;
    
    const zoom = map.getZoom();
    const center = map.getCenter();
    const latRadians = center.lat * Math.PI / 180;
    
    // Calcul de l'échelle en mètres par pixel
    const metersPerPixel = 156543.03392 * Math.cos(latRadians) / Math.pow(2, zoom);
    
    // Largeur de la carte en pixels (approximation)
    const mapWidthPixels = map.getSize().x;
    const mapWidthMeters = metersPerPixel * mapWidthPixels;
    
    // Format pour affichage
    let scaleText;
    if (mapWidthMeters >= 1000) {
        scaleText = '1:' + Math.round(mapWidthMeters).toLocaleString('fr-FR');
    } else {
        scaleText = '1:' + Math.round(mapWidthMeters);
    }
    
    mapScale.textContent = scaleText;
}

map.on('zoomend', updateMapScale);
map.on('moveend', updateMapScale);
updateMapScale();

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
