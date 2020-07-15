/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-72.56870253979419, 41.670466608520734],
          [-72.56870253979419, 41.59656503861213],
          [-72.43961318432544, 41.59656503861213],
          [-72.43961318432544, 41.670466608520734]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Wrapper for running z-score and linear trend across a moving window of years

//Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
dLib.getExistingChangeData();
// Define user parameters:
var args = {};
// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
args.studyArea =geometry;

// 2. Update the startJulian and endJulian variables to indicate your seasonal 
// constraints. This supports wrapping for tropics and southern hemisphere.
// startJulian: Starting Julian date 
// endJulian: Ending Julian date
args.startJulian = 150;
args.endJulian = 200

// 3. Specify start and end years for all analyses
// More than a 3 year span should be provided for time series methods to work 
// well. If using Fmask as the cloud/cloud shadow masking method, this does not 
// matter
args.startYear = 2010;
args.endYear = 2019;

//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
args.cloudScorePctl = 10;
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


//Set up Names for the export
// var outputName = 'Test_Z_';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
args.exportPathRoot = 'users/iwhousman/test/ChangeCollection';

// var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
args.crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
args.transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
args.scale = null;


////////////////////////////////////////////////
//Moving window parameters

//Parameters used for both z and trend analyses

//Number of julian days for each analysis
//Generally want it to be >= 32 or the output will be noisy
//Should almost never be less than 16
args.nDays = 50;

//Which bands/indices to run the analysis with
//Can be any of ['blue','green','red','nir','swir1','swir2','NDMI','NDVI','NBR','NDSI','tcAngleBG']
args.indexNames = ['NBR','NDVI'];//['nir','swir1','swir2','NDMI','NDVI','NBR','tcAngleBG'];//['blue','green','red','nir','swir1','swir2','NDMI','NDVI','NBR','tcAngleBG'];

//Whether each output should be exported to asset
args.exportImages = false;

////////////////////////////////////
//Moving window z parameters

//Number of years in baseline
//Generally 5 years works best in the Western CONUS and 3 in the Eastern CONUS
args.baselineLength = 5;

//Number of years between the analysis year and the last year of the baseline
//This helps ensure the z-test is being performed data that are less likely to be 
//temporally auto-correlated
//E.g. if the analysis year is 1990, the last year of the baseline would be 1987
//Set to 0 if the last year of the baseline needs to be the year just before the analysis year
args.baselineGap = 1;

//Number of cloud/cloud shadow free observations necessary to have in the baseline for a 
//pixel to run the analysis for a given year
//Generally 5-30 works well.  If false positives are prevalant, use something toward 30
//If there are too many holes in the outputs where data are sparse, this method may not work, but try 
//using a lower minBaselineObservationsNeeded
args.minBaselineObservationsNeeded = 10;

//Since there could be multiple z values for a given pixel on a given analysis period, how to summarize
//Generally use ee.Reducer.mean() or ee.Reducer.median()
args.zReducer = ee.Reducer.mean();

//Whether to reduce the collection to an annual median stack
//Since linear regression can be leveraged by outliers, this generally
//improves the trend analysis, but does get rid of a lot of potentially
//good data
args.useAnnualMedianForTrend = true;
////////////////////////////////////
//Moving window trend parameters

//Number of years in a given trend analysis inclusive of the analysis year
//E.g. if the analysis year was 1990 and the epochLength was 5, 
//the years included in the trend analysis would be 1986,1987,1988,1989, and 1990
args.epochLength =5;


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//Function Calls
//Get all images
var allScenes = getImagesLib.getProcessedLandsatAndSentinel2Scenes(args).select(args.indexNames);
print(allScenes)

////////////////////////////////////////////////////////////

//The time series of both z scores (scaled by 10) and trend (scaled by 10000)
//These can then be thresholded to find years of departure from "normal" and negative trends
var zAndTrendCollection = 
dLib.zAndTrendChangeDetection(allScenes,args.indexNames,args.nDays,args.startYear,args.endYear,args.startJulian,args.endJulian,
          args.baselineLength,args.baselineGap,args.epochLength,args.zReducer,args.useAnnualMedianForTrend,
          args.exportImages,args.exportPathRoot,args.studyArea,args.scale,args.crs,args.transform,args.minBaselineObservationsNeeded);
var zThresh = -2;
var slopeThresh = -0.05;
var exportStartYear = 2016;
var exportEndYear = 2019;

var processingMask = ee.Image("USGS/NLCD/NLCD2016").select(['percent_tree_cover']).gt(10).selfMask();

var exportName = 'SNE-ORS-'+exportStartYear.toString()+ '-'+exportEndYear.toString();
var exportFolder = 'ORS';
var noDataValue = -9999;


Map.addLayer(zAndTrendCollection,{},'zAndTrendCollection',false);         
var changeObj = dLib.thresholdZAndTrend(zAndTrendCollection,zThresh*10,slopeThresh*10000,exportStartYear,exportEndYear);
var zChange = changeObj.zChange.max().int16().unmask(noDataValue,false);
zChange = zChange.where(processingMask.and(zChange.eq(noDataValue)),1);

var trendChange = changeObj.trendChange.max().int16().unmask(noDataValue,false);
trendChange = trendChange.where(processingMask.and(trendChange.eq(noDataValue)),1);

Export.image.toDrive(zChange, exportName +'-zChange', exportFolder, exportName+'-zChange', null, studyArea, null, crs, transform, 1e13);
Export.image.toDrive(trendChange, exportName +'-trendChange', exportFolder, exportName+'-trendChange', null, studyArea, null, crs, transform, 1e13);

Map.addLayer(zChange,{},'zChange',false);
Map.addLayer(trendChange,{},'trendChange',false);


Map.setOptions('HYBRID');
