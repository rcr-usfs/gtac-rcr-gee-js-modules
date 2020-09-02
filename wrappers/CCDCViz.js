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
// var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib2.js');
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');

///////////////////////////////////////////////////////////////////////

var ccdcImg = ee.Image('users/iwhousman/test/ChangeCollection/CCDC-Test3');

var whichHarmonics = [1,2,3];
var changeDetectionBandName = 'NDVI';

var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();

var changeObj = dLib.ccdcChangeDetection(ccdcImg,changeDetectionBandName);
Map.addLayer(changeObj.highestMag.loss.year,{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Loss Year');
Map.addLayer(changeObj.highestMag.loss.mag,{min:-0.5,max:-0.1,palette:dLib.lossMagPalette},'Loss Mag',false);

var yearImages = dLib.getTimeImageCollection(startYear,endYear,startJulian,endJulian,0.1);
var fitted = dLib.predictCCDC(ccdcImg,yearImages,true,whichHarmonics);
Map.addLayer(fitted.select(['.*_predicted']),{},'Fitted CCDC',false)


Map.setOptions('HYBRID');