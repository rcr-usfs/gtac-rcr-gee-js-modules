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
        [[[-105.947425615163, 40.18578729628127],
          [-105.947425615163, 40.12543526681618],
          [-105.76374794182315, 40.12543526681618],
          [-105.76374794182315, 40.18578729628127]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
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
function getCCDCSegCoeffs(img,ccdcImg){
  img = getImagesLib.addYearYearFractionBand(img);
  var tStarts = ccdcImg.select(['.*tStart']);
  var tEnds = ccdcImg.select(['.*tEnd']);
  var tBand = img.select(['year'])
  var segMask  = tBand.gte(tStarts).and(tBand.lte(tEnds));
  var nSegs = segMask.bandNames().length();
  // var out = ee.List.sequence(1,nSegs).iterate(function(n,prev){
  //   var segCoeffs = ccdcImg.select([ee.String('S')])
  // },ee.Image(ee.List.repeat(0,nSegs)))
  Map.addLayer(ccdcImg);
  Map.addLayer(segMask);
  Map.addLayer(tStarts);
  Map.addLayer(tEnds);
  }
function predictCCDC(ccdcImg,ts,nSegments,harmonicTag,harmonicImg){
  if(nSegments === null || nSegments === undefined){
    nSegments = 4;
  }
  if(harmonicTag === null || harmonicTag === undefined){
    harmonicTag = ['INTP','SLP','COS','SIN','COS2','SIN2','COS3','SIN3'];
  }
  if(harmonicImg === null || harmonicImg === undefined){
    
    harmonicImg = ee.Image([1,1,Math.cos(2*Math.PI),Math.cos(2*Math.PI),Math.cos(4*Math.PI),Math.cos(4*Math.PI),Math.cos(6*Math.PI),Math.cos(6*Math.PI)]);//['INTP','SLP','COS','SIN','COS2','SIN2','COS3','SIN3'];
  }
   getCCDCSegCoeffs(ee.Image(ts.limit(20).sort('system:time_start',false).first()),ccdcImg)
  var bns = ee.Image(ts.first()).bandNames();
  print(ccdcImg)
}
//-------------------- END CCDC Helper Function -------------------//
///////////////////////////////////////////////////////////////////////////////
dLib.getExistingChangeData();
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
var startYear = 2005;
var endYear = 2010;





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
var outputName = 'EWMA';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
var exportPathRoot = 'users/ianhousman/test/changeCollection';

// var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;


////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////

//List of bands or indices to iterate across
//Typically a list of spectral bands or computed indices
//Can include: 'blue','green','red','nir','swir1','swir2'
//'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
// var indexList = ee.List(['nir','swir1']);
var indexNames = ['NBR'];//['green','red','nir','swir1','swir2','NBR','NDVI','tcAngleBG'];//['NBR','blue','green','red','nir','swir1','swir2','NDMI','NDVI','wetness','greenness','brightness','tcAngleBG'];

var cloudBands = null;//['green','swir1']
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

Map.addLayer(processedScenes.select(['NDVI']),{},'ts',false);
processedScenes = processedScenes.select(indexNames);
var ccdc = ee.Algorithms.TemporalSegmentation.Ccdc(processedScenes, indexNames, cloudBands,6,0.99,1.33,1,0.002);
print(ccdc);
Map.addLayer(ccdc,{},'raw ccdc',false);
var ccdcImg = buildCcdcImage(ccdc, 4);
predictCCDC(ccdcImg,processedScenes)
// Map.addLayer(ccdcImg,{},'ccdcImg',false);

// var breaks = ccdcImg.select(['.*_tBreak']);
// var probs = ccdcImg.select(['.*_changeProb']);
// var change = probs.gt(0.6);
// breaks = breaks.updateMask(change.neq(0));
// Map.addLayer(breaks.reduce(ee.Reducer.max()),{min:startYear,max:endYear},'Change year',false);


// var sinCoeffs = ccdcImg.select(['.*_SIN']);
// var cosCoeffs = ccdcImg.select(['.*_COS']);
// var bands = ['S1_swir2.*','S1_nir.*','S1_red.*'];
// var band = 'B4.*';
// var phase = sinCoeffs.atan2(cosCoeffs)
//                     .unitScale(-Math.PI, Math.PI);
 
// var amplitude = sinCoeffs.hypot(cosCoeffs)
//                     // .unitScale(0, 1)
//                     .multiply(2)
//   Map.addLayer(phase.select(bands),{min:0,max:1},'phase',false);
//   Map.addLayer(amplitude.select(bands),{min:0,max:0.6},'amplitude',true);

Map.setOptions('HYBRID');