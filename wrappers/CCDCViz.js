///Module imports
// var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
////////////////////////////////////////////////////////////////////////////////////////
//Function to get the coeffs corresponding to a given date on a pixel-wise basis
//The raw CCDC image is expected
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
function getCCDCSegCoeffs(timeImg,ccdcImg,fillGaps){
  var coeffKeys = ['.*_coefs'];
  var tStartKeys = ['tStart'];
  var tEndKeys = ['tEnd'];
  var tBreakKeys = ['tBreak'];
  
  //Get coeffs and find how many bands have coeffs
  var coeffs = ccdcImg.select(coeffKeys);
  var bns = coeffs.bandNames();
  var nBns = bns.length();
  var harmonicTag = ee.List(['INTP','SLP','COS1','SIN1','COS2','SIN2','COS3','SIN3']);

   
  //Get coeffs, start and end times
  coeffs = coeffs.toArray(2);
  var tStarts = ccdcImg.select(tStartKeys);
  var tEnds = ccdcImg.select(tEndKeys);
  var tBreaks = ccdcImg.select(tBreakKeys);
  
  //If filling to the tBreak, use this
  tStarts = ee.Image(ee.Algorithms.If(fillGaps,tStarts.arraySlice(0,0,1).arrayCat(tBreaks.arraySlice(0,0,-1),0),tStarts));
  tEnds = ee.Image(ee.Algorithms.If(fillGaps,tBreaks.arraySlice(0,0,-1).arrayCat(tEnds.arraySlice(0,-1,null),0),tEnds));
  
  
  //Set up a mask for segments that the time band intersects
  var tMask = tStarts.lt(timeImg).and(tEnds.gte(timeImg)).arrayRepeat(1,1).arrayRepeat(2,1);
  coeffs = coeffs.arrayMask(tMask).arrayProject([2,1]).arrayTranspose(1,0).arrayFlatten([bns,harmonicTag]);
  
  //If time band doesn't intersect any segments, set it to null
  coeffs = coeffs.updateMask(coeffs.reduce(ee.Reducer.max()).neq(0));
  
  return timeImg.addBands(coeffs);
}
////////////////////////////////////////////////////////////////////////////////////////
// Using annualized time series, get fitted values and slopes from fitted values.
function getFitSlopeCCDC(annualSegCoeffs, startYear, endYear){
  //Predict across each time image
  var whichBands = ee.Image(annualSegCoeffs.first()).select(['.*_INTP']).bandNames().map(function(bn){return ee.String(bn).split('_').get(0)});
  whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys().getInfo();
  var fitted = annualSegCoeffs.map(function(img){return simpleCCDCPredictionAnnualized(img,'year',whichBands)});
  
  // Get back-casted slope using the fitted values
  var diff = ee.ImageCollection(ee.List.sequence(ee.Number(startYear).add(1), endYear).map(function(rightYear){
    var leftYear = ee.Number(rightYear).subtract(1);
    var rightFitted = ee.Image(fitted.filter(ee.Filter.calendarRange(rightYear, rightYear, 'year')).first());
    var leftFitted = ee.Image(fitted.filter(ee.Filter.calendarRange(leftYear, leftYear, 'year')).first());
    var slopeNames = rightFitted.select(['.*_fitted']).bandNames().map(function(name){
      return ee.String(ee.String(name).split('_fitted').get(0)).cat(ee.String('_fitSlope'))
    });
    var slope = rightFitted.select(['.*_fitted']).subtract(leftFitted.select(['.*_fitted']))
                  .rename(slopeNames);
    return rightFitted.addBands(slope);
  }))
  
  // Rename bands
  var bandNames = diff.first().bandNames();
  var newBandNames = bandNames.map(function(name){return ee.String(name).replace('coefs','CCDC')});
  diff = diff.select(bandNames, newBandNames);
  
  return diff;
}
//Wrapper to predict CCDC values from a collection containing a time image and ccdc coeffs
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
//The whichHarmonics options are [1,2,3] - denoting which harmonics to include
function simpleCCDCPredictionWrapper(c,timeBandName,whichHarmonics){
  var whichBands = ee.Image(c.first()).select(['.*_INTP']).bandNames().map(function(bn){return ee.String(bn).split('_').get(0)});
  whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys().getInfo();
  var out = c.map(function(img){return simpleCCDCPrediction(img,timeBandName,whichHarmonics,whichBands)});
  return out;
}

////////////////////////////////////////////////////////////////////////////////////////
//Wrapper function for predicting CCDC across a set of time images
function predictCCDC(ccdcImg,timeImgs,fillGaps,whichHarmonics){//,fillGapBetweenSegments,addRMSE,rmseImg,nRMSEs){
  var timeBandName = ee.Image(timeImgs.first()).select([0]).bandNames().get(0);
  // Add the segment-appropriate coefficients to each time image
  timeImgs = timeImgs.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,fillGaps)});

  //Predict across each time image
  return simpleCCDCPredictionWrapper(timeImgs,timeBandName,whichHarmonics);
}
///////////////////////////////////////////////////////////////////////
//Bring in ccdc image asset
//This is assumed to be an image of arrays that is returned from the ee.Algorithms.TemporalSegmentation.Ccdc method
var ccdcImg =  ee.ImageCollection("projects/CCDC/USA_V2")
          .filter(ee.Filter.eq('spectral', 'SR'))
          .select(['tStart','tEnd','tBreak','changeProb',
                      'NDVI_.*','NBR_.*']);;
var f= ee.Image(ccdcImg.first());
ccdcImg = ee.Image(ccdcImg.mosaic().copyProperties(f));

//Specify which harmonics to use when predicting the CCDC model
//CCDC exports the first 3 harmonics (1 cycle/yr, 2 cycles/yr, and 3 cycles/yr)
//If you only want to see yearly patterns, specify [1]
//If you would like a tighter fit in the predicted value, include the second or third harmonic as well [1,2,3]
var whichHarmonics = [1];

//Whether to fill gaps between segments' end year and the subsequent start year to the break date
var fillGaps = true;

//Specify which band to use for loss and gain. 
//This is most important for the loss and gain magnitude since the year of change will be the same for all years
var changeDetectionBandName = 'NDVI';
//////////////////////////////////////////////////////////////////////
//Pull out some info about the ccdc image
var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();

//Add the raw array image
Map.addLayer(ccdcImg,{},'Raw CCDC Output',false);

//Extract the change years and magnitude
// var changeObj = dLib.ccdcChangeDetection(ccdcImg,changeDetectionBandName);
// Map.addLayer(changeObj.highestMag.loss.year,{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Loss Year');
// Map.addLayer(changeObj.highestMag.loss.mag,{min:-0.5,max:-0.1,palette:dLib.lossMagPalette},'Loss Mag',false);
// Map.addLayer(changeObj.highestMag.gain.year,{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Gain Year');
// Map.addLayer(changeObj.highestMag.gain.mag,{min:0.05,max:0.2,palette:dLib.gainMagPalette},'Gain Mag',false);
function simpleGetTimeImageCollection(startYear,endYear,step){
  var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear,step).map(function(n){
    n = ee.Number(n);
    var img = ee.Image(n).float().rename(['year']);
    var y = n.int16();
    var fraction = n.subtract(y);
    var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
    return img.set('system:time_start',d);
  }));
  return yearImages
}
function annualizeCCDC(ccdcImg,startYear,endYear,targetMonth,targetDay){
  var fraction = ee.Date.fromYMD(1900,targetMonth,targetDay).getFraction('year');
  var yearImages = simpleGetTimeImageCollection(ee.Number(startYear).add(fraction),ee.Number(endYear).add(fraction),1);
  // predictCCDC(ccdcImg,yearImages,fillGaps,whichHarmonics)
}
annualizeCCDC(ccdcImg,startYear,endYear,9,1)


//Apply the CCDC harmonic model across a time series
//First get a time series of time images 
// var yearImages = getTimeImageCollection(startYear,endYear,startJulian,endJulian,0.1);

// //Then predict the CCDC models
// var fitted = predictCCDC(ccdcImg,yearImages,fillGaps,whichHarmonics);
// Map.addLayer(fitted.select(['.*_predicted']),{},'Fitted CCDC',false);


// fitted = fitted.map(function(img){
//   var ndvi = img.normalizedDifference(['nir_predicted','red_predicted']).rename(['NDVI_predicted_after']);
//   return img.addBands(ndvi);
// });
// Map.addLayer(fitted.select(['NDVI_predicted','NDVI_predicted_after']),{},'NDVI Fitted vs NDVI after',false);
// var diff = fitted.map(function(img){
//   return img.select(['NDVI_predicted']).subtract(img.select(['NDVI_predicted_after'])).pow(2);
// }).mean();
// Map.addLayer(diff,{min:0,max:0.01},'Mean sq diff NDVI before and after')
Map.setOptions('HYBRID');