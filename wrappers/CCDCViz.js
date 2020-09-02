///Module imports
var dLib = require('users/USFS_GTAC/modules:changeDetectionLib.js');
///////////////////////////////////////////////////////////////////////
//Bring in ccdc image asset
//This is assumed to be an image of arrays that is returned from the ee.Algorithms.TemporalSegmentation.Ccdc method
var ccdcImg = ee.Image('users/iwhousman/test/ChangeCollection/CCDC-Test3');

//Specify which harmonics to use when predicting the CCDC model
//CCDC exports the first 3 harmonics (1 cycle/yr, 2 cycles/yr, and 3 cycles/yr)
//If you only want to see yearly patterns, specify [1]
//If you would like a tighter fit in the predicted value, include the second or third harmonic as well [1,2,3]
var whichHarmonics = [1,2,3];

//Specify which band to use for loss and gain. 
//This is most important for the loss and gain magnitude since the year of change will be the same for all years
var changeDetectionBandName = 'NDVI';
//////////////////////////////////////////////////////////////////////
//Pull out some info about the ccdc image
var startJulian = ccdcImg.get('startJulian').getInfo();
var endJulian = ccdcImg.get('endJulian').getInfo();
var startYear = ccdcImg.get('startYear').getInfo();
var endYear = ccdcImg.get('endYear').getInfo();

//Extract the change years and magnitude
var changeObj = dLib.ccdcChangeDetection(ccdcImg,changeDetectionBandName);
Map.addLayer(changeObj.highestMag.loss.year,{min:startYear,max:endYear,palette:dLib.lossYearPalette},'Loss Year');
Map.addLayer(changeObj.highestMag.loss.mag,{min:-0.5,max:-0.1,palette:dLib.lossMagPalette},'Loss Mag',false);
Map.addLayer(changeObj.highestMag.gain.year,{min:startYear,max:endYear,palette:dLib.gainYearPalette},'Gain Year');
Map.addLayer(changeObj.highestMag.gain.mag,{min:0.05,max:0.2,palette:dLib.gainMagPalette},'Gain Mag',false);

var yearImages = dLib.getTimeImageCollection(startYear,endYear,startJulian,endJulian,0.1);
var fitted = dLib.predictCCDC(ccdcImg,yearImages,true,whichHarmonics);
Map.addLayer(fitted.select(['.*_predicted']),{},'Fitted CCDC',false)


Map.setOptions('HYBRID');