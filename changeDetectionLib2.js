/*
   Copyright 2023 Ian Housman, Leah Campbell, Josh Heyer

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
// Script to help with basic change detection
// Intended to work within the geeViz package
// Adapted from changeDetectionLib.py


// Image and array manipulation
var lossYearPalette = 'ffffe5,fff7bc,fee391,fec44f,fe9929,ec7014,cc4c02'.split(',');
var lossMagPalette = 'D00,F5DEB3'.split(',');
var gainYearPalette = 'c5ee93,00a398'.split(',');
var gainMagPalette = 'F5DEB3,006400'.split(',');
var changeDurationPalette = 'BD1600,E2F400,0C2780'.split(',');

// Helper to multiply image
function multBands(img, distDir, by) {
  var out = img.multiply(ee.Image(distDir).multiply(by));
  out = ee.Image(out.copyProperties(img, ['system:time_start']).copyProperties(img));
  return out;
}

// Default run params for LandTrendr
var default_lt_run_params = {
  'maxSegments': 6,
  'spikeThreshold': 0.9,
  'vertexCountOvershoot': 3,
  'preventOneYearRecovery': true,
  'recoveryThreshold': 0.25,
  'pvalThreshold': 0.05,
  'bestModelProportion': 0.75,
  'minObservationsNeeded': 6
};

// 2023 rework to run LT in its most simple form
// Gets rid of handling :
//   Insufficient obs counts, no data handling,
//   Exporting of band stack format (assumes image array format for output)

// Function to mask out the non-vertex and original values
// Simplified version of rawLTToVertices
function simpleRawLTToVertices(rawLT) {
    // Pull off rmse
    var rmse = rawLT.select(['rmse']);
    // Mask out non-vertex values to use less storage space
    var ltArray = rawLT.select(['LandTrendr']);
    var vertices = ltArray.arraySlice(0, 3, 4);
    ltArray = ltArray.arrayMask(vertices);
  
    // Mask out all but the year and vertex fitted values (get rid of the raw and vertex rows)
    return ltArray.arrayMask(ee.Image(ee.Array([[1], [0], [1], [0]]))).addBands(rmse);
  }
  
  // Function to multiply the LandTrendr RMSE and vertex array
  // Assumes LTMaskNonVertices has already been run
  function multLT(rawLT, multBy) {
    // Pull off rmse
    var rmse = rawLT.select(['rmse']).multiply(multBy).abs();
    // Ensure only the LandTrendr array output
    var ltArray = rawLT.select(['LandTrendr']);
    // Form an image to multiply by
    var l = ltArray.arrayLength(1);
    var multImg = ee.Image(ee.Array([[1], [multBy]])).arrayRepeat(1, l);
    return ltArray.multiply(multImg).addBands(rmse);
  }
  
  // Function to simplify LandTrendr output for exporting
  function LTExportPrep(rawLT, multBy) {
    multBy = multBy || 10000;
    rawLT = simpleRawLTToVertices(rawLT);
    rawLT = multLT(rawLT, multBy);
    return rawLT;
  }
  
  // New function 11/23 to simplify running of LandTrendr
  // and prepping outputs for export
  function runLANDTRENDR(ts, bandName, run_params) {
    // Get single band time series and set its direction so that a loss in veg/moisture is going up
    ts = ts.select([bandName]);
    try {
      distDir = changeDirDict[bandName];
    } catch (e) {
      distDir = -1;
    }
    ts = ts.map(function (img) {
      return multBands(img, 1, distDir);
    });
  
    // Set up run params
    run_params = run_params || default_lt_run_params;
    
    run_params['timeSeries'] = ts;
  
    // Run LANDTRENDR
    var rawLT = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params);
  
    // Get vertex-only fitted values and multiply the fitted values
    return LTExportPrep(rawLT, distDir)
      .set('band', bandName)
      .set('run_params', run_params);
  }
  
  // Pulled from simpleLANDTRENDR below to take the lossGain dictionary and prep it for export
  function LTLossGainExportPrep(lossGainDict, indexName, multBy) {
    indexName = indexName || 'Bn';
    multBy = multBy || 10000;
    var lossStack = lossGainDict['lossStack'];
    var gainStack = lossGainDict['gainStack'];
  
    // Convert to byte/int16 to save space
    var lossThematic = lossStack.select(['.*_yr_.*']).int16().addBands(lossStack.select(['.*_dur_.*']).byte());
    var lossContinuous = lossStack.select(['.*_mag_.*', '.*_slope_.*']).multiply(multBy).float();
    lossStack = lossThematic.addBands(lossContinuous);
  
    var gainThematic = gainStack.select(['.*_yr_.*']).int16().addBands(gainStack.select(['.*_dur_.*']).byte());
    var gainContinuous = gainStack.select(['.*_mag_.*', '.*_slope_.*']).multiply(multBy).float();
    gainStack = gainThematic.addBands(gainContinuous);
    var outStack = lossStack.addBands(gainStack);
  
    // Add indexName to band names
    var bns = outStack.bandNames();
    var outBns = bns.map(function (bn) {
      return ee.String(indexName).cat('_LT_').cat(bn);
    });
    return outStack.rename(outBns);
  }
  
  // Pulled from simpleLANDTRENDR below to take prepped (must run LTLossGainExportPrep first) lossGain stack and view it
  function addLossGainToMap(lossGainStack, startYear, endYear, lossMagMin, lossMagMax, gainMagMin, gainMagMax) {
    lossMagMin = lossMagMin || -8000;
    lossMagMax = lossMagMax || -2000;
    gainMagMin = gainMagMin || 1000;
    gainMagMax = gainMagMax || 8000;
    
    var bns = lossGainStack.bandNames().getInfo();
    var indexName = bns[0].split('_')[0];
    var howManyToPull = Array.from(new Set(bns.map(function (bn) {
      return parseInt(bn.split('_').pop());
    })));
  
    // Set up viz params
    var vizParamsLossYear = { 'min': startYear, 'max': endYear, 'palette': lossYearPalette };
    var vizParamsLossMag = { 'min': lossMagMin, 'max': lossMagMax, 'palette': lossMagPalette };
  
    var vizParamsGainYear = { 'min': startYear, 'max': endYear, 'palette': gainYearPalette };
    var vizParamsGainMag = { 'min': gainMagMin, 'max': gainMagMax, 'palette': gainMagPalette };
  
    var vizParamsDuration = { 'min': 1, 'legendLabelLeftAfter': 'year', 'legendLabelRightAfter': 'years', 'max': 5, 'palette': changeDurationPalette };
  
    for (var i = 0; i < howManyToPull.length; i++) {
      var lossStackI = lossGainStack.select(['.*_loss_.*_' + howManyToPull[i]]);
      var gainStackI = lossGainStack.select(['.*_gain_.*_' + howManyToPull[i]]);
      var showLossYear = i === 0;
      Map.addLayer(lossStackI.select(['.*_loss_yr.*']), vizParamsLossYear, howManyToPull[i] + ' ' + indexName + ' Loss Year', showLossYear);
      Map.addLayer(lossStackI.select(['.*_loss_mag.*']), vizParamsLossMag, howManyToPull[i] + ' ' + indexName + ' Loss Magnitude', false);
      Map.addLayer(lossStackI.select(['.*_loss_dur.*']), vizParamsDuration, howManyToPull[i] + ' ' + indexName + ' Loss Duration', false);
  
      Map.addLayer(gainStackI.select(['.*_gain_yr.*']), vizParamsGainYear, howManyToPull[i] + ' ' + indexName + ' Gain Year', false);
      Map.addLayer(gainStackI.select(['.*_gain_mag.*']), vizParamsGainMag, howManyToPull[i] + ' ' + indexName + ' Gain Magnitude', false);
      Map.addLayer(gainStackI.select(['.*_gain_dur.*']), vizParamsDuration, howManyToPull[i] + ' ' + indexName + ' Gain Duration', false);
    }
  }
  
  // Function for running LT, thresholding the segments for both loss and gain, sort them, and convert them to an image stack
  // July 2019 LSC: replaced some parts of the workflow with functions in changeDetectionLib
  function simpleLANDTRENDR(ts, startYear, endYear, indexName, run_params, lossMagThresh, lossSlopeThresh, 
            gainMagThresh, gainSlopeThresh, slowLossDurationThresh, 
            chooseWhichLoss, chooseWhichGain, addToMap, howManyToPull, multBy) {
    indexName = indexName || 'NBR';
    run_params = run_params || default_lt_run_params;
    lossMagThresh = lossMagThresh || -0.15;
    lossSlopeThresh = lossSlopeThresh || -0.1;
    gainMagThresh = gainMagThresh || 0.1;
    gainSlopeThresh = gainSlopeThresh || 0.1;
    slowLossDurationThresh = slowLossDurationThresh || 3;
    chooseWhichLoss = chooseWhichLoss || 'largest';
    chooseWhichGain = chooseWhichGain || 'largest;';
    addToMap = addToMap || true;
    howManyToPull = howManyToPull || 2;
    multBy = multBy || 10000;
    
    ts = ts.select(indexName);
    var lt = runLANDTRENDR(ts, indexName, run_params);
  
    try {
      distDir = changeDirDict[indexName];
    } catch (e) {
      distDir = -1;
    }
  
    var ltTS = simpleLTFit(lt, startYear, endYear, indexName = indexName, arrayMode = true, maxSegs = run_params['maxSegments']);
    var joinedTS = joinCollections(ts, ltTS.select(['.*_LT_fitted']));
  
    // Flip the output back around if needed to do change detection
    var ltRawPositiveForChange = multLT(lt, distDir);
  
    // Take the LT output and detect change
    var lossGainDict = convertToLossGain(ltRawPositiveForChange, 'arrayLandTrendr', lossMagThresh, lossSlopeThresh, gainMagThresh, gainSlopeThresh, slowLossDurationThresh, chooseWhichLoss, chooseWhichGain, howManyToPull);
    // Prep loss gain dictionary into multi-band image ready for exporting
    var lossGainStack = LTLossGainExportPrep(lossGainDict, indexName, multBy);
  
    // Add the change outputs to the map if specified to do so
    if (addToMap) {
      Map.addLayer(joinedTS, { 'opacity': 0 }, 'Raw and Fitted Time Series', true);
      addLossGainToMap(lossGainStack, startYear, endYear, (lossMagThresh - 0.7) * multBy, lossMagThresh * multBy, gainMagThresh * multBy, (gainMagThresh + 0.7) * multBy);
    }
  
    return [multLT(lt, multBy).int16(), lossGainStack];
  }
  
  // Simplified method to convert LANDTRENDR stack to an annual collection of
// Duration, fitted, magnitude, slope, and diff
// Improved handling of start year delay found in the older method
function simpleLTFit(ltStack, startYear, endYear, indexName, arrayMode, maxSegs, multBy) {
  indexName = indexName || 'bn';
  arrayMode = arrayMode || true;
  maxSegs = maxSegs || 6;
  multBy = multBy || 1;
    indexName = ee.String(indexName);
  
    // Set up output band names
    var outBns = [indexName.cat('_LT_dur'), indexName.cat('_LT_fitted'), indexName.cat('_LT_mag'), indexName.cat('_LT_slope'), indexName.cat('_LT_diff')];
  
    // Separate years and fitted values of vertices
    var yrs, fit;
    if (arrayMode) {
      ltStack = ltStack.select([0]);
      var zeros = ee.Image(ee.Array([0]).repeat(0, maxSegs + 2));
      var yrBns = ee.List.sequence(1, maxSegs + 1).map(function (i) { return 'yrs_' + i; });
      var fitBns = ee.List.sequence(1, maxSegs + 1).map(function (i) { return 'fit_' + i; });
      yrs = ltStack.arraySlice(0, 0, 1).arrayProject([1]).arrayCat(zeros, 0).arraySlice(0, 0, maxSegs + 1).arrayFlatten([yrBns]).selfMask();
      fit = ltStack.arraySlice(0, 1, 2).arrayProject([1]).arrayCat(zeros, 0).arraySlice(0, 0, maxSegs + 1).arrayFlatten([fitBns]).updateMask(yrs.mask());
    } else {
      yrs = ltStack.select('yrs_.*').selfMask();
      fit = ltStack.select('fit_.*').updateMask(yrs.mask());
    }
  
    fit = fit.multiply(multBy);
    // Find the first and last vertex years
    var isStartYear = yrs.reduce(ee.Reducer.firstNonNull());
    var isEndYear = yrs.reduce(ee.Reducer.lastNonNull());
    var blankMask = yrs.gte(100000);
  
    // Iterate across each year to find the values for that year
    var out = ee.ImageCollection(ee.List.sequence(startYear, endYear).map(function (yr) {
      yr = ee.Number(yr);
  
      // Find the segment the year belongs to
      // Handle whether the year is the same as the first vertex year
      var startYrMask = blankMask;
      startYrMask = startYrMask.where(isStartYear.eq(yr), yrs.lte(yr));
      startYrMask = startYrMask.where(isStartYear.lt(yr), yrs.lt(yr));
  
      // Handle whether the year is the same as the last vertex year
      var endYrMask = blankMask;
      endYrMask = endYrMask.where(isStartYear.eq(yr), yrs.gt(yr));
      endYrMask = endYrMask.where(isStartYear.lt(yr), yrs.gte(yr));
  
      // Get fitted values for the vertices segment the year is within
      var fitStart = fit.updateMask(startYrMask).reduce(ee.Reducer.lastNonNull());
      var fitEnd = fit.updateMask(endYrMask).reduce(ee.Reducer.firstNonNull());
  
      // Get start and end year for the vertices segment the year is within
      var yearStart = yrs.updateMask(startYrMask).reduce(ee.Reducer.lastNonNull());
      var yearEnd = yrs.updateMask(endYrMask).reduce(ee.Reducer.firstNonNull());
  
      // Get the difference and duration of the segment
      var segDiff = fitEnd.subtract(fitStart);
      var segDur = yearEnd.subtract(yearStart);
  
      // Get various annual derivatives
      var tDiff = yr.subtract(yearStart);
      var segSlope = segDiff.divide(segDur);
      var fitDiff = segSlope.multiply(tDiff);
      var fitted = fitStart.add(fitDiff);
  
      var formatted = ee.Image.cat([segDur, fitted, segDiff, segSlope, fitDiff])
        .rename(outBns)
        .set('system:time_start', ee.Date.fromYMD(yr, 6, 1).millis());
  
      return formatted;
    }));
  
    return out;
  }
  
  // Wrapper function to iterate across multiple LT band/index values
  function batchSimpleLTFit(ltStacks, startYear, endYear, indexNames = null, bandPropertyName = 'band', arrayMode = false, maxSegs = 6, multBy = 1) {
    // Get band/index names if not provided
    if (indexNames === null) {
      indexNames = ltStacks.aggregate_histogram(bandPropertyName).keys().getInfo();
    }
  
    // Iterate across each band/index and get the fitted, mag, slope, etc
    var lt_fit = null;
    indexNames.forEach(function (bn) {
      var ltt = ltStacks.filter(ee.Filter.eq('band', bn)).max();
  
      if (lt_fit === null) {
        lt_fit = simpleLTFit(ltt, startYear, endYear, bn, arrayMode, maxSegs, multBy);
      } else {
        lt_fit = joinCollections(lt_fit, simpleLTFit(ltt, startYear, endYear, bn, arrayMode, maxSegs, multBy), false);
      }
    });
  
    return lt_fit;
  }
  
// Function to convert from raw Landtrendr Output OR Landtrendr/VerdetVertStack output to Loss & Gain Space
// format = 'rawLandtrendr' (Landtrendr only) or 'vertStack' (Verdet or Landtrendr)
// If using vertStack format, this will not work if there are masked values in the vertStack.
// Must use getImagesLib.setNoData prior to calling this function.
// Have to apply LandTrendr changeDirection (loss in veg/moisture goes up) to both Verdet and Landtrendr before applying convertToLossGain()
function convertToLossGain(
    ltStack,
    format = 'rawLandtrendr',
    lossMagThresh = -0.15,
    lossSlopeThresh = -0.1,
    gainMagThresh = 0.1,
    gainSlopeThresh = 0.1,
    slowLossDurationThresh = 3,
    chooseWhichLoss = 'largest',
    chooseWhichGain = 'largest',
    howManyToPull = 2
  ) {
    if (format == 'rawLandTrendr') {
      ltStack = simpleRawLTToVertices(ltStack);
    }
    if (format == 'rawLandTrendr' || format == 'arrayLandTrendr') {
      ltStack = ltStack.select([0]);
      print('Converting LandTrendr from array output to Gain & Loss');
      // Get the pair-wise difference and slopes of the years
      var left = ltStack.arraySlice(1, 0, -1);
      var right = ltStack.arraySlice(1, 1, null);
      var diff = left.subtract(right);
      var slopes = diff.arraySlice(0, 1, 2).divide(diff.arraySlice(0, 0, 1)).multiply(-1);
      var duration = diff.arraySlice(0, 0, 1).multiply(-1);
      var fittedMag = diff.arraySlice(0, 1, 2);
      // Set up array for sorting
      var forSorting = right.arraySlice(0, 0, 1).arrayCat(duration, 0).arrayCat(fittedMag, 0).arrayCat(slopes, 0);
    } else if (format == 'vertStack') {
      print('Converting LandTrendr OR Verdet from vertStack format to Gain & Loss');
      var baseMask = ltStack.select([0]).mask(); // Will fail on completely masked pixels. Have to work around and then remask later.
      ltStack = ltStack.unmask(255); // Set masked pixels to 255
      var yrs = ltStack.select('yrs.*').toArray();
      var yrMask = yrs.eq(-32768).or(yrs.eq(32767)).or(yrs.eq(0)).not();
      yrs = yrs.arrayMask(yrMask);
      var fit = ltStack.select('fit.*').toArray().arrayMask(yrMask);
      var both = yrs.arrayCat(fit, 1).matrixTranspose();
      var left = both.arraySlice(1, 0, -1);
      var right = both.arraySlice(1, 1, null);
      var diff = left.subtract(right);
      var fittedMag = diff.arraySlice(0, 1, 2);
      var duration = diff.arraySlice(0, 0, 1).multiply(-1);
      var slopes = fittedMag.divide(duration);
      var forSorting = right.arraySlice(0, 0, 1).arrayCat(duration, 0).arrayCat(fittedMag, 0).arrayCat(slopes, 0);
      forSorting = forSorting.updateMask(baseMask);
    }
  
    // Apply thresholds
    var magLossMask = forSorting.arraySlice(0, 2, 3).lte(lossMagThresh);
    var slopeLossMask = forSorting.arraySlice(0, 3, 4).lte(lossSlopeThresh);
    var lossMask = magLossMask.or(slopeLossMask);
    var magGainMask = forSorting.arraySlice(0, 2, 3).gte(gainMagThresh);
    var slopeGainMask = forSorting.arraySlice(0, 3, 4).gte(gainSlopeThresh);
    var gainMask = magGainMask.or(slopeGainMask);
  
    // Mask any segments that do not meet thresholds
    var forLossSorting = forSorting.arrayMask(lossMask);
    var forGainSorting = forSorting.arrayMask(gainMask);
  
    // Dictionaries for choosing the column and direction to multiply the column for sorting
    // Loss and gain are handled differently for sorting magnitude and slope (largest/smallest and steepest/mostgradual)
    var lossColumnDict = {
      'newest': [0, -1],
      'oldest': [0, 1],
      'largest': [2, 1],
      'smallest': [2, -1],
      'steepest': [3, 1],
      'mostGradual': [3, -1],
      'shortest': [1, 1],
      'longest': [1, -1],
    };
    var gainColumnDict = {
      'newest': [0, -1],
      'oldest': [0, 1],
      'largest': [2, -1],
      'smallest': [2, 1],
      'steepest': [3, -1],
      'mostGradual': [3, 1],
      'shortest': [1, 1],
      'longest': [1, -1],
    };
    // Pull the respective column and direction
    var lossSortValue = lossColumnDict[chooseWhichLoss];
    var gainSortValue = gainColumnDict[chooseWhichGain];
  
    // Pull the sort column and multiply it
    var lossSortBy = forLossSorting.arraySlice(0, lossSortValue[0], lossSortValue[0] + 1).multiply(lossSortValue[1]);
    var gainSortBy = forGainSorting.arraySlice(0, gainSortValue[0], gainSortValue[0] + 1).multiply(gainSortValue[1]);
  
    // Sort the loss and gain and slice off the first column
    var lossAfterForSorting = forLossSorting.arraySort(lossSortBy);
    var gainAfterForSorting = forGainSorting.arraySort(gainSortBy);
  
    // Convert array to image stack
    var lossStack = getLTStack(lossAfterForSorting, howManyToPull, ['loss_yr_', 'loss_dur_', 'loss_mag_', 'loss_slope_']);
    var gainStack = getLTStack(gainAfterForSorting, howManyToPull, ['gain_yr_', 'gain_dur_', 'gain_mag_', 'gain_slope_']);
  
    var lossGainDict = {
      'lossStack': lossStack,
      'gainStack': gainStack,
    };
  
    return lossGainDict;
  }
  
  // --------------------------------------------------------------------------
  // Linear Interpolation functions
  // --------------------------------------------------------------------------
  // Adapted from: https://code.earthengine.google.com/?accept_repo=users/kongdd/public
  // To work with multi-band images
  function replace_mask(img, newimg, nodata = 0) {
    var mask = img.mask();
  
    img = img.unmask(nodata);
    img = img.where(mask.not(), newimg);
  
    return img;
  }
  
  function addMillisecondsTimeBand(img) {
    var mask = img.mask().reduce(ee.Reducer.min());
    var time = img.metadata('system:time_start').rename('time').mask(mask);
    return img.addBands(time);
  }
  
  function linearInterp(imgcol, frame = 32, nodata = 0) {
    var bns = ee.Image(imgcol.first()).bandNames();
  
    imgcol = imgcol.map(addMillisecondsTimeBand);
  
    var maxDiff = ee.Filter.maxDifference(frame * (1000 * 60 * 60 * 24), 'time', null, 'time');
    var cond = { 'leftField': 'time', 'rightField': 'time' };
  
    var f1 = ee.Filter.And(maxDiff, ee.Filter.lessThanOrEquals(cond));
    var c1 = ee.Join.saveAll({ 'matchesKey': 'after', 'ordering': 'time', 'ascending': false }).apply(imgcol, imgcol, f1);
  
    var f2 = ee.Filter.And(maxDiff, ee.Filter.greaterThanOrEquals(cond));
    var c2 = ee.Join.saveAll({ 'matchesKey': 'before', 'ordering': 'time', 'ascending': true }).apply(c1, imgcol, f2);
  
    function interpolator(img) {
      img = ee.Image(img);
  
      var before = ee.ImageCollection.fromImages(ee.List(img.get('before'))).mosaic();
      var after = ee.ImageCollection.fromImages(ee.List(img.get('after'))).mosaic();
  
      img = img.set('before', null).set('after', null);
  
      before = replace_mask(before, after, nodata);
      after = replace_mask(after, before, nodata);
  
      var x1 = before.select('time').double();
      var x2 = after.select('time').double();
      var now = ee.Image.constant(img.date().millis()).double();
      var ratio = now.subtract(x1).divide(x2.subtract(x1));
  
      var before = before.select(bns);
      var after = after.select(bns);
  
      var interp = after.subtract(before).multiply(ratio).add(before);
  
      var qc = img.mask().not();
      interp = replace_mask(img, interp, nodata);
  
      return interp.copyProperties(img, img.propertyNames());
    }
  
    var interpolated = ee.ImageCollection(c2.map(function (img) {
      return interpolator(img);
    }));
  
    return interpolated;
  }
  
  // Function to do a single-band linear interpolation across time
  // Assumes the image has date properties stored under system:time_start
  // Will return a linearly interpolated date value where they were missing
  // Where there are only values on one side, it will cast out the mean date of year offset
  // for all years prior to or after actual data being available
  function new_interp_date(dateYr, dateCollection, max_window = 10, dummyImage = null, extrapolate = true) {
    var year = dateYr.date().get('year');
  
    if (dummyImage === null) {
      dummyImage = dateCollection.first();
    }
  
    var window_years = ee.List.sequence(1, max_window);
  
    function getWindow(window) {
      var yrLeft = year.subtract(window);
      var yrRight = year.add(window);
  
      var dateYrLeft = fillEmptyCollections(dateCollection.filter(ee.Filter.calendarRange(yrLeft, yrLeft, 'year')), dummyImage).first().rename(['left']).float();
      var yrLeft = ee.Image(yrLeft).updateMask(dateYrLeft.mask()).rename(['left_year']).int16();
  
      var dateYrRight = fillEmptyCollections(dateCollection.filter(ee.Filter.calendarRange(yrRight, yrRight, 'year')), dummyImage).first().rename(['right']).float();
      var yrRight = ee.Image(yrRight).updateMask(dateYrRight.mask()).rename(['right_year']).int16();
  
      return ee.Image.cat([dateYrLeft, yrLeft, dateYrRight, yrRight]);
    }
  
    var window_stack = ee.ImageCollection(window_years.map(getWindow));
  
    var window_first = window_stack.reduce(ee.Reducer.firstNonNull());
  
    var slope = window_first.select(['right_first']).subtract(window_first.select(['left_first'])).divide(window_first.select(['right_year_first']).subtract(window_first.select(['left_year_first'])));
  
    var interpolated = ee.Image(year).subtract(window_first.select(['left_year_first']));
    interpolated = interpolated.multiply(slope);
    interpolated = interpolated.add(window_first.select(['left_first']));
  
    var dateYrOut = dateYr.unmask(interpolated);
  
    if (extrapolate) {
      var extrapolate_left = window_stack.map(function (img) {
        return img.select(['right']).subtract(img.select(['right_year']));
      }).mean().add(year);
      var extrapolate_right = window_stack.map(function (img) {
        return img.select(['left']).subtract(img.select(['left_year']));
      }).mean().add(year);
      dateYrOut = ee.Image(dateYrOut).unmask(extrapolate_left);
      dateYrOut = ee.Image(dateYrOut).unmask(extrapolate_right);
    }
  
    return dateYrOut;
  }
  
  // Wrapper function to handle date interpolation for
  function new_interp_date_collection(dateCollection, max_window = 20, dummyImage = null, extrapolate = true) {
    dummyImage = dateCollection.first();
    var interpolated = dateCollection.map(function (dateImg) {
      return new_interp_date(dateImg, dateCollection, max_window, dummyImage, extrapolate);
    });
    return interpolated;
  }
  
  // Function to apply linear interpolation for Verdet
  function applyLinearInterp(composites, nYearsInterpolate) {
    composites = composites.select(['red', 'green', 'blue', 'nir', 'swir1', 'swir2']);
  
    var masks = composites.map(function (img) {
      return img.mask().reduce(ee.Reducer.min()).byte().copyProperties(img, img.propertyNames());
    }).select([0]);
    masks = masks.map(function (img) {
      return img.rename([ee.Date(img.get('system:time_start')).format('YYYY')]);
    });
    masks = masks.toBands();
  
    var origNames = masks.bandNames();
    var newNames = origNames.map(function (bandName) {
      return ee.String(bandName).replace('null', 'mask');
    });
    masks = masks.select(origNames, newNames).set('creationDate', datetime.format(datetime.now(), 'yyyyMMdd')).set('mask', true);
  
    composites = linearInterp(composites, 365 * nYearsInterpolate, -32768)
      .map(simpleAddIndices)
      .map(getTasseledCap)
      .map(simpleAddTCAngles);
  
    var outDict = {
      'composites': composites,
      'masks': masks,
    };
  
    return outDict;
  }
  

  // Function to predict a CCDC harmonic model at a given time
// The whichHarmonics options are [1,2,3] - denoting which harmonics to include
// Which bands is a list of the names of the bands to predict across
function simpleCCDCPrediction(img, timeBandName, whichHarmonics, whichBands) {
    // Unit of each harmonic (1 cycle)
    var omega = ee.Number(2.0).multiply(Math.PI);
  
    // Pull out the time band in the yyyy.ff format
    var tBand = img.select([timeBandName]);
  
    // Pull out the intercepts and slopes
    var intercepts = img.select(['.*_INTP']);
    var slopes = img.select(['.*_SLP']).multiply(tBand);
  
    // Set up the omega for each harmonic for the given time band
    var tOmega = ee.Image(whichHarmonics).multiply(omega).multiply(tBand);
    var cosHarm = tOmega.cos();
    var sinHarm = tOmega.sin();
  
    // Set up which harmonics to select
    var harmSelect = ee.List(whichHarmonics).map(function (n) {
      return ee.String('.*').cat(ee.Number(n).format());
    });
  
    // Select the harmonics specified
    var sins = img.select(['.*_SIN.*']);
    sins = sins.select(harmSelect);
    var coss = img.select(['.*_COS.*']);
    coss = coss.select(harmSelect);
  
    // Set up final output band names
    var outBns = ee.List(whichBands).map(function (bn) {
      return ee.String(bn).cat('_CCDC_fitted');
    });
  
    // Iterate across each band and predict value
    function predHelper(bn) {
      bn = ee.String(bn);
      return ee.Image([
        intercepts.select(bn.cat('_.*')),
        slopes.select(bn.cat('_.*')),
        sins.select(bn.cat('_.*')).multiply(sinHarm),
        coss.select(bn.cat('_.*')).multiply(cosHarm),
      ]).reduce(ee.Reducer.sum());
    }
    var predicted = ee.ImageCollection(whichBands.map(predHelper)).toBands().rename(outBns);
    return img.addBands(predicted);
  }
  
  // Wrapper to predict CCDC values from a collection containing a time image and ccdc coeffs
  // It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
  // The whichHarmonics options are [1,2,3] - denoting which harmonics to include
  function simpleCCDCPredictionWrapper(c, timeBandName, whichHarmonics) {
    var whichBands = ee.Image(c.first())
      .select(['.*_INTP'])
      .bandNames()
      .map(function (bn) {
        return ee.String(bn).split('_').get(0);
      });
    whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys().getInfo();
    var out = c.map(function (img) {
      return simpleCCDCPrediction(img, timeBandName, whichHarmonics, whichBands);
    });
    return out;
  }
  
  // Function to get the coeffs corresponding to a given date on a pixel-wise basis
  // The raw CCDC image is expected
  // It is also assumed that the time format is yyyy.ff where the .ff is the proportion of the year
  function getCCDCSegCoeffs(timeImg, ccdcImg, fillGaps) {
    var coeffKeys = ['.*_coefs'];
    var tStartKeys = ['tStart'];
    var tEndKeys = ['tEnd'];
    var tBreakKeys = ['tBreak'];
  
    // Get coeffs and find how many bands have coeffs
    var coeffs = ccdcImg.select(coeffKeys);
    var bns = coeffs.bandNames();
    var nBns = bns.length();
    var harmonicTag = ee.List(['INTP', 'SLP', 'COS1', 'SIN1', 'COS2', 'SIN2', 'COS3', 'SIN3']);
  
    // Get coeffs, start and end times
    coeffs = coeffs.toArray(2);
    var tStarts = ccdcImg.select(tStartKeys);
    var tEnds = ccdcImg.select(tEndKeys);
    var tBreaks = ccdcImg.select(tBreakKeys);
  
    // If filling to the tBreak, use this
    tStarts = ee.Image(ee.Algorithms.If(fillGaps, tStarts.arraySlice(0, 0, 1).arrayCat(tBreaks.arraySlice(0, 0, -1), 0), tStarts));
    tEnds = ee.Image(ee.Algorithms.If(fillGaps, tBreaks.arraySlice(0, 0, -1).arrayCat(tEnds.arraySlice(0, -1, None), 0), tEnds));
  
    // Set up a mask for segments that the time band intersects
    var tMask = tStarts.lt(timeImg).And(tEnds.gte(timeImg)).arrayRepeat(1, 1).arrayRepeat(2, 1);
    coeffs = coeffs.arrayMask(tMask).arrayProject([2, 1]).arrayTranspose(1, 0).arrayFlatten([bns, harmonicTag]);
  
    // If time band doesn't intersect any segments, set it to null
    coeffs = coeffs.updateMask(coeffs.reduce(ee.Reducer.max()).neq(0));
  
    return timeImg.addBands(coeffs);
  }

  // Functions to get yearly ccdc coefficients.
// Get CCDC coefficients for each year.
// yearStartMonth and yearStartDay are the date that you want the CCDC "year" to start at. This is mostly important for Annualized CCDC.
// For CONUS & COASTAL AK LCMS, this is Sept. 1. So any change that occurs before Sept 1 in that year will be counted in that year, and Sept. 1 and after
// will be counted in the following year.
// 10/21 LSC Added Capability to use pixel-wise Composite Dates instead of set dates.
// If used, set annualizeWithCompositeDates to True and provide imported/prepped composite image collection with 'year' and 'julianDay' bands
// Optionally, if there are holes in the composite dates, they can be interpolated using linear interpolation across time
function annualizeCCDC(
    ccdcImg,
    startYear,
    endYear,
    startJulian,
    endJulian,
    tEndExtrapolationPeriod,
    yearStartMonth = 9,
    yearStartDay = 1,
    annualizeWithCompositeDates = false,
    compositeCollection = null,
    interpolateCompositeDates = true
  ) {
    // Create image collection of images with the proper time stamp as well as a 'year' band with the year fraction.
    var timeImgs;
    if (annualizeWithCompositeDates && compositeCollection != null) {
      timeImgs = getTimeImageCollectionFromComposites(compositeCollection, startYear, endYear, interpolateCompositeDates);
    } else {
      timeImgs = getTimeImageCollection(startYear, endYear, startJulian, endJulian, 1, yearStartMonth, yearStartDay);
    }
  
    // If selected, add a constant amount of time to last end segment to make sure the last year is annualized correctly.
    // tEndExtrapolationPeriod should be a fraction of a year.
    var finalTEnd = ccdcImg.select('tEnd').arraySlice(0, -1, null).rename('tEnd').arrayGet(0).add(tEndExtrapolationPeriod).toArray(0);
    var tEnds = ccdcImg.select('tEnd');
    tEnds = tEnds.arraySlice(0, 0, -1).arrayCat(finalTEnd, 0).rename('tEnd');
    ccdcImg = ccdcImg.addBands(tEnds, null, true);
  
    // Loop through time image collection and grab the correct CCDC coefficients
    var annualSegCoeffs = timeImgs.map(function (img) {
      return getCCDCSegCoeffs(img, ccdcImg, true);
    });
    return annualSegCoeffs;
  }
  
  // Using annualized time series, get fitted values and slopes from fitted values.
  function getFitSlopeCCDC(annualSegCoeffs, startYear, endYear) {
    // Predict across each time image
    var whichBands = ee.Image(annualSegCoeffs.first())
      .select(['.*_INTP'])
      .bandNames()
      .map(function (bn) {
        return ee.String(bn).split('_').get(0);
      });
    whichBands = ee.Dictionary(whichBands.reduce(ee.Reducer.frequencyHistogram())).keys();
    var fitted = annualSegCoeffs.map(function (img) {
      return simpleCCDCPredictionAnnualized(img, 'year', whichBands);
    });
  
    // Get back-casted slope using the fitted values
    var diff = ee.ImageCollection(ee.List.sequence(ee.Number(startYear).add(ee.Number(1)), endYear).map(function (rightYear) {
      return yearlySlope(rightYear, fitted);
    }));
  
    // Rename bands
    var bandNames = diff.first().bandNames();
    var newBandNames = bandNames.map(function (name) {
      return ee.String(name).replace('coefs', 'CCDC');
    });
    diff = diff.select(bandNames, newBandNames);
  
    return diff;
  }
  
  function yearlySlope(rightYear, fitted) {
    var leftYear = ee.Number(rightYear).subtract(1);
    var rightFitted = ee.Image(fitted.filter(ee.Filter.calendarRange(rightYear, rightYear, 'year')).first());
    var leftFitted = ee.Image(fitted.filter(ee.Filter.calendarRange(leftYear, leftYear, 'year')).first());
    var slopeNames = rightFitted.select(['.*_fitted']).bandNames().map(function (name) {
      return ee.String(ee.String(name).split('_fitted').get(0)).cat(ee.String('_fitSlope'));
    });
    var slope = rightFitted.select(['.*_fitted']).subtract(leftFitted.select(['.*_fitted'])).rename(slopeNames);
    return rightFitted.addBands(slope);
  }
  
  // This function is ALMOST the same as simpleCCDCPrediction(), except that you don't use the harmonic coefficients, just the slope and intercept.
  // This is necessary if using a pixel-wise composite date method instead of one consistent date for annualization.
  function simpleCCDCPredictionAnnualized(img, timeBandName, whichBands) {
    // Pull out the time band in the yyyy.ff format
    var tBand = img.select([timeBandName]);
  
    // Pull out the intercepts and slopes
    var intercepts = img.select(['.*_INTP']);
    var slopes = img.select(['.*_SLP']).multiply(tBand);
  
    // Set up final output band names
    var outBns = whichBands.map(function (bn) {
      return ee.String(bn).cat('_CCDC_fitted');
    });
  
    // Iterate across each band and predict value
    var predicted = ee.ImageCollection(whichBands.map(function (bn) {
      return ee.Image([intercepts.select(ee.String(bn).cat('_.*')), slopes.select(ee.String(bn).cat('_.*'))])
        .reduce(ee.Reducer.sum());
    })).toBands().rename(outBns);
    return img.addBands(predicted);
  }
  
  // Wrapper function for predicting CCDC across a set of time images
  function predictCCDC(ccdcImg, timeImgs, fillGaps, whichHarmonics) {
    var timeBandName = ee.Image(timeImgs.first()).select([0]).bandNames().get(0);
    // Add the segment-appropriate coefficients to each time image
    timeImgs = timeImgs.map(function (img) {
      return getCCDCSegCoeffs(img, ccdcImg, fillGaps);
    });
  
    // Predict across each time image
    return simpleCCDCPredictionWrapper(timeImgs, timeBandName, whichHarmonics);
  }
  
  // Function for getting a set of time images
  // This is generally used for methods such as CCDC
  // yearStartMonth and yearStartDay are the date that you want the CCDC "year" to start at. This is mostly important for Annualized CCDC.
  function getTimeImageCollection(startYear, endYear, startJulian = 1, endJulian = 365, step = 0.1, yearStartMonth = 1, yearStartDay = 1) {
    function getYrImage(n) {
      n = ee.Number(n);
      var img = ee.Image(n).float().rename(['year']);
      var y = n.int16();
      var fraction = n.subtract(y);
      var d = ee.Date.fromYMD(y.subtract(ee.Number(1)), 12, 31).advance(fraction, 'year').millis();
      return img.set('system:time_start', d);
    }
    var monthDayFraction = ee.Number.parse(ee.Date.fromYMD(startYear, yearStartMonth, yearStartDay).format('DDD')).divide(365);
    var yearImages = ee.ImageCollection(ee.List.sequence(ee.Number(startYear).add(monthDayFraction), ee.Number(endYear).add(monthDayFraction), step).map(getYrImage));
    return yearImages.filter(ee.Filter.calendarRange(startYear, endYear, 'year')).filter(ee.Filter.calendarRange(startJulian, endJulian));
  }
  
  // This creates an image collection in the same format as getTimeImageCollection(), but gets the pixel-wise dates from a composite collection
  // Composite collection should be an imported and prepped image collection with 'julianDay' and 'year' bands
  // def getTimeImageCollectionFromComposites(startJulian, endJulian, compositeCollection): 
  //   dates = compositeCollection.map(lambda img:img.select(['year']).add(img.select(['julianDay']).divide(365)).float().copyProperties(img,['system:time_start']))
  //   nYears = dates.size().getInfo()
  //   interpolated = linearInterp(dates, 365*nYears, -32768)
  //   return interpolated
  function getTimeImageCollectionFromComposites(compositeCollection, startYear = null, endYear = null, interpolate = true, useNewInterpMethod = false) {
    compositeCollection = compositeCollection.sort('system:time_start');
    if (startYear == null) {
      startYear = compositeCollection.first().date().get('year');
      print('Found start year: {}'.format(startYear.getInfo()));
    }
    if (endYear == null) {
      endYear = compositeCollection.sort('system:time_start', false).first().date().get('year');
      print('Found end year: {}'.format(endYear.getInfo()));
    }
  
    var dates = compositeCollection.map(function (img) {
      return img.select(['year']).add(img.select(['julianDay']).divide(365)).float().copyProperties(img, ['system:time_start']);
    });
    var dummyImage = dates.first();
  
    var datesFilled = ee.ImageCollection(ee.List.sequence(startYear, endYear).map(function (yr) {
      return fillEmptyCollections(dates.filter(ee.Filter.calendarRange(yr, yr, 'year')), dummyImage).first().set('system:time_start', ee.Date.fromYMD(yr, 6, 1).millis());
    }));
  
    if (interpolate) {
      print('Interpolating composite time images');
      if (!useNewInterpMethod) {
        var nYears = datesFilled.size().getInfo();
        // print(nYears,endYear.getInfo()-startYear.getInfo())
        return linearInterp(datesFilled, 365 * nYears, -32768);
      } else {
        return new_interp_date_collection(datesFilled);
      }
    } else {
      return datesFilled;
    }
  }
  // Function for getting change years and magnitudes for a specified band from CCDC outputs
// Only change from the breaks is extracted
// As of now, if a segment has a high slope value, this method will not extract that
function ccdcChangeDetection(ccdcImg, bandName) {
    var magKeys = ['.*_magnitude'];
    var tBreakKeys = ['tBreak'];
    var changeProbKeys = ['changeProb'];
    var changeProbThresh = 1;
  
    // Pull out pieces from CCDC output
    var magnitudes = ccdcImg.select(magKeys);
    var breaks = ccdcImg.select(tBreakKeys);
  
    // Map.addLayer(breaks.arrayLength(0),{'min':1,'max':10});
    var changeProbs = ccdcImg.select(changeProbKeys);
    var changeMask = changeProbs.gte(changeProbThresh);
    magnitudes = magnitudes.select(bandName + '.*');
  
    // Sort by magnitude and years
    var breaksSortedByMag = breaks.arraySort(magnitudes);
    var magnitudesSortedByMag = magnitudes.arraySort();
    var changeMaskSortedByMag = changeMask.arraySort(magnitudes);
  
    var breaksSortedByYear = breaks.arraySort();
    var magnitudesSortedByYear = magnitudes.arraySort(breaks);
    var changeMaskSortedByYear = changeMask.arraySort(breaks);
  
    // Get the loss and gain years and magnitudes for each sorting method
    var highestMagLossYear = breaksSortedByMag.arraySlice(0, 0, 1).arrayFlatten([['loss_year']]);
    var highestMagLossMag = magnitudesSortedByMag.arraySlice(0, 0, 1).arrayFlatten([['loss_mag']]);
    var highestMagLossMask = changeMaskSortedByMag.arraySlice(0, 0, 1).arrayFlatten([['loss_mask']]);
  
    highestMagLossYear = highestMagLossYear.updateMask(highestMagLossMag.lt(0).And(highestMagLossMask));
    highestMagLossMag = highestMagLossMag.updateMask(highestMagLossMag.lt(0).And(highestMagLossMask));
  
    var highestMagGainYear = breaksSortedByMag.arraySlice(0, -1, null).arrayFlatten([['gain_year']]);
    var highestMagGainMag = magnitudesSortedByMag.arraySlice(0, -1, null).arrayFlatten([['gain_mag']]);
    var highestMagGainMask = changeMaskSortedByMag.arraySlice(0, -1, null).arrayFlatten([['gain_mask']]);
  
    highestMagGainYear = highestMagGainYear.updateMask(highestMagGainMag.gt(0).And(highestMagGainMask));
    highestMagGainMag = highestMagGainMag.updateMask(highestMagGainMag.gt(0).And(highestMagGainMask));
  
    var mostRecentLossYear = breaksSortedByYear.arrayMask(magnitudesSortedByYear.lt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['loss_year']]);
    var mostRecentLossMag = magnitudesSortedByYear.arrayMask(magnitudesSortedByYear.lt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['loss_mag']]);
    var mostRecentLossMask = changeMaskSortedByYear.arrayMask(magnitudesSortedByYear.lt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['loss_mask']]);
  
    mostRecentLossYear = mostRecentLossYear.updateMask(mostRecentLossMag.lt(0).And(mostRecentLossMask));
    mostRecentLossMag = mostRecentLossMag.updateMask(mostRecentLossMag.lt(0).And(mostRecentLossMask));
  
    var mostRecentGainYear = breaksSortedByYear.arrayMask(magnitudesSortedByYear.gt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['gain_year']]);
    var mostRecentGainMag = magnitudesSortedByYear.arrayMask(magnitudesSortedByYear.gt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['gain_mag']]);
    var mostRecentGainMask = changeMaskSortedByYear.arrayMask(magnitudesSortedByYear.gt(0)).arrayPad([1]).arraySlice(0, -1, null).arrayFlatten([['gain_mask']]);
  
    mostRecentGainYear = mostRecentGainYear.updateMask(mostRecentGainMag.gt(0).And(mostRecentGainMask));
    mostRecentGainMag = mostRecentGainMag.updateMask(mostRecentGainMag.gt(0).And(mostRecentGainMask));
  
    return {
      'mostRecent': {
        'loss': {
          'year': mostRecentLossYear,
          'mag': mostRecentLossMag
        },
        'gain': {
          'year': mostRecentGainYear,
          'mag': mostRecentGainMag
        }
      },
      'highestMag': {
        'loss': {
          'year': highestMagLossYear,
          'mag': highestMagLossMag
        },
        'gain': {
          'year': highestMagGainYear,
          'mag': highestMagGainMag
        }
      }
    };
  }
  