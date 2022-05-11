/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var ak = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-135.24144855973452, 56.98337037289282],
          [-135.24144855973452, 55.48763591967191],
          [-129.94603840348452, 55.48763591967191],
          [-129.94603840348452, 56.98337037289282]]], null, false),
    sne = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-73.51015757934601, 42.64313607458788],
          [-73.51015757934601, 41.32019390047518],
          [-71.07119273559601, 41.32019390047518],
          [-71.07119273559601, 42.64313607458788]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var getImagesLib = require('users/aaronkamoske/GTAC-Modules:getImagesLib.js');
var hiFormViz = {min: 0.05, max: 0.15, gamma: 1.2,bands:'red,green,blue'};
//////////////////////////////////////////////////////////////
//User parameters

//Choose dates for pre and post
// var preStartYear = 2019;
// var preEndYear = 2019;

// var postStartYear = 2020;
// var postEndYear = 2020;

// //Offset by 1 day if you're looking at a leap year
// var preStartJulian = ee.Date.fromYMD(5,7,15).getRelative('day','year').add(1).getInfo();
// var preEndJulian = ee.Date.fromYMD(5,8,15).getRelative('day','year').add(1).getInfo();

// var postStartJulian = ee.Date.fromYMD(5,7,29).getRelative('day','year').add(1).getInfo();
// var postEndJulian = ee.Date.fromYMD(5,7,31).getRelative('day','year').add(1).getInfo();

//Choose dates for pre and post
var preStartYear = 2014;
var preEndYear = 2015;

var postStartYear = 2019;
var postEndYear = 2019;

//Offset by 1 day if you're looking at a leap year
var preStartJulian = ee.Date.fromYMD(5,5,15).getRelative('day','year').add(1).getInfo();
var preEndJulian = ee.Date.fromYMD(5,7,15).getRelative('day','year').add(1).getInfo();

var postStartJulian = ee.Date.fromYMD(5,5,15).getRelative('day','year').add(1).getInfo();
var postEndJulian = ee.Date.fromYMD(5,7,15).getRelative('day','year').add(1).getInfo();

//Define study area
var studyArea = sne;

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

//Choose how to create the composite
//This is done in a band-wise fashion
var compositeReducer = ee.Reducer.percentile([50]);

//List of acceptable sensors
//Options include: 'LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8','Sentinel-2A', 'Sentinel-2B'
var sensorList = ['LANDSAT_4', 'LANDSAT_5', 'LANDSAT_7','LANDSAT_8','Sentinel-2A', 'Sentinel-2B'];

//Choose which bands to use for loss detection
//Can select more than one
//If selecting more than one, the lossReducer output of change/not change will be shown
//Specify a corresponding threshold for each band
//Band name options include: "blue","green","red","nir","swir1","swir2","NDVI","NBR","NDMI","NDSI","brightness","greenness","wetness","tcAngleBG"
var dBands = ['NDVI','NBR','NDMI'];
var lossThresh = [-0.15,-0.15,-0.15];

//If you want to find loss in any of the bands (OR), use ee.Reducer.max() for lossReducer
//If you want to find loss in all bands (AND), use ee.Reducer.min() for lossReducer
//If you want to find loss in the majority of bands, use ee.Reducer.mode() for lossReducer
var lossReducer = ee.Reducer.mode();

//Bring in a tree mask
var treeMask = ee.ImageCollection("USGS/NLCD")
                .filter(ee.Filter.calendarRange(2011,2011,'year'))
                .select(['percent_tree_cover']).mosaic().gte(10).selfMask();
Map.addLayer(treeMask,{min:1,max:1,palette:'080'},'Tree Mask',false);
//End User Inputs
////////////////////////////////////////////////////////////////////////////
//Get images for the union of the dates
var images = getImagesLib.getProcessedLandsatAndSentinel2Scenes({
  studyArea:studyArea,
  startYear:preStartYear,
  endYear:postEndYear,
  startJulian:Math.min(preStartJulian,postStartJulian),
  endJulian:Math.max(preEndJulian,postEndJulian),
  toaOrSR :'TOA',
  includeSLCOffL7:true,
  performCloudScoreOffset:true,
  applyCloudProbability:true,
  applyCloudScoreLandsat:false,
  applyCloudScoreSentinel2:false,
  applyTDOMLandsat:true,
  applyTDOMSentinel2:true,
  applyFmaskCloudMask:true,
  applyFmaskCloudShadowMask:false,
  applyFmaskSnowMask:false,
  convertToDailyMosaics:true,
  preComputedLandsatCloudScoreOffset:preComputedLandsatCloudScoreOffset,
  preComputedSentinel2CloudScoreOffset:preComputedSentinel2CloudScoreOffset,
  preComputedLandsatTDOMIRMean : preComputedLandsatTDOMIRMean,
  preComputedLandsatTDOMIRStdDev : preComputedLandsatTDOMIRStdDev,
  preComputedSentinel2TDOMIRMean : preComputedSentinel2TDOMIRMean,
  preComputedSentinel2TDOMIRStdDev : preComputedSentinel2TDOMIRStdDev

  });
  
//Filter to only include wanted sensors
images = images.filter(ee.Filter.inList('sensor',ee.List(sensorList)));

//Filter down into composites
var preComposite = images.filter(ee.Filter.calendarRange(preStartYear,preEndYear,'year'))
                  .filter(ee.Filter.calendarRange(preStartJulian,preEndJulian));


var postComposite  = images.filter(ee.Filter.calendarRange(postStartYear,postEndYear,'year'))
                  .filter(ee.Filter.calendarRange(postStartJulian,postEndJulian));

//Get band names since reducers will sometimes rename bands
var bns = ee.Image(preComposite.first()).bandNames();

//Reduce to composite and rename bands
preComposite = preComposite.reduce(compositeReducer).rename(bns).clip(studyArea);
postComposite = postComposite.reduce(compositeReducer).rename(bns).clip(studyArea);

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
if(!Map.getCenter().intersects(studyArea).getInfo()){
  Map.centerObject(studyArea)
}
