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
function simpleCCDCPredictionWrapper(c,timeBandName,whichHarmonics){
  var whichBands = ee.Image(c.first()).select(['.*_INTP']).bandNames().map(function(bn){return ee.String(bn).split('_').get(0)});
  whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys().getInfo();
  var out = c.map(function(img){return simpleCCDCPrediction(img,timeBandName,whichHarmonics,whichBands)});
  Map.addLayer(out.select(['.*_predicted']))
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
  var tBreakKeys = ['tBreak']
  
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
  // tStarts = ee.Image(ee.Algorithms.If(fillGaps,tStarts.arraySlice(0,0,1).arrayCat(tBreaks.arraySlice(0,0,-1),0),tStarts));
  // tEnds = ee.Image(ee.Algorithms.If(fillGaps,tBreaks.arraySlice(0,0,-1).arrayCat(tEnds.arraySlice(0,-1,null),0),tEnds));
  
  
  //Set up a mask for segments that the time band intersects
  var tMask = tStarts.lte(timeImg).and(tEnds.gt(timeImg)).arrayRepeat(1,1).arrayRepeat(2,1);
  coeffs = coeffs.arrayMask(tMask).arrayProject([2,1]).arrayTranspose(1,0).arrayFlatten([bns,harmonicTag]);
  
  //If time band doesn't intersect any segments, set it to null
  // coeffs = coeffs.updateMask(coeffs.reduce(ee.Reducer.max()).neq(0));
  
  return timeImg.addBands(coeffs);
}

function predictCCDC(ccdcImg,timeImgs,fillGaps,whichHarmonics){//,fillGapBetweenSegments,addRMSE,rmseImg,nRMSEs){
  // var timeImg = ee.Image(timeImgs.first());
  var timeBandName = ee.Image(timeImgs.first()).select([0]).bandNames().get(0);

  
  // getCCDCSegCoeffs(timeImg,ccdcImg)
  // Add the segment-appropriate coefficients to each time image
  timeImgs = timeImgs.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,fillGaps)});
simpleCCDCPredictionWrapper(timeImgs,timeBandName,whichHarmonics)
// simpleCCDCPredictionWrapper(timeImgs,timeBandName,[1])

  // getCCDCSegCoeffs(ee.Image(timeSeries.first()),ccdcImg,timeBandName,fillGapBetweenSegments)
  // timeSeries = timeSeries.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,timeBandName,fillGapBetweenSegments)});
  
  //Predict out the values for each image 

  // simpleCCDCPredictionWrapper(timeSeries,'year',[1,2,3]);
  // Map.addLayer(predicted)
  // getCCDCPrediction(img,img.select(['.*_coef.*','.*_rmse']),timeBandName,detrended,whichHarmonics,addRMSE,rmseImg,nRMSEs)
  // timeImgs = timeImgs.map(function(img){return getCCDCPrediction(img,img.select(['.*_coef.*','.*_rmse']),timeBandName,detrended,whichHarmonics)});
  // print(timeImgs);
  // Map.addLayer(timeSeries,{},'time series')
  // return timeSeries;
 
}


///////////////////////////////////////////////////////////////////////
// var startYear = 2010;
// var endYear = 2015;
var bands = ['NDVI'];
// var idsFolder = 'projects/USFS/LCMS-NFS/CONUS-Ancillary-Data/IDS';
// var ids = ee.data.getList({id:idsFolder}).map(function(t){return t.id});

// ids = ids.map(function(id){
//   var idsT = ee.FeatureCollection(id);
//   return idsT;
// });
// ids = ee.FeatureCollection(ids).flatten();
// ids = ids.filter(ee.Filter.inList('SURVEY_YEA',[2019]));
// ids = ee.Image().paint(ids,null,2);
// ids = ids.visualize({min:1,max:1,palette:'0FF'});
// Map.addLayer(ids,{},'ids');
// var ccdcImg = ee.Image('users/ianhousman/test/CCDC_Collection/CCDC_Test14');//.reproject('EPSG:5070',null,30);
// var c = ee.ImageCollection('users/chastainr/CCDC_Collection/CCDC_Collection_imagecoll');
var ccdcImg = ee.Image('users/iwhousman/test/ChangeCollection/CCDC-Test3');
var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();
// print(startJulian)
// function getMaxSegs(ccdcImg){
//   var scale = ccdcImg.projection().nominalScale();
//   var geo = ccdcImg.geometry();
//   var nSegs = ccdcImg.select([0]).arrayLength(0);
//   var maxSegs = ee.Dictionary(nSegs.reduceRegion(ee.Reducer.max(),geo, scale,null,null, true,1e13,2)).values().get(0);
//   return maxSegs;
// }
// c =  buildCcdcImage(c,getMaxSegs(c).getInfo())

// Map.addLayer(c)
// // c = c.map(function(img){
// //   var bCount = ee.Image(img).bandNames().length();
// //   return img.set('bandCount',bCount);
// // });
// // print(c)
// // c = c.filter(ee.Filter.eq('bandCount',576));
// // c = c.mosaic();
// var ccdcImg = c;
// // // print(ccdcImg)
// var selectBands = bands.map(function(b){return '.*'+b+'.*'});

// selectBands = selectBands.concat(['.*tStart','.*_changeProb']);

// var tEnds = ccdcImg.select(['.*tEnd']);
// var tBreaks = ccdcImg.select(['.*tBreak']);
// tBreaks = tBreaks.where(tBreaks.eq(0),tEnds);

// ccdcImg = ccdcImg.select(selectBands);

// ccdcImg = ee.Image.cat([ccdcImg,tEnds,tBreaks]);
// print(ccdcImg)
// // print(ccdcImg.bandNames())
// Map.addLayer(ccdcImg,{},'CCDC Img',false);
// // var change = dLib.getCCDCChange2(ccdcImg);

// //Pull out change
// var segLossMagThresh = 0.15;
// var segLossSlopeThresh = 0.05;
// var segGainMagThresh = 0.1;
// var segGainSlopeThresh = 0.05;
// var changeDirBand = bands[0];
// var change = dLib.getCCDCChange(ccdcImg,changeDirBand,startYear,endYear,segLossMagThresh,segLossSlopeThresh,segGainMagThresh,segGainSlopeThresh);
// var lossYearsCombined = ee.Image.cat([change.breakLossYears.reduce(ee.Reducer.max()),change.segLossYears.reduce(ee.Reducer.max())]).reduce(ee.Reducer.firstNonNull());

// Map.addLayer(lossYearsCombined,{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Break or Seg Loss Year',false);

// Map.addLayer(change.breakLossYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Break Loss Year',false);
// Map.addLayer(change.segLossYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Seg Loss Year',false);

// Map.addLayer(change.breakGainYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Most Recent Break Gain Year',false);
// Map.addLayer(change.segGainYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Most Recent Seg Gain Year',false);

// Map.addLayer(change.segLossYears,{min:startYear,max:endYear},'All Seg Loss Years',false);
// Map.addLayer(change.segGainYears,{min:startYear,max:endYear},'All Seg Gain Years',false);

// // Map.addLayer(change.lossMags.reduce(ee.Reducer.max()),{min:-0.6,max:-0.2,palette:dLib.lossMagPalette},'Largest Mag Loss');
// // Map.addLayer(change.gainMags.reduce(ee.Reducer.max()),{min:0.1,max:0.3,palette:dLib.gainMagPalette},'Largest Mag Gain');
  
// // var ccdcImgCoeffs = ccdcImg.select(['.*_coef.*']);
// // var coeffBns = ccdcImgCoeffs.bandNames();
// // print(coeffBns)
// // var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd']);
// // ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT)
// // // Map.addLayer(ccdcImg)
// // var ccdcImg = ee.ImageCollection('projects/CCDC/USA')
// //           .filterBounds(geometry)
// //           .mosaic();
// // print(ccdcImg)
// // var ccdcImgCoeffs = ccdcImg.select(['.*B2_coef_.*','.*B4_coef_.*'])//.divide(365.25);
// // var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd'])//.divide(365.25);

// // ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT);
// // Map.addLayer(ccdcImg)

var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear,0.1).map(function(n){
  n = ee.Number(n);
  var img = ee.Image(n).float().rename(['year']);
  var y = n.int16();
  var fraction = n.subtract(y);
  var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
  return img.set('system:time_start',d)
}));
yearImages = yearImages.filter(ee.Filter.calendarRange(startYear,endYear,'year'))
                      .filter(ee.Filter.calendarRange(startJulian,endJulian))
// Map.addLayer(yearImages)
// var studyArea =ccdcImg.geometry();
// // var yearImages = getImagesLib.getProcessedLandsatScenes(studyArea,startYear,endYear,1,365)
// // .map(getImagesLib.addSAVIandEVI)
// // .select(bands)
// // .map(getImagesLib.addYearYearFractionBand)

// // print(yearImages.limit(5))
// //   .select(ccdcParams.breakpointBands);
// // var yearImages2 = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
// //   n = ee.Number(n);
// //   var img = ee.Image(n).float().rename(['year']);
// //   var y = n.int16();
// //   var fraction = n.subtract(y);
// //   var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
// //   return img.multiply(365.25).set('system:time_start',d)
// // }));
// // // Map.addLayer(ccdcImg)
// // // processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand)
// // // var bns = ee.Image(timeSeries.first()).bandNames();
// var nSegments = ccdcImg.select(['.*tStart']).bandNames().length().getInfo();
// // //Visualize the number of segments
// var count = ccdcImg.select(['.*']).select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
// Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
// // // Map.addLayer(ccdcImgSmall.select(['.*tEnd']).selfMask().reduce(ee.Reducer.max()),{min:endYear-1,max:endYear},'Last Year');

// // var coeffs = ccdcImg.select('S1.*');
// // var bns = coeffs.bandNames();
// // bns = bns.map(function(bn){return ee.String(bn).split('_').slice(1,null).join('_')});
// // timeBandName,detrended,whichHarmonics,fillGapBetweenSegments
// // coeffs = coeffs.rename(bns)
// // var predicted = getCCDCPrediction(ee.Image(yearImages.first()),coeffs,'year',false,[1])
// var predicted0 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[]).select(['.*_predicted','.*_RMSEs']);
 predictCCDC(ccdcImg,yearImages,true,[1])//.select(['.*_predicted']);
 predictCCDC(ccdcImg,yearImages,false,[1])
//predictCCDC(ccdcImg,timeSeries,harmonicTag,timeBandName,detrended,whichHarmonics,fillGapBetweenSegments,addRMSE,rmseImg,nRMSEs){
// print(predicted1)
// // // var predicted2 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2]).select(['.*_predicted']);
// // var predicted3 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2,3]).select(['.*_predicted','.*_RMSEs']);//.select(bands.concat(['.*_predicted','.*_RMSEs']));
// print(predicted0)
// var joined = getImagesLib.joinCollections(predicted0,predicted1);
// // // joined = getImagesLib.joinCollections(joined,predicted2)
// // // // joined = getImagesLib.joinCollections(joined,predicted3)
// Map.addLayer(predicted0,{},'Predicted With Filling',false)
// // ccdcImg,timeSeries,harmonicTag,timeBandName,detrended,whichHarmonics,fillGapBetweenSegments
// var predicted0 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[],0).select(['.*_predicted']);
// // var predicted1 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1],0).select(['.*_predicted']);
// // var predicted2 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2],0).select(['.*_predicted']);
// var predicted3 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2,3],0).select(['.*_predicted']);
// var joined = getImagesLib.joinCollections(predicted0,predicted3);
// // joined = getImagesLib.joinCollections(joined,predicted2)
// // joined = getImagesLib.joinCollections(joined,predicted3)
// Map.addLayer(joined,{},'Predicted Without Filling',false)
// // print(predicted)
// // predicted = predicted.map(function(img){
// //   var nbr = img.normalizedDifference(['nir_predicted','red_predicted']).rename(['NBR_predicted_from_bands'])
// //   var ndvi = img.normalizedDifference(['nir_predicted','swir2_predicted']).rename(['NDVI_predicted_from_bands'])
// //   return img.addBands(ndvi).addBands(nbr)
  
  
// // })



// // Map.addLayer(ccdcImg)
// // var predictedCONUS = predictCCDC(ccdcImg,yearImages2).select(['.*_predicted'])//.map(function(img){return img.divide(100000).copyProperties(img,['system:time_start'])});
// // Map.addLayer(predictedCONUS,{},'Predicted CONUS')
//   // print(ccdcImg);
// // Map.addLayer(ccdcImg,{},'ccdcImg',false);

// // var breaks = ccdcImg.select(['.*_tBreak']);
// // var probs = ccdcImg.select(['.*_changeProb']);
// // var change = probs.gt(0.6);
// // breaks = breaks.updateMask(change.neq(0));
// // Map.addLayer(breaks.reduce(ee.Reducer.max()),{min:startYear,max:endYear},'Change year',false);


// //Visualize the seasonality of the first segment
// // var seg1 = ccdcImg.select(['S1.*']);
// // var sinCoeffs = seg1.select(['.*_SIN']);
// // var cosCoeffs = seg1.select(['.*_COS']);
// // var bands = ['.*swir2.*','.*nir.*','.*red.*'];
// // // var band = 'B4.*';
// // var phase = sinCoeffs.atan2(cosCoeffs)
// //                     .unitScale(-Math.PI, Math.PI);
 
// // var amplitude = sinCoeffs.hypot(cosCoeffs)
// //                     // .unitScale(0, 1)
// //                     .multiply(2);
// // Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
// // Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);

Map.setOptions('HYBRID');