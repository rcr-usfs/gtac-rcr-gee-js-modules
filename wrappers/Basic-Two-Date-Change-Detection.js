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
        [[[-73.84430548586525, 42.354124810674335],
          [-73.84430548586525, 41.26505461833333],
          [-71.70197150149025, 41.26505461833333],
          [-71.70197150149025, 42.354124810674335]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
//If available, bring in preComputed cloudScore offsets and TDOM stats
//Set to null if computing on-the-fly is wanted
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
var preComputedCloudScoreOffset = ee.ImageCollection('projects/USFS/TCC/cloudScore_stats').mosaic();
var preComputedLandsatCloudScoreOffset = preComputedCloudScoreOffset.select(['Landsat_CloudScore_p10']);
var preComputedSentinel2CloudScoreOffset = preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p10']);

//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedTDOMStats = ee.ImageCollection('projects/USFS/TCC/TDOM_stats').mosaic().divide(10000);
var preComputedLandsatTDOMIRMean = preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']);
var preComputedLandsatTDOMIRStdDev = preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev']);

var preComputedSentinel2TDOMIRMean = preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']);
var preComputedSentinel2TDOMIRStdDev = preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev']);
//////////////////////////////////////////////////////////////

var hiFormViz = {min: 0.05, max: 0.15, gamma: 1.2,bands:'red,green,blue'};

//User parameters

//Choose dates for pre and post
var preStartYear = 2014;
var preEndYear = 2015;

var postStartYear = 2016;
var postEndYear = 2016;

var preStartJulian = ee.Date.fromYMD(9999,6,15).getRelative('day','year').add(1).getInfo();
var preEndJulian = ee.Date.fromYMD(9999,7,15).getRelative('day','year').add(1).getInfo();

var postStartJulian = ee.Date.fromYMD(9999,6,15).getRelative('day','year').add(1).getInfo();
var postEndJulian = ee.Date.fromYMD(9999,7,15).getRelative('day','year').add(1).getInfo();

var studyArea = geometry;

var compositeReducer = ee.Reducer.percentile([50]);

//Choose which bands to use for loss detection
//Can select more than one
//If selecting more than one, the lossReducer output of change/not change will be shown
//Specify a corresponding threshold for each band


var dBands = ['NDVI','NBR','NDMI'];
var lossThresh = [-0.2,-0.2,-0.2];

//If you want to find loss in any of the bands (OR), use ee.Reducer.max() for lossReducer
//If you want to find loss in all bands (AND), use ee.Reducer.min() for lossReducer
//If you want to find loss in the majority of bands, use ee.Reducer.mode() for lossReducer
var lossReducer = ee.Reducer.mode();

var treeMask = ee.Image("USGS/NLCD/NLCD2016").select(['percent_tree_cover']).gte(10).selfMask();

//End User Inputs
////////////////////////////////////////////////////////////////////////////
//Get images
var preComposite = getImagesLib.getProcessedLandsatAndSentinel2Scenes({
  studyArea:studyArea,
  startYear:preStartYear,
  endYear:preEndYear,
  startJulian:preStartJulian,
  endJulian:preEndJulian,
  toaOrSR :'TOA',
  preComputedLandsatCloudScoreOffset:preComputedLandsatCloudScoreOffset,
  preComputedLandsatTDOMIRMean:preComputedLandsatTDOMIRMean,
  preComputedLandsatTDOMIRStdDev:preComputedLandsatTDOMIRStdDev,
  preComputedSentinel2CloudScoreOffset:preComputedSentinel2CloudScoreOffset,
  preComputedSentinel2TDOMIRMean:preComputedSentinel2TDOMIRMean,
  preComputedSentinel2TDOMIRStdDev:preComputedSentinel2TDOMIRStdDev,
  includeSLCOffL7:true
  });

var postComposite  = getImagesLib.getProcessedLandsatAndSentinel2Scenes({
  studyArea:studyArea,
  startYear:postStartYear,
  endYear:postEndYear,
  startJulian:postStartJulian,
  endJulian:postEndJulian,
  toaOrSR :'TOA',
  preComputedLandsatCloudScoreOffset:preComputedLandsatCloudScoreOffset,
  preComputedLandsatTDOMIRMean:preComputedLandsatTDOMIRMean,
  preComputedLandsatTDOMIRStdDev:preComputedLandsatTDOMIRStdDev,
  preComputedSentinel2CloudScoreOffset:preComputedSentinel2CloudScoreOffset,
  preComputedSentinel2TDOMIRMean:preComputedSentinel2TDOMIRMean,
  preComputedSentinel2TDOMIRStdDev:preComputedSentinel2TDOMIRStdDev,
  includeSLCOffL7:true
  
  });

//Get band names since reducers will sometimes rename bands
var bns = ee.Image(preComposite.first()).bandNames();

//Reduce to composite and rename bands
preComposite = preComposite.reduce(compositeReducer).rename(bns);
postComposite = postComposite.reduce(compositeReducer).rename(bns);

//Show composites
Map.addLayer(preComposite,hiFormViz,'Pre Composite True Color',false);
Map.addLayer(preComposite,getImagesLib.vizParamsFalse,'Pre Composite False Color',false);

Map.addLayer(postComposite,hiFormViz,'Post Composite True Color',false);
Map.addLayer(postComposite,getImagesLib.vizParamsFalse,'Post Composite False Color',false);

//Do change detection
var d = postComposite.subtract(preComposite).select(dBands).updateMask(treeMask);
Map.addLayer(d,{min:-0.2,max:0.2},'Difference',false);

var loss = d.lte(lossThresh).reduce(lossReducer).selfMask().updateMask(treeMask);
Map.addLayer(loss,{min:1,max:1,palette:'800'},'Loss',true);


Map.setOptions('HYBRID');