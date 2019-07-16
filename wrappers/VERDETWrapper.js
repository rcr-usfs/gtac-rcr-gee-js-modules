/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-115.67851562499999, 48.76683332204826],
          [-115.67851562499999, 47.29763431423617],
          [-112.86601562499999, 47.29763431423617],
          [-112.86601562499999, 48.76683332204826]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Wrapper for LANDTRENDR across an annual time series
//Returns a thresholded LANDTRENDR output
//The user can specify how to sort the LT segments and how many to export


///Module imports
var getImageLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
dLib.getExistingChangeData();
print(dLib)
////////////////////////////////////////////////////////////////////////////////////////////
//Parameters

//Study area
var studyArea = geometry;

//Date parameters
var startYear = 1984;
var endYear = 2018;
var startJulian = 190;
var endJulian = 250;

//Choose band or index
//NBR, NDMI, and NDVI tend to work best
//Other good options are wetness and tcAngleBG
var indexName = 'NBR';


var correctionFactor =   1; 


//Maximum number of segements assumed to be possible from VERDET outputs
//Currently there is no explicit max, so 10 or so is generally sufficient
var maxSegments = 10;

//Max number of years to allow no data to occur for- will extrapolate this number of years as well;
var nYearsInterpolate = 10;

//General run parameters for VERDETe
var run_params = {tolerance:0.0001,
                  alpha: 0.1
};
                  

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


//Whether to add outputs to map
var addToMap = true;

var exportLTStack = false;

//Set up Names for the export
var outputName = 'VT_Test';

//Provide location LT stack will be exported to
//This should be an asset folder or an asset imageCollection
var exportPathRoot = 'users/ianhousman/test/changeCollection';

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
var allImages = getImageLib.getLandsatWrapper(studyArea,startYear,endYear,startJulian,endJulian);
var images = allImages[0];
var composites = allImages[1];

var masks = composites.map(function(img){return img.mask().reduce(ee.Reducer.min()).byte().copyProperties(img, img.propertyNames())}).select([0],['mask']);


//Perform linear interpolation        
composites = dLib.linearInterp(composites, 365*nYearsInterpolate, -32768)
        // .map(getImageLib.simpleAddIndices)
        // .map(getImageLib.getTasseledCap)
        // .map(getImageLib.simpleAddTCAngles);
        // .map(function(img){return img.clip(studyArea)});
print(composites)
// //Run LT and get output stack
// var ltOut = changeDetectionLib.simpleLANDTRENDR(composites,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,chooseWhichLoss,chooseWhichGain,addToMap,howManyToPull);
// var ltOutStack = ltOut[1];
Map.addLayer(composites.select([indexName]),{},'ts',false);
var stack = dLib.VERDETLTStack(composites,indexName,run_params,maxSegments,correctionFactor);


var yrs = stack.select(['yrs_.*']);
// var fits = stack.select(['fit'])
print(stack)
// //Export  stack
// var exportName = outputName + '_Stack_'+indexName;
// var exportPath = exportPathRoot + '/'+ exportName;

// //Set up proper resampling for each band
// //Be sure to change if the band names for the exported image change
// var pyrObj = {'_yr_':'mode','_dur_':'mode','_mag_':'mean','_slope_':'mean'};
// var possible = ['loss','gain'];
// var outObj = {};
// possible.map(function(p){
//   Object.keys(pyrObj).map(function(key){
//     ee.List.sequence(1,howManyToPull).getInfo().map(function(i){
//       var kt = indexName + '_LT_'+p + key+i.toString();
//       outObj[kt]= pyrObj[key];
//     });
//   });
// });

// //Export output
// getImagesLib.exportToAssetWrapper2(ltOutStack,exportName,exportPath,outObj,studyArea,scale,crs,transform);
