/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-114.56133135216896, 48.890984163850284],
          [-114.36357744591896, 48.39008040881411],
          [-113.59453447716896, 48.61573953438945],
          [-113.66045244591896, 48.92708833357347]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Module imports
var getImageLib = require('users/USFS_GTAC/modules:getImagesLib.js');
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
var startYear = 2019;
var endYear = 2019;

// 4. Specify an annual buffer to include imagery from the same season 
// timeframe from the prior and following year. timeBuffer = 1 will result 
// in a 3 year moving window
var timebuffer =0;

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
//SR S2 data also has a terrain correction applied which may or may not be best depending on how you are using the data
//If using data from humid climates, terrain correction can be useful. Since vegetation types differ with respect to slope/aspect 
//in dryer climates, terrain correction can remove some of the signal in dryer climates.  In higher latitudes terrain correction can fail.
var toaOrSR = 'TOA';

// // 8. Choose whether to include Landat 7
// // Generally only included when data are limited
// var includeSLCOffL7 = false;

// //9. Whether to defringe L5
// //Landsat 5 data has fringes on the edges that can introduce anomalies into 
// //the analysis.  This method removes them, but is somewhat computationally expensive
// var defringeL5 = false;

// 10. Choose cloud/cloud shadow masking method
// Choices are a series of booleans for applyQABand, applyCloudScore, 
//applyShadowShift, and applyTDOM
//CloudScore runs pretty quickly, but does look at the time series to find areas that 
//always have a high cloudScore to reduce comission errors- this takes some time
//and needs a longer time series (>5 years or so)
//TDOM also looks at the time series and will need a longer time series
//QA band method is fast but is generally awful- don't use if you like good composites
//Shadow shift is intended if you don't have a time series to use for TDOM or just want individual images
//It will commit any dark area that the cloud mask is cast over (water, hill shadows, etc)
var applyQABand = false;

var applyCloudScore = true;
var applyShadowShift = false;
var applyTDOM = true;


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
var performCloudScoreOffset = false;

// If performCloudScoreOffset = true:
//Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy but may be necessary in persistently cloudy areas
var cloudScorePctl = 0; 

//Height of clouds to use to project cloud shadows
var cloudHeights = ee.List.sequence(500,10000,500);

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

//Choose the resampling method: 'near', 'bilinear', or 'bicubic'
//Defaults to 'near'
//If method other than 'near' is chosen, any map drawn on the fly that is not
//reprojected, will appear blurred
//Use .reproject to view the actual resulting image (this will slow it down)
var resampleMethod = 'bicubic';

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
//Currently not supported for S2
var correctIllumination = false;
var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
var exportComposites = true;

//Set up Names for the export
var outputName = 'S2_';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
var exportPathRoot = 'users/ianhousman/test/changeCollection';



//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:32611';

//Specify transform if scale is null and snapping to known grid is needed
var transform = null;//[30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = 20;
///////////////////////////////////////////////////////////////////////

  
var s2sAndTs =getImageLib.getSentinel2Wrapper(studyArea,startYear,endYear,startJulian,endJulian,
  timebuffer,weights,compositingMethod,
  applyQABand,applyCloudScore,applyShadowShift,applyTDOM,
  cloudScoreThresh,performCloudScoreOffset,cloudScorePctl,
  cloudHeights,
  zScoreThresh,shadowSumThresh,
  contractPixels,dilatePixels,
  correctIllumination,correctScale,
  exportComposites,outputName,exportPathRoot,crs,transform,scale,resampleMethod);
  
//Separate into scenes and composites for subsequent analysis
var processedScenes = s2sAndTs[0];
var processedComposites = s2sAndTs[1];
print(processedScenes)
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

// Map.centerObject(studyArea, 6);
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

