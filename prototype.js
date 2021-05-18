// Prototype use of AGOL-hosted WFS layer in OpenLayers client.
//
// Author: Ben Krepp (bkrepp@ctps.org)

// ESRI API key - probably not needed if not using ESRI basemap
const apiKey = "YOUR_API_KEY";

// URL for AGOL-hosted WFS service containing TAZ-level demographic data from last LRTP
// N.B. - This service was deleted on 5/18/21 at 2:30 PM EDT.
// var sample_taz_wfs =  'https://dservices1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/services/sample_taz_demographics/WFSServer?service=wfs';

// URL for AGOL-hosted ESRI "feature service" containing TAZ-level demographic data from last LRTP
var sample_taz_esri = 'https://services1.arcgis.com/jIRgb54Jq9V3BUeD/ArcGIS/rest/services/sample_taz_demographics/FeatureServer/0';

// For use during development and debugging:
var wfs_get_caps = 'https://dservices1.arcgis.com/jIRgb54Jq9V3BUeD/arcgis/services/sample_taz_demographics/WFSServer?service=wfs&request=getcapabilities';

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

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Beginning of legacy code for OL vector layer - carried over in case we might want to use it

// Max map resolution at which to label vector features.
var maxResolutionForLabelingVectorFeatures = 1200;   

// Our function to return text to label vector features
//
// Unabashedly borrowed from https://openlayers.org/en/latest/examples/vector-labels.html,
// and subsequently morphed for our purposes.
//
var getText = function(feature, resolution) {
  var maxResolution = maxResolutionForLabelingVectorFeatures;
  var text = "Lot " + String(feature.get('lot_id'));
  if (resolution > maxResolution) {
    text = '';
  }
  return text;
};
// Our createTextStyle function for labeling the vector layer
//
// Unabashedly borrowed from https://openlayers.org/en/latest/examples/vector-labels.html,
// and subsequently morphed for our purposes.
//
var createTextStyle = function(feature, resolution) {
  var align = 'center';
  var baseline = 'middle';
  var size = '14px';
  var height = 1;
  var offsetX = 0;
  var offsetY = 0;
  var weight = 'normal';
  var placement = 'point';
  var maxAngle = 45;
  var overflow = 'true'; 
  var rotation = 0;
  var font = weight + ' ' + size + '/' + height + ' ' + 'Arial';
  var fillColor = 'black';      // Color of label TEXT itself
  var outlineColor = 'white';   // Color of label OUTLINE
  var outlineWidth = 0;

  return new ol.style.Text({
    textAlign: align,
    textBaseline: baseline,
    font: font,
    text: getText(feature, resolution),
    fill: new ol.style.Fill({color: fillColor}),
    stroke: new ol.style.Stroke({color: outlineColor, width: outlineWidth}),
    offsetX: offsetX,
    offsetY: offsetY,
    placement: placement,
    maxAngle: maxAngle,
    overflow: overflow,
    rotation: rotation
  });
};

// Define OpenLayers vector layer - will overlay the base layer
var oHighlightLayer = new ol.layer.Vector({source: new ol.source.Vector({ wrapX: false }) });
// Define style for vector layer, and set the vector layer's style to it
function myVectorStyle(feature, resolution) {
	return new ol.style.Style({ fill	: new ol.style.Fill({ color: 'rgba(193,66,66,0.4)' }), 
                                stroke : new ol.style.Stroke({ color: 'rgba(0,0,255,1.0)', width: 3.0}),
								text:   createTextStyle(feature, resolution)
				});
}
oHighlightLayer.setStyle(myVectorStyle);

// End of legacy code for OL vector layer - carried over in case we might want to use it
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////



// Execute purely tabular SQL query code, taken from ESRI demo code
function executeQuery(whereClause) {
    arcgisRest
         .queryFeatures({
             url: sample_taz_esri,
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
            for (i = 0; i < features.length; i++) {
                props = features[i].getProperties();
                s = 'TAZ = ' + props.taz + ' 2010 population = ' + props.total_pop_2010 + ' 2016 population = ' + props.total_pop_2016 + '.' ;
                console.log(s);
            }
      });
} // executeQuery()


// OpenLayers 'map' object:
var ol_map = null;

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
                                                        oHighlightLayer
                                      ],
                               target: 'map',
                               view:   new ol.View({ center: ol.proj.fromLonLat([-71.0589, 42.3601]), zoom: 11 })
                            });     

         console.log('Initialization complete.');
         // Execute a simple tabular SQL query of the underlying data.
         executeQuery("town='ARLINGTON'");
    }});

} // initialize()
