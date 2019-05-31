/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-114.8126495682767, 48.58524635048106],
          [-114.8126495682767, 48.13631682610862],
          [-113.5657013260892, 48.13631682610862],
          [-113.5657013260892, 48.58524635048106]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Wrapper for LANDTRENDR across an annual time series
//Supports multiple bands and/or indices
//Returns the raw LANDTRENDR output, a fitted time series and
//a thresholded year, magnitude, and duration of greatest disturbance

///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var changeDetectionLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
changeDetectionLib.getExistingChangeData();
////////////////////////////////////////////////////////////////////////////////////////////
//Parameters

//Date parameters
var startYear = 1984;
var endYear = 2018;
var startJulian = 190;
var endJulian = 250;

//Choose band or index
//NBR, NDMI, and NDVI tend to work best
//Other good options are wetness and tcAngleBG
var indexName = 'NBR';

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
  maxSegments:            6,
  spikeThreshold:         0.9,
  vertexCountOvershoot:   3,
  preventOneYearRecovery: true,
  recoveryThreshold:      0.25,
  pvalThreshold:          0.05,
  bestModelProportion:    0.75,
  minObservationsNeeded:  6
};

//Whether to add outputs to map
var addToMap = true;

var exportOutputs
////////////////////////////////////////////////////////////////////////////////////////////
//Get images
var allImages = getImagesLib.getLandsatWrapper(geometry,startYear,endYear,startJulian,endJulian);
var images = allImages[0];
var composites = allImages[1];


function simpleLANDTRENDR(ts,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,addToMap){
  
  if(indexName === undefined || indexName === null){indexName = 'NBR'}
  if(run_params === undefined || run_params === null){
    run_params = {'maxSegments':6,
      'spikeThreshold':         0.9,
      'vertexCountOvershoot':   3,
      'preventOneYearRecovery': true,
      'recoveryThreshold':      0.25,
      'pvalThreshold':          0.05,
      'bestModelProportion':    0.75,
      'minObservationsNeeded':  6
    };
  }
  if(lossMagThresh === undefined || lossMagThresh === null){lossMagThresh =-0.15}
  if(gainMagThresh === undefined || gainMagThresh === null){gainMagThresh =0.1}
  if(slowLossDurationThresh === undefined || slowLossDurationThresh === null){slowLossDurationThresh =3}
  if(addToMap === undefined || addToMap === null){addToMap =true}
  
  
  //Get single band time series and set its direction so that a loss in veg is going up
  var ts = ts.select([indexName]);
  var distDir = getImagesLib.changeDirDict[indexName];
  run_params.timeSeries = ts.map(function(img){return changeDetectionLib.multBands(img,distDir,1)});
  
  //Run LANDTRENDR
  var rawLt = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params);
  
  var lt = rawLt.select([0]);
  Map.addLayer(lt,{},'Raw LT',false);
  
  //Get joined raw and fitted LANDTRENDR for viz
  var joinedTS = changeDetectionLib.getRawAndFittedLT(ts,lt,startYear,endYear,indexName,distDir);
  Map.addLayer(joinedTS,{},'joinedTS',false);
  
  ///////////////////////////////////////
  //Pop off vertices
  var vertices = lt.arraySlice(0,3,4);
  
  //Mask out any non-vertex values
  lt = lt.arrayMask(vertices);
  lt = lt.arraySlice(0,0,3);
  
  
  
  //Get the pair-wise difference and slopes of the years
  var left = lt.arraySlice(1,0,-1);
  var right = lt.arraySlice(1,1,null);
  var diff  = left.subtract(right);
  var slopes = diff.arraySlice(0,2,3).divide(diff.arraySlice(0,0,1)).multiply(-1);
  
  //Set up array for sorting
  var forSorting = slopes.arrayCat(diff,0);
  forSorting = right.arraySlice(0,0,1).arrayCat(forSorting,0);
  
  var magLossMask =  forSorting.arraySlice(0,4,5).lte(lossMagThresh);
  var slopeLossMask = forSorting.arraySlice(0,1,2).lte(lossSlopeThresh);
  var lossMask = magLossMask.or(slopeLossMask);
  
  var magGainMask =  forSorting.arraySlice(0,4,5).gte(gainMagThresh);
  var slopeGainMask = forSorting.arraySlice(0,1,2).gte(gainSlopeThresh);
  var gainMask = magGainMask.or(slopeGainMask);
  
  
  Map.addLayer(lossMask,{},'lossmask',false);
  Map.addLayer(gainMask,{},'gainMask',false);
   
  var forLossSorting = forSorting.arrayMask(lossMask);
  var forGainSorting = forSorting.arrayMask(gainMask);
  
  Map.addLayer(forLossSorting,{},'forLossSorting',false);
  Map.addLayer(forGainSorting,{},'forGainSorting',false);
   
  //Dictionaries for choosing the column and direction to multiply the column for sorting
  //Loss and gain are handled differently for sorting magnitude and slope (largest/smallest and steepest/mostgradual)
  var lossColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[4,1],
                    'smallest':[4,-1],
                    'steepest':[1,1],
                    'mostGradual':[1,-1],
                    'shortest':[2,-1],
                    'longest':[2,1]
                  };
  var gainColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[4,-1],
                    'smallest':[4,1],
                    'steepest':[1,-1],
                    'mostGradual':[1,1],
                    'shortest':[2,-1],
                    'longest':[2,1]
                  };
  //Pull the respective column and direction
  var lossSortValue = lossColumnDict[chooseWhichLoss];
  var gainSortValue = gainColumnDict[chooseWhichGain];
  
  //Pull the sort column and multiply it
  var lossSortBy = forLossSorting.arraySlice(0,lossSortValue[0],lossSortValue[0]+1).multiply(lossSortValue[1]);
  var gainSortBy = forGainSorting.arraySlice(0,gainSortValue[0],gainSortValue[0]+1).multiply(gainSortValue[1]);
  
  //Sort the loss and gain and slice off the first column
  var lossAfterForSorting = forLossSorting.arraySort(lossSortBy)//.arraySlice(1, 0, 1);
  var gainAfterForSorting = forGainSorting.arraySort(gainSortBy)//.arraySlice(1, 0, 1);
  
  Map.addLayer(lossAfterForSorting,{},'lossAfterForSorting',false);
  Map.addLayer(gainAfterForSorting,{},'gainAfterForSorting',false);
  
  
var lossStack = changeDetectionLib.getLTStack(lossAfterForSorting,run_params,5,['yrs_','slope_','dur_','raw_','fit_']);
Map.addLayer(lossStack,{},'lossstack',false);
  //Loosely based on code from: users/emaprlab/public
  // make an image from the array of attributes for the greatest disturbance
  // var distImg = ee.Image.cat(lossAfterForSorting.arraySlice(0,0,1).arrayProject([1]).arrayFlatten([['loss_year']]),
  //                             lossAfterForSorting.arraySlice(0,2,3).arrayProject([1]).arrayFlatten([['loss_dur']]).multiply(-1),
  //                             lossAfterForSorting.arraySlice(0,4,5).arrayProject([1]).arrayFlatten([['loss_mag']]),
  //                             lossAfterForSorting.arraySlice(0,1,2).arrayProject([1]).arrayFlatten([['loss_slope']]),
  //                             gainAfterForSorting.arraySlice(0,0,1).arrayProject([1]).arrayFlatten([['gain_year']]),
  //                             gainAfterForSorting.arraySlice(0,2,3).arrayProject([1]).arrayFlatten([['gain_dur']]).multiply(-1),
  //                             gainAfterForSorting.arraySlice(0,4,5).arrayProject([1]).arrayFlatten([['gain_mag']]),
  //                             gainAfterForSorting.arraySlice(0,1,2).arrayProject([1]).arrayFlatten([['gain_slope']])
  //                             );
  
  
  
  // // Map.addLayer(forSorting,{},'forSorting',false);
  // // Map.addLayer(lossAfterForSorting,{},'lossAfterForSorting',false);
  // // Map.addLayer(gainAfterForSorting,{},'gainAfterForSorting',false);
  // Map.addLayer(distImg,{},'distImg',false);
  
  // // //Pull out slow and fast loss and gain
  // var loss = distImg.select(['loss_mag']).lte(lossMagThresh).or(distImg.select(['loss_slope']).lte(lossSlopeThresh));
  // var slowLoss = loss.and(distImg.select(['loss_dur']).gte(slowLossDurationThresh));
  // var fastLoss = loss.and(distImg.select(['loss_dur']).lt(slowLossDurationThresh));
  // var gain = distImg.select(['gain_mag']).gte(gainMagThresh).or(distImg.select(['gain_slope']).gt(gainSlopeThresh));
  
  
  
  // //Mask  loss 
  // fastLoss = distImg.select(['loss_.*']).updateMask(fastLoss);
  // slowLoss = distImg.select(['loss_.*']).updateMask(slowLoss);
  // gain = distImg.select(['gain_.*']).updateMask(gain);
  
  
  
  // //Set up viz params
  // var vizParamsLossYear = {'min':startYear,'max':endYear,'palette':'ffffe5,fff7bc,fee391,fec44f,fe9929,ec7014,cc4c02'};
  // var vizParamsLossMag = {'min':-0.8 ,'max':lossMagThresh,'palette':'D00,F5DEB3'};
  
  // var vizParamsGainYear = {'min':startYear,'max':endYear,'palette':'54A247,AFDEA8,80C476,308023,145B09'};
  // var vizParamsGainMag = {'min':gainMagThresh,'max':0.8,'palette':'F5DEB3,006400'};
  
  // var vizParamsDuration = {'min':1,'max':5,'palette':'BD1600,E2F400,0C2780'};
  
  // if(addToMap){
  //   Map.addLayer(fastLoss.select(['loss_year']),vizParamsLossYear,indexName +' Fast Loss Year',false);
  //   Map.addLayer(fastLoss.select(['loss_mag']),vizParamsLossMag,indexName +' Fast Loss Magnitude',false);
  //   Map.addLayer(fastLoss.select(['loss_dur']),vizParamsDuration,indexName +' Fast Loss Duration',false);
    
  //   Map.addLayer(slowLoss.select(['loss_year']),vizParamsLossYear,indexName +' Slow Loss Year',false);
  //   Map.addLayer(slowLoss.select(['loss_mag']),vizParamsLossMag,indexName +' Slow Loss Magnitude',false);
  //   Map.addLayer(slowLoss.select(['loss_dur']),vizParamsDuration,indexName +' Slow Loss Duration',false);
    
    
    
  //   Map.addLayer(gain.select(['gain_year']),vizParamsGainYear,indexName +' Gain Year',false);
  //   Map.addLayer(gain.select(['gain_mag']),vizParamsGainMag,indexName +' Gain Magnitude',false);
  //   Map.addLayer(gain.select(['gain_dur']),vizParamsDuration,indexName +' Gain Duration',false);
  // }
  // return [rawLt,distImg];
}
simpleLANDTRENDR(composites,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,addToMap)
// Map.addLayer(fastLoss)
// Map.addLayer(fastLossYears)

// // Define user parameters:

// // 1. Specify study area: Study area
// // Can specify a country, provide a fusion table  or asset table (must add 
// // .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
// var studyArea =geometry;

// // 2. Update the startJulian and endJulian variables to indicate your seasonal 
// // constraints. This supports wrapping for tropics and southern hemisphere.
// // startJulian: Starting Julian date 
// // endJulian: Ending Julian date
// var startJulian = 190;
// var endJulian = 250;

// // 3. Specify start and end years for all analyses
// // More than a 3 year span should be provided for time series methods to work 
// // well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// // matter
// var startYear = 2000;
// var endYear = 2019;


// // 4. Specify an annual buffer to include imagery from the same season 
// // timeframe from the prior and following year. timeBuffer = 1 will result 
// // in a 3 year moving window
// var timebuffer = 0;

// // 5. Specify the weights to be used for the moving window created by timeBuffer
// //For example- if timeBuffer is 1, that is a 3 year moving window
// //If the center year is 2000, then the years are 1999,2000, and 2001
// //In order to overweight the center year, you could specify the weights as
// //[1,5,1] which would duplicate the center year 5 times and increase its weight for
// //the compositing method
// var weights = [1];


// // 6. Choose medoid or median compositing method. 
// // Median tends to be smoother, while medoid retains 
// // single date of observation across all bands
// // If not exporting indices with composites to save space, medoid should be used
// var compositingMethod = 'medoid';


// // 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// // Specify TOA or SR
// // Current implementation does not support Fmask for TOA
// var toaOrSR = 'SR';

// // 8. Choose whether to include Landat 7
// // Generally only included when data are limited
// var includeSLCOffL7 = false;

// //9. Whether to defringe L5
// //Landsat 5 data has fringes on the edges that can introduce anomalies into 
// //the analysis.  This method removes them, but is somewhat computationally expensive
// var defringeL5 = false;

// // 10. Choose cloud/cloud shadow masking method
// // Choices are a series of booleans for cloudScore, TDOM, and elements of Fmask
// //Fmask masking options will run fastest since they're precomputed
// //CloudScore runs pretty quickly, but does look at the time series to find areas that 
// //always have a high cloudScore to reduce comission errors- this takes some time
// //and needs a longer time series (>5 years or so)
// //TDOM also looks at the time series and will need a longer time series
// var applyCloudScore = false;
// var applyFmaskCloudMask = true;

// var applyTDOM = false;
// var applyFmaskCloudShadowMask = true;

// var applyFmaskSnowMask = true;

// // 11. Cloud and cloud shadow masking parameters.
// // If cloudScoreTDOM is chosen
// // cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
// //    masking (lower number masks more clouds.  Between 10 and 30 generally 
// //    works best)
// var cloudScoreThresh = 20;

// //Whether to find if an area typically has a high cloudScore
// //If an area is always cloudy, this will result in cloud masking omission
// //For bright areas that may always have a high cloudScore
// //but not actually be cloudy, this will result in a reduction of commission errors
// //This procedure needs at least 5 years of data to work well
// var performCloudScoreOffset = false;


// // Percentile of cloud score to pull from time series to represent a minimum for 
// // the cloud score over time for a given pixel. Reduces comission errors over 
// // cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// // bit noisy
// var cloudScorePctl = 10; 

// // zScoreThresh: Threshold for cloud shadow masking- lower number masks out 
// //    less. Between -0.8 and -1.2 generally works well
// var zScoreThresh = -1;

// // shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the 
// //    shadow shift method (lower number masks out less)
// var shadowSumThresh = 0.35;

// // contractPixels: The radius of the number of pixels to contract (negative 
// //    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
// //    patches that are likely errors
// // (1.5 results in a -1 pixel buffer)(0.5 results in a -0 pixel buffer)
// // (1.5 or 2.5 generally is sufficient)
// var contractPixels = 1.5; 

// // dilatePixels: The radius of the number of pixels to dilate (buffer) clouds 
// //    and cloud shadows by. Intended to include edges of clouds/cloud shadows 
// //    that are often missed
// // (1.5 results in a 1 pixel buffer)(0.5 results in a 0 pixel buffer)
// // (2.5 or 3.5 generally is sufficient)
// var dilatePixels = 2.5;

// // 12. correctIllumination: Choose if you want to correct the illumination using
// // Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// // correction is calculated in meters.
// var correctIllumination = false;
// var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

// //13. Export params
// //Whether to export composites
// var exportComposites = false;

// //Set up Names for the export
// var outputName = 'LT_';

// //Provide location composites will be exported to
// //This should be an asset folder, or more ideally, an asset imageCollection
// var exportPathRoot = 'users/ianhousman/test/changeCollection';

// // var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
// //CRS- must be provided.  
// //Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
// //WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
// var crs = 'EPSG:5070';

// //Specify transform if scale is null and snapping to known grid is needed
// var transform = [30,0,-2361915.0,0,-30,3177735.0];

// //Specify scale if transform is null
// var scale = null;


// //List of bands or indices to iterate across
// //Typically a list of spectral bands or computed indices
// //Can include: 'blue','green','red','nir','swir1','swir2'
// //'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
// // var indexList = ee.List(['nir','swir1']);
// var indexList = ['NBR','SAVI','EVI'];//['NBR','blue','green','red','nir','swir1','swir2','NDMI','NDVI','wetness','greenness','brightness','tcAngleBG'];

// //The corresponding direction of forest loss for the given band/index specified above in indexList
// // var ltDirection = ee.List([-1,    1]);
// var ltDirection =[-1,-1,-1];//[-1,1,-1,1,-1,    1,      1,   -1, -1,    -1,   -1,        1,          -1];


// //Define landtrendr params
// var run_params = { 
//   maxSegments:            6,
//   spikeThreshold:         0.9,
//   vertexCountOvershoot:   3,
//   preventOneYearRecovery: true,
//   recoveryThreshold:      0.25,
//   pvalThreshold:          0.05,
//   bestModelProportion:    0.75,
//   minObservationsNeeded:  6
// };

// //Define disturbance mapping filter parameters 
// var treeLoss1  = 0.1;      //0.15 works well delta filter for 1 year duration disturbance, <= will not be included as disturbance - units are in units of segIndex defined in the following function definition
// var treeLoss20 = 0.2;      //0.2 works well delta filter for 20 year duration disturbance, <= will not be included as disturbance - units are in units of segIndex defined in the following function definition
// var preVal     = 0.01;      //0.2 works well. Set close to 0 if all pixels are wanted pre-disturbance value threshold - values below the provided threshold will exclude disturbance for those pixels - units are in units of segIndex defined in the following function definition
// var mmu        = 0;       // minimum mapping unit for disturbance patches - units of pixels

// var distParams = {
//     tree_loss1: treeLoss1,
//     tree_loss20: treeLoss20,  
//     pre_val: preVal           
//   };
  

// //End params
// ///////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////////////////////
// //Call on master wrapper function to get Landat scenes and composites
// var lsAndTs = getImageLib.getLandsatWrapper(studyArea,startYear,endYear,startJulian,endJulian,
//   timebuffer,weights,compositingMethod,
//   toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
//   applyFmaskCloudShadowMask,applyFmaskSnowMask,
//   cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
//   zScoreThresh,shadowSumThresh,
//   contractPixels,dilatePixels,
//   correctIllumination,correctScale,
//   exportComposites,outputName,exportPathRoot,crs,transform,scale);

// //Separate into scenes and composites for subsequent analysis
// var scenes = lsAndTs[0];
// var composites = lsAndTs[1];
// composites = composites.map(getImageLib.addSAVIandEVI);

// ////////////////////////////////////////////////////////////
// //Landtrendr code
// var indexListString = getImageLib.listToString(indexList,'_');
// var indexDirList = ee.List(indexList).zip(ee.List(ltDirection)).getInfo();

// //Iterate across index and direction list
// var outputCollection;
// var outputStack;
// indexDirList.map(function(indexDir){
//   var indexName = indexDir[0];
//   var distDir = indexDir[1];
//   // print(indexName,distDir);
//   var tsIndex = composites.select([indexName]);
  
//   //Run master LT wrapper
//   //Returns the raw, heuristic output, and fitted collection
//   var ltOutputs = dLib.landtrendrWrapper(tsIndex,startYear+timebuffer,endYear-timebuffer,indexName,distDir,run_params,distParams,mmu);
  
//   var ltRaw = ltOutputs[0];
//   var ltHeuristic = ltOutputs[1];
//   var ltAnnualFitted = ltOutputs[2];
  
//   //Stack the heuristic output and stack each image
//   //in fitted collection using join
//   if(outputCollection === undefined){
//     outputCollection = ltAnnualFitted;
//     outputStack = ltHeuristic;
//   }else{
//     outputCollection = getImageLib.joinCollections(outputCollection,ltAnnualFitted,false);
//     outputStack = outputStack.addBands(ltHeuristic);
    
//   }
  
// });
// Map.addLayer(getImageLib.joinCollections(composites.select(indexList),outputCollection,false),{},'LT Fitted IndexNames',false);
// Map.addLayer(outputStack.select([0]),{'min':startYear,'max':endYear,'palette':'FF0,F00'},indexList[0] + ' LT Change Year',true);
// Map.addLayer(outputStack.select([1]),{min:0.1,max:0.8,palette:'FF0,F00'},indexList[0] + ' LT Change Magnitude',false);
// Map.addLayer(outputStack.select([2]),{min:1,max:5,palette:'FF0,F00'},indexList[0] + ' LT Change Duration',false);

// print(outputStack)
// // Export each fitted year
// var years = ee.List.sequence(startYear+timebuffer,endYear-timebuffer).getInfo();

//   years.map(function(year){
//     var ltYr = ee.Image(outputCollection.filter(ee.Filter.calendarRange(year,year,'year')).first())
//     .multiply(10000).int16()
//     .set('bandsUsed',indexListString)
//     .set('system:time_start',ee.Date.fromYMD(year,6,1).millis());
 
//   var exportName = outputName + year.toString();
//     var exportPath = exportPathRoot + '/'+ exportName;
    
//     getImageLib.exportToAssetWrapper(ltYr,exportName,exportPath,'mean',
//       studyArea,null,crs,transform);
//   });
  
// //Export thresholded stack
// var exportName = outputName + 'LT_Stack';
// var exportPath = exportPathRoot + '/'+ exportName;
    
// getImageLib.exportToAssetWrapper(outputStack,exportName,exportPath,'mean',
//       studyArea,null,crs,transform);
