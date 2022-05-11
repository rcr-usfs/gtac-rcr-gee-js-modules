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
var getImagesLib = require('users/aaronkamoske/GTAC-Modules:getImagesLib.js');
var changeDetectionLib = require('users/aaronkamoske/GTAC-Modules:changeDetectionLib.js');
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



// Iterate across each band to look for areas of change
bandNames.map(function(bandName){
  // Convert LandTrendr stack to Loss & Gain space
  var ltt = lt.filter(ee.Filter.eq(bandPropertyName,bandName)).mosaic();
  var fit = ltt.select(['fit.*']).multiply(getImagesLib.changeDirDict[bandName]/10000);
  ltt = ltt.addBands(fit,null,true);
  var lossGainDict = changeDetectionLib.convertToLossGain(ltt, 
                                                      'vertStack',
                                                       -0.15,
                                                       -0.1,
                                                       0.1,
                                                       0.1,
                                                       3,
                                                       'largest', 
                                                       'largest', 
                                                       1);
                                                       
  var lossStack = lossGainDict.lossStack;
  var gainStack = lossGainDict.gainStack;

  // Set up viz params
  var vizParamsLossYear = {'min':startYear,'max':endYear,'palette':changeDetectionLib.lossYearPalette};
  var vizParamsLossMag = {'min':-0.8 ,'max':-0.15,'palette':changeDetectionLib.lossMagPalette};
  
  var vizParamsGainYear = {'min':startYear,'max':endYear,'palette':changeDetectionLib.gainYearPalette};
  var vizParamsGainMag = {'min':0.1,'max':0.8,'palette':changeDetectionLib.gainMagPalette};
  
  vizParamsDuration = {'min':1,'max':5,'palette':changeDetectionLib.changeDurationPalette};

  // Select off the first change detected and visualize outputs
  var lossStackI = lossStack.select(['.*_1']);
  var gainStackI = gainStack.select(['.*_1']);
 
  Map.addLayer(lossStackI.select(['loss_yr.*']),vizParamsLossYear,bandName +' Loss Year',true);
  Map.addLayer(lossStackI.select(['loss_mag.*']),vizParamsLossMag,bandName +' Loss Magnitude',false);
  Map.addLayer(lossStackI.select(['loss_dur.*']),vizParamsDuration,bandName +' Loss Duration',false);
  
  Map.addLayer(gainStackI.select(['gain_yr.*']),vizParamsGainYear,bandName +' Gain Year',false);
  Map.addLayer(gainStackI.select(['gain_mag.*']),vizParamsGainMag,bandName +' Gain Magnitude',false);
  Map.addLayer(gainStackI.select(['gain_dur.*']),vizParamsDuration,bandName +' Gain Duration',false);

});
  
// Vizualize image collection for charting (opacity set to 0 so it will chart but not be visible)
Map.addLayer(lt_fit,{},'LT Fit TS');
Map.setOptions('HYBRID');