# Local Climate Zones (LCZ) - Regional Natural Park of the Northern Vosges


**Interactive mapping and climate analysis of the Regional Natural Park of the Northern Vosges**  
_Master 2 OTG (Geomatics and Territorial Engineering) • University of Strasbourg • 2025-2026_

Live demo : https://quentinldrm.github.io/GeoLab2026/
---

## Summary

This project provides an **interactive web platform** for visualizing and analyzing Local Climate Zones (LCZ) in the Regional Natural Park of the Northern Vosges (PNR Vosges du Nord). The platform enables the exploration of urban and natural thermal structures through standardized climate classification, with temporal analysis capabilities spanning 2015 to 2025.

The project was developed as part of the **GeoLAB 2026** initiative at the University of Strasbourg, focusing on conduct a scientific project.

---

## Features

The platform offers three main modules:

### 1. **Interactive LCZ Mapping** (`/map`)

- Interactive visualization of Local Climate Zones for years 2015, 2020, and 2025
- Multiple data layers with different methodologies (GeoClimate and Random Forest)
- Municipality boundaries overlay
- Detailed information for each LCZ class with climate characteristics
- Progressive loading system for optimal performance

### 2. **Temporal Comparison** (`/compare`)

- Side-by-side visualization of two time periods (2015 vs 2020, 2015 vs 2025, 2020 vs 2025)
- Statistical analysis of LCZ evolution over time
- Interactive charts showing surface area changes by LCZ class
- Synchronized map navigation for easy comparison

### 3. **Urban Heat Island Analysis** (`/icu`)

- Visualization of heat island intensity by municipality
- Graduated color mapping based on thermal intensity
- Detailed statistics for each municipality
- Integration with LCZ data for comprehensive climate understanding

---

## Data Sources

### Spatial Data

#### **LCZ Classifications (2015, 2020, 2025)**

- **Source**: [GeoClimate](https://github.com/orbisgis/geoclimate) - Open-source processing chain developed by CNRS
- **Input data**:
  - IGN BD TOPO (French National Geographic Database)
  - OpenStreetMap
- **Method**: Morphological analysis of built environment and land cover
- **Calculated indicators**: Building fraction, average height, spacing, roughness, permeability
- **Classification**: Decision algorithm based on thresholds defined by Stewart & Oke (2012)

#### **LCZ 2025 - Machine Learning Approach**

- **Source**: Random Forest model trained on high-resolution remote sensing data
- **Input data**:
  - HD Lidar (IGN)
  - IRC Orthophotography (Infrared Color)
  - OCS GE (Large-scale Land Cover Database)
- **Method**:
  - 15 derived variables (height, density, land cover, spectral indices)
  - Random Forest classifier trained on validation samples
  - Prediction on regular 100m × 100m grid
- **Advantages**: Homogeneous resolution and rapid updates with high-resolution remote sensing

#### **Administrative Boundaries**

- **File**: `COMMUNES_PNR.geojson`
- **Source**: IGN Admin Express
- **Coverage**: All municipalities within the PNR Vosges du Nord

#### **Park Boundaries**

- **File**: `PNR_VN_4326.geojson`
- **Source**: Regional Natural Park of the Northern Vosges
- **Coordinate System**: WGS84 (EPSG:4326)

---

## Methodology

### Local Climate Zones Classification

The LCZ scheme is a standardized urban climate classification system developed by Stewart & Oke (2012). It divides landscapes into 17 classes based on:

- Building structure (height, density, spacing)
- Land cover properties
- Construction materials
- Anthropogenic heat emissions

**Reference**: Stewart, I. D., & Oke, T. R. (2012). Local Climate Zones for Urban Temperature Studies. _Bulletin of the American Meteorological Society_, 93(12), 1879-1900.

### Technical Implementation

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping Library**: Leaflet.js with VectorGrid plugin for vector tiles
- **Charting**: Chart.js for statistical visualizations
- **Data Format**: GeoJSON for vector data
- **Performance Optimization**:
  - Service Worker for offline capabilities
  - Progressive data loading with cache management
  - Web Workers for heavy data processing

---

## Study Area

The **Regional Natural Park of the Northern Vosges** is an exceptional territory spanning Alsace and Lorraine, recognized as a UNESCO Biosphere Reserve since 1989. Key characteristics:

- **Area**: Over 130,000 hectares
- **Landscape**: Vast piedmont forest with over 30 medieval castles
- **Biodiversity**: Remarkable species including Eurasian lynx and Western capercaillie
- **Climate Challenge**: Facing summer water stress, increased forest vulnerability, and ecosystem modifications due to climate change

Understanding the thermal structure of this territory through LCZ analysis is crucial for sustainable land use planning and natural environment preservation.

---

## Getting Started (for local deployment)

### Prerequisites

- Modern web browser (Chrome, Firefox, Edge, Safari)
- Local web server (optional for development)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/GeoLab2026.git
cd GeoLab2026
```

2. Serve the files with a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js (with http-server)
npx http-server -p 8000
```

3. Open your browser at `http://localhost:8000`

### File Structure

```
GeoLab2026/
├── index.html              # Landing page
├── style.css              # Global styles
├── script_landing.js      # Landing page scripts
├── map/                   # Interactive mapping module
│   ├── map.html
│   └── script_map.js
├── compare/               # Temporal comparison module
│   ├── compare.html
│   └── script_compare.js
├── icu/                   # Heat island analysis module
│   ├── icu.html
│   └── script_icu.js
├── data/                  # GeoJSON data files
│   ├── COMMUNES_PNR.geojson
│   └── PNR_VN_4326.geojson
├── utils/                 # Utility scripts
│   ├── cache-manager.js
│   ├── common.js
│   ├── geojson-loader.js
│   ├── geojson-worker.js
│   ├── preloader.js
│   ├── service-worker.js
│   └── stats_utils.js
└── pictures/              # Images and logos
```

---

## Team

**Master 2 OTG - University of Strasbourg (2025-2026)**

- Morgane Carmier
- Clément Friess
- Quentin Ledermann
- Ella Levinger

---

## License

This project is part of an academic work at the University of Strasbourg. For any use or reproduction, please contact the authors.

---

## Acknowledgments

- **Regional Natural Park of the Northern Vosges** for collaboration and data access
- **IGN** (French National Geographic Institute) for topographic and remote sensing data
- **CNRS** for the GeoClimate tool
- **University of Strasbourg** - Master OTG program
- Stewart & Oke for the LCZ classification framework

---

## Contact

For questions or collaboration opportunities, please contact:

- University of Strasbourg - Master 2 OTG
- Email: quentinledermann@outlook.fr

---

**© 2026 - GeoLAB Project - University of Strasbourg**
