/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-115.19522231507318, 48.704101580291294],
          [-115.12930434632318, 48.39866293818322],
          [-114.10757583069818, 48.62065285721024],
          [-114.40969985413568, 48.87781053836135]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:

// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
var studyArea = geometry;

// 2. Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
var startJulian = 190;
var endJulian = 250; 

// 3. Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// matter
var startYear = 2014;
var endYear = 2018;

// 4. Specify an annual buffer to include imagery from the same season 
// timeframe from the prior and following year. timeBuffer = 1 will result 
// in a 3 year moving window
var timebuffer = 0;

// 5. Specify the weights to be used for the moving window created by timeBuffer
//For example- if timeBuffer is 1, that is a 3 year moving window
//If the center year is 2000, then the years are 1999,2000, and 2001
//In order to overweight the center year, you could specify the weights as
//[1,5,1] which would duplicate the center year 5 times and increase its weight for
//the compositing method
var weights = [1];

// 6. Choose medoid or median compositing method. 
// Median tends to be smoother, while medoid retains 
// single date of observation across all bands
// If not exporting indices with composites to save space, medoid should be used
var compositingMethod = 'medoid';

// 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// Specify TOA or SR
//Sentinel 2 SR data currently have terrain correction applied
//Best to use TOA if using S2 and Landsat together
var toaOrSR = 'TOA';

//Whether to convert S2 images from the military grid reference system(MGRS) tiles to daily mosaics to avoid arbitrary
//MGRS tile artifacts or not. In most cases, it is best to set this to true.
var convertToDailyMosaics = true;


// 8. Choose whether to include Landat 7
// Generally only included when data are limited
var includeSLCOffL7 = true;

//9. Whether to defringe L5
//Landsat 5 data has fringes on the edges that can introduce anomalies into 
//the analysis.  This method removes them, but is somewhat computationally expensive
var defringeL5 = false;

// 10. Choose cloud/cloud shadow masking method
// Choices are a series of booleans for cloudScore, TDOM, and elements of Fmask
//Fmask masking options will run fastest since they're precomputed
//Fmask cloud mask is generally very good, while the fMask cloud shadow
//mask isn't great. TDOM tends to perform better than the Fmask cloud shadow mask. cloudScore 
//is usually about as good as the Fmask cloud mask overall, but each failes in different instances.
//CloudScore runs pretty quickly, but does look at the time series to find areas that 
//always have a high cloudScore to reduce commission errors- this takes some time
//and needs a longer time series (>5 years or so)
//TDOM also looks at the time series and will need a longer time series
//If pre-computed cloudScore offsets and/or TDOM stats are provided below, cloudScore
//and TDOM will run quite quickly

//CloudScore and TDOM switches- for both Sentinel 2 and Landsat
//We generally use these
var applyCloudScore = true;
var applyTDOM = true;

//S2 only cloud/cloud shadow masking methods switches- generally do not use these
//QA band method is fast but is generally awful- don't use if you like good composites
//Shadow shift is intended if you don't have a time series to use for TDOM or just want individual images
//It will commit any dark area that the cloud mask is cast over (water, hill shadows, etc)
var applyQABand = false;
var applyShadowShift = false;
//Height of clouds to use to project cloud shadows
var cloudHeights = ee.List.sequence(500,10000,500);

//Fmask switches- only for Landsat
//Generally we do use these
var applyFmaskCloudMask = true;
var applyFmaskCloudShadowMask = true;
var applyFmaskSnowMask = false;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScoreTDOM is chosen
// cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
//    masking (lower number masks more clouds.  Between 10 and 30 generally 
//    works best)
var cloudScoreThresh = 20;

//Whether to find if an area typically has a high cloudScore
//If an area is always cloudy, this will result in cloud masking omission
//For bright areas that may always have a high cloudScore
//but not actually be cloudy, this will result in a reduction of commission errors
//This procedure needs at least 5 years of data to work well
var performCloudScoreOffset = true;

// If performCloudScoreOffset = true:
//Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy but may be necessary in persistently cloudy areas
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

//Choose the resampling method: 'aggregate','near', 'bilinear', or 'bicubic'
//Defaults to 'aggregate' for Sentinel 2 and 'near' for Landsat

//Aggregate is generally useful for aggregating pixels when reprojecting instead of resampling
//A good example would be reprojecting S2 data to 30 m

//If method other than 'near' is chosen, any map drawn on the fly that is not
//reprojected, will appear blurred or not really represented properly
//Use .reproject to view the actual resulting image (this will slow it down)
var landsatResampleMethod = 'near';

var sentinel2ResampleMethod = 'aggregate';

//Choose whether to use the Chastain et al 2019(https://www.sciencedirect.com/science/article/pii/S0034425718305212)
//harmonization method
//All harmonization models apply a rather small correction and are likely not needed
var runChastainHarmonization = true;

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
var preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic();
var preComputedLandsatCloudScoreOffset = preComputedCloudScoreOffset.select(['Landsat_CloudScore_p'+cloudScorePctl.toString()]);
var preComputedSentinel2CloudScoreOffset = preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p'+cloudScorePctl.toString()]);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
var preComputedLandsatTDOMMeans = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
var preComputedLandsatTDOMStdDevs = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);

var preComputedSentinel2TDOMMeans = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
var preComputedSentinel2TDOMStdDevs = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
var correctIllumination = false;
var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
var exportComposites = true;

//Set up Names for the export
var outputName = 'Landsat_S2_Hybrid_';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
var exportPathRoot = 'users/iwhousman/test/ChangeCollection';



//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls
////////////////////////////////////////////////////////////////////////////////
function getLandsatAndS2HybridWrapper(studyArea,startYear,endYear,startJulian,endJulian,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
  zScoreThresh,shadowSumThresh,
  contractPixels,dilatePixels,landsatResampleMethod,sentinel2ResampleMethod,convertToDailyMosaics,runChastainHarmonization,
  preComputedLandsatCloudScoreOffset,preComputedLandsatTDOMMeans,preComputedLandsatTDOMStdDevs,
  preComputedSentinel2CloudScoreOffset,preComputedSentinel2TDOMMeans,preComputedSentinel2TDOMStdDevs){
  
  var ls = getImagesLib.getProcessedLandsatScenes(studyArea,startYear,endYear,startJulian,endJulian,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
  zScoreThresh,shadowSumThresh,
  contractPixels,dilatePixels,landsatResampleMethod,false,
  preComputedLandsatCloudScoreOffset,preComputedLandsatTDOMMeans,preComputedLandsatTDOMStdDevs
  );
  
  var s2s = getImagesLib.getProcessedSentinel2Scenes(studyArea,startYear,endYear,startJulian,endJulian,
  applyQABand,applyCloudScore,applyShadowShift,applyTDOM,
  cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
  cloudHeights,
  zScoreThresh,shadowSumThresh,
  contractPixels,dilatePixels,sentinel2ResampleMethod,toaOrSR,convertToDailyMosaics,
  preComputedSentinel2CloudScoreOffset,preComputedSentinel2TDOMMeans,preComputedSentinel2TDOMStdDevs
  );
  // Map.addLayer(ls.median(),getImagesLib.vizParamsFalse,'ls');
  // Map.addLayer(s2s.median(),getImagesLib.vizParamsFalse,'s2s');
  
  //Select off common bands between Landsat and Sentinel 2
  var commonBands =  ['blue', 'green', 'red','nir','swir1', 'swir2'];
  ls = ls.select(commonBands);
  s2s = s2s.select(commonBands);
  

  //Seperate each sensor
  var tm = ls.filter(ee.Filter.eq('SENSOR_ID','TM'));
  var etm = ls.filter(ee.Filter.eq('SENSOR_ID','ETM'));
  var oli = ls.filter(ee.Filter.eq('SENSOR_ID','OLI_TIRS'));
  var msi = s2s;
  
  //Fill if no images exist for particular Landsat sensor
  //Allow it to fail of no images exist for Sentinel 2 since the point
  //of this method is to include S2
  tm = getImagesLib.fillEmptyCollections(tm,ee.Image(ls.first()));
  etm = getImagesLib.fillEmptyCollections(etm,ee.Image(ls.first()));
  oli = getImagesLib.fillEmptyCollections(oli,ee.Image(ls.first()));
  
  
  if(runChastainHarmonization){
    print('Running Chastain et al 2019 harmonization');
    
    // Map.addLayer(oli.median(),getImagesLib.vizParamsFalse,'oli before');
    // Map.addLayer(msi.median(),getImagesLib.vizParamsFalse,'msi before');
   
    //Apply correction
    //Currently coded to go to ETM+
    
    //No need to correct ETM to ETM
    // tm = tm.map(function(img){return getImagesLib.harmonizationChastain(img, 'ETM','ETM')});
    // etm = etm.map(function(img){return getImagesLib.harmonizationChastain(img, 'ETM','ETM')});
    
    //Harmonize the other two
    oli = oli.map(function(img){return getImagesLib.harmonizationChastain(img, 'OLI','ETM')});
    msi = msi.map(function(img){return getImagesLib.harmonizationChastain(img, 'MSI','ETM')});
    // Map.addLayer(oli.median(),getImagesLib.vizParamsFalse,'oli after');
    // Map.addLayer(msi.median(),getImagesLib.vizParamsFalse,'msi after');
    
    
  }
  
  
  //Set sensor band number
  tm = tm.map(function(img){
    return img.addBands(ee.Image(5).rename(['sensor']));
  });
  etm = etm.map(function(img){
    return img.addBands(ee.Image(7).rename(['sensor']));
  });
  
  oli = oli.map(function(img){
    return img.addBands(ee.Image(8).rename(['sensor']));
  });
  
  msi = msi.map(function(img){
    return img.addBands(ee.Image(2).rename(['sensor']));
  });
  
  
  s2s = msi;
  
  //Merge Landsat back together
  tm = ee.ImageCollection(tm.merge(etm));
  ls = ee.ImageCollection(tm.merge(oli));
  
  // Merge Landsat and S2
  var merged = ls.merge(s2s);
 
 
  //Create hybrid composites
  var composites = getImagesLib.compositeTimeSeries(merged,startYear,endYear,startJulian,endJulian,timebuffer,weights,compositingMethod);
  print(composites)
  if(exportComposites){// Export composite collection
    
    var exportBandDict = {
      'medoid':['blue', 'green', 'red','nir','swir1', 'swir2','sensor','year','julianDay'],
      'median':['blue', 'green', 'red','nir','swir1', 'swir2']
    };
    var nonDivideBandDict = {
      'medoid':['sensor','year','julianDay'],
      'median':[]
    };
    var exportBands = exportBandDict[compositingMethod];
    var nonDivideBands = nonDivideBandDict[compositingMethod];
    getImagesLib.exportCompositeCollection(exportPathRoot,outputName,studyArea, crs,transform,scale,
      composites,startYear,endYear,startJulian,endJulian,compositingMethod,timebuffer,exportBands,toaOrSR,weights,
      applyCloudScore,applyFmaskCloudMask,applyTDOM,applyFmaskCloudShadowMask,applyFmaskSnowMask,includeSLCOffL7,correctIllumination,nonDivideBands,'Landsat: '+[landsatResampleMethod,sentinel2ResampleMethod].join(' Sentinel2:'));
  }
  
  return [merged,composites];
}
///////////////////////////////////////////////////////////////
var processedAndComposites = getLandsatAndS2HybridWrapper(studyArea,startYear,endYear,startJulian,endJulian,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
  zScoreThresh,shadowSumThresh,
  contractPixels,dilatePixels,landsatResampleMethod,sentinel2ResampleMethod,convertToDailyMosaics,runChastainHarmonization,
  preComputedLandsatCloudScoreOffset,preComputedLandsatTDOMMeans,preComputedLandsatTDOMStdDevs,
  preComputedSentinel2CloudScoreOffset,preComputedSentinel2TDOMMeans,preComputedSentinel2TDOMStdDevs);

//Separate into scenes and composites for subsequent analysis
var processedScenes = processedAndComposites[0];
var processedComposites = processedAndComposites[1];

////////////////////////////////////////////////////////////////////////////////
// Load the study region, with a blue outline.
// Create an empty image into which to paint the features, cast to byte.
// Paint all the polygon edges with the same number and width, display.
var empty = ee.Image().byte();
var outline = empty.paint({
  featureCollection: studyArea,
  color: 1,
  width: 3
});
Map.addLayer(outline, {palette: '0000FF'}, "Study Area", false);
// Map.centerObject(studyArea, 6);

Map.setOptions('hybrid')
////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////
//Code for starting all tasks once this script has ran
//Press f12, then paste functions into console
//Then paste function calls into console
// function runTaskList() {


//     //1. task local type-EXPORT_FEATURES awaiting-user-config

//     //2. task local type-EXPORT_IMAGE awaiting-user-config

//     var tasklist = document.getElementsByClassName('awaiting-user-config');

//     for (var i = 0; i < tasklist.length; i++)

//         tasklist[i].children[2].click();

// }

// // confirmAll();

// function confirmAll() {

//     var ok = document.getElementsByClassName('goog-buttonset-default goog-buttonset-action');

//     for (var i = 0; i < ok.length; i++)

//         ok[i].click();

// }