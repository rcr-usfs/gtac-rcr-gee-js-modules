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

//Wrapper for LANDTRENDR across an annual time series
//Returns a thresholded LANDTRENDR output
//The user can specify how to sort the LT segments and how many to export


///Module imports
var gil = require('users/aaronkamoske/GTAC-Modules:getImagesLib.js');
var cdl = require('users/aaronkamoske/GTAC-Modules:changeDetectionLib.js');
cdl.getExistingChangeData();
////////////////////////////////////////////////////////////////////////////////////////////

//Parameters

//Study area
var studyArea = gil.testAreas.CA;

//Date parameters
var startYear = 1984;
var endYear = 2023;
var startJulian = 152;
var endJulian = 273;

//Choose band or index
//NBR, NDMI, and NDVI tend to work best
//Other good options are wetness and tcAngleBG
var indexName = 'NBR';

//How many significant loss and/or gain segments to include
//Do not make less than 1
//If you only want the first loss and/or gain, choose 1
//Generally any past 2 are noise
var howManyToPull = 2;

//Parameters to identify suitable LANDTRENDR segments

//Thresholds to identify loss in vegetation
//Any segment that has a change magnitude or slope less than both of these thresholds is omitted
var lossMagThresh = -0.15;
var lossSlopeThresh = -0.05;


//Thresholds to identify gain in vegetation
//Any segment that has a change magnitude or slope greater than both of these thresholds is omitted
var gainMagThresh = 0.1;
var gainSlopeThresh = 0.05;

var slowLossDurationThresh = 3;

//Choose from: 'newest','oldest','largest','smallest','steepest','mostGradual','shortest','longest'
var chooseWhichLoss = 'largest';
var chooseWhichGain = 'largest';

//Define landtrendr params
var run_params = { 
  maxSegments:            9,
  spikeThreshold:         0.9,
  vertexCountOvershoot:   3,
  preventOneYearRecovery: false,
  recoveryThreshold:      0.25,
  pvalThreshold:          0.05,
  bestModelProportion:    0.75,
  minObservationsNeeded:  6
};

//Whether to add outputs to map
var addToMap = true;

// Export params
// Whether to export LANDTRENDR change detection (loss and gain) outputs
var exportLTLossGain = true;

// Whether to export LandTrendr vertex array raw output
var exportLTVertexArray = true;

//Set up Names for the export
var outputName = 'LT_Test';

//Provide location LT stack will be exported to
//This should be an asset folder or an asset imageCollection
var exportPathRoot = 'users/username/someCollection';

//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;

////////////////////////////////////////////////////////////////////////////////////////////
//Get images
var allImages = gil.getLandsatWrapper(studyArea,startYear,endYear,startJulian,endJulian);
var images = allImages.processedScenes;
var composites = allImages.processedComposites;



//Run LT and get output stack
var ltOutputs = cdl.simpleLANDTRENDR(composites,startYear,endYear,indexName,run_params,
                lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,
                chooseWhichLoss,chooseWhichGain,addToMap,howManyToPull,10000);

if(exportLTLossGain){
  var lossGainStack = ltOutputs[1]
  // Export  stack
  var exportName = outputName + '_LT_LossGain_Stack_'+indexName+'_'+startYear.toString()+'_'+endYear.toString()
                  +'_'+startJulian.toString()+'_'+endJulian.toString();
                  
  var exportPath = exportPathRoot + '/'+ exportName

  var lossGainStack = lossGainStack.set({'startYear':startYear,
                                        'endYear':endYear,
                                        'startJulian':startJulian,
                                        'endJulian':endJulian,
                                        'band':indexName})
  lossGainStack =lossGainStack.set(run_params)
  
  //Set up proper resampling for each band
  //Be sure to change if the band names for the exported image change
  var pyrObj = {'_yr_':'mode','_dur_':'mode','_mag_':'mean','_slope_':'mean'};
  var possible = ['loss','gain'];
  var outObj = {};
  possible.map(function(p){
    Object.keys(pyrObj).map(function(key){
      ee.List.sequence(1,howManyToPull).getInfo().map(function(i){
        var kt = indexName + '_LT_'+p + key+i.toString();
        outObj[kt]= pyrObj[key];
      });
    });
  });
  // print(outObj)
  // Export output
  gil.exportToAssetWrapper(lossGainStack,exportName,exportPath,outObj,studyArea,scale,crs,transform);
}

// Export raw LandTrendr array image
if(exportLTVertexArray){
  var rawLTForExport = ltOutputs[0];
  Map.addLayer(rawLTForExport,{},'Raw LT For Export '+indexName,false);
  
  rawLTForExport = rawLTForExport.set({'startYear':startYear,
                                        'endYear':endYear,
                                        'startJulian':startJulian,
                                        'endJulian':endJulian,
                                        'band':indexName});
  rawLTForExport =rawLTForExport.set(run_params);
  exportName = outputName+'_LT_Raw_'+indexName+'_'+startYear.toString()+'_'+endYear.toString();
                  +'_'+startJulian.toString()+'_'+endJulian.toString();
  exportPath = exportPathRoot + '/'+ exportName;
  gil.exportToAssetWrapper(rawLTForExport,exportName,exportPath,{'.default':'sample'},studyArea,scale,crs,transform);
  // Reverse for modeling
  var decompressedC = cdl.simpleLTFit(rawLTForExport,startYear,endYear,indexName,true,run_params['maxSegments']);
  Map.addLayer(decompressedC,{},'Decompressed LT Output '+indexName,false);
}
Map.setOptions('HYBRID');