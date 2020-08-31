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
/**
 * create segment tab
 */
var buildSegmentTag = function(nSegments) {
  return ee.List.sequence(1, nSegments).map(function(i) {
    return ee.String('S').cat(ee.Number(i).int());
  });
};


function buildSegmentBandTag(nSegments,bands){
  var out = bands.map(function(bn){
      return ee.List.sequence(1, nSegments).map(function(i) {
        return ee.String('S').cat(ee.Number(i).int()).cat('_').cat(bn);
      });
  });
  return out.flatten();
}
/**
 * Extract CCDC magnitude image
 * 
 */
var buildMagnitude = function(fit, nSegments) {
  var mag = fit.select(['.*_magnitude']);
  var bns = mag.bandNames();
  var segBns = buildSegmentTag(nSegments);

  var zeros = ee.Image(ee.Array([ee.List.repeat(-32768, bns.length())]).repeat(0, nSegments));
  var magImg = mag.toArray(1).arrayCat(zeros, 0).arraySlice(0, 0, nSegments).arrayFlatten([segBns,bns]);
  
  return magImg;
};

/**
 * Extract CCDC RMSE image
 * 
 */
var buildRMSE = function(fit, nSegments) {
  var rmses = fit.select(['.*_rmse']);
  var bns = rmses.bandNames();
  var segBns = buildSegmentTag(nSegments);

  var zeros = ee.Image(ee.Array([ee.List.repeat(-32768, bns.length())]).repeat(0, nSegments));
  var rmseImg = rmses.toArray(1).arrayCat(zeros, 0).arraySlice(0, 0, nSegments).arrayFlatten([segBns,bns]);
  
  return rmseImg;
};

/**
 * Extract CCDC Coefficient image
 * 
 */
var buildCoefs = function(fit, nSegments,harmonicTag) {
  if(nSegments === null || nSegments === undefined){
    nSegments = 4;
  }
  if(harmonicTag === null || harmonicTag === undefined){
    harmonicTag = ['INTP','SLP','COS','SIN','COS2','SIN2','COS3','SIN3'];
  }
  
  
  var coeffs = fit.select(['.*_coefs']);
  
  var bns = coeffs.bandNames();
  
  var segBns = ee.List.sequence(1,nSegments).map(function(n){return ee.String('S').cat(ee.Number(n).byte().format())});

  var otherBns =bns.map(function(bn){
    bn = ee.String(bn);
    return harmonicTag.map(function(harm){
      harm = ee.String(harm);
      return bn.cat('_').cat(harm);
    });
  }).flatten();
  
  var totalLength = ee.Number(harmonicTag.length).multiply(bns.length());
  var zeros = ee.Image(ee.Array([ee.List.repeat(-32768,totalLength)]).repeat(0, nSegments));
  
  var coeffImg = coeffs.toArray(1).arrayCat(zeros, 0).arraySlice(0, 0, nSegments);

  coeffImg = coeffImg.arrayFlatten([segBns,otherBns]);
 
  return coeffImg;
};

/**
 * Extract CCDC tStart, tEnd, tBreak, changeProb
 * 
 */
var buildStartEndBreakProb = function(fit, nSegments) {
  var change = fit.select(['.*tStart','.*tEnd','.*tBreak','.*changeProb']);
  var bns = change.bandNames();
  var segBns = buildSegmentTag(nSegments);
  var zeros = ee.Image(ee.Array([ee.List.repeat(-32768, bns.length())]).repeat(0, nSegments));
  var changeImg = change.toArray(1).arrayCat(zeros, 0).arraySlice(0, 0, nSegments).arrayFlatten([segBns,bns]);
  
  var tStart = changeImg.select(['.*tStart']);
  var changeProbs = changeImg.select(['.*changeProb']);
  var tEnds = changeImg.select(['.*tEnd']);
  var tBreaks = changeImg.select(['.*tBreak']);
  tBreaks = tBreaks.where(tBreaks.eq(0),tEnds);
  
  
  changeImg = ee.Image.cat([tStart,tEnds,tBreaks,changeProbs]);
  return changeImg;
  
};

/**
Build CCDC output stack from array image
 */
var buildCcdcImage = function(ccdc, nSegments) {
  var coeffs =buildCoefs(ccdc,nSegments);
  var rmses = buildRMSE(ccdc, nSegments);
  var mags = buildMagnitude(ccdc, nSegments);
  var change = buildStartEndBreakProb(ccdc, nSegments);

  var ccdcImg = ee.Image.cat(coeffs, rmses, mags, change).float();
  ccdcImg = ccdcImg.updateMask(ccdcImg.neq(-32768));
  return ccdcImg;
};
////////////////////////////////////////////////////////////////////////////////////////
//Function to find the corresponding CCDC coefficients for a given time image
//The timeImg can have other bands in it that will be retained in the image that
//is returned.  This is useful if plotting actual and predicted values is of interest
function getCCDCSegCoeffs(timeImg,ccdcImg,timeBandName, fillGapBetweenSegments,tStartKey,tEndKey,coeffKey,rmseKey){
  if(timeBandName === null || timeBandName === undefined){timeBandName = 'year'}
  if(fillGapBetweenSegments === null || fillGapBetweenSegments === undefined){fillGapBetweenSegments = 1}
  if(tStartKey === null || tStartKey === undefined){tStartKey = '.*tStart'}
  if(tEndKey === null || tEndKey === undefined){tEndKey = '.*tBreak'}
  if(coeffKey === null || coeffKey === undefined){coeffKey = '.*_coef.*'}
  if(rmseKey === null || rmseKey === undefined){rmseKey = '.*_rmse'}
  //Pop off the coefficients and find the output band names
  var coeffs =  ccdcImg.select([coeffKey,rmseKey]);
  var coeffBns = coeffs.bandNames();
  var outBns = coeffs.select(['S1_.*']).bandNames().map(function(bn){return ee.String(bn).split('_').slice(1,null).join('_')});
  
  //Find the start and end time for the segments
  var tStarts = ccdcImg.select([tStartKey]);
  var tEnds = ccdcImg.select([tEndKey]);
  
  //Get seg start band names
  var segBns = tStarts.bandNames().map(function(bn){return ee.String(bn).split('_').slice(0,1).join('_')});
  
  //Get the time for the given timeImg
  var tBand = timeImg.select([timeBandName]);
  
  
  //Find how many segments there are
  var nSegs = ccdcImg.select([tStartKey]).bandNames().length();
  
  //Create a mask stack for a given timage
  var segMask = tBand.gte(tStarts).and(tBand.lt(tEnds)).selfMask().unmask().toArray().arrayRepeat(1, outBns.length()).arrayFlatten([segBns,outBns]).toArray();
  coeffs = coeffs.unmask().toArray().arrayMask(segMask).arrayFlatten([outBns]);//.updateMask(segMask)//.arrayProject([0])
  
  // //Iterate through each segment to pull the correct values
  // var prev = ee.Image.constant(ee.List.repeat(-9999,outBns.length())).rename(outBns);
  // // var out = ee.Image(ee.List.sequence(1,nSegs).iterate(function(n,prev){
  //   n = ee.Number(n).byte();
  //   prev = ee.Image(prev);
  //   var segBN = ee.String('S').cat(ee.Number(n).byte().format()).cat('_.*');
  //   var segBNBefore = ee.String('S').cat(ee.Number(n).subtract(1).byte().format()).cat('_.*');
    
  //   var segCoeffs = ccdcImg.select([segBN]);
  //   segCoeffs = segCoeffs.select([coeffKey,rmseKey]);
    
  //   //Handle whether to go back to breakpoint for any segement after the first
  //   var tStarts1 = ccdcImg.select([segBN]);
  //   tStarts1 = tStarts1.select([tStartKey]);
    
  //   //Go back to previous breakpont if the segment n is > 1
  //   var tStartsGT1T = ccdcImg.select([segBNBefore]);
  //   tStartsGT1T = tStartsGT1T.select([tEndKey]);
  //   var tStartsT =ee.Algorithms.If(n.gt(1).and(ee.Number(fillGapBetweenSegments).eq(1)),tStartsGT1T,tStarts1);
    
  //   var tEndsT = tEnds.select([segBN]);
  //   //Mask out segments that the time does not intersect
  //   var segMaskT  = tBand.gte(tStartsT).and(tBand.lt(tEndsT));
  
  
  //   // var segMaskT = segMask.select([segBN]);
  //   segCoeffs = segCoeffs.updateMask(segMaskT);
  //   segCoeffs = prev.where(segCoeffs.mask(),segCoeffs);
  //   prev = segCoeffs
  //   // return segCoeffs;
  // }
  // // ,prev));
  // out = out.updateMask(out.neq(-9999));

  timeImg = timeImg.addBands(coeffs);
  return timeImg;
  }
////////////////////////////////////////////////////////////////////////////////////////
//Function to get prediced value from a set of harmonic coefficients and a time band
//The time band is assumed to be in a yyyy.ff where the .ff is the proportion of the year
//The timeImg can have other bands in it that will be retained in the image that
//is returned.  This is useful if plotting actual and predicted values is of interest
function getCCDCPrediction(timeImg,coeffImg,timeBandName,detrended,whichHarmonics,addRMSE,rmseImg,nRMSEs){
  var harmDict = ee.Dictionary({1:'',2:'2',3:'3',4:'4'});
  if(timeBandName === null || timeBandName === undefined){timeBandName = 'year'}
  if(detrended === null || detrended === undefined){detrended = true}
  if(whichHarmonics === null || whichHarmonics === undefined){whichHarmonics = [1,2,3]}
  if(addRMSE === null || addRMSE === undefined){addRMSE = true}
  if(rmseImg === null || rmseImg === undefined){rmseImg = coeffImg.select(['.*_rmse'])}
  if(nRMSEs === null || nRMSEs === undefined){nRMSEs = [2]}
  var tBand = timeImg.select([timeBandName]);
  var neededCoeffs = ee.List([]);
  //Unit of each harmonic (1 cycle)
  var omega = ee.Number(2.0).multiply(Math.PI);
  
  //Constant raster for each coefficient
  //Constant, slope, first harmonic, second harmonic, and third harmonic
  var harmImg = ee.Image([1]);
  neededCoeffs = neededCoeffs.cat(['.*_INTP']);
  
  harmImg = ee.Algorithms.If(detrended, harmImg.addBands(tBand),harmImg);
  neededCoeffs = ee.Algorithms.If(detrended, neededCoeffs.cat(['.*_SLP']),neededCoeffs);
 
  
  harmImg = ee.Image(ee.List(whichHarmonics).iterate(function(n,prev){
    var omImg = tBand.multiply(omega.multiply(n));
    return ee.Image(prev).addBands(omImg.cos()).addBands(omImg.sin());
  },harmImg));
  
  neededCoeffs = ee.List(whichHarmonics).iterate(function(n,prev){
    prev = ee.List(prev);
    return prev.cat([ee.String('.*_COS').cat(harmDict.get(n)),ee.String('.*_SIN').cat(harmDict.get(n))]);
  },neededCoeffs);
 
  //Ensure just coeffs for ccdc coeffs
  coeffImg = coeffImg.select(['.*_coef.*']).select(neededCoeffs);

  //Parse through bands to find individual bands that need predicted
  var actualBandNames = coeffImg.bandNames().map(function(bn){return ee.String(bn).split('_').get(0)});
  actualBandNames = ee.Dictionary(actualBandNames.reduce(ee.Reducer.frequencyHistogram())).keys();
  var bnsOut = actualBandNames.map(function(bn){return ee.String(bn).cat('_predicted')});

  //Apply respective coeffs for each of those bands to predict 
  var predicted = ee.ImageCollection(actualBandNames.map(function(bn){
    bn = ee.String(bn);
    var predictedT = coeffImg.select([bn.cat('.*')]).multiply(harmImg).reduce(ee.Reducer.sum());
    return predictedT;
  })).toBands().rename(bnsOut);
 
  //Add rmses if specified
  // function getRMSES(){
  // var rmses = ee.Image(ee.List(nRMSEs).iterate(function(n,prev){
  //     n = ee.Number(n);
  //     var plusBns = bnsOut.map(function(bn){return ee.String(bn).cat('_Plus_').cat(n.format()).cat('_RMSEs')});
  //     var minusBns = bnsOut.map(function(bn){return ee.String(bn).cat('_Minus_').cat(n.format()).cat('_RMSEs')});
  //     var plus = predicted.add(rmseImg.multiply(n)).rename(plusBns);
  //     var minus = predicted.subtract(rmseImg.multiply(n)).rename(minusBns);
  //     return ee.Image.cat(prev,plus,minus);
  //   },ee.Image()));
  //   var rmsesBns = rmses.bandNames().slice(1,null);
  //   rmses = rmses.select(rmsesBns);
  //   return rmses;
  // }
  var out = timeImg.addBands(predicted);

  // out = ee.Image(ee.Algorithms.If(addRMSE,out.addBands(getRMSES()),out));
  out = out.updateMask(tBand.mask());
 
 
  return out
}
////////////////////////////////////////////////////////////////////////////////////////
//Function to take a given CCDC results stack and predict values for a given time series
//The ccdcImg is assumed to have coefficients for a set of segments and a tStart and tEnd for 
//each segment. 
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
function predictCCDC(ccdcImg,timeSeries,harmonicTag,timeBandName,detrended,whichHarmonics,fillGapBetweenSegments,addRMSE,rmseImg,nRMSEs){
  
  //Add the segment-appropriate coefficients to each time image
  // getCCDCSegCoeffs(ee.Image(timeSeries.first()),ccdcImg,timeBandName,fillGapBetweenSegments)
  timeSeries = timeSeries.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,timeBandName,fillGapBetweenSegments)});
  // print(timeSeries)
  
  //Predict out the values for each image 
  // var img = ee.Image(timeSeries.first());
  // getCCDCPrediction(img,img.select(['.*_coef.*','.*_rmse']),timeBandName,detrended,whichHarmonics,addRMSE,rmseImg,nRMSEs)
  timeSeries = timeSeries.map(function(img){return getCCDCPrediction(img,img.select(['.*_coef.*','.*_rmse']),timeBandName,detrended,whichHarmonics,addRMSE,rmseImg,nRMSEs)});
  // print(timeSeries.first());
  Map.addLayer(timeSeries,{},'time series')
  // return timeSeries;
 
}
///////////////////////////////////////////////////////////////////////
var startYear = 2010;
var endYear = 2015;
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
var c = ee.Image('users/iwhousman/test/ChangeCollection/CCDC-Test2');


function getMaxSegs(ccdcImg){
  var scale = ccdcImg.projection().nominalScale();
  var geo = ccdcImg.geometry();
  var nSegs = ccdcImg.select([0]).arrayLength(0);
  var maxSegs = ee.Dictionary(nSegs.reduceRegion(ee.Reducer.max(),geo, scale,null,null, true,1e13,2)).values().get(0);
  return maxSegs;
}
c =  buildCcdcImage(c,getMaxSegs(c).getInfo())

Map.addLayer(c)
// c = c.map(function(img){
//   var bCount = ee.Image(img).bandNames().length();
//   return img.set('bandCount',bCount);
// });
// print(c)
// c = c.filter(ee.Filter.eq('bandCount',576));
// c = c.mosaic();
var ccdcImg = c;
// // print(ccdcImg)
// var selectBands = bands.map(function(b){return '.*'+b+'.*'});

// selectBands = selectBands.concat(['.*tStart','.*_changeProb']);

// var tEnds = ccdcImg.select(['.*tEnd']);
// var tBreaks = ccdcImg.select(['.*tBreak']);
// tBreaks = tBreaks.where(tBreaks.eq(0),tEnds);

// ccdcImg = ccdcImg.select(selectBands);

// ccdcImg = ee.Image.cat([ccdcImg,tEnds,tBreaks])
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

var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
  n = ee.Number(n);
  var img = ee.Image(n).float().rename(['year']);
  var y = n.int16();
  var fraction = n.subtract(y);
  var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
  return img.set('system:time_start',d)
}));
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
var predicted1 = predictCCDC(ccdcImg,yearImages,null,'year',true,[1])//.select(['.*_predicted']);
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