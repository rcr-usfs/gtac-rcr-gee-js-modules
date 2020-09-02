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
        [[[-108.28163961476221, 39.25451132142729],
          [-108.28163961476221, 36.68265794564914],
          [-104.55727438038721, 36.68265794564914],
          [-104.55727438038721, 39.25451132142729]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
// var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
// var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
//-------------------- BEGIN CCDC Helper Function -------------------//
//Function to predict a CCDC harmonic model at a given time
//The whichHarmonics options are [1,2,3] - denoting which harmonics to include
//Which bands is a list of the names of the bands to predict across
function simpleCCDCPrediction(img,timeBandName,whichHarmonics,whichBands){
  //Unit of each harmonic (1 cycle)
  var omega = ee.Number(2.0).multiply(Math.PI);
  var tBand = img.select([timeBandName]);
  var intercepts = img.select(['.*_INTP']);
  var slopes = img.select(['.*_SLP']).multiply(tBand);
 
  var tOmega = ee.Image(whichHarmonics).multiply(omega).multiply(tBand);
  var cosHarm = tOmega.cos();
  var sinHarm = tOmega.sin();
  
  var harmSelect = whichHarmonics.map(function(n){return ee.String('.*').cat(ee.Number(n).format())});
  
  var sins = img.select(['.*_SIN.*']);
  sins = sins.select(harmSelect);
  var coss = img.select(['.*_COS.*']);
  coss = coss.select(harmSelect);
  
  var outBns = whichBands.map(function(bn){return ee.String(bn).cat('_predicted')});
  var predicted = ee.ImageCollection(whichBands.map(function(bn){
    bn = ee.String(bn);
    return ee.Image([intercepts.select(bn.cat('.*')),
                    slopes.select(bn.cat('.*')),
                    sins.select(bn.cat('.*')).multiply(sinHarm),
                    coss.select(bn.cat('.*')).multiply(cosHarm)
                    ]).reduce(ee.Reducer.sum());
  })).toBands().rename(outBns);
  return img.addBands(predicted);
}
/////////////////////////////////////////////////////////////
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
  var tMask = tStarts.lte(timeImg).and(tEnds.gt(timeImg)).arrayRepeat(1,1).arrayRepeat(2,1);
  coeffs = coeffs.arrayMask(tMask).arrayProject([2,1]).arrayTranspose(1,0).arrayFlatten([bns,harmonicTag]);
  
  //If time band doesn't intersect any segments, set it to null
  coeffs = coeffs.updateMask(coeffs.reduce(ee.Reducer.max()).neq(0));
  
  return timeImg.addBands(coeffs);
}

function predictCCDC(ccdcImg,timeImgs,fillGaps,whichHarmonics){//,fillGapBetweenSegments,addRMSE,rmseImg,nRMSEs){
  var timeBandName = ee.Image(timeImgs.first()).select([0]).bandNames().get(0);
  // Add the segment-appropriate coefficients to each time image
  timeImgs = timeImgs.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,fillGaps)});
  return simpleCCDCPredictionWrapper(timeImgs,timeBandName,whichHarmonics);
}


function getTimeImageCollection(startYear,endYear,startJulian,endJulian,step){
  if(startJulian === undefined || startJulian === null){
    startJulian = 1;
  }
  if(endJulian === undefined || endJulian === null){
    endJulian = 365;
  }
  if(step === undefined || step === null){
    step = 0.1;
  }
  var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear,step).map(function(n){
  n = ee.Number(n);
  var img = ee.Image(n).float().rename(['year']);
  var y = n.int16();
  var fraction = n.subtract(y);
  var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
  return img.set('system:time_start',d);
  }));
  return yearImages.filter(ee.Filter.calendarRange(startYear,endYear,'year'))
                      .filter(ee.Filter.calendarRange(startJulian,endJulian));
}

///////////////////////////////////////////////////////////////////////
var ccdcImg = ee.Image('users/iwhousman/test/ChangeCollection/CCDC-Test3');

var whichHarmonics = [1,2,3];

var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();

var yearImages = getTimeImageCollection(startYear,endYear,startJulian,endJulian,0.1);
var fitted = predictCCDC(ccdcImg,yearImages,true,whichHarmonics);
Map.addLayer(fitted.select(['.*_predicted']),{},'Fitted CCDC')


Map.setOptions('HYBRID');