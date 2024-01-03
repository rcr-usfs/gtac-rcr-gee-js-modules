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
var gil = require('users/aaronkamoske/GTAC-Modules:getImagesLib.js');
var cdl = require('users/aaronkamoske/GTAC-Modules:changeDetectionLib.js');
//####################################################################################################
// Define user parameters:
// ####################################################################################################
// Define user parameters:

// Specify which years to look at 
// Available years are 1984-present
var startYear = 1984;
var endYear = 2023;

// Which property stores which band/index LandTrendr was run across
var bandPropertyName = 'band';

// Specify which bands to run across
// Set to None to run all available bands
// Available bands include: ['NBR', 'NDMI', 'NDSI', 'NDVI', 'blue', 'brightness', 'green', 'greenness', 'nir', 'red', 'swir1', 'swir2', 'tcAngleBG', 'wetness']
var bandNames =null;

// Specify if output is an array image or not
var arrayMode = true;
// ####################################################################################################
// Bring in LCMS LandTrendr outputs (see other examples that include LCMS final data)
var lt = ee.ImageCollection('projects/lcms-tcc-shared/assets/CONUS/Base-Learners/LandTrendr-Collection');
print('Available bands/indices: ',lt.aggregate_histogram(bandPropertyName).keys().getInfo());

var lt_props = lt.first().toDictionary().getInfo();
print(lt_props);

// Convert stacked outputs into collection of fitted, magnitude, slope, duration, etc values for each year
// Divide by 10000 (0.0001) so values are back to original values (0-1 or -1-1)
var lt_fit = cdl.batchSimpleLTFit(lt,startYear,endYear,bandNames,bandPropertyName,arrayMode,lt_props['maxSegments'],0.0001);

// Vizualize image collection for charting (opacity set to 0 so it will chart but not be visible)
Map.addLayer(lt_fit.select(['NBR_LT_fitted']),{'opacity':0},'LT Fit TS');

// Visualize single year fitted landTrendr composite
// Set to only run if no bandNames are specified
if(bandNames == null || bandNames == undefined){
  // Get fitted bandnames
  var fitted_bns = lt_fit.select(['.*_fitted']).first().bandNames();
  var out_bns = fitted_bns.map(function(bn){return ee.String(bn).split('_').get(0)});

  // Filter out next to last year
  var lt_synth = lt_fit.select(fitted_bns,out_bns)
            .filter(ee.Filter.calendarRange(endYear-1,endYear-1,'year')).first();

  // Visualize as you would a composite
  Map.addLayer(lt_synth,gil.vizParamsFalse,'Synthetic Composite');

}
// Iterate across each band to look for areas of change
if(bandNames === null || bandNames === undefined){bandNames=['NBR']}
bandNames.map(function(bandName){
  // Do basic change detection with raw LT output
  var ltt = lt.filter(ee.Filter.eq(bandPropertyName,bandName)).mosaic();
  ltt = cdl.multLT(ltt,cdl.changeDirDict[bandName]*0.0001);
 
  var lossMagThresh = -0.15;
  var lossSlopeThresh = -0.1;
  var gainMagThresh = 0.1;
  var gainSlopeThresh = 0.1;
  var slowLossDurationThresh = 3;
  var chooseWhichLoss = 'largest';
  var chooseWhichGain = 'largest' ;
  var howManyToPull = 1;
  lossGainDict = cdl.convertToLossGain(ltt, 
                                      format = 'arrayLandTrendr',
                                      lossMagThresh = lossMagThresh,
                                      lossSlopeThresh = lossSlopeThresh,
                                      gainMagThresh = gainMagThresh,
                                      gainSlopeThresh = gainSlopeThresh,
                                      slowLossDurationThresh = slowLossDurationThresh,
                                      chooseWhichLoss = chooseWhichLoss, 
                                      chooseWhichGain = chooseWhichGain, 
                                      howManyToPull = howManyToPull);
  lossGainStack = cdl.LTLossGainExportPrep(lossGainDict,indexName = bandName,multBy = 1);
  cdl.addLossGainToMap(lossGainStack,startYear,endYear,lossMagThresh-0.7,lossMagThresh,gainMagThresh,gainMagThresh+0.7);
});
// Vizualize image collection for charting (opacity set to 0 so it will chart but not be visible)
Map.addLayer(lt_fit,{},'LT Fit TS');
Map.setOptions('HYBRID');