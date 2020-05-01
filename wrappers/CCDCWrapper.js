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
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
// var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
// var ccdcLib = require('users/yang/CCDC:default');


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

  var zeros = ee.Image(ee.Array([ee.List.repeat(0, bns.length())]).repeat(0, nSegments));
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

  var zeros = ee.Image(ee.Array([ee.List.repeat(0, bns.length())]).repeat(0, nSegments));
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
  var zeros = ee.Image(ee.Array([ee.List.repeat(0,totalLength)]).repeat(0, nSegments));
  
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
  var zeros = ee.Image(ee.Array([ee.List.repeat(0, bns.length())]).repeat(0, nSegments));
  var changeImg = change.toArray(1).arrayCat(zeros, 0).arraySlice(0, 0, nSegments).arrayFlatten([segBns,bns]);
  
  return changeImg;
  
};

/**
 * build a 74 x nSegments layer image
 * using int32 as output.
 * 
 */
var buildCcdcImage = function(fit, nSegments) {
  var coeffs =buildCoefs(ccdc,nSegments);
  var rmses = buildRMSE(ccdc, nSegments);
  var mags = buildMagnitude(ccdc, nSegments);
  var change = buildStartEndBreakProb(ccdc, nSegments);

  return ee.Image.cat(coeffs, rmses, mags, change).float();
};
////////////////////////////////////////////////////////////////////////////////////////
//Function to find the corresponding CCDC coefficients for a given time image
//The timeImg can have other bands in it that will be retained in the image that
//is returned.  This is useful if plotting actual and predicted values is of interest
function getCCDCSegCoeffs(timeImg,ccdcImg,timeBandName){
  if(timeBandName === null || timeBandName === undefined){timeBandName = 'year'}
  
  //Pop off the coefficients and find the output band names
  var coeffs =  ccdcImg.select('.*_coef.*');
  var coeffBns = coeffs.bandNames();
  var outBns = coeffs.select(['S1.*']).bandNames().map(function(bn){return ee.String(bn).split('_').slice(1,null).join('_')});
  
  //Find the start and end time for the segments
  var tStarts = ccdcImg.select(['.*tStart']);
  var tEnds = ccdcImg.select(['.*tEnd']);
  
  //Get the time for the given timeImg
  var tBand = timeImg.select([timeBandName]);
  
  //Mask out segments that the time does not intersect
  var segMask  = tBand.gte(tStarts).and(tBand.lte(tEnds));
  
  //Find how many segments there are
  var nSegs = segMask.bandNames().length();
  
  //Iterate through each segment to pull the correct values
  var out = ee.Image(ee.List.sequence(1,nSegs).iterate(function(n,prev){
    prev = ee.Image(prev);
    var segBN = ee.String('S').cat(ee.Number(n).byte().format()).cat('.*');
    var segCoeffs = ccdcImg.select([segBN]);
    segCoeffs = segCoeffs.select(['.*_coef.*']);
    var segMaskT = segMask.select([segBN]);
    segCoeffs = segCoeffs.updateMask(segMaskT);
    return prev.where(segCoeffs.mask(),segCoeffs);
  },ee.Image.constant(ee.List.repeat(-9999,outBns.length())).rename(outBns)));
  out = out.updateMask(out.neq(-9999));
  
  timeImg = timeImg.addBands(out);
  return timeImg;
  }
////////////////////////////////////////////////////////////////////////////////////////
//Function to get prediced value from a set of harmonic coefficients and a time band
//The time band is assumed to be in a yyyy.ff where the .ff is the proportion of the year
//The timeImg can have other bands in it that will be retained in the image that
//is returned.  This is useful if plotting actual and predicted values is of interest
function getCCDCPrediction(timeImg,coeffImg,timeBandName,detrended,whichHarmonics){
  if(timeBandName === null || timeBandName === undefined){timeBandName = 'year'}
  if(detrended === null || detrended === undefined){detrended = true}
  if(whichHarmonics === null || whichHarmonics === undefined){whichHarmonics = [1,2,3]}
  
  var tBand = timeImg.select([timeBandName]);
  
  //Unit of each harmonic (1 cycle)
  var omega = ee.Number(2.0).multiply(Math.PI);
  
  //Constant raster for each coefficient
  //Constant, slope, first harmonic, second harmonic, and third harmonic
  var harmImg = ee.Image([1]);
  harmImg = ee.Algorithms.If(detrended, harmImg.addBands(tBand),harmImg);
  harmImg = ee.Image(ee.List(whichHarmonics).iterate(function(n,prev){
    var omImg = tBand.multiply(omega.multiply(n));
    return ee.Image(prev).addBands(omImg.cos()).addBands(omImg.sin());
  },harmImg));
  
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
 
  return timeImg.addBands(predicted);
}
////////////////////////////////////////////////////////////////////////////////////////
//Function to take a given CCDC results stack and predict values for a given time series
//The ccdcImg is assumed to have coefficients for a set of segments and a tStart and tEnd for 
//each segment. 
//It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
function predictCCDC(ccdcImg,timeSeries,nSegments,harmonicTag){
  
  //Add the segment-appropriate coefficients to each time image
  timeSeries = timeSeries.map(function(img){return getCCDCSegCoeffs(img,ccdcImg,harmonicTag)});
  //Predict out the values for each image 
  timeSeries = timeSeries.map(function(img){return getCCDCPrediction(img,img.select(['.*_coef.*']))});
  
  return timeSeries;
 
}
//-------------------- END CCDC Helper Function -------------------//
///////////////////////////////////////////////////////////////////////////////
// dLib.getExistingChangeData();
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:

// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
var studyArea = geometry;//paramDict[studyAreaName][3];

// 2. Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
var startJulian = 1;
var endJulian = 365; 

// 3. Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// matter
var startYear = 1984;
var endYear = 2020;





// 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// Specify TOA or SR
// Current implementation does not support Fmask for TOA
var toaOrSR = 'SR';

// 8. Choose whether to include Landat 7
// Generally only included when data are limited
var includeSLCOffL7 = false;

//9. Whether to defringe L5
//Landsat 5 data has fringes on the edges that can introduce anomalies into 
//the analysis.  This method removes them, but is somewhat computationally expensive
var defringeL5 = false;

// 10. Choose cloud/cloud shadow masking method
// Choices are a series of booleans for cloudScore, TDOM, and elements of Fmask
//Fmask masking options will run fastest since they're precomputed
//CloudScore runs pretty quickly, but does look at the time series to find areas that 
//always have a high cloudScore to reduce comission errors- this takes some time
//and needs a longer time series (>5 years or so)
//TDOM also looks at the time series and will need a longer time series
var applyCloudScore = false;
var applyFmaskCloudMask = true;

var applyTDOM = false;
var applyFmaskCloudShadowMask = true;

var applyFmaskSnowMask = true;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScoreTDOM is chosen
// cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
//    masking (lower number masks more clouds.  Between 10 and 30 generally 
//    works best)
var cloudScoreThresh = 20;

// Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy
var cloudScorePctl = 10; 

// zScoreThresh: Threshold for cloud shadow masking- lower number masks out 
//    less. Between -0.8 and -1.2 generally works well
var zScoreThresh = -1;

// shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the 
//    shadow shift method (lower number masks out less)
var shadowSumThresh = 0.35;

// contractPixels: The radius of the number of pixels to contract (negative 
//    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
//    patches that are likely errors
// (1.5 results in a -1 pixel buffer)(0.5 results in a -0 pixel buffer)
// (1.5 or 2.5 generally is sufficient)
var contractPixels = 1.5; 

// dilatePixels: The radius of the number of pixels to dilate (buffer) clouds 
//    and cloud shadows by. Intended to include edges of clouds/cloud shadows 
//    that are often missed
// (1.5 results in a 1 pixel buffer)(0.5 results in a 0 pixel buffer)
// (2.5 or 3.5 generally is sufficient)
var dilatePixels = 2.5;

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
var correctIllumination = false;
var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
var exportComposites = false;

//Set up Names for the export
var outputName = 'CCDC_Test3';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
var exportPathRoot = 'users/iwhousman/test/CCDC_Collection/';

// var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;

//How many segments to export
//Agricultural and wetland areas generally will need about 1 for every 2-5 years
//Other areas need about 1 for every 10-30 years
var nSegments = 9;
///////////////////////////////////////////////////////////////////////
//CCDC Parsams
var ccdcParams ={
  breakpointBands:['red','nir','swir1','swir2','NDVI','NBR'],//The name or index of the bands to use for change detection. If unspecified, all bands are used.//Can include: 'blue','green','red','nir','swir1','swir2'
                                                              //'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
  tmaskBands : ['green','swir1'],//The name or index of the bands to use for iterative TMask cloud detection. These are typically the green band and the SWIR2 band. If unspecified, TMask is not used. If specified, 'tmaskBands' must be included in 'breakpointBands'., 
  minObservations: 6,//Factors of minimum number of years to apply new fitting.
  chiSquareProbability: 0.99,//The chi-square probability threshold for change detection in the range of [0, 1],
  minNumOfYearsScaler: 1.33,//Factors of minimum number of years to apply new fitting.,\
  lambda: 0.002,//Lambda for LASSO regression fitting. If set to 0, regular OLS is used instead of LASSO
  maxIterations : 25000 //Maximum number of runs for LASSO regression convergence. If set to 0, regular OLS is used instead of LASSO.
} 

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls

////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Landat scenes and composites
var processedScenes = getImagesLib.getProcessedLandsatScenes(studyArea,startYear,endYear,startJulian,endJulian,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels
  ).map(getImagesLib.addSAVIandEVI);


processedScenes = processedScenes.select(ccdcParams.breakpointBands);
Map.addLayer(processedScenes,{},'Raw Time Series',false);

ccdcParams.dateFormat = 1;
ccdcParams.collection = processedScenes;
var ccdc = ee.Algorithms.TemporalSegmentation.Ccdc(ccdcParams);


var ccdcImg = buildCcdcImage(ccdc, nSegments);

var count = ccdcImg.select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand);
ccdcParams.breakpointBands.push('.*_predicted');

var predicted = predictCCDC(ccdcImg,processedScenes).select(ccdcParams.breakpointBands);
Map.addLayer(predicted,{},'Predicted CCDC',false);

var seg1 = ccdcImg.select(['S1.*']);
var sinCoeffs = seg1.select(['.*_SIN']);
var cosCoeffs = seg1.select(['.*_COS']);
var bands = ['.*swir2.*','.*nir.*','.*red.*'];
// var band = 'B4.*';
var phase = sinCoeffs.atan2(cosCoeffs)
                    .unitScale(-Math.PI, Math.PI);
 
var amplitude = sinCoeffs.hypot(cosCoeffs)
                    // .unitScale(0, 1)
                    .multiply(2);
Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);


Export.image.toAsset(ccdcImg.float(), outputName, exportPathRoot +outputName , null, null, geometry, scale, crs, transform, 1e13)
// var ccdcImgSmall = ee.Image('users/iwhousman/test/CCDC_Collection/CCDC_Test2');
// // var ccdcImgCoeffs = ccdcImg.select(['.*_coef.*']);
// // var coeffBns = ccdcImgCoeffs.bandNames();
// // print(coeffBns)
// // var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd']);
// // ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT)
// // // Map.addLayer(ccdcImg)
// var ccdcImg = ee.ImageCollection('projects/CCDC/USA')
//           .filterBounds(geometry)
//           .mosaic();
// print(ccdcImg)
// var ccdcImgCoeffs = ccdcImg.select(['.*B2_coef_.*','.*B4_coef_.*'])//.divide(365.25);
// var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd'])//.divide(365.25);

// ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT);
// // Map.addLayer(ccdcImg)
// var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
//   n = ee.Number(n);
//   var img = ee.Image(n).float().rename(['year']);
//   var y = n.int16();
//   var fraction = n.subtract(y);
//   var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
//   return img.set('system:time_start',d)
// }));
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
// var nSegments = ccdcImgSmall.select(['.*tStart']).bandNames().length().getInfo();
// //Visualize the number of segments
// var count = ccdcImgSmall.select(['.*']).select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
// Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
// Map.addLayer(ccdcImgSmall.select(['.*tEnd']).selfMask().reduce(ee.Reducer.max()),{min:endYear-1,max:endYear},'Last Year');
  
// var predictedSmall = predictCCDC(ccdcImg,yearImages).select(['.*_predicted']);
// Map.addLayer(predictedSmall,{},'Predicted Small')
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


Map.setOptions('HYBRID');