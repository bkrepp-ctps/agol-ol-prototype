// Prototype use of AGOL-hosted WFS layer in OpenLayers client.
//
// Author: Ben Krepp (bkrepp@ctps.org)

// SRS of MassGIS basemap: EPSG:3857, a.k.a. SR-ORG:6864
proj4.defs("SR-ORG:6864", "+proj=merc +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=6378137 +b=6378137 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
var epsg3857_proj = proj4('EPSG:3857');

// SRS of demographic data (Mass State Plane, NAD 83, meters)
proj4.defs("EPSG:26986", "+proj=lcc +lat_1=42.68333333333333 +lat_2=41.71666666666667 +lat_0=41 +lon_0=-71.5 +x_0=200000 +y_0=750000 +ellps=GRS80 +datum=NAD83 +units=m +no_defs");
var epsg26986_proj = proj4('EPSG:26986');

// WGS84 SRS
proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");
var wgs_srs = proj4("EPSG:4326");

// URL for AGOL-hosted ESRI "feature service" containing TAZ-level demographic data from last LRTP
// ==> This one has an SRS of EPSG:26986
var sample_taz_esri = 'https://services1.arcgis.com/jIRgb54Jq9V3BUeD/ArcGIS/rest/services/sample_taz_demographics/FeatureServer/0';
// For use during development and debugging:
var wfs_get_caps = 'https://dservices1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/services/sample_taz_demographics/WFSServer?service=wfs&request=getcapabilities';

// URL for AGOL-hosted ESRI "feature service" containing TAZ-level demographic data from last LRTP
// ==> This one has an SRS of EPSG:3857
var sample_taz_esri_3857_wfs = 'https://dservices1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/rest/services/sample_taz_demographics_3857_wfs_gdb/FeatureServer/0';
                                              // 'https://services1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/rest/services/sample_taz_demographics_3857_wfs_gdb/FeatureServer';

// For use during development and debugging:
var wfs_get_caps_3857 =  'https://dservices1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/services/sample_taz_demographics_3857_wfs_gdb/WFSServer?service=wfs&request=getcapabilities';




// URLs for MassGIS basemap layer services
var mgis_serviceUrls = { 
    'topo_features'     :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Topographic_Features_for_Basemap/MapServer",
    'basemap_features'  :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Basemap_Detailed_Features/MapServer",
    'structures'        :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Structures/MapServer",
    'parcels'           :  "https://tiles.arcgis.com/tiles/hGdibHYSPO59RG1h/arcgis/rest/services/MassGIS_Level3_Parcels/MapServer"
};

// OpenLayers layers for MassGIS basemap layers used in our map
var mgis_basemap_layers = { 'topo_features'     : null,     // bottom layer
                            'structures'        : null,     
                            'basemap_features'  : null,     // on top of 'structures' so labels aren't obscured
                            'parcels'           : null      // unused; not populated
};

// Stuff for sketching vector polygon for spatial query
var source = new ol.source.Vector({wrapX: false});

var vectorDrawingLayer = new ol.layer.Vector({
  source: source,
});



// Execute purely tabular SQL query code, taken from ESRI demo code
function executeTabularQuery(whereClause) {
    arcgisRest
         .queryFeatures({
             url: sample_taz_esri_3857_wfs,    // sample_taz_esri,
            where: whereClause,
            f: "geojson",
            returnGeometry: true,
            outFields: ['taz', 'town', 'total_pop_2010', 'total_pop_2016' ]
      })
      .then((response) => {
            const returned_geojson = new ol.format.GeoJSON();
            var features = returned_geojson.readFeatures(response);
            var _DEBUG_HOOK_ = 0;
            var i, props, s;
            $('#output_div').html('');
            s = '';
            for (i = 0; i < features.length; i++) {
                props = features[i].getProperties();
                s += 'TAZ = ' + props.taz + ' 2010 population = ' + props.total_pop_2010 + ' 2016 population = ' + props.total_pop_2016 + '.' + '</br>' ;
            }
            $('#output_div').html(s)
      });
} // executeTabularQuery()


function executeSpatialQuery(geometry) {
    arcgisRest
        .queryFeatures({
              url: sample_taz_esri_3857_wfs, //  sample_taz_esri,
              geometry: geometry,
              geometryType: "esriGeometryPolygon",
              spatialRel: "intersects",
              f: "json",
              returnGeometry: true
        })
        .then((response) => {
              const features = new ol.format.JSON().readFeatures(response);
              var _DEBUG_HOOK = 0;
        });
} //executeSpatialQuery()

// OpenLayers 'map' object:
var ol_map = null;

var aMpoTowns = [
    [2, "ACTON"], [10, "ARLINGTON"], [14, "ASHLAND"],
    [23, "BEDFORD"], [25, "BELLINGHAM"], [26, "BELMONT"], [30, "BEVERLY"], [34, "BOLTON"],
	[35, "BOSTON"], [37, "BOXBOROUGH"], [40, "BRAINTREE"], [46, "BROOKLINE"], [48, "BURLINGTON"],
    [49, "CAMBRIDGE"], [50, "CANTON"], [51, "CARLISLE"], [57, "CHELSEA"], [65, "COHASSET"],
    [67, "CONCORD"],
    [71, "DANVERS"], [73, "DEDHAM"], [78, "DOVER"], [82, "DUXBURY"],
    [92, "ESSEX"], [93, "EVERETT"],
    [99, "FOXBOROUGH"], [100, "FRAMINGHAM"], [101, "FRANKLIN"],
    [107, "GLOUCESTER"],
    [119, "HAMILTON"], [122, "HANOVER"], [131, "HINGHAM"], [133, "HOLBROOK"], [136, "HOLLISTON"],
    [139, "HOPKINTON"], [141, "HUDSON"], [142, "HULL"],
    [144, "IPSWICH"],
    [155, "LEXINGTON"], [157, "LINCOLN"], [158, "LITTLETON"], [163, "LYNN"], [164, "LYNNFIELD"],
    [165, "MALDEN"], [166, "MANCHESTER"], [168, "MARBLEHEAD"], [170, "MARLBOROUGH"], [171, "MARSHFIELD"],
    [174, "MAYNARD"], [175, "MEDFIELD"], [176, "MEDFORD"], [177, "MEDWAY"], [178, "MELROSE"],
    [184, "MIDDLETON"], [185, "MILFORD"], [187, "MILLIS"], [189, "MILTON"],
    [196, "NAHANT"], [198, "NATICK"], [199, "NEEDHAM"], [207, "NEWTON"], [208, "NORFOLK"],
    [213, "NORTH READING"], [219, "NORWELL"], [220, "NORWOOD"],
    [229, "PEABODY"], [231, "PEMBROKE"],
    [243, "QUINCY"],
    [244, "RANDOLPH"], [246, "READING"], [248, "REVERE"], [251, "ROCKLAND"], [252, "ROCKPORT"],
    [258, "SALEM"], [262, "SAUGUS"], [264, "SCITUATE"], [266, "SHARON"], [269, "SHERBORN"],
    [274, "SOMERVILLE"], [277, "SOUTHBOROUGH"], [284, "STONEHAM"], [285, "STOUGHTON"], [286, "STOW"],
    [288, "SUDBURY"], [291, "SWAMPSCOTT"],
    [298, "TOPSFIELD"],
    [305, "WAKEFIELD"], [307, "WALPOLE"], [308, "WALTHAM"], [314, "WATERTOWN"],  [315, "WAYLAND"],
    [317, "WELLESLEY"], [320, "WENHAM"], [333, "WESTON"], [335, "WESTWOOD"], [336, "WEYMOUTH"],
    [342, "WILMINGTON"],  [344, "WINCHESTER"], [346, "WINTHROP"], [347, "WOBURN"],  [350, "WRENTHAM"]
];  // aMpoTowns[];

// Function: initialize()
//     Initializes OpenLayers map, gets MassGIS basemap service properties by executing AJAX request
//
function initialize() {  
    // 1. Initialize OpenLayers map, gets MassGIS basemap service properties by executing AJAX request
    $.ajax({ url: mgis_serviceUrls['topo_features'], jsonp: 'callback', dataType: 'jsonp', data: { f: 'json' }, 
             success: function(config) {     
        // Body of "success" handler starts here.
        // Get resolutions
        var tileInfo = config.tileInfo;
        var resolutions = [];
        for (var i = 0, ii = tileInfo.lods.length; i < ii; ++i) {
            resolutions.push(tileInfo.lods[i].resolution);
        }               
        // Get projection
        var epsg = 'EPSG:' + config.spatialReference.wkid;
        var units = config.units === 'esriMeters' ? 'm' : 'degrees';
        var projection = ol.proj.get(epsg) ? ol.proj.get(epsg) : new ol.proj.Projection({ code: epsg, units: units });                              
        // Get attribution
        var attribution = new ol.control.Attribution({ html: config.copyrightText });               
        // Get full extent
        var fullExtent = [config.fullExtent.xmin, config.fullExtent.ymin, config.fullExtent.xmax, config.fullExtent.ymax];
        
        var tileInfo = config.tileInfo;
        var tileSize = [tileInfo.width || tileInfo.cols, tileInfo.height || tileInfo.rows];
        var tileOrigin = [tileInfo.origin.x, tileInfo.origin.y];
        var urls;
        var suffix = '/tile/{z}/{y}/{x}';
        urls = [mgis_serviceUrls['topo_features'] += suffix];               
        var width = tileSize[0] * resolutions[0];
        var height = tileSize[1] * resolutions[0];     
        var tileUrlFunction, extent, tileGrid;               
        if (projection.getCode() === 'EPSG:4326') {
            tileUrlFunction = function tileUrlFunction(tileCoord) {
                var url = urls.length === 1 ? urls[0] : urls[Math.floor(Math.random() * (urls.length - 0 + 1)) + 0];
                return url.replace('{z}', (tileCoord[0] - 1).toString()).replace('{x}', tileCoord[1].toString()).replace('{y}', (-tileCoord[2] - 1).toString());
            };
        } else {
            extent = [tileOrigin[0], tileOrigin[1] - height, tileOrigin[0] + width, tileOrigin[1]];
            tileGrid = new ol.tilegrid.TileGrid({ origin: tileOrigin, extent: extent, resolutions: resolutions });
        }     

        // Layer 1 - topographic features
        var layerSource;
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });
                          
        mgis_basemap_layers['topo_features'] = new ol.layer.Tile();
        mgis_basemap_layers['topo_features'].setSource(layerSource);
        mgis_basemap_layers['topo_features'].setVisible(true);
        
        // We make the rash assumption that since this set of tiled basemap layers were designed to overlay one another,
        // their projection, extent, and resolutions are the same.
        
         // Layer 2 - structures
        urls = [mgis_serviceUrls['structures'] += suffix];  
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });;
        mgis_basemap_layers['structures'] = new ol.layer.Tile();
        mgis_basemap_layers['structures'].setSource(layerSource); 
        mgis_basemap_layers['structures'].setVisible(true);          
        
        // Layer 3 - "detailed" features - these include labels
        urls = [mgis_serviceUrls['basemap_features'] += suffix];  
        layerSource = new ol.source.XYZ({ attributions: [attribution], projection: projection,
                                          tileSize: tileSize, tileGrid: tileGrid,
                                          tileUrlFunction: tileUrlFunction, urls: urls });                                  
        mgis_basemap_layers['basemap_features'] = new ol.layer.Tile();
        mgis_basemap_layers['basemap_features'].setSource(layerSource);
        mgis_basemap_layers['basemap_features'].setVisible(true);

        // Create OpenLayers map
        ol_map = new ol.Map({ layers: [   mgis_basemap_layers['topo_features'],
                                                        mgis_basemap_layers['structures'],
                                                        mgis_basemap_layers['basemap_features'],
                                                        vectorDrawingLayer
                                      ],
                               target: 'map',
                               view:   new ol.View({ center: ol.proj.fromLonLat([-71.0589, 42.3601]), zoom: 11 })
                            });     

         console.log('Initialization complete.');
         
         // Execute a simple tabular SQL query of the underlying data.
         executeTabularQuery("town='ARLINGTON'");
         
         // Initialize combo box of towns
         var i;
         for (i = 0; i < aMpoTowns.length; i++) {
             $('#select_town').append($('<option>', { value: aMpoTowns[i][0],     
                                                                      text : aMpoTowns[i][1] }));  
            
        }
        // Arm on-change event handler for combo box
        $('#select_town').on('change', function(e) {
             var town_name = $('#select_town').find(":selected").text();
             var query_string = "town='" + town_name + "'";
             executeTabularQuery(query_string);
        });
         
         // Beginning of stuff for spatial query driven by sketch
        var draw;
        function addInteraction() {
            draw = new ol.interaction.Draw({ source: source, type: 'Polygon'  });
            draw.on('drawend', function (e) {
                console.log('Edit sketch complete.');
                var _DEBUG_HOOK = 0;
                var currentFeature= e.feature;
                var g = currentFeature.getGeometry();
                // Note: ESRI spatial query is a 'BBOX" query requiring an esriGeometryEnvelope parm: [minx, miny, maxx, maxy]
                var bbox = g.getExtent();
                _DEBUG_HOOK = 1;
                // Attempts to project from EPSG:3857 to EPSG:26986 using the proj4 library thus far haven't worked.
                // Instead, we will attempt to query against a copy of the sample TAZ demographics data layer that was projected to EPSG:3857 using ArcMap.
                // Execute spatial query
                executeSpatialQuery(bbox);              
                _DEBUG_HOOK = 2;
            });
            ol_map.addInteraction(draw);
        }
        addInteraction();
               
    }});

} // initialize()
