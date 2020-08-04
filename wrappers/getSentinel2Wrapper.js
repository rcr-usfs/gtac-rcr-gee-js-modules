//Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:
var args = {};

// Specify study area: Study area
// Can be a featureCollection, feature, or geometry
args.studyArea = getImagesLib.testAreas.CA;

// Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// If using wrapping and the majority of the days occur in the second year, the system:time_start will default 
// to June 1 of that year.Otherwise, all system:time_starts will default to June 1 of the given year
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
args.startJulian = 190;
args.endJulian = 250; 

// Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, or providing
// pre-computed stats for cloudScore and TDOM, this does not 
// matter
args.startYear = 2019;
args.endYear = 2019;

// Specify an annual buffer to include imagery from the same season 
// timeframe from the prior and following year. timeBuffer = 1 will result 
// in a 3 year moving window. If you want single-year composites, set to 0
args.timebuffer =0;

// Specify the weights to be used for the moving window created by timeBuffer
// For example- if timeBuffer is 1, that is a 3 year moving window
// If the center year is 2000, then the years are 1999,2000, and 2001
// In order to overweight the center year, you could specify the weights as
// [1,5,1] which would duplicate the center year 5 times and increase its weight for
// the compositing method. If timeBuffer = 0, set to [1]
args.weights = [1];



// Choose medoid or median compositing method. 
// Median tends to be smoother, while medoid retains 
// single date of observation across all bands
// The date of each pixel is stored if medoid is used. This is not done for median
// If not exporting indices with composites to save space, medoid should be used
args.compositingMethod = 'medoid';

// Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// SR S2 data also has a terrain correction applied which may or may not be best depending on how you are using the data
// If using data from humid climates, terrain correction can be useful. Since vegetation types differ more with respect to slope/aspect 
// in dryer climates, terrain correction can remove some of the signal in dryer climates.  In higher latitudes terrain correction can fail.
args.toaOrSR = 'TOA';

//Whether to convert S2 images from the military grid reference system(MGRS) tiles to daily mosaics to avoid arbitrary
//MGRS tile artifacts or not. In most cases, it is best to set this to true.
args.convertToDailyMosaics = true;

// Choose cloud/cloud shadow masking method
// Choices are a series of booleans for applyQABand, applyCloudScore, 
// applyShadowShift, and applyTDOM
// CloudScore runs pretty quickly, but does look at the time series to find areas that 
// always have a high cloudScore to reduce commission errors- this takes some time
// and needs a longer time series (>5 years or so)
// This an be turned off by setting "performCloudScoreOffset" to false
// The cloud probability is provided as a pre-computed asset and seems better than cloudScore.
// The cloudScoreThresh is applied to both the cloudScore and cloud probability as they work in a similar manner
// TDOM also looks at the time series and will need a longer time series
// QA band method is fast but is generally awful- don't use if you like good composites
// Shadow shift is intended if you don't have a time series to use for TDOM or just want individual images - best not to use this method
// It will commit any dark area that the cloud mask is cast over (water, hill shadows, etc)
// If pre-computed cloudScore offsets and/or TDOM stats are provided below, cloudScore
// and TDOM will run quite quickly and a long time sereies is not needed 
args.applyQABand = false;

args.applyCloudScore = false;
args.applyShadowShift = false;
args.applyTDOM = true;

// Whether to use the pre-computed cloud probabilities to mask
// clouds for Sentinel 2
// This method works really well and should be used instead of cloudScore (applyCloudScore)
args.applyCloudProbability = true;


// If applyCloudScore is set to true
// cloudScoreThresh: lower number masks more clouds.  Between 10 and 30 generally 
// works best
args.cloudScoreThresh = 20;

// Whether to find if an area typically has a high cloudScore
// If an area is always cloudy, this will result in cloud masking omission
// For bright areas that may always have a high cloudScore
// but not actually be cloudy, this will result in a reduction of commission errors
// This procedure needs at least 5 years of data to work well
// Precomputed offsets can be provided below
args.performCloudScoreOffset = true;

// If performCloudScoreOffset = true:
// Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy but may be necessary in persistently cloudy areas
args.cloudScorePctl = 10; 

// Height of clouds to use to project cloud shadows
args.cloudHeights = ee.List.sequence(500,10000,500);

// zScoreThresh: If applyTDOM is true, this is the threshold for cloud shadow masking- 
// lower number masks out less. Between -0.8 and -1.2 generally works well
args.zScoreThresh = -1;

// shadowSumThresh:  If applyTDOM is true, sum of IR bands to include as shadows within TDOM and the 
//    shadow shift method (lower number masks out less)
args.shadowSumThresh = 0.35;

// contractPixels: The radius of the number of pixels to contract (negative 
//    buffer) clouds and cloud shadows by. Intended to eliminate smaller cloud 
//    patches to reduce commission and then buffer cloud edges to reduce omission
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
//Defaults to 'aggregate'

//Aggregate is generally useful for aggregating pixels when reprojecting instead of resampling
//A good example would be reprojecting S2 data to 30 m

//If method other than 'near' is chosen, any map drawn on the fly that is not
//reprojected, will appear blurred or not really represented properly
//Use .reproject to view the actual resulting image (this will slow it down)
args.resampleMethod = 'aggregate';


//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
args.preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic().select(['Sentinel2_CloudScore_p'+args.cloudScorePctl.toString()]);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
args.preComputedTDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
args.preComputedTDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);


// Export params

//Whether to export composites
args.exportComposites = true;

//Set up Names for the export
args.outputName = 'Sentinel2';

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
print('Provided parameters are:',args);
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls
////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Sentinel2 scenes and composites

  
var sentinel2 =getImagesLib.getSentinel2Wrapper(args);


//Separate into scenes and composites for subsequent analysis
var processedScenes = sentinel2.processedScenes;
var processedComposites = sentinel2.processedComposites;

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
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
Map.setOptions('HYBRID')
