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

var exportLTStack = false;

//Set up Names for the export
var outputName = 'LT_';

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
var allImages = getImagesLib.getLandsatWrapper(studyArea,startYear,endYear,startJulian,endJulian);
var images = allImages[0];
var composites = allImages[1];


function simpleLANDTRENDR(ts,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,addToMap,howManyToPull){
  
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
  if(howManyToPull === undefined || howManyToPull === null){howManyToPull =2}
  
  
  //Get single band time series and set its direction so that a loss in veg is going up
  ts = ts.select([indexName]);
  var distDir = getImagesLib.changeDirDict[indexName];
  var tsT = ts.map(function(img){return changeDetectionLib.multBands(img,distDir,1)});
  
  //Find areas with insufficient data to run LANDTRENDR
  var countMask = tsT.count().unmask().gte(6);

  tsT = tsT.map(function(img){
    var m = img.mask();
    //Allow areas with insufficient data to be included, but then set to a dummy value for later masking
    m = m.or(countMask.not());
    img = img.mask(m);
    img = img.where(countMask.not(),-32768);
    return img});

  run_params.timeSeries = tsT;
  
  //Run LANDTRENDR
  var rawLt = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params);
  
  var lt = rawLt.select([0]);
  
  
  //Get joined raw and fitted LANDTRENDR for viz
  var joinedTS = changeDetectionLib.getRawAndFittedLT(ts,lt,startYear,endYear,indexName,distDir);
  
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
  
  var duration = diff.arraySlice(0,0,1).multiply(-1);
  var fittedMag = diff.arraySlice(0,2,3);
  //Set up array for sorting
  var forSorting = right.arraySlice(0,0,1).arrayCat(duration,0).arrayCat(fittedMag,0).arrayCat(slopes,0);
 
  
  //Apply thresholds
  var magLossMask =  forSorting.arraySlice(0,2,3).lte(lossMagThresh);
  var slopeLossMask = forSorting.arraySlice(0,3,4).lte(lossSlopeThresh);
  var lossMask = magLossMask.or(slopeLossMask);
  
  var magGainMask =  forSorting.arraySlice(0,2,3).gte(gainMagThresh);
  var slopeGainMask = forSorting.arraySlice(0,3,4).gte(gainSlopeThresh);
  var gainMask = magGainMask.or(slopeGainMask);
  
  
  //Mask any segments that do not meet thresholds
  var forLossSorting = forSorting.arrayMask(lossMask);
  var forGainSorting = forSorting.arrayMask(gainMask);
  

   
  //Dictionaries for choosing the column and direction to multiply the column for sorting
  //Loss and gain are handled differently for sorting magnitude and slope (largest/smallest and steepest/mostgradual)
  var lossColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[2,1],
                    'smallest':[2,-1],
                    'steepest':[3,1],
                    'mostGradual':[3,-1],
                    'shortest':[1,1],
                    'longest':[1,-1]
                  };
  var gainColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[2,-1],
                    'smallest':[2,1],
                    'steepest':[3,-1],
                    'mostGradual':[3,1],
                    'shortest':[1,1],
                    'longest':[1,-1]
                  };
  //Pull the respective column and direction
  var lossSortValue = lossColumnDict[chooseWhichLoss];
  var gainSortValue = gainColumnDict[chooseWhichGain];
  
  //Pull the sort column and multiply it
  var lossSortBy = forLossSorting.arraySlice(0,lossSortValue[0],lossSortValue[0]+1).multiply(lossSortValue[1]);
  var gainSortBy = forGainSorting.arraySlice(0,gainSortValue[0],gainSortValue[0]+1).multiply(gainSortValue[1]);
  
  //Sort the loss and gain and slice off the first column
  var lossAfterForSorting = forLossSorting.arraySort(lossSortBy);
  var gainAfterForSorting = forGainSorting.arraySort(gainSortBy);
  
  //Convert array to image stck
  var lossStack = changeDetectionLib.getLTStack(lossAfterForSorting,howManyToPull,['loss_yr_','loss_dur_','loss_mag_','loss_slope_']);
  var gainStack = changeDetectionLib.getLTStack(gainAfterForSorting,howManyToPull,['gain_yr_','gain_dur_','gain_mag_','gain_slope_']);
  
  //Convert to byte/int16 to save space
  var lossThematic = lossStack.select(['.*_yr_.*']).int16().addBands(lossStack.select(['.*_dur_.*']).byte());
  var lossContinuous = lossStack.select(['.*_mag_.*','.*_slope_.*']).multiply(10000).int16();
  lossStack = lossThematic.addBands(lossContinuous);
  
  var gainThematic = gainStack.select(['.*_yr_.*']).int16().addBands(gainStack.select(['.*_dur_.*']).byte());
  var gainContinuous = gainStack.select(['.*_mag_.*','.*_slope_.*']).multiply(10000).int16();
  gainStack = gainThematic.addBands(gainContinuous);
  
  //Remask areas with insufficient data that were given dummy values 
  lossStack = lossStack.updateMask(countMask);
  gainStack = gainStack.updateMask(countMask);
  
  
  //Set up viz params
  var vizParamsLossYear = {'min':startYear,'max':endYear,'palette':'ffffe5,fff7bc,fee391,fec44f,fe9929,ec7014,cc4c02'};
  var vizParamsLossMag = {'min':-0.8*10000 ,'max':lossMagThresh*10000,'palette':'D00,F5DEB3'};
  
  var vizParamsGainYear = {'min':startYear,'max':endYear,'palette':'54A247,AFDEA8,80C476,308023,145B09'};
  var vizParamsGainMag = {'min':gainMagThresh*10000,'max':0.8*10000,'palette':'F5DEB3,006400'};
  
  var vizParamsDuration = {'min':1,'max':5,'palette':'BD1600,E2F400,0C2780'};
  
  
  if(addToMap){
    Map.addLayer(lt,{},'Raw LT',false);
    Map.addLayer(joinedTS,{},'Time Series',false);
  
    ee.List.sequence(1,howManyToPull).getInfo().map(function(i){
     
      var lossStackI = lossStack.select(['.*_'+i.toString()]);
      var gainStackI = gainStack.select(['.*_'+i.toString()]);
      
      Map.addLayer(lossStackI.select(['loss_yr.*']),vizParamsLossYear,i.toString()+' '+indexName +' Loss Year',false);
      Map.addLayer(lossStackI.select(['loss_mag.*']),vizParamsLossMag,i.toString()+' '+indexName +' Loss Magnitude',false);
      Map.addLayer(lossStackI.select(['loss_dur.*']),vizParamsDuration,i.toString()+' '+indexName +' Loss Duration',false);
      
      Map.addLayer(gainStackI.select(['gain_yr.*']),vizParamsGainYear,i.toString()+' '+indexName +' Gain Year',false);
      Map.addLayer(gainStackI.select(['gain_mag.*']),vizParamsGainMag,i.toString()+' '+indexName +' Gain Magnitude',false);
      Map.addLayer(gainStackI.select(['gain_dur.*']),vizParamsDuration,i.toString()+' '+indexName +' Gain Duration',false);
    });
  }
  var outStack = lossStack.addBands(gainStack);
  
  return [rawLt,outStack];
}
Map.addLayer(composites)
var ltOut = simpleLANDTRENDR(composites,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,addToMap,howManyToPull)
var ltOutStack = ltOut[1];
print(ltOutStack)
//Export  stack
var exportName = outputName + '_Stack2_'+indexName;
var exportPath = exportPathRoot + '/'+ exportName;


var pyrObj = {'_yr_':'mode','_dur_':'mode','_mag_':'mean','_slope_':'mean'};
var possible = ['loss','gain'];
var outObj = {};
possible.map(function(p){
  Object.keys(pyrObj).map(function(key){
    ee.List.sequence(1,howManyToPull).getInfo().map(function(i){
      var kt = p + key+i.toString();
      outObj[kt]= pyrObj[key];
    });
  });
});

getImagesLib.exportToAssetWrapper2(ltOutStack,exportName,exportPath,outObj,studyArea,scale,crs,transform);
