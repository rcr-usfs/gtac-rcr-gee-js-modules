/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-114.89071367722619, 48.87913410589321],
          [-114.89071367722619, 48.206337851124374],
          [-113.12191484910119, 48.206337851124374],
          [-113.12191484910119, 48.87913410589321]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/

// # Example of how to visualize LandTrendr outputs using the Python visualization tools
// # LANDTRENDR original paper: https://www.sciencedirect.com/science/article/pii/S0034425710002245
// # LANDTRENDR in GEE paper: https://www.mdpi.com/2072-4292/10/5/691
// # Takes pre-exported LT stack output and provides a visualization of loss and gain years, duration, and magnitude 
// # Also charts the LT output time series

///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
var changeDetectionLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
//####################################################################################################
// Define user parameters:

// Specify which years to look at 
// Available years are 1984-2021
var startYear = 1984;
var endYear = 2021;

// Which property stores which band/index LandTrendr was run across
var bandPropertyName = 'band';

// Specify which bands to run across
// Set to null to run all available bands
// Available bands include: ['NBR', 'NDMI', 'NDSI', 'NDVI', 'blue', 'brightness', 'green', 'greenness', 'nir', 'red', 'swir1', 'swir2', 'tcAngleBG', 'wetness']
var bandNames =['NBR'];
// ####################################################################################################
// Bring in LCMS LandTrendr outputs (see other examples that include LCMS final data)
var lt = ee.ImageCollection('projects/lcms-tcc-shared/assets/LandTrendr/LandTrendr-Collection-yesL7-1984-2020');
print('Available bands/indices:',lt.aggregate_histogram(bandPropertyName).keys().getInfo());

// Convert stacked outputs into collection of fitted, magnitude, slope, duration, etc values for each year
var lt_fit = changeDetectionLib.batchSimpleLTFit(lt,startYear,endYear,bandNames,bandPropertyName);

// Vizualize image collection for charting (opacity set to 0 so it will chart but not be visible)
Map.addLayer(lt_fit,{'opacity':0},'LT Fit TS')
Map.setOptions('HYBRID');