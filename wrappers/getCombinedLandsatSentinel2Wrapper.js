/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-115.19522231507318, 48.704101580291294],
          [-115.12930434632318, 48.39866293818322],
          [-114.10757583069818, 48.62065285721024],
          [-114.40969985413568, 48.87781053836135]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:
var args = {};
// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
args.studyArea = geometry;

// 2. Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
args.startJulian = 190;
args.endJulian = 250; 

// 3. Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// matter
args.startYear = 2014;
args.endYear = 2018;

// 4. Specify an annual buffer to include imagery from the same season 
// timeframe from the prior and following year. timeBuffer = 1 will result 
// in a 3 year moving window
args.timebuffer = 0;

// 5. Specify the weights to be used for the moving window created by timeBuffer
//For example- if timeBuffer is 1, that is a 3 year moving window
//If the center year is 2000, then the years are 1999,2000, and 2001
//In order to overweight the center year, you could specify the weights as
//[1,5,1] which would duplicate the center year 5 times and increase its weight for
//the compositing method
args.weights = [1];

// 6. Choose medoid or median compositing method. 
// Median tends to be smoother, while medoid retains 
// single date of observation across all bands
// If not exporting indices with composites to save space, medoid should be used
args.compositingMethod = 'medoid';

// 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// Specify TOA or SR
//Sentinel 2 SR data currently have terrain correction applied
//Best to use TOA if using S2 and Landsat together
args.toaOrSR = 'TOA';

//Whether to convert S2 images from the military grid reference system(MGRS) tiles to daily mosaics to avoid arbitrary
//MGRS tile artifacts or not. In most cases, it is best to set this to true.
args.convertToDailyMosaics = true;


// 8. Choose whether to include Landat 7
// Generally only included when data are limited
args.includeSLCOffL7 = true;

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
args.applyCloudScore = true;
args.applyTDOM = true;

//S2 only cloud/cloud shadow masking methods switches- generally do not use these
//QA band method is fast but is generally awful- don't use if you like good composites
//Shadow shift is intended if you don't have a time series to use for TDOM or just want individual images
//It will commit any dark area that the cloud mask is cast over (water, hill shadows, etc)
args.applyQABand = false;
args.applyShadowShift = false;
//Height of clouds to use to project cloud shadows
args.cloudHeights = ee.List.sequence(500,10000,500);

//Whether to use the pre-computed cloud probabilities to mask
//clouds for Sentinel 2
//This method works really well
args.applyCloudProbability = true;

//Fmask switches- only for Landsat
//Generally we do use these
args.applyFmaskCloudMask = true;
args.applyFmaskCloudShadowMask = true;
args.applyFmaskSnowMask = false;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScore  is chosen
// cloudScoreThresh: If using the cloudScore or cloudProbability method-Threshold for cloud 
//    masking (lower number masks more clouds.  Between 10 and 30 generally 
//    works best)
args.cloudScoreThresh = 20;

//Whether to find if an area typically has a high cloudScore
//If an area is always cloudy, this will result in cloud masking omission
//For bright areas that may always have a high cloudScore
//but not actually be cloudy, this will result in a reduction of commission errors
//This procedure needs at least 5 years of data to work well
args.performCloudScoreOffset = true;

// If performCloudScoreOffset = true:
//Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy but may be necessary in persistently cloudy areas
args.cloudScorePctl = 10;

// zScoreThresh: Threshold for cloud shadow masking- lower number masks out 
//    less. Between -0.8 and -1.2 generally works well
args.zScoreThresh = -1;

// shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the 
//    shadow shift method (lower number masks out less)
args.shadowSumThresh = 0.35;

// contractPixels: The radius of the number of pixels to contract (negative 
//    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
//    patches that are likely errors
// (1.5 results in a -1 pixel buffer)(0.5 results in a -0 pixel buffer)
// (1.5 or 2.5 generally is sufficient)
args.contractPixels = 1.5; 

// dilatePixels: The radius of the number of pixels to dilate (buffer) clouds 
//    and cloud shadows by. Intended to include edges of clouds/cloud shadows 
//    that are often missed
// (1.5 results in a 1 pixel buffer)(0.5 results in a 0 pixel buffer)
// (2.5 or 3.5 generally is sufficient)
args.dilatePixels = 2.5;

//Choose the resampling method: 'aggregate','near', 'bilinear', or 'bicubic'
//Defaults to 'aggregate' for Sentinel 2 and 'near' for Landsat

//Aggregate is generally useful for aggregating pixels when reprojecting instead of resampling
//A good example would be reprojecting S2 data to 30 m

//If method other than 'near' is chosen, any map drawn on the fly that is not
//reprojected, will appear blurred or not really represented properly
//Use .reproject to view the actual resulting image (this will slow it down)
args.landsatResampleMethod = 'near';

args.sentinel2ResampleMethod = 'aggregate';

//Choose whether to use the Chastain et al 2019(https://www.sciencedirect.com/science/article/pii/S0034425718305212)
//harmonization method
//All harmonization models apply a rather small correction and are likely not needed
args.runChastainHarmonization = true;

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
var preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic();
args.preComputedLandsatCloudScoreOffset = preComputedCloudScoreOffset.select(['Landsat_CloudScore_p'+args.cloudScorePctl.toString()]);
args.preComputedSentinel2CloudScoreOffset = preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p'+args.cloudScorePctl.toString()]);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
args.preComputedLandsatTDOMIRMean = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
args.preComputedLandsatTDOMIRStdDev = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);

args.preComputedSentinel2TDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
args.preComputedSentinel2TDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
args.correctIllumination = false;
args.correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
args.exportComposites = true;

//Set up Names for the export
args.outputName = 'Landsat_Sentinel2_Hybrid';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
args.exportPathRoot = 'users/iwhousman/test/compositeCollection';



//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
args.crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
args.transform = [10,0,-2361915.0,0,-10,3177735.0];

//Specify scale if transform is null
args.scale = null;

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls
////////////////////////////////////////////////////////////////////////////////
print(args)
///////////////////////////////////////////////////////////////
var processedAndComposites = getImagesLib.getLandsatAndSentinel2HybridWrapper(args);

// //Separate into scenes and composites for subsequent analysis
// var processedScenes = processedAndComposites[0];
// var processedComposites = processedAndComposites[1];

////////////////////////////////////////////////////////////////////////////////
// Load the study region, with a blue outline.
// Create an empty image into which to paint the features, cast to byte.
// Paint all the polygon edges with the same number and width, display.
var empty = ee.Image().byte();
var outline = empty.paint({
  featureCollection: args.studyArea,
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