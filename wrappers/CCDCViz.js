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
        [[[-108.28163961476221, 39.25451132142729],
          [-108.28163961476221, 36.68265794564914],
          [-104.55727438038721, 36.68265794564914],
          [-104.55727438038721, 39.25451132142729]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
///Module imports
// var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
///////////////////////////////////////////////////////////////////////
var startYear = 1984;
var endYear = 2020;
var ccdcImg = ee.Image('users/iwhousman/test/CCDC_Collection/CCDC_Test2').reproject('EPSG:5070',null,30);
Map.addLayer(ccdcImg,{},'CCDC Img',false);
function getCCDCChange(ccdcImg){
  var nSegs = ccdcImg.select(['.*_changeProb']).bandNames().length();
  var changeMask = ccdcImg.select(['.*_changeProb']).gt(0).selfMask();
  var changeYears = ccdcImg.select(['.*_tBreak']).selfMask();
  changeYears = changeYears.updateMask(changeMask);
  
  var coeffs = ccdcImg.select(['.*_coef.*']);
  var segMask = ccdcImg.select(['.*_tStart']).selfMask();
  
  // var dummyYears =  ee.ImageCollection(ee.List.repeat(2000.7,nSegs).map(function(n){n = ee.Number(n);return ee.Image(n).float().rename(['year'])}));
  var predicted = ee.List.sequence(1,nSegs).map(function(n){
    n = ee.Number(n).byte();
    var segName = ee.String('S').cat(n.format())
    var dummyYear = ee.Image(2000.7);
    var segMaskT = segMask.select
    var coeffsT = d
  })
  //   dummyYears.map(function(img){return dLib.getCCDCPrediction(img,ccdcImg.select(['.*_coef.*']))})
  // print(predicted)
  // Map.addLayer(predicted)
  Map.addLayer(changeYears.reduce(ee.Reducer.max()),{min:startYear,max:endYear,palette:'FF0,F00'},'Change Year')
  
}
getCCDCChange(ccdcImg)
// // var ccdcImgCoeffs = ccdcImg.select(['.*_coef.*']);
// // var coeffBns = ccdcImgCoeffs.bandNames();
// // print(coeffBns)
// // var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd']);
// // ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT)
// // // Map.addLayer(ccdcImg)
// var ccdcImg = ee.ImageCollection('projects/CCDC/USA')
//           .filterBounds(geometry)
//           .mosaic();
// print(ccdcImg)
// var ccdcImgCoeffs = ccdcImg.select(['.*B2_coef_.*','.*B4_coef_.*'])//.divide(365.25);
// var ccdcImgT = ccdcImg.select(['.*tStart','.*tEnd'])//.divide(365.25);

// ccdcImg = ccdcImgCoeffs.addBands(ccdcImgT);
// // Map.addLayer(ccdcImg)
var yearImages = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
  n = ee.Number(n);
  var img = ee.Image(n).float().rename(['year']);
  var y = n.int16();
  var fraction = n.subtract(y);
  var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
  return img.set('system:time_start',d)
}));
// var yearImages2 = ee.ImageCollection(ee.List.sequence(startYear,endYear+1,0.1).map(function(n){
//   n = ee.Number(n);
//   var img = ee.Image(n).float().rename(['year']);
//   var y = n.int16();
//   var fraction = n.subtract(y);
//   var d = ee.Date.fromYMD(y,1,1).advance(fraction,'year').millis();
//   return img.multiply(365.25).set('system:time_start',d)
// }));
// // Map.addLayer(ccdcImg)
// // processedScenes = processedScenes.map(getImagesLib.addYearYearFractionBand)
// // var bns = ee.Image(timeSeries.first()).bandNames();
var nSegments = ccdcImg.select(['.*tStart']).bandNames().length().getInfo();
// //Visualize the number of segments
var count = ccdcImg.select(['.*']).select(['.*tStart']).selfMask().reduce(ee.Reducer.count());
Map.addLayer(count,{min:1,max:nSegments},'Segment Count');
// Map.addLayer(ccdcImgSmall.select(['.*tEnd']).selfMask().reduce(ee.Reducer.max()),{min:endYear-1,max:endYear},'Last Year');
  
var predicted = dLib.predictCCDC(ccdcImg,yearImages).select(['.*_predicted']);
Map.addLayer(predicted,{},'Predicted',false)
// Map.addLayer(ccdcImg)
// var predictedCONUS = predictCCDC(ccdcImg,yearImages2).select(['.*_predicted'])//.map(function(img){return img.divide(100000).copyProperties(img,['system:time_start'])});
// Map.addLayer(predictedCONUS,{},'Predicted CONUS')
  // print(ccdcImg);
// Map.addLayer(ccdcImg,{},'ccdcImg',false);

// var breaks = ccdcImg.select(['.*_tBreak']);
// var probs = ccdcImg.select(['.*_changeProb']);
// var change = probs.gt(0.6);
// breaks = breaks.updateMask(change.neq(0));
// Map.addLayer(breaks.reduce(ee.Reducer.max()),{min:startYear,max:endYear},'Change year',false);


Map.setOptions('HYBRID');