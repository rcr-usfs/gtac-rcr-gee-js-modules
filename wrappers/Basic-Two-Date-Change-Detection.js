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
          [-129.94603840348452, 56.98337037289282]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
var hiFormViz = {min: 0.05, max: 0.15, gamma: 1.2,bands:'red,green,blue'};
//////////////////////////////////////////////////////////////
//User parameters

//Choose dates for pre and post
var preStartYear = 2019;
var preEndYear = 2019;

var postStartYear = 2020;
var postEndYear = 2020;

//Offset by 1 day if you're looking at a leap year
var preStartJulian = ee.Date.fromYMD(5,7,15).getRelative('day','year').add(1).getInfo();
var preEndJulian = ee.Date.fromYMD(5,8,15).getRelative('day','year').add(1).getInfo();

var postStartJulian = ee.Date.fromYMD(5,7,29).getRelative('day','year').add(1).getInfo();
var postEndJulian = ee.Date.fromYMD(5,7,31).getRelative('day','year').add(1).getInfo();

var studyArea = ak;

//Choose how to create the composite
//This is done in a band-wise fashion
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
  startYear:preStartYear-1,
  endYear:postEndYear+1,
  startJulian:Math.min(preStartJulian,postStartJulian),
  endJulian:Math.max(preEndJulian,postEndJulian),
  toaOrSR :'TOA',
  performCloudScoreOffset:false,
  applyCloudProbability:false,
  applyCloudScore:true,
  applyTDOM:false,
  convertToDailyMosaics:false,
  });

//Filter down into composites
var preComposite = images.filter(ee.Filter.calendarRange(preStartYear,preEndYear,'year'))
                  .filter(ee.Filter.calendarRange(preStartJulian,preEndJulian));


var postComposite  = images.filter(ee.Filter.calendarRange(postStartYear,postEndYear,'year'))
                  .filter(ee.Filter.calendarRange(postStartJulian,postEndJulian));

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
// Map.setCenter(-132.396, 56.4711, 7);
