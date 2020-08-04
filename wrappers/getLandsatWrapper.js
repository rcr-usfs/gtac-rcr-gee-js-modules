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
// well. If providing pre-computed stats for cloudScore and TDOM, this does not 
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
args.toaOrSR = 'SR';

// Choose whether to include Landat 7
// Generally only included when data are limited
args.includeSLCOffL7 = true;

// Whether to defringe L4 and L5
// Landsat 5 data has fringes on the edges that can introduce anomalies into 
// the analysis.  This method removes them, but is somewhat computationally expensive
args.defringeL5 = true;

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
args.applyCloudScore = true;
args.applyFmaskCloudMask = true;

args.applyTDOM = true;
args.applyFmaskCloudShadowMask = true;

args.applyFmaskSnowMask = false;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScoreTDOM is chosen
// cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
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

//Choose the resampling method: 'near', 'bilinear', or 'bicubic'
//Defaults to 'near'
//If method other than 'near' is chosen, any map drawn on the fly that is not
//reprojected, will appear blurred
//Use .reproject to view the actual resulting image (this will slow it down)
args.resampleMethod = 'near';

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
args.preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic().select(['Landsat_CloudScore_p'+args.cloudScorePctl.toString()]);

//The TDOM stats are the mean and standard deviations of the two IR bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
args.preComputedTDOMIRMean = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
args.preComputedTDOMIRStdDev = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);


// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
args.correctIllumination = false;
args.correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
args.exportComposites = true;

//Set up Names for the export
args.outputName = 'Landsat';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
args.exportPathRoot = 'users/iwhousman/test/compositeCollection';


//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
args.crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
args.transform = [30,0,-2361915.0,0,-30,3177735.0];

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
//Call on master wrapper function to get Landat scenes and composites
var landsat = getImagesLib.getLandsatWrapper(args);
print('Final output:',landsat);
//Separate into scenes and composites for subsequent analysis
var processedScenes = landsat.processedScenes;
var processedComposites = landsat.processedComposites;

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
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
