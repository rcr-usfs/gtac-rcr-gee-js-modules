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
// var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
// var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
///////////////////////////////////////////////////////////////////////
var startYear = 2010;
var endYear = 2020;
var bands = ['NDVI'];
var ccdcImg = ee.Image('users/ianhousman/test/CCDC_Collection/CCDC_Test12');//.reproject('EPSG:5070',null,30);
print(ccdcImg)
var selectBands = bands.map(function(b){return '.*'+b+'.*'});

selectBands = selectBands.concat(['.*tStart','.*_changeProb']);

var tEnds = ccdcImg.select(['.*tEnd']);
var tBreaks = ccdcImg.select(['.*tBreak']);
tBreaks = tBreaks.where(tBreaks.eq(0),tEnds);

ccdcImg = ccdcImg.select(selectBands);

ccdcImg = ee.Image.cat([ccdcImg,tEnds,tBreaks])
// print(ccdcImg.bandNames())
Map.addLayer(ccdcImg,{},'CCDC Img',false);
// var change = dLib.getCCDCChange2(ccdcImg);

function getCCDCChange2(ccdcImg,changeDirBand,lossDir,magnitudeEnding,coeffEnding,slopeEnding,tStartEnding,tEndEnding,tBreakEnding,changeProbEnding,changeProbThresh,segMagThresh,segSlopeThresh,divideTimeBy,startYear,endYear){
  if(changeDirBand === null || changeDirBand === undefined){changeDirBand = 'NDVI'}
  if(lossDir === null || lossDir === undefined){lossDir = -1}//getImagesLib.changeDirDict[changeDirBand]}
  if(magnitudeEnding === null || magnitudeEnding === undefined){magnitudeEnding = '_magnitude'}
  if(coeffEnding === null || coeffEnding === undefined){coeffEnding = '.*_coefs_.*'}
  if(slopeEnding === null || slopeEnding === undefined){slopeEnding = '.*_SLP'}
  if(tStartEnding === null || tStartEnding === undefined){tStartEnding = '_tStart'}
  if(tEndEnding === null || tEndEnding === undefined){tEndEnding = '_tEnd'}
  if(tBreakEnding === null || tBreakEnding === undefined){tBreakEnding = '_tBreak'}
  if(changeProbEnding === null || changeProbEnding === undefined){changeProbEnding = '_changeProb'}
  if(changeProbThresh === null || changeProbThresh === undefined){changeProbThresh = 0.8}
  if(segMagThresh === null || segMagThresh === undefined){segMagThresh = 0.2}
  if(segSlopeThresh === null || segSlopeThresh === undefined){segSlopeThresh = 0.2}
  if(divideTimeBy === null || divideTimeBy === undefined){divideTimeBy = 1}
  if(startYear === null || startYear === undefined){startYear = 0}
  if(endYear === null || endYear === undefined){endYear = 3000}
  
  var coeffs = ccdcImg.select(['.*'+changeDirBand+coeffEnding]);
  
  var slopes = coeffs.select(['.*'+slopeEnding]);
  var tStarts = ccdcImg.select(['.*'+tStartEnding]);
  var tEnds = ccdcImg.select(['.*'+tEndEnding]);
  var durs = tEnds.subtract(tStarts);
  var mags = durs.multiply(slopes);
  
  
  var changeProbs = ccdcImg.select(['.*'+changeProbEnding]).selfMask();
  changeProbs = changeProbs.updateMask(changeProbs.gte(changeProbThresh));

  var changeYears = ccdcImg.select(['.*'+tBreakEnding]).selfMask().divide(divideTimeBy);
  changeYears = changeYears.updateMask(changeYears.gte(startYear).and(changeYears.lte(endYear)).and(changeProbs.mask()));
  var diffs = ccdcImg.select(['.*'+changeDirBand+magnitudeEnding]).updateMask(changeYears.mask());
  
  //Pull out loss and gain
  if(lossDir === 1){
    diffs = diffs.multiply(-1);
    mags = mags.multiply(-1);
    slopes = slopes.multiply(-1);
  }
  var loss = diffs.lt(0).or(mags.lt(-segMagThresh)).or(slopes.lt(-segSlopeThresh));
  var gain = diffs.gt(0).or(mags.gt(segMagThresh)).or(slopes.gt(segSlopeThresh))
  var lossYears = changeYears.updateMask(loss);
  var gainYears = changeYears.updateMask(gain);
  var lossMags = diffs.updateMask(diffs.lt(0));
  var gainMags = diffs.updateMask(diffs.gt(0));
  
  return {lossYears:lossYears,gainYears:gainYears,lossMags:lossMags,gainMags:gainMags};
}
getCCDCChange2(ccdcImg)
// Map.addLayer(change.lossYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Most Recent Loss Year');
// Map.addLayer(change.gainYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Most Recent Gain Year');

// Map.addLayer(change.lossMags.reduce(ee.Reducer.max()),{min:-0.6,max:-0.2,palette:dLib.lossMagPalette},'Largest Mag Loss');
// Map.addLayer(change.gainMags.reduce(ee.Reducer.max()),{min:0.1,max:0.3,palette:dLib.gainMagPalette},'Largest Mag Gain');
  
// var ccdcImgCoeffs = ccdcImg.select(['.*_coef.*']);
// var coeffBns = ccdcImgCoeffs.bandNames();
// print(coeffBns)
// var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd']);
// ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT)
// // Map.addLayer(ccdcImg)
// var ccdcImg = ee.ImageCollection('projects/CCDC/USA')
//           .filterBounds(geometry)
//           .mosaic();
// print(ccdcImg)
// var ccdcImgCoeffs = ccdcImg.select(['.*B2_coef_.*','.*B4_coef_.*'])//.divide(365.25);
// var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd'])//.divide(365.25);

// ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT);
// Map.addLayer(ccdcImg)

var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
  n = ee.Number(n);
  var img = ee.Image(n).float().rename(['year']);
  var y = n.int16();
  var fraction = n.subtract(y);
  var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
  return img.set('system:time_start',d)
}));
var studyArea =ccdcImg.geometry();
// var yearImages = getImagesLib.getProcessedLandsatScenes(studyArea,startYear,endYear,1,365)
// .map(getImagesLib.addSAVIandEVI)
// .select(bands)
// .map(getImagesLib.addYearYearFractionBand)

// print(yearImages.limit(5))
//   .select(ccdcParams.breakpointBands);
// var yearImages2 = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
//   n = ee.Number(n);
//   var img = ee.Image(n).float().rename(['year']);
//   var y = n.int16();
//   var fraction = n.subtract(y);
//   var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
//   return img.multiply(365.25).set('system:time_start',d)
// }));
// // Map.addLayer(ccdcImg)
// // processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand)
// // var bns = ee.Image(timeSeries.first()).bandNames();
var nSegments = ccdcImg.select(['.*tStart']).bandNames().length().getInfo();
// //Visualize the number of segments
var count = ccdcImg.select(['.*']).select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
// // Map.addLayer(ccdcImgSmall.select(['.*tEnd']).selfMask().reduce(ee.Reducer.max()),{min:endYear-1,max:endYear},'Last Year');

// var coeffs = ccdcImg.select('S1.*');
// var bns = coeffs.bandNames();
// bns = bns.map(function(bn){return ee.String(bn).split('_').slice(1,null).join('_')});
// timeBandName,detrended,whichHarmonics,fillGapBetweenSegments
// coeffs = coeffs.rename(bns)
// var predicted = getCCDCPrediction(ee.Image(yearImages.first()),coeffs,'year',false,[1])
// var predicted0 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[]).select(['.*_predicted','.*_RMSEs']);
// // var predicted1 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1]).select(['.*_predicted']);
// // var predicted2 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2]).select(['.*_predicted']);
// var predicted3 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2,3]).select(['.*_predicted','.*_RMSEs']);//.select(bands.concat(['.*_predicted','.*_RMSEs']));

// var joined = getImagesLib.joinCollections(predicted0,predicted3);
// // joined = getImagesLib.joinCollections(joined,predicted2)
// // joined = getImagesLib.joinCollections(joined,predicted3)
// Map.addLayer(joined,{},'Predicted With Filling',false)
// ccdcImg,timeSeries,harmonicTag,timeBandName,detrended,whichHarmonics,fillGapBetweenSegments
// var predicted0 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[],0).select(['.*_predicted']);
// var predicted1 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1],0).select(['.*_predicted']);
// var predicted2 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2],0).select(['.*_predicted']);
// var predicted3 = dLib.predictCCDC(ccdcImg,yearImages,null,'year',true,[1,2,3],0).select(['.*_predicted']);
// var joined = getImagesLib.joinCollections(predicted0,predicted1);
// joined = getImagesLib.joinCollections(joined,predicted2)
// joined = getImagesLib.joinCollections(joined,predicted3)
// Map.addLayer(joined,{},'Predicted Without Filling',false)
// print(predicted)
// predicted = predicted.map(function(img){
//   var nbr = img.normalizedDifference(['nir_predicted','red_predicted']).rename(['NBR_predicted_from_bands'])
//   var ndvi = img.normalizedDifference(['nir_predicted','swir2_predicted']).rename(['NDVI_predicted_from_bands'])
//   return img.addBands(ndvi).addBands(nbr)
  
  
// })



// Map.addLayer(ccdcImg)
// var predictedCONUS = predictCCDC(ccdcImg,yearImages2).select(['.*_predicted'])//.map(function(img){return img.divide(100000).copyProperties(img,['system:time_start'])});
// Map.addLayer(predictedCONUS,{},'Predicted CONUS')
  // print(ccdcImg);
// Map.addLayer(ccdcImg,{},'ccdcImg',false);

// var breaks = ccdcImg.select(['.*_tBreak']);
// var probs = ccdcImg.select(['.*_changeProb']);
// var change = probs.gt(0.6);
// breaks = breaks.updateMask(change.neq(0));
// Map.addLayer(breaks.reduce(ee.Reducer.max()),{min:startYear,max:endYear},'Change year',false);


//Visualize the seasonality of the first segment
// var seg1 = ccdcImg.select(['S1.*']);
// var sinCoeffs = seg1.select(['.*_SIN']);
// var cosCoeffs = seg1.select(['.*_COS']);
// var bands = ['.*swir2.*','.*nir.*','.*red.*'];
// // var band = 'B4.*';
// var phase = sinCoeffs.atan2(cosCoeffs)
//                     .unitScale(-Math.PI, Math.PI);
 
// var amplitude = sinCoeffs.hypot(cosCoeffs)
//                     // .unitScale(0, 1)
//                     .multiply(2);
// Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
// Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);

Map.setOptions('HYBRID');