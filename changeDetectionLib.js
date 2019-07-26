//Module imports
var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');
///////////////////////////////////////////////////////////////////////////////
var lossYearPalette =  'ffffe5,fff7bc,fee391,fec44f,fe9929,ec7014,cc4c02';
var lossMagPalette = 'D00,F5DEB3';
var gainYearPalette =  '54A247,AFDEA8,80C476,308023,145B09';
var gainMagPalette = 'F5DEB3,006400';
var changeDurationPalette = 'BD1600,E2F400,0C2780';
exports.lossYearPalette = lossYearPalette;
exports.lossMagPalette = lossMagPalette;
exports.gainYearPalette = gainYearPalette;
exports.gainMagPalette = gainMagPalette;
exports.changeDurationPalette = changeDurationPalette;
//////////////////////////////////////////////////////////////////////////
// Function to compute R^2 (Coefficient of Determination) for a linear model.
// Written by Joshua Goldstein (joshuagoldstein@fs.fed.us) on 21-Sept-2016
// Adapted from code by Ian Housman and the following reference:
// (http://blog.minitab.com/blog/statistics-and-quality-data-analysis/
// r-squared-sometimes-a-square-is-just-a-square)
// Last update: 21-Sept-2016 by Joshua Goldstein

function getR2(collection,coefficients,dependent,independents) {
  // Calculate mean
  var meanImage = collection.select(dependent).mean();
  // For each image in original collection
  var squaredErrors = collection.map(function(image) {
    // Evalute predicted linear model
    var prediction = image.select(independents)
        .multiply(coefficients)
        .reduce('sum');
    var actual = image.select(dependent);
    // Find squared residual error, (actual-predict)^2
    // Find squared total error, (actual-mean)^2
    var diffPrediction = actual.subtract(prediction);
    var diffMean = actual.subtract(meanImage);
    var sqError = diffPrediction.multiply(diffPrediction)
        .rename('sqError');
    var sqTotal = diffMean.multiply(diffMean)
        .rename('sqTotal');
    // Add squared errors as new bands
    return image.addBands(sqError).addBands(sqTotal);
  });
  // Calculate sum of squared errors
  var ssError = squaredErrors.select('sqError').sum();
  var ssTotal = squaredErrors.select('sqTotal').sum();
  // R^2 = 1 - (ssError/ssTotal)
  var R2 = ee.Image(1).subtract(ssError.divide(ssTotal));
  return R2;
}

//////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////
function thresholdChange(changeCollection,changeThresh,changeDir){
  if(changeDir === undefined || changeDir === null){changeDir = 1}
  var bandNames = ee.Image(changeCollection.first()).bandNames();
  bandNames = bandNames.map(function(bn){return ee.String(bn).cat('_change')});
  var change = changeCollection.map(function(img){
    var yr = ee.Date(img.get('system:time_start')).get('year');
    var changeYr = img.multiply(changeDir).gt(changeThresh);
    var yrImage = img.where(img.mask(),yr);
    changeYr = yrImage.updateMask(changeYr).rename(bandNames).int16();
    return img.mask(ee.Image(1)).addBands(changeYr);
  });
  return change;
}
function thresholdSubtleChange(changeCollection,changeThreshLow,changeThreshHigh,changeDir){
  if(changeDir === undefined || changeDir === null){changeDir = 1}
  var bandNames = ee.Image(changeCollection.first()).bandNames();
  bandNames = bandNames.map(function(bn){return ee.String(bn).cat('_change')});
  var change = changeCollection.map(function(img){
    var yr = ee.Date(img.get('system:time_start')).get('year');
    var changeYr = img.multiply(changeDir).gt(changeThreshLow).and(img.multiply(changeDir).lt(changeThreshHigh));
    var yrImage = img.where(img.mask(),yr);
    changeYr = yrImage.updateMask(changeYr).rename(bandNames).int16();
    return img.mask(ee.Image(1)).addBands(changeYr);
  });
  return change;
}

function getExistingChangeData(changeThresh,showLayers){
  if(showLayers === undefined || showLayers === null){
    showLayers = true;
  }
  if(changeThresh === undefined || changeThresh === null){
    changeThresh = 50;
  }
  var startYear = 1985;
  var endYear = 2016;
  
  
  
  // var glriEnsemble = ee.Image('projects/glri-phase3/changeMaps/ensembleOutputs/NBR_NDVI_TCBGAngle_swir1_swir2_median_LT_Ensemble');
  
  
  
  
  
 
  // if(showLayers){
  // Map.addLayer(conusChange.select(['change']).max(),{'min':startYear,'max':endYear,'palette':'FF0,F00'},'CONUS LCMS Most Recent Year of Change',false);
  // Map.addLayer(conusChange.select(['probability']).max(),{'min':0,'max':50,'palette':'888,008'},'LCMSC',false);
  // }
  // var glri_lcms = glriEnsemble.updateMask(glriEnsemble.select([0])).select([1]);
  // glri_lcms = glri_lcms.updateMask(glri_lcms.gte(startYear).and(glri_lcms.lte(endYear)));
  // if(showLayers){
  // Map.addLayer(glri_lcms,{'min':startYear,'max':endYear,'palette':'FF0,F00'},'GLRI LCMS',false);
  // }
  
  
  
  var hansen = ee.Image('UMD/hansen/global_forest_change_2018_v1_6').select(['lossyear']).add(2000).int16();
  hansen = hansen.updateMask(hansen.neq(2000).and(hansen.gte(startYear)).and(hansen.lte(endYear)));
  if(showLayers){
  Map.addLayer(hansen,{'min':startYear,'max':endYear,'palette':'FF0,F00'},'Hansen Change Year',true);
  }
  // return conusChangeOut;
  return hansen
}

//########################################################################################################
//Landtrendr code taken from users/emaprlab/public
//########################################################################################################
//##### UNPACKING LT-GEE OUTPUT STRUCTURE FUNCTIONS ##### 
//########################################################################################################

// ----- FUNCTION TO EXTRACT VERTICES FROM LT RESULTS AND STACK BANDS -----
var getLTvertStack = function(LTresult,run_params) {
  var emptyArray = [];                              // make empty array to hold another array whose length will vary depending on maxSegments parameter    
  var vertLabels = [];                              // make empty array to hold band names whose length will vary depending on maxSegments parameter 
  var iString;                                      // initialize variable to hold vertex number
  for(var i=1;i<=run_params.maxSegments+1;i++){     // loop through the maximum number of vertices in segmentation and fill empty arrays
    iString = i.toString();                         // define vertex number as string 
    vertLabels.push("vert_"+iString);               // make a band name for given vertex
    emptyArray.push(-32768);                             // fill in emptyArray
  }
  
  var zeros = ee.Image(ee.Array([emptyArray,        // make an image to fill holes in result 'LandTrendr' array where vertices found is not equal to maxSegments parameter plus 1
                                 emptyArray,
                                 emptyArray]));
  
  var lbls = [['yrs_','src_','fit_'], vertLabels,]; // labels for 2 dimensions of the array that will be cast to each other in the final step of creating the vertice output 

  var vmask = LTresult.arraySlice(0,3,4);           // slices out the 4th row of a 4 row x N col (N = number of years in annual stack) matrix, which identifies vertices - contains only 0s and 1s, where 1 is a vertex (referring to spectral-temporal segmentation) year and 0 is not
  
  var ltVertStack = LTresult.arrayMask(vmask)       // uses the sliced out isVert row as a mask to only include vertice in this data - after this a pixel will only contain as many "bands" are there are vertices for that pixel - min of 2 to max of 7. 
                      .arraySlice(0, 0, 3)          // ...from the vertOnly data subset slice out the vert year row, raw spectral row, and fitted spectral row
                      .addBands(zeros)              // ...adds the 3 row x 7 col 'zeros' matrix as a band to the vertOnly array - this is an intermediate step to the goal of filling in the vertOnly data so that there are 7 vertice slots represented in the data - right now there is a mix of lengths from 2 to 7
                      .toArray(1)                   // ...concatenates the 3 row x 7 col 'zeros' matrix band to the vertOnly data so that there are at least 7 vertice slots represented - in most cases there are now > 7 slots filled but those will be truncated in the next step
                      .arraySlice(1, 0, run_params.maxSegments+1) // ...before this line runs the array has 3 rows and between 9 and 14 cols depending on how many vertices were found during segmentation for a given pixel. this step truncates the cols at 7 (the max verts allowed) so we are left with a 3 row X 7 col array
                      .arrayFlatten(lbls, '');      // ...this takes the 2-d array and makes it 1-d by stacking the unique sets of rows and cols into bands. there will be 7 bands (vertices) for vertYear, followed by 7 bands (vertices) for rawVert, followed by 7 bands (vertices) for fittedVert, according to the 'lbls' list

  return ltVertStack;                               // return the stack
};

//Adapted version for converting sorted array to image

function getLTStack(LTresult,maxVertices,bandNames) {
  var nBands = bandNames.length;
  var emptyArray = [];                              // make empty array to hold another array whose length will vary depending on maxSegments parameter    
  var vertLabels = [];                              // make empty array to hold band names whose length will vary depending on maxSegments parameter 
  var iString;                                      // initialize variable to hold vertex number
  for(var i=1;i<=maxVertices;i++){     // loop through the maximum number of vertices in segmentation and fill empty arrays
    iString = i.toString();                         // define vertex number as string 
    vertLabels.push(iString);               // make a band name for given vertex
    emptyArray.push(-32768);                             // fill in emptyArray
  }
  //Set up empty array list
  var emptyArrayList = [];
  ee.List.sequence(1,nBands).getInfo().map(function(i){emptyArrayList.push(emptyArray)});
  var zeros = ee.Image(ee.Array(emptyArrayList));        // make an image to fill holes in result 'LandTrendr' array where vertices found is not equal to maxSegments parameter plus 1
                               
  
  var lbls = [bandNames, vertLabels,]; // labels for 2 dimensions of the array that will be cast to each other in the final step of creating the vertice output 
  
          // slices out the 4th row of a 4 row x N col (N = number of years in annual stack) matrix, which identifies vertices - contains only 0s and 1s, where 1 is a vertex (referring to spectral-temporal segmentation) year and 0 is not
  
  var ltVertStack = LTresult       // uses the sliced out isVert row as a mask to only include vertice in this data - after this a pixel will only contain as many "bands" are there are vertices for that pixel - min of 2 to max of 7. 
                      .addBands(zeros)              // ...adds the 3 row x 7 col 'zeros' matrix as a band to the vertOnly array - this is an intermediate step to the goal of filling in the vertOnly data so that there are 7 vertice slots represented in the data - right now there is a mix of lengths from 2 to 7
                      .toArray(1)                   // ...concatenates the 3 row x 7 col 'zeros' matrix band to the vertOnly data so that there are at least 7 vertice slots represented - in most cases there are now > 7 slots filled but those will be truncated in the next step
                      .arraySlice(1, 0, maxVertices) // ...before this line runs the array has 3 rows and between 9 and 14 cols depending on how many vertices were found during segmentation for a given pixel. this step truncates the cols at 7 (the max verts allowed) so we are left with a 3 row X 7 col array
                      .arrayFlatten(lbls, '');      // ...this takes the 2-d array and makes it 1-d by stacking the unique sets of rows and cols into bands. there will be 7 bands (vertices) for vertYear, followed by 7 bands (vertices) for rawVert, followed by 7 bands (vertices) for fittedVert, according to the 'lbls' list
  
  return ltVertStack.updateMask(ltVertStack.neq(-32768));                               // return the stack
};




//########################################################################################################
//##### GREATEST DISTURBANCE EXTRACTION FUNCTIONS #####
//########################################################################################################

// ----- function to extract greatest disturbance based on spectral delta between vertices 
var extractDisturbance = function(lt, distDir, params, mmu) {
  // select only the vertices that represents a change
  var vertexMask = lt.arraySlice(0, 3, 4); // get the vertex - yes(1)/no(0) dimension
  var vertices = lt.arrayMask(vertexMask); // convert the 0's to masked
 

  // var numberOfVertices = vertexMask.arrayReduce(ee.Reducer.sum(),[1]).arrayProject([1]).arrayFlatten([['vertexCount']]);
  // var secondMask = numberOfVertices.gte(3);
  // var thirdMask = numberOfVertices.gte(4);
  // Map.addLayer(numberOfVertices,{min:2,max:4},'number of vertices',false)
  // construct segment start and end point years and index values
  var left = vertices.arraySlice(1, 0, -1);    // slice out the vertices as the start of segments
  var right = vertices.arraySlice(1, 1, null); // slice out the vertices as the end of segments
  var startYear = left.arraySlice(0, 0, 1);    // get year dimension of LT data from the segment start vertices
  var startVal = left.arraySlice(0, 2, 3);     // get spectral index dimension of LT data from the segment start vertices
  var endYear = right.arraySlice(0, 0, 1);     // get year dimension of LT data from the segment end vertices 
  var endVal = right.arraySlice(0, 2, 3);      // get spectral index dimension of LT data from the segment end vertices
  
  var dur = endYear.subtract(startYear);       // subtract the segment start year from the segment end year to calculate the duration of segments 
  var mag = endVal.subtract(startVal);         // substract the segment start index value from the segment end index value to calculate the delta of segments 

  
  // concatenate segment start year, delta, duration, and starting spectral index value to an array 
  var distImg = ee.Image.cat([startYear.add(1), mag, dur, startVal.multiply(-1)]).toArray(0); // make an image of segment attributes - multiply by the distDir parameter to re-orient the spectral index if it was flipped for segmentation - do it here so that the subtraction to calculate segment delta in the above line is consistent - add 1 to the detection year, because the vertex year is not the first year that change is detected, it is the following year
 
  // sort the segments in the disturbance attribute image delta by spectral index change delta  
  var distImgSorted = distImg.arraySort(mag.multiply(-1));    
  
  // slice out the first (greatest) delta
  var tempDistImg1 = distImgSorted.arraySlice(1, 0, 1).unmask(ee.Image(ee.Array([[0],[0],[0],[0]])));
  var tempDistImg2 = distImgSorted.arraySlice(1, 1, 2).unmask(ee.Image(ee.Array([[0],[0],[0],[0]])));
  var tempDistImg3 = distImgSorted.arraySlice(1, 2, 3).unmask(ee.Image(ee.Array([[0],[0],[0],[0]])));
  
 
  // make an image from the array of attributes for the greatest disturbance
  var finalDistImg1 = tempDistImg1.arrayProject([0]).arrayFlatten([['yod','mag','dur','preval']]);
  var finalDistImg2 = tempDistImg2.arrayProject([0]).arrayFlatten([['yod','mag','dur','preval']]);
  var finalDistImg3 = tempDistImg3.arrayProject([0]).arrayFlatten([['yod','mag','dur','preval']]);
  
  
  // filter out disturbances based on user settings
  function filterDisturbances(finalDistImg){
    // var threshold = ee.Image(finalDistImg.select(['dur']))                        // get the disturbance band out to apply duration dynamic disturbance magnitude threshold 
    //       .multiply((params.tree_loss20 - params.tree_loss1) / 19.0)  // ...
    //       .add(params.tree_loss1)                                     //    ...interpolate the magnitude threshold over years between a 1-year mag thresh and a 20-year mag thresh
    //       .lte(finalDistImg.select(['mag']))                          // ...is disturbance less then equal to the interpolated, duration dynamic disturbance magnitude threshold 
    //       .and(finalDistImg.select(['mag']).gt(0))                    // and is greater than 0  
    //       .and(finalDistImg.select(['preval']).gt(params.pre_val));
    var longTermDisturbance = finalDistImg.select(['dur']).gte(15);
    var longTermThreshold = finalDistImg.select(['mag']).gte(params.tree_loss20).and(longTermDisturbance);
    var threshold = finalDistImg.select(['mag']).gte(params.tree_loss1);

    return finalDistImg.updateMask(threshold.or(longTermThreshold)); 
  }
  finalDistImg1 = filterDisturbances(finalDistImg1);
  finalDistImg2 = filterDisturbances(finalDistImg2);
  finalDistImg3 = filterDisturbances(finalDistImg3);

  
  function applyMMU(finalDistImg){
      var mmuPatches = finalDistImg.select(['yod.*']).int16()          // patchify based on disturbances having the same year of detection
                            .connectedPixelCount(mmu, true) // count the number of pixel in a candidate patch
                            .gte(mmu);                      // are the the number of pixels per candidate patch greater than user-defined minimum mapping unit?
    return finalDistImg.updateMask(mmuPatches);     // mask the pixels/patches that are less than minimum mapping unit
    
    }
    // patchify the remaining disturbance pixels using a minimum mapping unit
  if(mmu > 1){
    print('Applying mmu:',mmu,'to LANDTRENDR heuristic outputs');
    
    finalDistImg1 = applyMMU(finalDistImg1);
    finalDistImg2 = applyMMU(finalDistImg2);
    finalDistImg3 = applyMMU(finalDistImg3);
    
  } 
  
  return finalDistImg1.addBands(finalDistImg2).addBands(finalDistImg3); // return the filtered greatest disturbance attribute image
};


//////////////////////////////////////////////////////////////////////////
//Helper to multiply image
function multBands(img,distDir,by){
    var out = img.multiply(ee.Image(distDir).multiply(by));
    out  = out.copyProperties(img,['system:time_start'])
              .copyProperties(img);
    return out;
  }
function addToImage(img,howMuch){
    var out = img.add(ee.Image(howMuch));
    out  = out.copyProperties(img,['system:time_start'])
              .copyProperties(img);
    return out;
  }

///////////////////////////////////////////////////////////////
//Function to convert an image array object to collection
function arrayToTimeSeries(tsArray,yearsArray,possibleYears,bandName){
    //Set up dummy image for handling null values
    var noDateValue = -32768;
    var dummyImage = ee.Image(noDateValue).toArray();
    
    //Ierate across years
    var tsC = possibleYears.map(function(yr){
      yr = ee.Number(yr);
      
      //Pull out given year
      var yrMask = yearsArray.eq(yr);
    
      //Mask array for that given year
      var masked = tsArray.arrayMask(yrMask);
      
      
      //Find null pixels
      var l = masked.arrayLength(0);
      
      //Fill null values and convert to regular image
      masked = masked.where(l.eq(0),dummyImage).arrayGet([-1]);
      
      //Remask nulls
      masked = masked.updateMask(masked.neq(noDateValue)).rename([bandName])      
        .set('system:time_start',ee.Date.fromYMD(yr,6,1).millis());
        
      return masked;
    
    
  });
  return ee.ImageCollection(tsC);
  }

//Function to wrap landtrendr processing
function landtrendrWrapper(processedComposites,startYear,endYear,indexName,distDir,run_params,distParams,mmu){
  // var startYear = 1984;//ee.Date(ee.Image(processedComposites.first()).get('system:time_start')).get('year').getInfo();
  // var endYear = 2017;//ee.Date(ee.Image(processedComposites.sort('system:time_start',false).first()).get('system:time_start')).get('year').getInfo();
  var noDataValue = 32768;
  if(distDir === 1){
    noDataValue = -noDataValue;
  }
  //----- RUN LANDTRENDR -----
  var ltCollection = processedComposites.select([indexName]).map(function(img){
     return ee.Image(multBands(img,distDir,1))//.unmask(noDataValue);
  });
  // Map.addLayer(ltCollection,{},'ltCollection',false);
  run_params.timeSeries = ltCollection;               // add LT collection to the segmentation run parameter object
  var lt = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params); // run LandTrendr spectral temporal segmentation algorithm
  
  //########################################################################################################
  //##### RUN THE GREATEST DISTURBANCE EXTRACT FUCTION #####
  //########################################################################################################
  
  //assemble the disturbance extraction parameters
  
  
  // run the dist extract function
  var distImg = extractDisturbance(lt.select('LandTrendr'), distDir, distParams,mmu);
  var distImgBandNames = distImg.bandNames();
  distImgBandNames = distImgBandNames.map(function(bn){return ee.String(indexName).cat('_').cat(bn)});
  distImg = distImg.rename(distImgBandNames);
 
  
  //########################################################################################################
  //##### DISTURBANCE MAP DISPLAY #####
  //########################################################################################################
  
  // ----- set visualization dictionaries -----
  
  // var yodVizParms = {
  //   min: startYear+1,
  //   max: endYear,
  //   palette: ['#9400D3', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000']
  // };
  
  // var magVizParms = {
  //   min: distParams.tree_loss1,
  //   max: 1000,
  //   palette: ['#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000']
  // };
  
  // var durVizParms = {
  //   min: 1,
  //   max: endYear-startYear,
  //   palette: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF']
  // };
  
  // var preValVizParms = {
  //   min: distParams.pre_val,
  //   max: 800,
  //   palette: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF']
  // };
  
  
  // ----- display the disturbance attribute maps ----- 
                                                  // clip the data to the geometry
  // Map.addLayer(distImg.select(['preval']), preValVizParms, 'LT-Pre-dist Value',false); // add pre-disturbacne spectral index value to map
  // Map.addLayer(distImg.select(['dur']), durVizParms, 'LT-Duration',false);             // add disturbance duration to map
  // Map.addLayer(distImg.select(['mag']), magVizParms, 'LT-Magnitude',false);            // add magnitude to map
  // Map.addLayer(distImg.select(['yod']), yodVizParms, 'LT-Year of Detection',false);    // add disturbance year of detection to map
  
  //Convert to collection
  var rawLT = lt.select([0]);
  var ltYear = rawLT.arraySlice(0,0,1).arrayProject([1]);
  var ltFitted = rawLT.arraySlice(0,2,3).arrayProject([1]);
  if(distDir === -1){
    ltFitted = ltFitted.multiply(-1);
  }
  
  var fittedCollection = arrayToTimeSeries(ltFitted,ltYear,ee.List.sequence(startYear,endYear),'LT_Fitted_'+indexName);
  

  //Convert to single image
  var vertStack = getLTvertStack(rawLT,run_params);
  return [lt,distImg,fittedCollection,vertStack];
  
}
//Other LANDTRENDR code//
//////////////////////////////////////////////
//Function to join raw time series with fitted time series from LANDTRENDR
//Takes the rawTs as an imageCollection, lt is the first band of the output from LANDTRENDR, and the distDir
//is the direction of change for a loss in vegeation for the chosen band/index
function getRawAndFittedLT(rawTs,lt,startYear,endYear,indexName,distDir){
  if(indexName === undefined || indexName === null){indexName = 'Band'}
  if(distDir === undefined || distDir === null){distDir = -1}
  
  //Pop off years and fitted values
  var ltYear = lt.arraySlice(0,0,1).arrayProject([1]);
  var ltFitted = lt.arraySlice(0,2,3).arrayProject([1]);
  
  //Flip fitted values if needed
  if(distDir == -1){ltFitted = ltFitted.multiply(-1)}
  
  //Convert array to an imageCollection
  var fittedCollection = arrayToTimeSeries(ltFitted,ltYear,ee.List.sequence(startYear,endYear),'LT_Fitted_'+indexName);
  
  //Join raw time series with fitted
  var joinedTS = getImagesLib.joinCollections(rawTs,fittedCollection);
  
  return joinedTS;
  

}
//////////////////////////////////////////////////////////////////////////////////
//Function for running LT, thresholding the segments for both loss and gain, sort them, and convert them to an image stack
// July 2019 LSC: replaced some parts of workflow with functions in changeDetectionLib
function simpleLANDTRENDR(ts,startYear,endYear,indexName, run_params,lossMagThresh,lossSlopeThresh,gainMagThresh,gainSlopeThresh,slowLossDurationThresh,chooseWhichLoss,chooseWhichGain,addToMap,howManyToPull){
  
  if(indexName === undefined || indexName === null){indexName = 'NBR'}
  if(run_params === undefined || run_params === null){
    run_params = {'maxSegments':6,
      'spikeThreshold':         0.9,
      'vertexCountOvershoot':   3,
      'preventOneYearRecovery': true,
      'recoveryThreshold':      0.25,
      'pvalThreshold':          0.05,
      'bestModelProportion':    0.75,
      'minObservationsNeeded':  6
    };
  }
  if(lossMagThresh === undefined || lossMagThresh === null){lossMagThresh =-0.15}
  if(lossSlopeThresh === undefined || lossSlopeThresh === null){lossSlopeThresh =-0.1}
  if(gainMagThresh === undefined || gainMagThresh === null){gainMagThresh =0.1}
  if(gainSlopeThresh === undefined || gainSlopeThresh === null){gainSlopeThresh =0.1}
  if(slowLossDurationThresh === undefined || slowLossDurationThresh === null){slowLossDurationThresh =3}
  if(chooseWhichLoss === undefined || chooseWhichLoss === null){chooseWhichLoss ='largest'}
  if(chooseWhichGain === undefined || chooseWhichGain === null){chooseWhichGain ='largest'}
  if(addToMap === undefined || addToMap === null){addToMap =true}
  if(howManyToPull === undefined || howManyToPull === null){howManyToPull =2}
  
  var prepDict = prepTimeSeriesForLandTrendr(ts, indexName, run_params)
  run_params = prepDict.run_params; // added composite time series prepped above
  var countMask = prepDict.runMask; // count mask for pixels without enough data
  var distDir = getImagesLib.changeDirDict[indexName];

  //Run LANDTRENDR
  var rawLt = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params);
  
  var lt = rawLt.select([0]);
  //Remask areas with insufficient data that were given dummy values
  lt = lt.updateMask(countMask);
  
  //Get joined raw and fitted LANDTRENDR for viz
  var joinedTS = getRawAndFittedLT(ts, lt, startYear, endYear, indexName, distDir);
  
  // Convert LandTrendr to Loss & Gain space
  var lossGainDict = convertToLossGain(lt, 'rawLandTrendr', lossMagThresh, lossSlopeThresh, gainMagThresh, gainSlopeThresh, 
                                        slowLossDurationThresh, chooseWhichLoss, chooseWhichGain, howManyToPull)
  var lossStack = lossGainDict.lossStack;
  var gainStack = lossGainDict.gainStack;

  //Convert to byte/int16 to save space
  var lossThematic = lossStack.select(['.*_yr_.*']).int16().addBands(lossStack.select(['.*_dur_.*']).byte());
  var lossContinuous = lossStack.select(['.*_mag_.*','.*_slope_.*']).multiply(10000).int16();
  lossStack = lossThematic.addBands(lossContinuous);

  var gainThematic = gainStack.select(['.*_yr_.*']).int16().addBands(gainStack.select(['.*_dur_.*']).byte());
  var gainContinuous = gainStack.select(['.*_mag_.*','.*_slope_.*']).multiply(10000).int16();
  gainStack = gainThematic.addBands(gainContinuous);
  
  if(addToMap){
    //Set up viz params
    var vizParamsLossYear = {'min':startYear,'max':endYear,'palette':lossYearPalette};
    var vizParamsLossMag = {'min':-0.8*10000 ,'max':lossMagThresh*10000,'palette':lossMagPalette};
    
    var vizParamsGainYear = {'min':startYear,'max':endYear,'palette':gainYearPalette};
    var vizParamsGainMag = {'min':gainMagThresh*10000,'max':0.8*10000,'palette':gainMagPalette};
    
    var vizParamsDuration = {'min':1,'max':5,'palette':changeDurationPalette};
  
    Map.addLayer(lt,{},'Raw LT',false);
    Map.addLayer(joinedTS,{},'Time Series',false);
  
    ee.List.sequence(1,howManyToPull).getInfo().map(function(i){
     
      var lossStackI = lossStack.select(['.*_'+i.toString()]);
      var gainStackI = gainStack.select(['.*_'+i.toString()]);
      
      Map.addLayer(lossStackI.select(['loss_yr.*']),vizParamsLossYear,i.toString()+' '+indexName +' Loss Year',false);
      Map.addLayer(lossStackI.select(['loss_mag.*']),vizParamsLossMag,i.toString()+' '+indexName +' Loss Magnitude',false);
      Map.addLayer(lossStackI.select(['loss_dur.*']),vizParamsDuration,i.toString()+' '+indexName +' Loss Duration',false);
      
      Map.addLayer(gainStackI.select(['gain_yr.*']),vizParamsGainYear,i.toString()+' '+indexName +' Gain Year',false);
      Map.addLayer(gainStackI.select(['gain_mag.*']),vizParamsGainMag,i.toString()+' '+indexName +' Gain Magnitude',false);
      Map.addLayer(gainStackI.select(['gain_dur.*']),vizParamsDuration,i.toString()+' '+indexName +' Gain Duration',false);
    });
  }
  var outStack = lossStack.addBands(gainStack);
  
  //Add indexName to bandnames
  var bns = outStack.bandNames();
  var outBns = bns.map(function(bn){return ee.String(indexName).cat('_LT_').cat(bn)});
  outStack = outStack.select(bns,outBns);
  
  return [rawLt,outStack];
}



//////////////////////////////////////////////////////////////////////////////////////////
// Function to prep data following our workflows. Will have to run Landtrendr and convert to stack after.
function prepTimeSeriesForLandTrendr(ts,indexName, run_params){
  var maxSegments = ee.Number(run_params.maxSegments);
  //var startYear = ee.Date(ts.first().get('system:time_start')).get('year');
  //var endYear = ee.Date(ts.sort('system:time_start',false).first().get('system:time_start')).get('year');

   //Get single band time series and set its direction so that a loss in veg is going up
  ts = ts.select([indexName]);
  var distDir = getImagesLib.changeDirDict[indexName];
  var tsT = ts.map(function(img){return multBands(img, 1, distDir)});
  
  //Find areas with insufficient data to run LANDTRENDR
  var countMask = tsT.count().unmask().gte(maxSegments.add(1));

  tsT = tsT.map(function(img){
    var m = img.mask();
    //Allow areas with insufficient data to be included, but then set to a dummy value for later masking
    m = m.or(countMask.not());
    img = img.mask(m);
    img = img.where(countMask.not(),-32768);
    return img});

  run_params.timeSeries = tsT;
  var runMask = countMask.rename('insufficientDataMask');
  var prepDict = {
    'run_params': run_params,
    'runMask':    runMask,
    'distDir':    distDir
  }
  
  return prepDict;  
}

// Function to output LandTrendr as Vertical Stack to take up less space
function LANDTRENDRVertStack(composites, indexName, run_params, startYear, endYear){
  var creationDate = ee.Date(Date.now()).format('YYYYMMdd');
  
  // Prep Time Series and put into run parameters
  var prepDict = prepTimeSeriesForLandTrendr(composites, indexName, run_params);
  run_params = prepDict.run_params;
  var countMask = prepDict.runMask;
  
  //Run LANDTRENDR
  var rawLt = ee.Algorithms.TemporalSegmentation.LandTrendr(run_params);
  
  // Convert to image stack
  var lt = rawLt.select([0]);
  var ltStack = ee.Image(getLTvertStack(lt,run_params)).updateMask(countMask);
  ltStack = ltStack.select('yrs.*').addBands(ltStack.select('fit.*'));
  var rmse = rawLt.select([1]).rename('rmse');    
  ltStack = ltStack.addBands(rmse); 
  
  // Undo distDir change done in prepTimeSeriesForLandTrendr()
  ltStack = applyDistDir_vertStack(ltStack, getImagesLib.changeDirDict[indexName], 'landtrendr')
  
  // Set Properties
  ltStack = ltStack.set({
    'startYear': startYear,
    'endYear': endYear,
    'band': indexName,
    'creationDate': creationDate,
    'maxSegments': run_params.maxSegments,
    'spikeThreshold': run_params.spikeThreshold,
    'vertexCountOvershoot': run_params.vertexCountOvershoot,
    'recoveryThreshold': run_params.recoveryThreshold,
    'pvalThreshold': run_params.pvalThreshold,
    'bestModelProportion': run_params.bestModelProportion,
    'minObservationsNeeded': run_params.minObservationsNeeded
  });

  return ee.Image(ltStack);
}


///////////////////////////////////////////////////////////////////////////////////////////
//Function for running LANDTRENDR and converting output to annual image collection
//with the fitted value, duration, magnitude, slope, and diff for the segment for each given year
function LANDTRENDRFitMagSlopeDiffCollection(ts, indexName, run_params){
  var startYear = ee.Date(ts.first().get('system:time_start')).get('year');
  var endYear = ee.Date(ts.sort('system:time_start',false).first().get('system:time_start')).get('year');
  
  // Run LandTrendr and convert to VertStack format
  var landtrendrOut = LANDTRENDRVertStack(ts, indexName, run_params, startYear, endYear);
  var ltStack = ee.Image(landtrendrOut.ltStack);
  
  // Convert to durFitMagSlope format
  var durFitMagSlope = convertStack_To_DurFitMagSlope(ltStack, 'LT');
  
  // Prep data for export
  durFitMagSlope = durFitMagSlope.map(function(img){return LT_VT_multBands(img, 10000)});
  durFitMagSlope = durFitMagSlope.map(function(img){return img.int16()});
  
  return durFitMagSlope;
} 

//----------------------------------------------------------------------------------------------------
//        Functions for both Verdet and Landtrendr
//----------------------------------------------------------------------------------------------------
// Helper to multiply new baselearner format values (LandTrendr & Verdet) by the appropriate amount when importing
// Duration is the only band that does not get multiplied by 0.0001 upon import.
// img = landtrendr or verdet image in fitMagDurSlope format
// multBy = 10000 (to prep for export) or 0.0001 (after import)
function LT_VT_multBands(img, multBy){
    var fitted = img.select('.*_fitted').multiply(multBy);
    var slope = img.select('.*_slope').multiply(multBy);
    var diff = img.select('.*_diff').multiply(multBy);
    var mag = img.select('.*_mag').multiply(multBy);
    var dur = img.select('.*_dur');
    var out = dur.addBands(fitted).addBands(slope).addBands(diff).addBands(mag);
    out  = out.copyProperties(img,['system:time_start'])
              .copyProperties(img);
    return ee.Image(out);
}

// Function to apply the Direction of  a decrease in photosynthetic vegetation to Landtrendr or Verdet vertStack format
// img = vertStack image for one band, e.g. "NBR"
// verdet_or_landtrendr = 'verdet' or 'landtrendr'
// distDir = from getImagesLib.changeDirDict
function applyDistDir_vertStack(stack, distDir, verdet_or_landtrendr){
  var years = stack.select('yrs.*');
  var fitted = stack.select('fit.*').multiply(distDir);
  var out = years.addBands(fitted);
  if(verdet_or_landtrendr == 'landtrendr'){
    var rmse = stack.select('rmse');
    out = out.addBands(rmse); 
  }
  out  = out.copyProperties(stack,['system:time_start'])
            .copyProperties(stack);
  return ee.Image(out);  
}

// Helper to multiply vertStack bands by the appropriate amount before exporting (multBy = 10000)
// or after importing (multBy = 0.0001)
// img = vertStack image for one band, e.g. "NBR"
// verdet_or_landtrendr = 'verdet' or 'landtrendr'
// multBy = 10000 or 0.0001
function LT_VT_vertStack_multBands(img, verdet_or_landtrendr, multBy){
    var years = img.select('yrs.*');
    var fitted = img.select('fit.*').multiply(multBy);
    var out = years.addBands(fitted);
    if(verdet_or_landtrendr == 'landtrendr'){
      var rmse = img.select('rmse').multiply(multBy);
      out = out.addBands(rmse); 
    }
    out  = out.copyProperties(img,['system:time_start'])
              .copyProperties(img);
    return ee.Image(out);
}

///////////////////////////////////////////////////////////////////////////////////////////
//Function to parse stack from LANDTRENDR or VERDET in the same format as that created by
// FitMagSlopeDiffCollection() functions. 
// July 2019 LSC: multiply(distDir) and multiply(10000) now take place outside of this function,
// but must be done BEFORE stack is passed to this function
function fitStackToCollection(stack, maxSegments, startYear, endYear){
  
  //Parse into annual fitted, duration, magnitude, and slope images
  //Iterate across each possible segment and find its fitted end value, duration, magnitude, and slope
  var yrDurMagSlope = ee.FeatureCollection(ee.List.sequence(1,maxSegments).map(function(i){
    i = ee.Number(i);

    //Set up slector for left and right side of segments
    var stringSelectLeft = ee.String('.*_').cat(i.byte().format());
    var stringSelectRight = ee.String('.*_').cat((i.add(1)).byte().format());
    
    //Get the left and right bands into separate images
    var stackLeft = stack.select([stringSelectLeft]);
    var stackRight = stack.select([stringSelectRight]);
    
    //Select off the year bands
    var segYearsLeft = stackLeft.select(['yrs_.*']).rename(['year_left']);
    var segYearsRight = stackRight.select(['yrs_.*']).rename(['year_right']);
    
    //Select off the fitted bands 
    var segFitLeft = stackLeft.select(['fit_.*']).rename(['fitted'])
    var segFitRight = stackRight.select(['fit_.*']).rename(['fitted'])
    
    //Compute duration, magnitude, and then slope
    var segDur = segYearsRight.subtract( segYearsLeft).rename(['dur']);
    var segMag = segFitRight.subtract( segFitLeft).rename(['mag']);
    var segSlope = segMag.divide(segDur).rename(['slope']);

    //Iterate across each year to see if the year is within a given segment
    //All annualizing is done from the right vertex backward
    //The first year of the time series is inserted manually with an if statement
    //Ex: If the first segment goes from 1984-1990 and the second from 1990-1997, the duration, magnitude,and slope
    //values from the first segment will be given to 1984-1990, while the second segment (and any subsequent segment)
    //the duration, magnitude, and slope values will be given from 1991-1997
    var annualizedCollection = ee.FeatureCollection(ee.List.sequence(startYear,endYear).map(function(yr){
      yr = ee.Number(yr);
      var yrImage = ee.Image(yr);

      //Find if the year is the first and include the left year if it is
      //Otherwise, do not include the left year
      yrImage = ee.Algorithms.If(yr.eq(startYear),
                  yrImage.updateMask(segYearsLeft.lte(yr).and(segYearsRight.gte(yr))),
                  yrImage.updateMask(segYearsLeft.lt(yr).and(segYearsRight.gte(yr))));
    
      yrImage = ee.Image(yrImage).rename(['yr']).int16();
      
      //Mask out the duration, magnitude, slope, and fit raster for the given year mask
      var yrDur = segDur.updateMask(yrImage);
      var yrMag = segMag.updateMask(yrImage);
      var yrSlope = segSlope.updateMask(yrImage);
      var yrFit = segFitRight.subtract(yrSlope.multiply(segYearsRight.subtract(yr))).updateMask(yrImage);
      
      //Get the difference from the 
      var diffFromLeft =yrFit.subtract(segFitLeft).updateMask(yrImage).rename(['diff']);
      // var relativeDiffFromLeft = diffFromLeft.divide(segMag.abs()).updateMask(yrImage).rename(['rel_yr_diff_left']).multiply(10000);
      
      // var diffFromRight =yrFit.subtract(segFitRight).updateMask(yrImage).rename(['yr_diff_right']);
      // var relativeDiffFromRight = diffFromRight.divide(segMag.abs()).updateMask(yrImage).rename(['rel_yr_diff_right']).multiply(10000)
      //Stack it up
      var out = yrDur.addBands(yrFit).addBands(yrMag).addBands(yrSlope)
                .addBands(diffFromLeft);
      out = out.set('system:time_start',ee.Date.fromYMD(yr,6,1).millis());
      return out;
    }));
    return annualizedCollection;
  }));
  
  //Convert to an image collection
  yrDurMagSlope = ee.ImageCollection(yrDurMagSlope.flatten());
  
  //Collapse each given year to the single segment with data
  var yrDurMagSlopeCleaned = ee.ImageCollection.fromImages(ee.List.sequence(startYear,endYear).map(function(yr){
    var yrDurMagSlopeT = yrDurMagSlope.filter(ee.Filter.calendarRange(yr,yr,'year')).mosaic();
    return yrDurMagSlopeT.set('system:time_start',ee.Date.fromYMD(yr,6,1).millis());
  }));
  return yrDurMagSlopeCleaned;
}

//////////////////////////////////////////////////////////////////////////////////////////////
// Wrapper for fitStacktoCollection
// VTorLT is the string that is put in the band names, 'LT' or 'VT'
function convertStack_To_DurFitMagSlope(stackCollection, VTorLT){
  stackCollection = ee.ImageCollection(stackCollection);
  var stackList = stackCollection.first().bandNames();
  if (stackList.getInfo().indexOf('rmse') >= 0){
    stackList = stackList.remove('rmse');
    stackCollection = stackCollection.select(stackList);
  }  

  // Prep parameters for fitStackToCollection
  var maxSegments = stackCollection.first().get('maxSegments');
  var startYear = stackCollection.first().get('startYear');
  var endYear = stackCollection.first().get('endYear');
  var indexList = ee.Dictionary(stackCollection.aggregate_histogram('band')).keys().getInfo();
  
  //Set up output collection to populate
  var outputCollection; var stack;
  //Iterate across indices
  indexList.map(function(indexName){  
    stack = stackCollection.filter(ee.Filter.eq('band',indexName)).first();
    
    //Convert to image collection
    var yrDurMagSlopeCleaned = fitStackToCollection(stack, 
      maxSegments, 
      startYear, 
      endYear
    ); 

    //Rename
    var bns = ee.Image(yrDurMagSlopeCleaned.first()).bandNames();
    var outBns = bns.map(function(bn){return ee.String(indexName).cat('_'+VTorLT+'_').cat(bn)});  
    yrDurMagSlopeCleaned = yrDurMagSlopeCleaned.select(bns,outBns);
    
    if(outputCollection === undefined){
      outputCollection = yrDurMagSlopeCleaned;
    }else{
      outputCollection = getImagesLib.joinCollections(outputCollection,yrDurMagSlopeCleaned,false);
    }  
  });
  return outputCollection;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// Function to convert from raw Landtrendr Output OR Landtrendr/VerdetVertStack output to Loss & Gain Space
// format = 'rawLandtrendr' (Landtrendr only) or 'vertStack' (Verdet or Landtrendr)
function convertToLossGain(ltStack, format, lossMagThresh, lossSlopeThresh, gainMagThresh, gainSlopeThresh, 
                            slowLossDurationThresh, chooseWhichLoss, chooseWhichGain, howManyToPull){
  if(lossMagThresh === undefined || lossMagThresh === null){lossMagThresh =-0.15}
  if(lossSlopeThresh === undefined || lossSlopeThresh === null){lossSlopeThresh =-0.1}
  if(gainMagThresh === undefined || gainMagThresh === null){gainMagThresh =0.1}
  if(gainSlopeThresh === undefined || gainSlopeThresh === null){gainSlopeThresh =0.1}
  if(slowLossDurationThresh === undefined || slowLossDurationThresh === null){slowLossDurationThresh =3}
  if(chooseWhichLoss === undefined || chooseWhichLoss === null){chooseWhichLoss ='largest'}
  if(chooseWhichGain === undefined || chooseWhichGain === null){chooseWhichGain ='largest'}
  if(howManyToPull === undefined || howManyToPull === null){howManyToPull =2}
  if(format === undefined || format === null){format = 'raw'}
  
  if (format == 'rawLandTrendr'){
    print('Converting LandTrendr from raw output to Gain & Loss')
    //Pop off vertices
    var vertices = ltStack.arraySlice(0,3,4);
    
    //Mask out any non-vertex values
    ltStack = ltStack.arrayMask(vertices);
    ltStack = ltStack.arraySlice(0,0,3);
    
    //Get the pair-wise difference and slopes of the years
    var left = ltStack.arraySlice(1,0,-1);
    var right = ltStack.arraySlice(1,1,null);
    var diff  = left.subtract(right);
    var slopes = diff.arraySlice(0,2,3).divide(diff.arraySlice(0,0,1)).multiply(-1);  
    var duration = diff.arraySlice(0,0,1).multiply(-1);
    var fittedMag = diff.arraySlice(0,2,3);
    //Set up array for sorting
    var forSorting = right.arraySlice(0,0,1).arrayCat(duration,0).arrayCat(fittedMag,0).arrayCat(slopes,0);
    
  }else if(format == 'vertStack'){
    print('Converting LandTrendr OR Verdet from vertStack format to Gain & Loss');
    
    var yrs = ltStack.select('yrs.*').toArray();
    Map.addLayer(yrs, {}, 'yrs', false);
    var yrMask = yrs.lte(1983).or(yrs.gte(2030)).not();
    yrs = yrs.arrayMask(yrMask);
    var fit = ltStack.select('fit.*').toArray().arrayMask(yrMask);
    Map.addLayer(fit, {}, 'fit', false);
    var both = yrs.arrayCat(fit,1).matrixTranspose();
    Map.addLayer(both, {}, 'both', false);
    var left = both.arraySlice(1,0,-1);
    var right = both.arraySlice(1,1,null);
    var diff = left.subtract(right);
    var fittedMag = diff.arraySlice(0,1,2);
    var duration = diff.arraySlice(0,0,1).multiply(-1);
    var slopes = fittedMag.divide(duration);
    var forSorting = right.arraySlice(0,0,1).arrayCat(duration,0).arrayCat(fittedMag,0).arrayCat(slopes,0);
    Map.addLayer(forSorting, {}, 'forSorting', false);
  }
  
  //Apply thresholds
  var magLossMask =  forSorting.arraySlice(0,2,3).lte(lossMagThresh);
  var slopeLossMask = forSorting.arraySlice(0,3,4).lte(lossSlopeThresh);
  var lossMask = magLossMask.or(slopeLossMask);  
  var magGainMask =  forSorting.arraySlice(0,2,3).gte(gainMagThresh);
  var slopeGainMask = forSorting.arraySlice(0,3,4).gte(gainSlopeThresh);
  var gainMask = magGainMask.or(slopeGainMask);
  
  //Mask any segments that do not meet thresholds
  var forLossSorting = forSorting.arrayMask(lossMask);
  var forGainSorting = forSorting.arrayMask(gainMask);
  
  //Dictionaries for choosing the column and direction to multiply the column for sorting
  //Loss and gain are handled differently for sorting magnitude and slope (largest/smallest and steepest/mostgradual)
  var lossColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[2,1],
                    'smallest':[2,-1],
                    'steepest':[3,1],
                    'mostGradual':[3,-1],
                    'shortest':[1,1],
                    'longest':[1,-1]
                  };
  var gainColumnDict = {'newest':[0,-1],
                    'oldest':[0,1],
                    'largest':[2,-1],
                    'smallest':[2,1],
                    'steepest':[3,-1],
                    'mostGradual':[3,1],
                    'shortest':[1,1],
                    'longest':[1,-1]
                  };
  //Pull the respective column and direction
  var lossSortValue = lossColumnDict[chooseWhichLoss];
  var gainSortValue = gainColumnDict[chooseWhichGain];

  //Pull the sort column and multiply it
  var lossSortBy = forLossSorting.arraySlice(0,lossSortValue[0],lossSortValue[0]+1).multiply(lossSortValue[1]);
  var gainSortBy = forGainSorting.arraySlice(0,gainSortValue[0],gainSortValue[0]+1).multiply(gainSortValue[1]);

  //Sort the loss and gain and slice off the first column
  var lossAfterForSorting = forLossSorting.arraySort(lossSortBy);
  var gainAfterForSorting = forGainSorting.arraySort(gainSortBy);

  //Convert array to image stck
  var lossStack = getLTStack(lossAfterForSorting,howManyToPull,['loss_yr_','loss_dur_','loss_mag_','loss_slope_']);
  var gainStack = getLTStack(gainAfterForSorting,howManyToPull,['gain_yr_','gain_dur_','gain_mag_','gain_slope_']);
  
  var lossGainDict = {  'lossStack': lossStack,
                        'gainStack': gainStack
  };
  
  return lossGainDict;
}
//----------------------------------------------------------------------------------------------------
//        Linear Interpolation Functions
//----------------------------------------------------------------------------------------------------
//Adapted from: https://code.earthengine.google.com/?accept_repo=users/kongdd/public
//To work with multi-band images
function replace_mask(img, newimg, nodata) {
    nodata   = nodata || 0;
    
    // var con = img.mask();
    // var res = img., NODATA
    var mask = img.mask();
    
    /** 
     * This solution lead to interpolation fails | 2018-07-12
     * Good vlaues can become NA.
     */
    // img = img.expression("img*mask + newimg*(!mask)", {
    //     img    : img.unmask(),  // default unmask value is zero
    //     newimg : newimg, 
    //     mask   : mask
    // });

    /** The only nsolution is unmask & updatemask */
    img = img.unmask(nodata);
    img = img.where(mask.not(), newimg);
    // 
    // error 2018-07-13 : mask already in newimg, so it's unnecessary to updateMask again
    // either test or image is masked, values will not be changed. So, newimg 
    // mask can transfer to img. 
    // 
    img = img.updateMask(img.neq(nodata));
    return img;
}

/** Interpolation not considering weights */
function addMillisecondsTimeBand(img) {
    /** make sure mask is consistent */
    var mask = img.mask().reduce(ee.Reducer.min());
    var time = img.metadata('system:time_start').rename("time").mask(mask);
    return img.addBands(time);
}

function linearInterp(imgcol, frame, nodata){
    frame  = frame  || 32;
    nodata = nodata || 0;
    
    var bns = ee.Image(imgcol.first()).bandNames();
    // var frame = 32;
    var time   = 'system:time_start';
    imgcol = imgcol.map(addMillisecondsTimeBand);
   
    // We'll look for all images up to 32 days away from the current image.
    var maxDiff = ee.Filter.maxDifference(frame * (1000*60*60*24), time, null, time);
    var cond    = {leftField:time, rightField:time};
    
    // Images after, sorted in descending order (so closest is last).
    //var f1 = maxDiff.and(ee.Filter.lessThanOrEquals(time, null, time))
    var f1 = ee.Filter.and(maxDiff, ee.Filter.lessThanOrEquals(cond));
    var c1 = ee.Join.saveAll({matchesKey:'after', ordering:time, ascending:false})
        .apply(imgcol, imgcol, f1);
    
    // Images before, sorted in ascending order (so closest is last).
    //var f2 = maxDiff.and(ee.Filter.greaterThanOrEquals(time, null, time))
    var f2 = ee.Filter.and(maxDiff, ee.Filter.greaterThanOrEquals(cond));
    var c2 = ee.Join.saveAll({matchesKey:'before', ordering:time, ascending:true})
        .apply(c1, imgcol, f2);
  
    // print(c2, 'c2');
    // var img = ee.Image(c2.toList(1, 15).get(0));
    // var mask   = img.select([0]).mask();
    // Map.addLayer(img , {}, 'img');
    // Map.addLayer(mask, {}, 'mask');
    
    var interpolated = ee.ImageCollection(c2.map(function(img) {
        img = ee.Image(img);
      
        var before = ee.ImageCollection.fromImages(ee.List(img.get('before'))).mosaic();
        var after  = ee.ImageCollection.fromImages(ee.List(img.get('after'))).mosaic();
        
        img = img.set('before', null).set('after', null);
        // constrain after or before no NA values, confirm linear Interp having result
        before = replace_mask(before, after, nodata);
        after  = replace_mask(after , before, nodata);
        
        // Compute the ratio between the image times.
        var x1 = before.select('time').double();
        var x2 = after.select('time').double();
        var now = ee.Image.constant(img.date().millis()).double();
        var ratio = now.subtract(x1).divide(x2.subtract(x1));  // this is zero anywhere x1 = x2
        // Compute the interpolated image.
        before = before.select(bns); //remove time band now;
        after  = after.select(bns);
        img    = img.select(bns); 
        
        var interp = after.subtract(before).multiply(ratio).add(before);
        // var mask   = img.select([0]).mask();
        
        var qc = img.mask().not();//.rename('qc');
        interp = replace_mask(img, interp, nodata);
        // Map.addLayer(interp, {}, 'interp');
        return interp.copyProperties(img, img.propertyNames());
    }));
    return interpolated;
}

///////////////////////////////////////////////////////////////////////////////
//        Function to apply linear interpolation for Verdet
function applyLinearInterp(composites, nYearsInterpolate){      
    
    // Start with just the basic bands
    composites = composites.select(['red','green','blue','nir','swir1','swir2']);
    
    // Find pixels/years with no data
    var masks = composites.map(function(img){return img.mask().reduce(ee.Reducer.min()).byte().copyProperties(img, img.propertyNames())}).select([0]);
    masks = masks.map(function(img){return img.rename([ee.Date(img.get('system:time_start')).format('YYYY')])});
    masks = masks.toBands();
    
    // rename bands to better names
    var origNames = masks.bandNames();
    var newNames = origNames.map(function(bandName){return ee.String(bandName).replace('null','mask')});
    masks = masks.select(origNames, newNames).set('creationDate',ee.Date(Date.now()).format('YYYYMMdd')).set('mask',true);
    
    //Perform linear interpolation        
    composites = linearInterp(composites, 365*nYearsInterpolate, -32768)
            .map(getImagesLib.simpleAddIndices)
            .map(getImagesLib.getTasseledCap)
            .map(getImagesLib.simpleAddTCAngles);
            
    var outDict = {'composites': composites,
                   'masks':      masks
    };
    return outDict;
}

//----------------------------------------------------------------------------------------------------
//        Verdet Functions
//----------------------------------------------------------------------------------------------------
// Functions to apply our scaling work arounds for Verdet
// Multiply by a predetermined factor beforehand and divide after
// Add 1 before and subtract 1 after
function applyVerdetScaling(ts, indexName, correctionFactor){
  var distDir = getImagesLib.changeDirDict[indexName];
  var tsT = ts.map(function(img){return ee.Image(multBands(img, 1, -distDir))}); // Apply change in direction first
  tsT = tsT.map(function(img){return ee.Image(addToImage(img, 1))});            // Then add 1 to image to get rid of any negatives
  tsT = tsT.map(function(img){return ee.Image(multBands(img, 1, correctionFactor))});  // Finally we can apply scaling.
  return tsT;
}

function undoVerdetScaling(fitted, indexName, correctionFactor){
  var distDir = getImagesLib.changeDirDict[indexName];
  fitted = ee.Image(multBands(fitted, 1, 1.0/correctionFactor)); // Undo scaling first.
  fitted = ee.Image(addToImage(fitted, -1)); // Undo getting rid of negatives
  fitted = ee.Image(multBands(fitted, 1, -distDir)); // Finally, undo change in direction
  return fitted;
}
 
//////////////////////////////////////////////////////////////////////////////////////////
// Function to prep data for Verdet. Will have to run Verdet and convert to stack after.
// This step applies the Verdet Scaling. The scaling is undone in VERDETVertStack().
function prepTimeSeriesForVerdet(ts, indexName, run_params, correctionFactor){
  //Get the start and end years
  var startYear = ee.Date(ts.first().get('system:time_start')).get('year');
  var endYear = ee.Date(ts.sort('system:time_start',false).first().get('system:time_start')).get('year');
  
  //Get single band time series and set its direction so that a loss in veg is going up
  ts = ts.select([indexName]);
  var tsT = applyVerdetScaling(ts, indexName, correctionFactor);
  
  //Find areas with insufficient data to run VERDET
  //VERDET currently requires all pixels have a value
  var countMask = tsT.count().unmask().gte(endYear.subtract(startYear).add(1));

  tsT = tsT.map(function(img){
    var m = img.mask();
    //Allow areas with insufficient data to be included, but then set to a dummy value for later masking
    m = m.or(countMask.not());
    img = img.mask(m);
    img = img.where(countMask.not(),-32768);
    return img});

  run_params.timeSeries = tsT;
  
  countMask = countMask.rename('insufficientDataMask');
  var prepDict = {
    'run_params': run_params,
    'countMask':  countMask,
    'startYear':  startYear,
    'endYear':    endYear
  }
  
  return prepDict;  
}
//////////////////////////////////////////////////////////////////////////////////////////
// This step undoes the Verdet Scaling that is implemented in prepTimeSeriesForVerdet()
function VERDETVertStack(ts, indexName, run_params, maxSegments, correctionFactor, doLinearInterp){
  if(!run_params){run_params = {tolerance:0.0001,
                  alpha: 0.1}}
  if(!maxSegments){maxSegments = 10}
  if(!correctionFactor){correctionFactor = 1}
  if(!doLinearInterp){doLinearInterp = false}
  
  // Get today's date for properties
  var creationDate = ee.Date(Date.now()).format('YYYYMMdd');
  
  // Extract composite time series and apply relevant masking & scaling
  var prepDict = prepTimeSeriesForVerdet(ts, indexName, run_params, correctionFactor)
  run_params = prepDict.run_params;
  var countMask = prepDict.countMask;
  var startYear = prepDict.startYear;
  var endYear = prepDict.endYear;
  
  //Run VERDET
  var verdet =   ee.Algorithms.TemporalSegmentation.Verdet(run_params).arraySlice(0,1,null);
  
  //Get all possible years
  var tsYearRight = ee.Image(ee.Array.cat([ee.Array([startYear]),ee.Array(ee.List.sequence(startYear.add(2),endYear))]));
  
  //Slice off right and left slopes
  var vLeft = verdet.arraySlice(0,1,-1);
  var vRight = verdet.arraySlice(0,2,null);
  
  //Find whether its a vertex (abs of curvature !== 0)
  var vCurvature = vLeft.subtract(vRight);
  var vVertices = vCurvature.abs().gte(0.00001);
  
  //Append vertices to the start and end of the time series al la LANDTRENDR
  vVertices = ee.Image(ee.Array([1])).arrayCat(vVertices,0).arrayCat(ee.Image(ee.Array([1])),0);

  //Mask out vertex years
  tsYearRight = tsYearRight.arrayMask(vVertices);
  
  //Find the duration of each segment
  var dur = tsYearRight.arraySlice(0,1,null).subtract(tsYearRight.arraySlice(0,0,-1));
  dur = ee.Image(ee.Array([0])).arrayCat(dur,0);
  
  
  //Mask out vertex slopes
  verdet = verdet.arrayMask(vVertices);
  
  //Get the magnitude of change for each segment
  var mag = verdet.multiply(dur);
  
  //Get the fitted values
  var fitted = ee.Image(run_params.timeSeries.limit(3).mean()).toArray().arrayCat(mag,0);
  fitted = fitted.arrayAccum(0, ee.Reducer.sum()).arraySlice(0,1,null);
  // Undo scaling of fitted values
  fitted = undoVerdetScaling(fitted, indexName, correctionFactor)
  
  //Get the bands needed to convert to image stack
  var forStack = tsYearRight.addBands(fitted).toArray(1);

  //Convert to stack and mask out any pixels that didn't have an observation in every image
  var stack = getLTStack(forStack.arrayTranspose(),maxSegments+1,['yrs_','fit_']).updateMask(countMask);
  
  // Set Properties
  stack = stack.set({
    'startYear': startYear,
    'endYear': endYear,
    'band': indexName,
    'creationDate': creationDate,
    'maxSegments': maxSegments,
    'correctionFactor': correctionFactor,
    'tolerance': run_params.tolerance,
    'alpha': run_params.alpha,
    'linearInterpApplied': doLinearInterp
  });
  
  return ee.Image(stack);
}

//Function for running VERDET and converting output to annual image collection
//with the fitted value, duration, magnitude, slope, and diff for the segment for each given year
// July 2019 LSC: multiply(distDir) and multiply(10000) now take place outside of this function 
// Linear Interpolation has to be done beforehand, and the masks collection passed in to this function
function VERDETFitMagSlopeDiffCollection(composites, indexName, run_params, maxSegments, correctionFactor, doLinearInterp, masks){
  if(doLinearInterp === null || doLinearInterp === undefined){doLinearInterp = false}
    
  // Run Verdet and convert to vertStack format
  var vtStack = VERDETVertStack(composites, indexName, run_params, maxSegments, correctionFactor, doLinearInterp)
  
  // Convert to durFitMagSlope format
  var durFitMagSlope = convertStack_To_DurFitMagSlope(vtStack, 'VT');

  // Prep data for export
  durFitMagSlope = durFitMagSlope.map(function(img){return LT_VT_multBands(img, 10000)});
  durFitMagSlope = durFitMagSlope.map(function(img){return img.int16()});
  
  // Update Mask from LinearInterp step
  if (doLinearInterp === true){
    durFitMagSlope = durFitMagSlope.map(function(img){
      var thisYear = ee.Date(img.get('system:time_start')).format('YYYY');
      var thisYear_maskName = ee.String('mask_').cat(thisYear);
      var thisMask = masks.select(thisYear_maskName);
      img = img.updateMask(thisMask);
      return img;
    });
  }
  
  return durFitMagSlope;
}
//////////////////////////////////////////////////////////////////////////
//Wrapper for applying VERDET slightly more simply
//Returns annual collection of verdet slope
function verdetAnnualSlope(tsIndex,indexName,startYear,endYear, alpha, tolerance){
  //Apply VERDET
  var verdet =   ee.Algorithms.TemporalSegmentation.Verdet({timeSeries: tsIndex,
                                        tolerance: tolerance, //default tolerance = 0.0001
                                        alpha: alpha}).arraySlice(0,1,null); //default alpha = 0.03333
  print('indexName',indexName);
  print('verdet',verdet);
  Map.addLayer(verdet,{},'verdet '+indexName);
  var tsYear = tsIndex.map(getImagesLib.addYearBand).select([1]).toArray().arraySlice(0,1,null).arrayProject([0]);
  
  //Find possible years to convert back to collection with
  var possibleYears = ee.List.sequence(startYear,endYear);
  print('possibleYears',possibleYears);
  print('tsYear',tsYear);
  var verdetC = arrayToTimeSeries(verdet,tsYear,possibleYears,'VERDET_fitted_'+indexName+'_slope');
  
  return verdetC;
}
//////////////////////////////////////////////////////////////////////////
//Wrapper for applying EWMACD slightly more simply
function getEWMA(lsIndex,trainingStartYear,trainingEndYear, harmonicCount){
  if(harmonicCount === null || harmonicCount === undefined){harmonicCount = 1}
  
  
  //Run EWMACD 
  var ewmacd = ee.Algorithms.TemporalSegmentation.Ewmacd({
    timeSeries: lsIndex, 
    vegetationThreshold: -1, 
    trainingStartYear: trainingStartYear, 
    trainingEndYear: trainingEndYear, 
    harmonicCount: harmonicCount
  });
  
  //Extract the ewmac values
  var ewma = ewmacd.select(['ewma']);
  return ewma;
}

//Function for converting EWMA values to annual collection
function annualizeEWMA(ewma,indexName,lsYear,startYear,endYear,annualReducer,remove2012){
  //Fill null parameters
  if(annualReducer === null || annualReducer === undefined){annualReducer = ee.Reducer.min()}
  if(remove2012 === null || remove2012 === undefined){remove2012 = true}
  
   //Find the years to annualize with
  var years = ee.List.sequence(startYear,endYear);
  
  //Find if 2012 needs replaced
  var replace2012 = ee.Number(ee.List([years.indexOf(2011),years.indexOf(2012),years.indexOf(2013)]).reduce(ee.Reducer.min())).neq(-1).getInfo();
  print('2012 needs replaced:',replace2012);
  
  
  //Remove 2012 if in list and set to true
  if(remove2012){years = years.removeAll([2012])}
  
  
  
  
  //Annualize
  //Set up dummy image for handling null values
  var noDateValue = -32768;
  var dummyImage = ee.Image(noDateValue).toArray();
    
  
  var annualEWMA = years.map(function(yr){
    yr = ee.Number(yr);
    var yrMask = lsYear.int16().eq(yr);
    var ewmacdYr = ewma.arrayMask(yrMask);
    var ewmacdYearYr = lsYear.arrayMask(yrMask);
    var ewmacdYrSorted = ewmacdYr.arraySort(ewmacdYr);
    var ewmacdYearYrSorted= ewmacdYearYr.arraySort(ewmacdYr);
    
    var yrData = ewmacdYrSorted.arrayCat(ewmacdYearYrSorted,1);
    var yrReduced = ewmacdYrSorted.arrayReduce(annualReducer,[0]);
   
    
    //Find null pixels
    var l = yrReduced.arrayLength(0);
    
    //Fill null values and convert to regular image
    yrReduced = yrReduced.where(l.eq(0),dummyImage).arrayGet([-1]);
    
    //Remask nulls
    yrReduced = yrReduced.updateMask(yrReduced.neq(noDateValue)).rename(['EWMA_'+indexName])      
      .set('system:time_start',ee.Date.fromYMD(yr,6,1).millis()).int16();
      
   
    return yrReduced;
  });
  annualEWMA = ee.ImageCollection.fromImages(annualEWMA);
  // print(remove2012,replace2012 ==1)
  if(remove2012 && replace2012 ==1){
    print('Replacing EWMA 2012 with mean of 2011 and 2013');
    var value2011 = ee.Image(annualEWMA.filter(ee.Filter.calendarRange(2011,2011,'year')).first());
    var value2013 = ee.Image(annualEWMA.filter(ee.Filter.calendarRange(2013,2013,'year')).first());
    var value2012 = value2013.add(value2011);
    value2012 = value2012.divide(2).rename(['EWMA_'+indexName])
    .set('system:time_start',ee.Date.fromYMD(2012,6,1).millis()).int16();
    
    annualEWMA = ee.ImageCollection(ee.FeatureCollection([annualEWMA,ee.ImageCollection([value2012])]).flatten()).sort('system:time_start');
  }
  return annualEWMA;
}
//
function runEWMACD(lsIndex,indexName,startYear,endYear,trainingStartYear,trainingEndYear, harmonicCount,annualReducer,remove2012){
  // var bandName = ee.String(ee.Image(lsIndex.first()).bandNames().get(0));
 
  var ewma = getEWMA(lsIndex,trainingStartYear,trainingEndYear, harmonicCount);
  
  //Get dates for later reference
  var lsYear = lsIndex.map(function(img){return getImagesLib.addDateBand(img,true)}).select(['year']).toArray().arrayProject([0]);

  
  var annualEWMA = annualizeEWMA(ewma,indexName,lsYear,startYear,endYear,annualReducer,remove2012);
  
  return [ewma.arrayCat(lsYear,1),annualEWMA];
}
///////////////////////////////////////////////////////////////////////////////////////////
//Function for converting CCDC output to annual image collection
//with the fitted value, duration, magnitude, and slope for the segment for each given year
// Input must be an image collection of CCDC tiles. The script will mosaic them to one image.
function CCDCFitMagSlopeCollection(ccdc_output, studyArea){
  // Grab important properties
  var startYear = ee.Number.parse(ccdc_output.first().get('startYear'));
  var endYear = ee.Number.parse(ccdc_output.first().get('endYear'));
  var maxSegments = ee.Number.parse(ccdc_output.first().get('nSegments'));
  var create_date = ccdc_output.first().get('create_date');
  
  // order of bands so we can pull them out by number frow raw CCDC output
  var bandNames = ee.List(['blue','green','red','nir','swir1','temp', 'swir2'])
  

  // Mosaic CCDC tiles and clip to study area.
  var ccdc_raw = ccdc_output.filterBounds(studyArea).mosaic().clip(studyArea);
  
  // Loop through the available segments
  var yrDurMagSlope = ee.FeatureCollection(ee.List.sequence(1,maxSegments).map(function(i){

    // Create a string to select relevant segments (e.g. 'S1')
    i = ee.Number(i);
    var stringSelect = ee.String('S').cat(i.byte().format())
    
    var segAll = ccdc_raw.select([stringSelect.cat('_.*')]);
    
    // Start and end times for the segment. Time format is days from 0000-01-01
    var segStartDay = segAll.select([stringSelect.cat('_tStart')]).rename(['startDay']);
    var segEndDay = segAll.select([stringSelect.cat('_tEnd')]).rename(['endDay']);
    var segBreakDay = segAll.select([stringSelect.cat('_tBreak')]).rename(['breakDay']);
    var effEndDay = segEndDay.max(segBreakDay).rename(['effEndDay']); // effective end day - latest time between tEnd and tBreak
    var segDur = effEndDay.subtract(segStartDay).divide(365).rename(['CCDC_dur']);
    
    // Grab the linear fit information for each band for this segment
    var segChangeProb = segAll.select([stringSelect.cat('_changeProb')]).rename(['changeProb']);    
    var segBands = ee.ImageCollection(ee.List.sequence(1,7).map(function(bandNum){
      bandNum = ee.Number(bandNum).int();
      var thisBand = ee.String(bandNames.get(bandNum.subtract(1)));
      var bandString = ee.String('_B').cat(bandNum.format());
      var segSlope = segAll.select([stringSelect.cat(bandString.cat('_coef_SLP'))]).rename(['slope']);
      var segIntp = segAll.select([stringSelect.cat(bandString.cat('_coef_INTP'))]).rename(['intercept']);
      var segMag = segSlope.multiply(segDur).rename(['mag']);
      return segSlope.addBands(segIntp).addBands(segMag).set('system:index',thisBand);
    })); 

    // Annualize
    var output = ee.FeatureCollection(ee.List.sequence(startYear,endYear).map(function(yr){
      yr = ee.Number(yr).int();

      // We have to assign a year based on whether the start and end times are before or after Julian day 250 of that year
      var cutoffday = ee.Date.parse('yyyy-D',yr.format().cat('-250')).difference(ee.Date.fromYMD(0,1,1),'day');
      var lastYrCutoffday = ee.Date.parse('yyyy-D',yr.subtract(1).format().cat('-250')).difference(ee.Date.fromYMD(0,1,1),'day');
      var yearDay = ee.Date.fromYMD(yr,6,1).difference(ee.Date.fromYMD(0,1,1),'day'); // this will be the date/year assigned to the output timeseries
      
      // Year mask to pull out appropriate values for each year
      var yrImage = ee.Image(yr).rename(['yr']).int16();
      var yrMask = segStartDay.lt(cutoffday).and(segEndDay.gte(lastYrCutoffday));

      // Loop through the values for each band and apply year mask
      var yrBands = ee.ImageCollection(segBands.map(function(band){
        var yrSlope = ee.Image(band.select(['.*slope'])).rename(['CCDC_slope']);
        var yrIntp = ee.Image(band.select(['.*intercept'])).rename(['CCDC_intercept']);
        var yrMag = ee.Image(band.select(['.*mag'])).rename(['CCDC_mag']);
        var yrFit = yrSlope.multiply(yearDay).add(yrIntp).rename(['CCDC_fitted']);
        var yrDur = segDur.rename(['CCDC_dur']);
        return yrSlope.addBands(yrIntp).addBands(yrMag).addBands(yrFit).addBands(yrDur)
                      .updateMask(yrMask);
      })).toBands();
      yrBands = ee.Image(multBands(yrBands,1,0.0001));

      var yrDur = segDur.updateMask(yrMask);
      var yrProb = segChangeProb.updateMask(yrMask);
      var yrSegStart = segStartDay.updateMask(yrMask);
      var yrSegEnd = segEndDay.updateMask(yrMask);
      var yrSegBreak = segBreakDay.updateMask(yrMask);
      var yrEffEnd = effEndDay.updateMask(yrMask);
      
      var out = yrBands//.addBands(yrDur).addBands(yrProb).addBands(yrSegStart)
                      //.addBands(yrSegEnd).addBands(yrSegBreak).addBands(yrEffEnd);
  
      return out.set('system:time_start', ee.Date.fromYMD(yr,6,1).millis()).set('year',yr);
    }));
    
    return output;
  }));
  
  yrDurMagSlope = ee.ImageCollection(yrDurMagSlope.flatten());
  var ccdc = ee.ImageCollection.fromImages(ee.List.sequence(startYear,endYear).map(function(yr){
    var yrDurMagSlopeT = yrDurMagSlope.filter(ee.Filter.calendarRange(yr,yr,'year')).mosaic();
    return yrDurMagSlopeT.set('system:time_start',ee.Date.fromYMD(yr,6,1).millis())
                         .set('create_date', create_date)
                         .set('startYear', startYear)
                         .set('endYear', endYear)
                         .set('nSegments', maxSegments);
  }));
  
  return ccdc;
} 


//////////////////////////////////////////////////////////////////////////
//Function to find the pairwise difference of a time series
//Assumes one image per year
function pairwiseSlope(c){
    c = c.sort('system:time_start');
    
    var bandNames = ee.Image(c.first()).bandNames();
    // bandNames = bandNames.map(function(bn){return ee.String(bn).cat('_slope')});
    
    var years = c.toList(10000).map(function(i){i = ee.Image(i);return ee.Date(i.get('system:time_start')).get('year')});
    
    var yearsLeft = years.slice(0,-1);
    var yearsRight = years.slice(1,null);
    var yearPairs = yearsLeft.zip(yearsRight);
    
    var slopeCollection = yearPairs.map(function(yp){
      yp = ee.List(yp);
      var yl = ee.Number(yp.get(0));
      var yr = ee.Number(yp.get(1));
      var yd = yr.subtract(yl);
      var l = ee.Image(c.filter(ee.Filter.calendarRange(yl,yl,'year')).first()).add(0.000001);
      var r = ee.Image(c.filter(ee.Filter.calendarRange(yr,yr,'year')).first());
      
      var slope = (r.subtract(l)).rename(bandNames);
      slope = slope.set('system:time_start',ee.Date.fromYMD(yr,6,1).millis());
      return slope;
    });
    return ee.ImageCollection.fromImages(slopeCollection);
  }

/////////////////////////////////////////////////////
//Function for converting collection into annual median collection
//Does not support date wrapping across the new year (e.g. Nov- April window is a no go)
function toAnnualMedian(images,startYear,endYear){
      var dummyImmage = ee.Image(images.first());
      var out = ee.List.sequence(startYear,endYear).map(function(yr){
        var imagesT = images.filter(ee.Filter.calendarRange(yr,yr,'year'));
        imagesT = getImagesLib.fillEmptyCollections(imagesT,dummyImmage);
        return imagesT.median().set('system:time_start',ee.Date.fromYMD(yr,6,1));
      });
      return ee.ImageCollection.fromImages(out);
    }
////////////////////////////////////////////////////
//Function for applying linear fit model
//Assumes the model has a intercept and slope band prefix to the bands in the model
//Assumes that the c (collection) has the raw bands in it
function predictModel(c,model,bandNames){
  
  //Parse model
  var intercepts = model.select('intercept_.*');
  var slopes = model.select('slope_.*');
  
  //Find band names for raw data if not provided
  if(bandNames === null || bandNames === undefined){
    bandNames = slopes.bandNames().map(function(bn){return ee.String(bn).split('_').get(1)});
  }
  
  //Set up output band names
  var predictedBandNames = bandNames.map(function(bn){return ee.String(bn).cat('_trend')});
  
  //Predict model
  var predicted = c.map(function(img){
    var cActual = img.select(bandNames);
    var out = img.select(['year']).multiply(slopes).add(img.select(['constant']).multiply(intercepts)).rename(predictedBandNames);
    return cActual.addBands(out).copyProperties(img,['system:time_start']);
  });
  
  return predicted;
}
//////////////////////
//Function for getting a linear fit of a time series and applying it
function getLinearFit(c,bandNames){
  //Find band names for raw data if not provided
  if(bandNames === null || bandNames === undefined){
    bandNames = ee.Image(c.first()).bandNames();
  }
  else{
    bandNames = ee.List(bandNames);
    c = c.select(bandNames);
  }
  
  //Add date and constant independents
  c = c.map(function(img){return img.addBands(ee.Image(1))});
  c = c.map(getImagesLib.addDateBand);
  var selectOrder = ee.List([['constant','year'],bandNames]).flatten();
  
  //Fit model
  var model = c.select(selectOrder).reduce(ee.Reducer.linearRegression(2,bandNames.length())).select([0]);
  
  //Convert model to image
  model = model.arrayTranspose().arrayFlatten([bandNames,['intercept','slope']]);
  
  //Apply model
  var predicted = predictModel(c,model,bandNames);
  
  //Return both the model and predicted
  return [model,predicted];
}
/////////////////////////////////////////////////////////////////////////
//Iterate across each time window and do a z-score and trend analysis
//This method does not currently support date wrapping
function zAndTrendChangeDetection(allScenes,indexNames,nDays,startYear,endYear,startJulian,endJulian,
          baselineLength,baselineGap,epochLength,zReducer,useAnnualMedianForTrend,
          exportImages,exportPathRoot,studyArea,scale,crs,transform,
          minBaselineObservationsNeeded){
  if(minBaselineObservationsNeeded === null || minBaselineObservationsNeeded === undefined){
    minBaselineObservationsNeeded = 30;
  }
  //House-keeping
  allScenes = allScenes.select(indexNames);
  var dummyScene = ee.Image(allScenes.first());
  var outNames = indexNames.map(function(bn){return ee.String(bn).cat('_Z')});
  var analysisStartYear = Math.max(startYear+baselineLength+baselineGap,startYear+epochLength-1);
  
  var years = ee.List.sequence(analysisStartYear,endYear,1).getInfo();
  var julians = ee.List.sequence(startJulian,endJulian-nDays,nDays).getInfo();
  
  //Iterate across each year and perform analysis
  var zAndTrendCollection = years.map(function(yr){
    yr = ee.Number(yr);
    
    //Set up the baseline years
    var blStartYear = yr.subtract(baselineLength).subtract(baselineGap);
    var blEndYear = yr.subtract(1).subtract(baselineGap);
    
    //Set up the trend years
    var trendStartYear = yr.subtract(epochLength).add(1);
    
    //Iterate across the julian dates
    return ee.FeatureCollection(julians.map(function(jd){
      
      jd = ee.Number(jd);
      
      //Set up the julian date range
      var jdStart = jd;
      var jdEnd = jd.add(nDays);
     
      //Get the baseline images
      var blImages = allScenes.filter(ee.Filter.calendarRange(blStartYear,blEndYear,'year'))
                              .filter(ee.Filter.calendarRange(jdStart,jdEnd));
      blImages = getImagesLib.fillEmptyCollections(blImages,dummyScene);
      
      //Mask out where not enough observations
      var blCounts = blImages.count();
      blImages = blImages.map(function(img){return img.updateMask(blCounts.gte(minBaselineObservationsNeeded))});
      
      //Get the z analysis images
      var analysisImages = allScenes.filter(ee.Filter.calendarRange(yr,yr,'year'))
                              .filter(ee.Filter.calendarRange(jdStart,jdEnd)); 
      analysisImages = getImagesLib.fillEmptyCollections(analysisImages,dummyScene);
      
      //Get the images for the trend analysis
      var trendImages = allScenes.filter(ee.Filter.calendarRange(trendStartYear,yr,'year'))
                              .filter(ee.Filter.calendarRange(jdStart,jdEnd));
      trendImages = getImagesLib.fillEmptyCollections(trendImages,dummyScene);
      
      
      //Convert to annual stack if selected
      if(useAnnualMedianForTrend){
        trendImages = toAnnualMedian(trendImages,trendStartYear,yr);
      }
      
      //Perform the linear trend analysis
      var linearTrend = getLinearFit(trendImages,indexNames);
      var linearTrendModel = ee.Image(linearTrend[0]).select(['.*_slope']).multiply(10000);
      
      //Perform the z analysis
      var blMean = blImages.mean();
      var blStd = blImages.reduce(ee.Reducer.stdDev());
    
      var analysisImagesZ = analysisImages.map(function(img){
        return (img.subtract(blMean)).divide(blStd);
      }).reduce(zReducer).rename(outNames).multiply(10);
      
      // Set up the output
      var outName = ee.String('Z_and_Trend_b').cat(ee.String(blStartYear.int16())).cat(ee.String('_'))
                                  .cat(ee.String(blEndYear.int16())).cat(ee.String('_epoch')).cat(ee.String(ee.Number(epochLength)))
                                  .cat(ee.String('_y')).cat(ee.String(yr.int16())).cat(ee.String('_jd'))
                                  .cat(ee.String(jdStart.int16())).cat(ee.String('_')).cat(ee.String(jdEnd.int16()));
      var imageStartDate =ee.Date.fromYMD(yr,1,1).advance(jdStart,'day').millis();
      
      
      var out = analysisImagesZ.addBands(linearTrendModel).int16()
            .set({'system:time_start':imageStartDate,
                  'system:time_end':ee.Date.fromYMD(yr,1,1).advance(jdEnd,'day').millis(),
                  'baselineYrs': baselineLength,
                  'baselineStartYear':blStartYear,
                  'baselineEndYear':blEndYear,
                  'epochLength':epochLength,
                  'trendStartYear':trendStartYear,
                  'year':yr,
                  'startJulian':jdStart,
                  'endJulian':jdEnd,
                  'system:index':outName
            });
        
      if(exportImages){
        outName = outName.getInfo();
        var outPath = exportPathRoot + '/' + outName;
          getImagesLib.exportToAssetWrapper(out.clip(studyArea),outName,outPath,
          'mean',studyArea.bounds(),scale,crs,transform);
      }
      return out;
      }));
    });
    zAndTrendCollection = ee.ImageCollection(ee.FeatureCollection(zAndTrendCollection).flatten());
  
    return zAndTrendCollection;
}


function thresholdZAndTrend(zAndTrendCollection,zThresh,slopeThresh,startYear,endYear,negativeOrPositiveChange){
  if(negativeOrPositiveChange === null || negativeOrPositiveChange === undefined){negativeOrPositiveChange = 'negative'}
  var dir;
  if(negativeOrPositiveChange === 'negative'){dir = -1}
  else{dir = 1};
  var zCollection = zAndTrendCollection.select('.*_Z');
  var trendCollection = zAndTrendCollection.select('.*_slope');
  
  var zChange = thresholdChange(zCollection,-zThresh,dir).select('.*_change');
  var trendChange = thresholdChange(trendCollection,-slopeThresh,dir).select('.*_change');
  
  
  Map.addLayer(zChange.max().select([0]),{'min':startYear,'max':endYear,'palette':'FF0,F00'},'Z Most Recent Change Year '+negativeOrPositiveChange,true);
  Map.addLayer(trendChange.max().select([0]),{'min':startYear,'max':endYear,'palette':'FF0,F00'},'Trend Most Recent Change Year '+negativeOrPositiveChange,false);
  
}

function thresholdZAndTrendSubtle(zAndTrendCollection,zThreshLow,zThreshHigh,slopeThreshLow,slopeThreshHigh,startYear,endYear,negativeOrPositiveChange){
  if(negativeOrPositiveChange === null || negativeOrPositiveChange === undefined){negativeOrPositiveChange = 'negative'}
  var dir;var colorRamp;
  if(negativeOrPositiveChange === 'negative'){dir = -1;colorRamp = 'FF0,F00';}
  else{dir = 1; colorRamp = 'BBB,080';}
  var zCollection = zAndTrendCollection.select('.*_Z');
  var trendCollection = zAndTrendCollection.select('.*_slope');
  
  var zChange = thresholdSubtleChange(zCollection,-zThreshLow,-zThreshHigh,dir).select('.*_change');
  var trendChange = thresholdSubtleChange(trendCollection,-slopeThreshLow,-slopeThreshHigh,dir).select('.*_change');
  
  
  
  Map.addLayer(zChange.max().select([0]),{'min':startYear,'max':endYear,'palette':colorRamp},'Z Most Recent Change Year '+negativeOrPositiveChange,false);
  Map.addLayer(trendChange.max().select([0]),{'min':startYear,'max':endYear,'palette':colorRamp},'Trend Most Recent Change Year '+negativeOrPositiveChange,false);
  
}
// function exportZAndTrend(zAndTrendCollection,dates,exportPathRoot,studyArea,scale,crs,transform){
 
// print('Exporting z and trend collection');
// var i = 0;
// dates.map(function(d){
//   var image = ee.Image(zAndTrendCollection.filterDate(d,d).first());
   
//   var outPath = exportPathRoot + '/' + i;
//   getImagesLib.exportToAssetWrapper(image,i.toString(),outPath,
//         'mean',studyArea,scale,crs,transform)
//     i++;
//   // image.id().evaluate(function(id){
//   //     var outPath = exportPathRoot + '/' + id;
//   //     getImagesLib.exportToAssetWrapper(image,id,outPath,
//   //       'mean',studyArea,scale,crs,transform);
//   //   });
// })
// // var zAndTrendCollectionL = zAndTrendCollection.toList(100);
// //   zAndTrendCollection.size().evaluate(function(count){
// //   ee.List.sequence(0,count-1).getInfo().map(function(i){
   
// //     var image = ee.Image(zAndTrendCollectionL.get(i));
    
// //     image.id().evaluate(function(id){
// //       var outPath = exportPathRoot + '/' + id;
// //       getImagesLib.exportToAssetWrapper(image,id,outPath,
// //         'mean',studyArea,scale,crs,transform);
// //     });
// //   });
// // }); 
// }
//////////////////////////////////////////////////////////////////////////
exports.getR2 = getR2;
exports.extractDisturbance = extractDisturbance;
exports.landtrendrWrapper = landtrendrWrapper;
exports.multBands = multBands;
exports.LT_VT_multBands = LT_VT_multBands;
exports.addToImage = addToImage;
exports.getExistingChangeData = getExistingChangeData;
exports.arrayToTimeSeries = arrayToTimeSeries;
exports.getRawAndFittedLT = getRawAndFittedLT;
exports.getLTStack = getLTStack;
exports.getLTvertStack = getLTvertStack;
exports.simpleLANDTRENDR = simpleLANDTRENDR;
exports.convertToLossGain = convertToLossGain;
exports.prepTimeSeriesForLandTrendr = prepTimeSeriesForLandTrendr;
exports.LANDTRENDRVertStack =  LANDTRENDRVertStack;
exports.applyDistDir_vertStack = applyDistDir_vertStack;
exports.LT_VT_vertStack_multBands = LT_VT_vertStack_multBands;
exports.fitStackToCollection = fitStackToCollection;
exports.convertStack_To_DurFitMagSlope = convertStack_To_DurFitMagSlope;
exports.LANDTRENDRFitMagSlopeDiffCollection = LANDTRENDRFitMagSlopeDiffCollection;
exports.applyLinearInterp = applyLinearInterp;
exports.VERDETVertStack = VERDETVertStack;
exports.VERDETFitMagSlopeDiffCollection = VERDETFitMagSlopeDiffCollection;
exports.verdetAnnualSlope  = verdetAnnualSlope;
exports.annualizeEWMA = annualizeEWMA;
exports.getEWMA = getEWMA;
exports.runEWMACD = runEWMACD;
exports.CCDCFitMagSlopeCollection = CCDCFitMagSlopeCollection;

exports.pairwiseSlope = pairwiseSlope;
exports.thresholdChange = thresholdChange;

exports.predictModel = predictModel;
exports.getLinearFit = getLinearFit;
exports.toAnnualMedian = toAnnualMedian;

exports.zAndTrendChangeDetection = zAndTrendChangeDetection;
exports.thresholdZAndTrend = thresholdZAndTrend;
exports.thresholdZAndTrendSubtle = thresholdZAndTrendSubtle;
exports.thresholdSubtleChange = thresholdSubtleChange;