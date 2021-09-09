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
        [[[-118.93183248812555, 36.94269993936479],
          [-118.93183248812555, 36.74928026456],
          [-118.63520162875055, 36.74928026456],
          [-118.63520162875055, 36.94269993936479]]], null, false),
    geometry2 = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-65.7772077174009, 18.28849882300539],
          [-65.7772077174009, 18.268449832558666],
          [-65.75145851085793, 18.268449832558666],
          [-65.75145851085793, 18.28849882300539]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');

///////////////////////////////////////////////////////////////////////////////
// Define user parameters:
var args = {};

// Specify study area: Study area
// Can be a featureCollection, feature, or geometry
args.studyArea = geometry2;//getImagesLib.testAreas.CA;

// Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// If using wrapping and the majority of the days occur in the second year, the system:time_start will default 
// to June 1 of that year.Otherwise, all system:time_starts will default to June 1 of the given year
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
args.startJulian = 152;
args.endJulian = 151; 

// Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If providing pre-computed stats for cloudScore and TDOM, this does not 
// matter
args.startYear = 2013;
args.endYear = 2016;

// Choose whether to include Landat 7
// Generally only included when data are limited
args.includeSLCOffL7 = true;

//Choose whether to use the Chastain et al 2019(https://www.sciencedirect.com/science/article/pii/S0034425718305212)
//harmonization method
//All harmonization models apply a rather small correction and are likely not needed
args.runChastainHarmonization = false;

args.performCloudScoreOffset = false

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
var preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic();
args.preComputedLandsatCloudScoreOffset = preComputedCloudScoreOffset.select(['Landsat_CloudScore_p10']);
args.preComputedSentinel2CloudScoreOffset = preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p10']);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/lcms-292214/assets/R8/PR_USVI/Composites/TDOM_stats').mosaic().divide(10000);
args.preComputedLandsatTDOMIRMean = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
args.preComputedLandsatTDOMIRStdDev = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);

args.preComputedSentinel2TDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
args.preComputedSentinel2TDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);


//List of acceptable sensors
//Options include: 'LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8','Sentinel-2A', 'Sentinel-2B'
args.sensorList = [ 'LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8'];

//Which bands/indices to export
//These will not always be used to find breaks - that is specified below in the ccdcParams
//Options are: ["blue","green","red","nir","swir1","swir2","NDVI","NBR","NDMI","NDSI","brightness","greenness","wetness","fourth","fifth","sixth","tcAngleBG"]
//Be sure that any bands in ccdcParams.breakpointBands are in this list
args.exportBands = ["blue","green","red","nir","swir1","swir2","NDVI"];


// Set up Names for the export
args.outputName = 'CCDC-Test3';

// Provide location composites will be exported to
// This should be an asset folder, or more ideally, an asset imageCollection
args.exportPathRoot = 'users/leahscampbell/scratch/ccdc-test';


// CRS- must be provided.  
// Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
// WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
args.crs = 'EPSG:5070';

// Specify transform if scale is null and snapping to known grid is needed
args.transform = [30,0,-2361915.0,0,-30,3177735.0];

// Specify scale if transform is null
args.scale = null;


///////////////////////////////////////////////////////////////////////
//CCDC Params
var ccdcParams ={
  breakpointBands:['green','red','nir','swir1','swir2','NDVI'],//The name or index of the bands to use for change detection. If unspecified, all bands are used.//Can include: 'blue','green','red','nir','swir1','swir2'
                                                              //'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
  tmaskBands : null,//['green','swir2'],//The name or index of the bands to use for iterative TMask cloud detection. These are typically the green band and the SWIR2 band. If unspecified, TMask is not used. If specified, 'tmaskBands' must be included in 'breakpointBands'., 
  minObservations: 6,//Factors of minimum number of years to apply new fitting.
  chiSquareProbability: 0.99,//The chi-square probability threshold for change detection in the range of [0, 1],
  minNumOfYearsScaler: 1.33,//Factors of minimum number of years to apply new fitting.,\
  lambda: 0.002,//Lambda for LASSO regression fitting. If set to 0, regular OLS is used instead of LASSO
  maxIterations : 25000, //Maximum number of runs for LASSO regression convergence. If set to 0, regular OLS is used instead of LASSO.
  dateFormat : 1 //'fractional' (1) is the easiest to work with. It is the time representation to use during fitting: 0 = jDays, 1 = fractional years, 2 = unix time in milliseconds. The start, end and break times for each temporal segment will be encoded this way.
  
}; 

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls
////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Landat and Sentinel 2 scenes
var processedScenes = getImagesLib.getProcessedLandsatAndSentinel2Scenes(args).select(args.exportBands);

//Filter to only include wanted sensors
processedScenes = processedScenes.filter(ee.Filter.inList('sensor',ee.List(args.sensorList)));

//Remove any extremely high band/index values
processedScenes = processedScenes.map(function(img){
  var lte1 = img.select(['blue','green','nir','swir1','swir2']).lte(1).reduce(ee.Reducer.min());
  return img.updateMask(lte1);
});
Map.addLayer(processedScenes,{},'Processed Input Data',false);

//Set the scene collection in the ccdcParams
ccdcParams.collection = processedScenes;

//Run CCDC
var ccdc = ee.Image(ee.Algorithms.TemporalSegmentation.Ccdc(ccdcParams));

//Set properties for asset
ccdc = ccdc.copyProperties(processedScenes)
            .set(ccdcParams);

//Map.addLayer(ccdc,{},'CCDC Output',false);

args.outputName = args.outputName + '_' + args.startYear.toString() + '_' + args.endYear.toString() + '_' + args.startJulian.toString() + '_' + args.endJulian.toString();
//Export output
Export.image.toAsset({image: ccdc, 
                    description: args.outputName, 
                    assetId: args.exportPathRoot +'/'+args.outputName, 
                    pyramidingPolicy: {'.default':'sample'}, 
                    dimensions: null, 
                    region: args.studyArea, 
                    scale: args.scale, 
                    crs: args.crs, 
                    crsTransform: args.transform, 
                    maxPixels: 1e13});


Map.setOptions('HYBRID');