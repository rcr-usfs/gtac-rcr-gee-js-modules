/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = /* color: #d63000 */ee.Geometry.Polygon(
        [[[-109.412841796875, 44.95702412512118],
          [-111.02783203125, 45.22461173085719],
          [-111.4508056640625, 44.05995928349327],
          [-109.775390625, 43.846412964702395]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
//Module imports
var getImageLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
///////////////////////////////////////////////////////////////////////////////
// Define user parameters:
dLib.getExistingChangeData();
// 1. Specify study area: Study area
// Can specify a country, provide a fusion table  or asset table (must add 
// .geometry() after it), or draw a polygon and make studyArea = drawnPolygon
var rio = ee.FeatureCollection('users/ianhousman/RIO/Rio_Grande_NF_Boundary_10kBuffer_albers_diss').geometry();
var fnf = ee.FeatureCollection('projects/USFS/LCMS-NFS/R1/FNF/FNF_GNP_Merge_Admin_BND_1k').geometry();
var bt = ee.FeatureCollection('projects/USFS/LCMS-NFS/R4/BT/BT_LCMS_ProjectArea_5km').geometry();
var studyArea = fnf;

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
var startYear = 1984;
var endYear = 2018;

// 4. Specify an annual buffer to include imagery from the same season 
// timeframe from the prior and following year. timeBuffer = 1 will result 
// in a 3 year moving window
var timebuffer = 1;

// 5. Specify the weights to be used for the moving window created by timeBuffer
//For example- if timeBuffer is 1, that is a 3 year moving window
//If the center year is 2000, then the years are 1999,2000, and 2001
//In order to overweight the center year, you could specify the weights as
//[1,5,1] which would duplicate the center year 5 times and increase its weight for
//the compositing method
var weights = [1,5,1];



// 6. Choose medoid or median compositing method. 
// Median tends to be smoother, while medoid retains 
// single date of observation across all bands
// If not exporting indices with composites to save space, medoid should be used
var compositingMethod = 'medoid';

// 7. Choose Top of Atmospheric (TOA) or Surface Reflectance (SR) 
// Specify TOA or SR
// Current implementation does not support Fmask for TOA
var toaOrSR = 'SR';

// 8. Choose whether to include Landat 7
// Generally only included when data are limited
var includeSLCOffL7 = false;

//9. Whether to defringe L5
//Landsat 5 data has fringes on the edges that can introduce anomalies into 
//the analysis.  This method removes them, but is somewhat computationally expensive
var defringeL5 = false;

// 10. Choose cloud/cloud shadow masking method
// Choices are a series of booleans for cloudScore, TDOM, and elements of Fmask
//Fmask masking options will run fastest since they're precomputed
//CloudScore runs pretty quickly, but does look at the time series to find areas that 
//always have a high cloudScore to reduce comission errors- this takes some time
//and needs a longer time series (>5 years or so)
//TDOM also looks at the time series and will need a longer time series
var applyCloudScore = false;
var applyFmaskCloudMask = true;

var applyTDOM = false;
var applyFmaskCloudShadowMask = true;

var applyFmaskSnowMask = true;

// 11. Cloud and cloud shadow masking parameters.
// If cloudScoreTDOM is chosen
// cloudScoreThresh: If using the cloudScoreTDOMShift method-Threshold for cloud 
//    masking (lower number masks more clouds.  Between 10 and 30 generally 
//    works best)
var cloudScoreThresh = 20;

// Percentile of cloud score to pull from time series to represent a minimum for 
// the cloud score over time for a given pixel. Reduces comission errors over 
// cool bright surfaces. Generally between 5 and 10 works well. 0 generally is a
// bit noisy
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

// 12. correctIllumination: Choose if you want to correct the illumination using
// Sun-Canopy-Sensor+C correction. Additionally, choose the scale at which the
// correction is calculated in meters.
var correctIllumination = false;
var correctScale = 250;//Choose a scale to reduce on- 250 generally works well

//13. Export params
//Whether to export composites
var exportComposites = false;

//Set up Names for the export
var outputName = 'Base-learners';

//Provide location composites will be exported to
//This should be an asset folder, or more ideally, an asset imageCollection
// var exportPathRoot = 'users/iwhousman/test/ChangeCollection';

var exportPathRoot = 'projects/USFS/LCMS-NFS/R1/FNF/Base-Learners/Base-Learners-Collection';
// var exportPathRoot = 'projects/USFS/LCMS-NFS/R4/BT/Base-Learners/Base-Learners-Collection';
//CRS- must be provided.  
//Common crs codes: Web mercator is EPSG:4326, USGS Albers is EPSG:5070, 
//WGS84 UTM N hemisphere is EPSG:326+ zone number (zone 12 N would be EPSG:32612) and S hemisphere is EPSG:327+ zone number
var crs = 'EPSG:5070';

//Specify transform if scale is null and snapping to known grid is needed
var transform = [30,0,-2361915.0,0,-30,3177735.0];

//Specify scale if transform is null
var scale = null;


////////////////////////////////////////////////////////////
//Landtrendr params
//Param documentation:
// reference: Kennedy, R. E., Yang, Z., & Cohen, W. B. (2010). Detecting trends in forest disturbance and recovery using yearly Landsat time series: 1. LandTrendr—Temporal segmentation algorithms. Remote Sensing of Environment, 114(12), 2897-2910.
//https://github.com/eMapR/LT-GEE
//From: http://www.mdpi.com/2072-4292/10/5/691
// Table 1. LandTrendr parameters used for IDL and GEE runs in all study areas. The NBR spectral metric was used for segmentation. For descriptions of the parameters, see [3]).
// Parameter	IDL	GEE	Comments
// maxSegments	6	6	
// spikeThreshold	0.9	0.9	Renamed from “desawtooth val”
// vertexCountOvershoot	3	3	
// recoveryThreshold	0.25	0.25	
// pvalThreshold	0.05	0.05	
// bestModelProportion	0.75	0.75	
// minObservationsNeeded	6	6	Renamed from “minneeded”
// Background_val	0	NA	GEE uses a mask logic to avoid missing values caused by clouds, shadows, and missing imagery.
// Divisor	−1	NA	Ensures that vegetation loss disturbance results in negative change in value when NBR is used as a spectral metric. In GEE, this must be handled outside of the segmentation algorithm.
// Kernelsize	1	Dropped	Originally used together with skipfactor to save computational burden; no longer necessary.
// Skipfactor	1	Dropped
// Distweightfactor	2	Dropped	Inadvertently hardwired in the IDL code, this parameter was hardwired in the GEE code to the value of 2.
// Fix_doy_effect	1	Dropped	Although correcting day-of-year trends was considered theoretically useful in the original LT implementation, in practice it has been found to distort time series values when change occurs and thus was eliminated.


//Define landtrendr params
var run_params = { 
  maxSegments:            6,
  spikeThreshold:         0.9,
  vertexCountOvershoot:   3,
  preventOneYearRecovery: true,
  recoveryThreshold:      0.25,
  pvalThreshold:          0.05,
  bestModelProportion:    0.75,
  minObservationsNeeded:  6
};

//Define disturbance mapping filter parameters 
var treeLoss1  = 1;      //150 delta filter for 1 year duration disturbance, <= will not be included as disturbance - units are in units of segIndex defined in the following function definition
var treeLoss20 = 200;      //200 delta filter for 20 year duration disturbance, <= will not be included as disturbance - units are in units of segIndex defined in the following function definition
var preVal     = 1;      //200 pre-disturbance value threshold - values below the provided threshold will exclude disturbance for those pixels - units are in units of segIndex defined in the following function definition
var mmu        = 15;       //15 minimum mapping unit for disturbance patches - units of pixels

var distParams = {
    tree_loss1: treeLoss1,
    tree_loss20: treeLoss20,  
    pre_val: preVal           
  };

//List of bands or indices to iterate across
//Typically a list of spectral bands or computed indices
//Can include: 'blue','green','red','nir','swir1','swir2'
//'NBR','NDVI','wetness','greenness','brightness','tcAngleBG'
// var indexList = ee.List(['nir','swir1']);
var indexList = ee.List(['nir','swir1','swir2','NDVI','wetness','greenness','brightness','tcAngleBG']);

//The corresponding direction of forest loss for the given band/index specified above in indexList
// var ltDirection = ee.List([-1,    1]);
var ltDirection =ee.List([-1,    1,      1,        -1,   -1,           -1,        1,          -1]);

// var distDir = -1; // define the sign of spectral delta for vegetation loss for the segmentation index - 
//                   // NBR delta is negetive for vegetation loss, so -1 for NBR, 1 for band 5, -1 for NDVI, etc

// var indexName = 'NBR';



///////////////////////////////////////////////////////////////////////
//EWMACD Parameters

//Number of years to include at the beginning of the time series to train
//the harmonic regression model.
//Generally 3-5 works well
var ewmacdTrainingYears = 5;

//Expected frequency of phenological cycles. 
//harmonicCount is n pi so 1 cycle/yr is 2 
var harmonicCount = 2;

//When simplifying from all EWMA values to annual values
//this is the reducer that is applied.  Generally will want to pull from the 
//bottom quadrant
var annualReducer = ee.Reducer.percentile([10])

///////////////////////////////////////////////////////////////////////
// End user parameters
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////
//Start function calls

////////////////////////////////////////////////////////////////////////////////
//Call on master wrapper function to get Landat scenes and composites
var lsAndTs = getImageLib.getLandsatWrapper(studyArea,startYear,endYear,startJulian,endJulian,
  timebuffer,weights,compositingMethod,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,applyFmaskSnowMask,
  cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels,
  correctIllumination,correctScale,
  exportComposites,outputName,exportPathRoot,crs,transform,scale);

//Separate into scenes and composites for subsequent analysis
var processedScenes = lsAndTs[0];
var processedComposites = lsAndTs[1];
// var first = ee.Image(processedComposites.first())
// Map.addLayer(first,getImageLib.vizParamsFalse,'First Composite',false);
//Get all images from the entire year for EWMACD 
var lsAndTsAll = getImageLib.getLandsatWrapper(studyArea,startYear+timebuffer,endYear+timebuffer,1,365,
  timebuffer,weights,compositingMethod,
  toaOrSR,includeSLCOffL7,defringeL5,applyCloudScore,applyFmaskCloudMask,applyTDOM,
  applyFmaskCloudShadowMask,true,
  cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels,
  correctIllumination,correctScale,
  false,outputName,exportPathRoot,crs,transform,scale);

//Separate into scenes and composites for subsequent analysis
var allScenes = lsAndTsAll[0];

// Map.addLayer(allScenes.select(['NBR']))
// Map.addLayer(processedComposites.select(['NBR']))


var indexDirList = indexList.zip(ltDirection).getInfo();

var collections =indexDirList.map(function(indexDir){
  print(indexDir);
  var indexName = indexDir[0];
  var distDir = indexDir[1];
  
  var tsIndex = processedComposites.select(indexName);
  var lsIndex = allScenes.select(indexName);
 
 
  //Apply LANDTRENDR
  var ltOutputs = dLib.landtrendrWrapper(processedComposites,startYear+timebuffer,endYear-timebuffer,indexName,distDir,run_params,distParams,mmu);
  var ltAnnualFitted = ltOutputs[2];
  ltAnnualFitted = ltAnnualFitted.map(function(img){return dLib.multBands(img,1,0.001)});
  
  var ltAnnualFittedSlope = dLib.pairwiseSlope(ltAnnualFitted);
  // Map.addLayer(ltAnnualFitted,{},'lt annual fitted',false);
  // Map.addLayer(ltAnnualFittedSlope,{},'lt annual fitted slope',false);
  
  //Apply VERDET
  var verdetAnnualFittedSlope = dLib.verdetAnnualSlope(tsIndex,indexName,startYear+timebuffer,endYear-timebuffer);
  // Map.addLayer(verdetAnnualFittedSlope,{},'VERDET annual fitted',false);
  
  
  //Apply EWMACD
  var ewmaOutputs = dLib.runEWMACD(lsIndex,indexName,startYear+timebuffer,endYear-timebuffer,ewmacdTrainingYears,harmonicCount,annualReducer,!includeSLCOffL7);
  var annualEWMA = ewmaOutputs[1].map(function(img){return dLib.multBands(img,1,0.01)});
  
  
  var tsIndexSlope = dLib.pairwiseSlope(tsIndex);
  var annualEWMASlope = dLib.pairwiseSlope(annualEWMA);
  
  var changeOutputs = getImageLib.joinCollections(tsIndex,tsIndexSlope,false);
  changeOutputs = getImageLib.joinCollections(changeOutputs,ltAnnualFittedSlope,false);
  changeOutputs = getImageLib.joinCollections(changeOutputs,verdetAnnualFittedSlope,false);
  
  // changeOutputs = getImageLib.joinCollections(changeOutputs,annualEWMA,false);
  changeOutputs = getImageLib.joinCollections(changeOutputs,annualEWMASlope);
 
  
  Map.addLayer(changeOutputs,{},'changeOutputs-'+indexName,false);
  
  // var indexListString = getImageLib.listToString(indexList.getInfo(),'_');

  var possibleYears = ee.List.sequence(startYear+timebuffer+1,endYear-timebuffer).getInfo();
  possibleYears.map(function(yr){

    var changeOutput = changeOutputs.filter(ee.Filter.calendarRange(yr,yr,'year'));
    changeOutput = ee.Image(changeOutput.first()).float();
    changeOutput = changeOutput.set({
      'system:time_start':ee.Date.fromYMD(yr,6,1).millis(),
      'indexName':indexName,
      'startYear':startYear,
      'endYear':endYear,
    });
    var exportName = outputName + '_'+indexName + '_' + yr.toString();
    var exportPath = exportPathRoot + '/' + exportName;
    getImageLib.exportToAssetWrapper(changeOutput,exportName,exportPath,'mean',
      studyArea,null,crs,transform);
    
  });
  return changeOutputs;
 // return [tsIndex,tsIndexSlope,ltAnnualSlope,verdetOutputs,annualEWMA,annualEWMASlope];
});


// var combined;
// ee.List.sequence(0,indexList.length().subtract(1)).getInfo().map(function(i){
//   if(combined === undefined){
//     combined = ee.ImageCollection(collections[i]);
//   }else{
//     combined =  ee.ImageCollection(getImageLib.joinCollections(combined,collections[i],false));
//   }
// });

// var indexListString = getImageLib.listToString(indexList.getInfo(),'_');

// var possibleYears = ee.List.sequence(startYear+timebuffer+1,endYear-timebuffer).getInfo();
//   possibleYears.map(function(yr){

//     var changeOutput = combined.filter(ee.Filter.calendarRange(yr,yr,'year'));
//     changeOutput = ee.Image(changeOutput.first()).float();
//     changeOutput = changeOutput.set({
//       'system:time_start':ee.Date.fromYMD(yr,6,1).millis(),
//       'indexList':indexListString,
//       'startYear':startYear,
//       'endYear':endYear,
//     });
//     var exportName = outputName + '_'+indexListString + '_' + yr.toString();
//     var exportPath = exportPathRoot + '/' + exportName;
//     getImageLib.exportToAssetWrapper(changeOutput,exportName,exportPath,'mean',
//       studyArea,null,crs,transform);
    
//   });

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



// runTaskList();

// confirmAll();
