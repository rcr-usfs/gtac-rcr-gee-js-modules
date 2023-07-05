/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var geometry = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-108.2078125, 39.95076370350941],
          [-108.2078125, 39.40962921639621],
          [-106.62578125, 39.40962921639621],
          [-106.62578125, 39.95076370350941]]], null, false),
    geometry2 = 
    /* color: #98ff00 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-162.51322843770723, 26.449474853267848],
          [-162.51322843770723, 18.16521561821099],
          [-153.72416593770723, 18.16521561821099],
          [-153.72416593770723, 26.449474853267848]]], null, false);
/***** End of imports. If edited, may not auto-convert in the playground. *****/
////////////////////////////////////////////////////////////////////////////////
//Module for getting Landsat, Sentinel 2 and MODIS images/composites
// Define visualization parameters
var vizParamsFalse = {
  'min': 0.1, 
  'max': [0.5,0.6,0.6], 
  'bands': 'swir2,nir,red', 
  'gamma': 1.6
};
var vizParamsFalse10k = {
  'min': 0.1*10000, 
  'max': [0.5*10000,0.6*10000,0.6*10000], 
  'bands': 'swir2,nir,red', 
  'gamma': 1.6
};
var vizParamsTrue = {
  'min': 0, 
  'max': [0.2,0.2,0.2], 
  'bands': 'red,green,blue', 
};
var vizParamsTrue10k = {
  'min': 0, 
  'max': [0.2*10000,0.2*10000,0.2*10000], 
  'bands': 'red,green,blue', 
};

var common_projections = {};
common_projections['NLCD_CONUS'] = {'crs':'PROJCS["Albers_Conical_Equal_Area",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Albers_Conic_Equal_Area"],PARAMETER["latitude_of_center",23],PARAMETER["longitude_of_center",-96],PARAMETER["standard_parallel_1",29.5],PARAMETER["standard_parallel_2",45.5],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["meters",1],AXIS["Easting",EAST],AXIS["Northing",NORTH]]',
                              'transform': [30,0,-2361915.0,0,-30,3177735.0]};
common_projections['NLCD_AK'] = {'crs':'PROJCS["Albers_Conical_Equal_Area",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],TOWGS84[0,0,0,0,0,0,0],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9108"]],AUTHORITY["EPSG","4326"]],PROJECTION["Albers_Conic_Equal_Area"],PARAMETER["standard_parallel_1",55],PARAMETER["standard_parallel_2",65],PARAMETER["latitude_of_center",50],PARAMETER["longitude_of_center",-154],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["meters",1]]',
                                  'transform':[30,0,-48915.0,0,-30,1319415.0]};

common_projections['NLCD_HI'] = {'crs':'PROJCS["Albers_Conical_Equal_Area",GEOGCS["WGS 84",DATUM["WGS_1984", SPHEROID["WGS 84", 6378137.0, 298.257223563, AUTHORITY["EPSG","7030"]], AUTHORITY["EPSG","6326"]], PRIMEM["Greenwich", 0.0], UNIT["degree", 0.017453292519943295], AXIS["Longitude", EAST], AXIS["Latitude", NORTH], AUTHORITY["EPSG","4326"]], PROJECTION["Albers_Conic_Equal_Area"], PARAMETER["central_meridian", -157.0],PARAMETER["latitude_of_origin", 3.0],PARAMETER["standard_parallel_1", 8.0],PARAMETER["false_easting", 0.0],PARAMETER["false_northing", 0.0],PARAMETER["standard_parallel_2", 18.0],UNIT["m", 1.0],AXIS["x", EAST],AXIS["y", NORTH]]',
                                  'transform':[30,0,-342585,0,-30,2127135]};

//Direction of  a decrease in photosynthetic vegetation- add any that are missing
var changeDirDict = {
"blue":1,"green":1,"red":1,"nir":-1,"swir1":1,"swir2":1,"temp":1,
"NDVI":-1,"NBR":-1,"NDMI":-1,"NDSI":1,
"brightness":1,"greenness":-1,"wetness":-1,"fourth":-1,"fifth":1,"sixth":-1,

"ND_blue_green":-1,"ND_blue_red":-1,"ND_blue_nir":1,"ND_blue_swir1":-1,"ND_blue_swir2":-1,
"ND_green_red":-1,"ND_green_nir":1,"ND_green_swir1":-1,"ND_green_swir2":-1,"ND_red_swir1":-1,
"ND_red_swir2":-1,"ND_nir_red":-1,"ND_nir_swir1":-1,"ND_nir_swir2":-1,"ND_swir1_swir2":-1,
"R_swir1_nir":1,"R_red_swir1":-1,"EVI":-1,"SAVI":-1,"IBI":1,
"tcAngleBG":-1,"tcAngleGW":-1,"tcAngleBW":-1,"tcDistBG":1,"tcDistGW":1,"tcDistBW":1,
'NIRv':-1,'NDCI':-1,'NDGI':-1,
};

//Precomputed cloudscore offsets and TDOM stats
//These have been pre-computed for all CONUS for Landsat and Setinel 2 (separately)
//and are appropriate to use for any time period within the growing season
// These have been calculated separately for AK and HI, so we mosaic them all together
//The cloudScore offset is generally some lower percentile of cloudScores on a pixel-wise basis
//The TDOM stats are the mean and standard deviations of the two bands used in TDOM
//By default, TDOM uses the nir and swir1 bands
var preComputedCloudScoreOffset = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/cloudScore').mosaic();
var preComputedCloudScoreOffsetAK = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/Alaska/cloudScore_stats').mosaic();
var preComputedCloudScoreOffsetHI = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/Hawaii/cloudScore').mosaic();

// mosaic all together
var preComputedCloudScoreOffset = ee.ImageCollection.fromImages([preComputedCloudScoreOffset, 
                                                                 preComputedCloudScoreOffsetAK,
                                                                 preComputedCloudScoreOffsetHI]).mosaic();

var preComputedTDOMStats = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/TDOM').filter(ee.Filter.eq('endYear',2019)).mosaic().divide(10000);
var preComputedTDOMStatsAK = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/Alaska/TDOM_stats').filter(ee.Filter.eq('sensor','Sentinel2')).mosaic().divide(10000);
var preComputedTDOMStatsHI = ee.ImageCollection('projects/lcms-tcc-shared/assets/CS-TDOM-Stats/Hawaii/TDOM').filter(ee.Filter.eq('sensor','Sentinel2')).mosaic().divide(10000);

// mosaic all together
var preComputedTDOMStats = ee.ImageCollection.fromImages([preComputedTDOMStats, 
                                              preComputedTDOMStatsAK,
                                              preComputedTDOMStatsHI]).mosaic();


exports.preComputedCloudScoreOffset = preComputedCloudScoreOffset;
exports.preComputedTDOMStats = preComputedTDOMStats;

exports.getPrecomputedCloudScoreOffsets = function(cloudScorePctl){
  return {'landsat': preComputedCloudScoreOffset.select(['Landsat_CloudScore_p'+cloudScorePctl.toString()]),
          'sentinel2':preComputedCloudScoreOffset.select(['Sentinel2_CloudScore_p'+cloudScorePctl.toString()])
          };
};

exports.getPrecomputedTDOMStats = function(cloudScorePctl){
  return {'landsat': {
                      'mean':preComputedTDOMStats.select(['Landsat_nir_mean','Landsat_swir1_mean']),
                      'stdDev':preComputedTDOMStats.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev'])
                      },
          'sentinel2': {
                      'mean':preComputedTDOMStats.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']),
                      'stdDev':preComputedTDOMStats.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev'])
                      }
          };
};

exports.getPrecomputedTDOMStatsAK = function(cloudScorePctl){
  
  return {'landsat': {
                      'mean':preComputedTDOMStatsAK.select(['Landsat_nir_mean','Landsat_swir1_mean']),
                      'stdDev':preComputedTDOMStatsAK.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev'])
                      },
          'sentinel2': {
                      'mean':preComputedTDOMStatsAK.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']),
                      'stdDev':preComputedTDOMStatsAK.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev'])
                      }
          };
};

exports.getPrecomputedTDOMStatsHI = function(cloudScorePctl){
  
  return {// TDOM stats not calculated for landsat for HI
          //'landsat': {
          //            'mean':preComputedTDOMStatsHI.select(['Landsat_nir_mean','Landsat_swir1_mean']),
          //           'stdDev':preComputedTDOMStatsHI.select(['Landsat_nir_stdDev','Landsat_swir1_stdDev'])
          //            },
          'sentinel2': {
                      'mean':preComputedTDOMStatsHI.select(['Sentinel2_nir_mean','Sentinel2_swir1_mean']),
                      'stdDev':preComputedTDOMStatsHI.select(['Sentinel2_nir_stdDev','Sentinel2_swir1_stdDev'])
                      }
          };
};

////////////////////////////////////////////////////////////////////////////////
// FUNCTIONS
/////////////////////////////////////////////////////////////////////////////////
//Function to prep arguments into standardized object regardless of format parameters are provided in
//args are the default arguments keyword for the function
//defaultArgs is an object containing each key and default value needed for the function
//Leave any defaultArg as null if it is needed but a default is not provided
function prepArgumentsObject(args,defaultArgs){
  var argList = [].slice.call(args);
  var outArgs = {};
  // print('Default args:',defaultArgs);
  //See if first argument is an ee object instead of a vanilla js object
  var firstArgumentIsEEObj = false;
  var argsAreObject = false;
  try{
      var t=argList[0].serialize();
      firstArgumentIsEEObj = true;
      }catch(err){
        
      }
      
  if(typeof(argList[0]) === 'object' && argList.length === 1 && !firstArgumentIsEEObj){
    argsAreObject = true;
    outArgs = argList[0];
  }
  //Iterate through each expected argument to create the obj with all parameters
  Object.keys(defaultArgs).forEach(function(key, i) {
    var value;
    if(argsAreObject){
      value = argList[0][key];
    }else{value = argList[i]}
    
    //Fill in default value if non is provided or it is null
    if(value === undefined || value === null){
      value = defaultArgs[key];
    }
    // console.log(value)
      outArgs[key] = value;
    });
    
  // //Merge any remaining variables that were provided
  // if(argsAreObject){
    
  // }
  // print('Out args:',outArgs);
  return outArgs;
}
//////////////////////////////////////////////////
// Function to copy an object so values are not updated in both objects
function copyObj(obj){
  var out = {};Object.keys(obj).map(function(k){out[k]=obj[k]});
  return out}
//////////////////////////////////////////////////
//Function to set null value for export or conversion to arrays
//See default args below
//Must provide image and noDataValue - there are no defaults
//Example usage: setNoData(anEEImage,-32768) or setNoData({'image':anEEImage,'noDataValue':-32768})
function setNoData(){
  var defaultArgs = {
    'image':null,
    'noDataValue':null
    };
  var args = prepArgumentsObject(arguments,defaultArgs);

  return args.image.unmask(args.noDataValue,false).set(args);
}
/////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
//Functions to perform basic clump and elim
//See default args below
//Must provide image 
//mmu is an optional parameter with default of 4 pixels
//Example usage: sieve(anEEImage,4) or sieve({'image':anEEImage,'mmu':4})
function sieve(){
  var defaultArgs = {
    'image':null,
    'mmu':4
    };
  var args = prepArgumentsObject(arguments,defaultArgs);
  var connected = args.image.connectedPixelCount(args.mmu+20);
  // Map.addLayer(connected,{'min':1,'max':args.mmu},'connected');
  var elim = connected.gt(args.mmu);
  var mode = args.image.focal_mode(args.mmu/2,'circle');
  mode = mode.mask(args.image.mask());
  var filled = args.image.where(elim.not(),mode);
  return filled.set(args);
}

//Written by Yang Z.
//------ L8 to L7 HARMONIZATION FUNCTION -----
// slope and intercept citation: Roy, D.P., Kovalskyy, V., Zhang, H.K., Vermote, E.F., Yan, L., Kumar, S.S, Egorov, A., 2016, Characterization of Landsat-7 to Landsat-8 reflective wavelength and normalized difference vegetation index continuity, Remote Sensing of Environment, 185, 57-70.(http://dx.doi.org/10.1016/j.rse.2015.12.024); Table 2 - reduced major axis (RMA) regression coefficients
var harmonizationRoy = function(oli) {
  var slopes = ee.Image.constant([0.9785, 0.9542, 0.9825, 1.0073, 1.0171, 0.9949]);        // create an image of slopes per band for L8 TO L7 regression line - David Roy
  var itcp = ee.Image.constant([-0.0095, -0.0016, -0.0022, -0.0021, -0.0030, 0.0029]);
  var bns = oli.bandNames();
  var includeBns = ['blue','green','red','nir','swir1','swir2' ];
  var otherBns = bns.removeAll(includeBns);

  // create an image of y-intercepts per band for L8 TO L7 regression line - David Roy
  var y = oli.select(includeBns).float() // select OLI bands 2-7 and rename them to match L7 band names
            // .resample('bicubic')                                                          // ...resample the L8 bands using bicubic
             .subtract(itcp).divide(slopes)                                // ...multiply the y-intercept bands by 10000 to match the scale of the L7 bands then apply the line equation - subtract the intercept and divide by the slope
             .set('system:time_start', oli.get('system:time_start'));                      // ...set the output system:time_start metadata to the input image time_start otherwise it is null
  y = y.addBands(oli.select(otherBns)).select(bns);
  
  return y.float();                                                                       // return the image as short to match the type of the other data
};

/////////////////////////////////////////////////////////////////////////
//Code to implement OLI/ETM/MSI regression
//Chastain et al 2018 coefficients
//Empirical cross sensor comparison of Sentinel-2A and 2B MSI, Landsat-8 OLI, and Landsat-7 ETM+ top of atmosphere spectral characteristics over the conterminous United States
//https://www.sciencedirect.com/science/article/pii/S0034425718305212#t0020
//Left out 8a coefficients since all sensors need to be cross- corrected with bands common to all sensors
//Dependent and Independent variables can be switched since Major Axis (Model 2) linear regression was used
var chastainBandNames = ['blue','green','red','nir','swir1','swir2'];

//From Table 4
//msi = oli*slope+intercept
//oli = (msi-intercept)/slope
var msiOLISlopes = [1.0946,1.0043,1.0524,0.8954,1.0049,1.0002];
var msiOLIIntercepts = [-0.0107,0.0026,-0.0015,0.0033,0.0065,0.0046];

//From Table 5
//msi = etm*slope+intercept
//etm = (msi-intercept)/slope
var msiETMSlopes = [1.10601,0.99091,1.05681,1.0045,1.03611,1.04011];
var msiETMIntercepts = [-0.0139,0.00411,-0.0024,-0.0076,0.00411,0.00861];

//From Table 6
//oli = etm*slope+intercept
//etm = (oli-intercept)/slope
var oliETMSlopes =[1.03501,1.00921,1.01991,1.14061,1.04351,1.05271];
var oliETMIntercepts = [-0.0055,-0.0008,-0.0021,-0.0163,-0.0045,0.00261];
//Construct dictionary to handle all pairwise combos 
var chastainCoeffDict = {'MSI_OLI':[msiOLISlopes,msiOLIIntercepts,1],
                        'MSI_ETM':[msiETMSlopes,msiETMIntercepts,1],
                        'OLI_ETM':[oliETMSlopes,oliETMIntercepts,1],
                        
                        'OLI_MSI':[msiOLISlopes,msiOLIIntercepts,0],
                        'ETM_MSI':[msiETMSlopes,msiETMIntercepts,0],
                        'ETM_OLI':[oliETMSlopes,oliETMIntercepts,0]
};
//Function to apply model in one direction
function dir0Regression(img,slopes,intercepts){
  var bns = img.bandNames();
  var nonCorrectBands = bns.removeAll(chastainBandNames);
  var nonCorrectedBands = img.select(nonCorrectBands);
  var corrected = img.select(chastainBandNames).multiply(slopes).add(intercepts);
  var out = corrected.addBands(nonCorrectedBands).select(bns);
  return out;
}
//Applying the model in the opposite direction
function dir1Regression(img,slopes,intercepts){
  var bns = img.bandNames();
  var nonCorrectBands = bns.removeAll(chastainBandNames);
  var nonCorrectedBands = img.select(nonCorrectBands);
  var corrected = img.select(chastainBandNames).subtract(intercepts).divide(slopes);
  var out = corrected.addBands(nonCorrectedBands).select(bns);
  return out;
}
//Function to correct one sensor to another
//Sensor options are 'ETM','OLI', and 'MSI'
//Any pairwise combo can be provided
//See default args below
//Must provide image, fromSensor, and toSensor
//There are no default parameters
//mmu is an optional parameter with default of 4 pixels
//Example usage: harmonizationChastain(anEEImage,'MSI','ETM) or sieve({'image':anEEImage,'fromSensor':'MSI','toSensor':'ETM'})
function harmonizationChastain(){
  var defaultArgs = {
    'image':null,
    'fromSensor':null,
    'toSensor':null
    };
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.fromSensor = args.fromSensor.toUpperCase();
  args.toSensor = args.toSensor.toUpperCase();
  //Get the model for the given from and to sensor
  args.comboKey = args.fromSensor+'_'+args.toSensor;
  args.coeffList = chastainCoeffDict[args.comboKey];
  var slopes = args.coeffList[0];
  var intercepts = args.coeffList[1];
  var direction = ee.Number(args.coeffList[2]);
  
  //Apply the model in the respective direction
  var out = ee.Algorithms.If(direction.eq(0),dir0Regression(args.image,slopes,intercepts),dir1Regression(args.image,slopes,intercepts));
  out = ee.Image(out).copyProperties(args.image).copyProperties(args.image,['system:time_start']);
  out = out.set(args);
  return ee.Image(out);
}
///////////////////////////////////////////////////////////
//Function to create a multiband image from a collection
//Has been replaced by imageCollection.toBands()
function collectionToImage(collection){
  var stack = ee.Image(collection.iterate(function(img, prev) {
    return ee.Image(prev).addBands(img);
  }, ee.Image(1)));

  stack = stack.select(ee.List.sequence(1, stack.bandNames().size().subtract(1)));
  return stack;
} 
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
//Function to find the date for a given composite computed from a given set of images
//Will work on composites computed with methods that include different dates across different bands
//such as the median.  For something like a medoid, only a single bands needs passed through
//A known bug is that if the same value occurs twice, it will choose only a single date
function compositeDates(images,composite,bandNames){
  if(bandNames === null || bandNames === undefined){
     bandNames = ee.Image(images.first()).bandNames();
  }else{images = images.select(bandNames);composite = composite.select(bandNames)}
  
  var bns = ee.Image(images.first()).bandNames().map(function(bn){return ee.String(bn).cat('_diff')});

  //Function to get the abs diff from a given composite *-1
  function getDiff(img,composite){
    var out = img.subtract(composite).abs().multiply(-1).rename(bns);
    return img.addBands(out);
  }

  //Find the diff and add a date band
  images = images.map(function(img){return getDiff(img,composite)});
  images = images.map(addDateBand);
  
  //Iterate across each band and find the corresponding date to the composite
  var out = bandNames.map(function(bn){
    bn = ee.String(bn);
    var t = images.select([bn,bn.cat('_diff'),'year']).qualityMosaic(bn.cat('_diff'));
    return t.select(['year']).rename(['YYYYDD']);
  });
  //Convert to an image and rename
  out  = collectionToImage(ee.ImageCollection(out));
  // var outBns = bandNames.map(function(bn){return ee.String(bn).cat('YYYYDD')});
  // out = out.rename(outBns);
  
  return out;
}
///////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////
//Function to handle empty collections that will cause subsequent processes to fail
//If the collection is empty, will fill it with an empty image
function fillEmptyCollections(inCollection,dummyImage){                       
  var dummyCollection = ee.ImageCollection([dummyImage.mask(ee.Image(0))]);
  var imageCount = inCollection.toList(1).length();
  return ee.ImageCollection(ee.Algorithms.If(imageCount.gt(0),inCollection,dummyCollection));

}

//////////////////////////////////////////////////////////////////////////
//Add sensor band function
// Add band tracking which satellite the pixel came from
function addSensorBand(img, whichProgram, toaOrSR){
  var sensorDict = ee.Dictionary({'LANDSAT_4': 4,
              'LANDSAT_5': 5,
              'LANDSAT_7': 7,
              'LANDSAT_8': 8,
              'LANDSAT_9': 9,
              'Sentinel-2A': 21,
              'Sentinel-2B': 22,
              'Sentinel-2C': 23,
              });
  var sensorPropDict = ee.Dictionary({'C1_landsat':
                        {'TOA':'SPACECRAFT_ID',
                          'SR':'SATELLITE'
                        },
                    'C2_landsat':
                        {'TOA':'SPACECRAFT_ID',
                          'SR':'SPACECRAFT_ID'
                        },
                  'sentinel2':
                        {'TOA':'SPACECRAFT_NAME',
                         'SR':'SPACECRAFT_NAME'
                        }
                  });
  toaOrSR = toaOrSR.toUpperCase();
  var sensorProp = ee.Dictionary(sensorPropDict.get(whichProgram)).get(toaOrSR);
  var sensorName = img.get(sensorProp);
  img = img.addBands(ee.Image.constant(sensorDict.get(sensorName)).rename(['sensor']).byte()).set('sensor',sensorName);
  return img;
}
/////////////////////////////////////////////////////////////////
//Adds the float year with julian proportion to image
function addDateBand(img,maskTime){
  if(maskTime === null || maskTime === undefined){maskTime = false}
  var d = ee.Date(img.get('system:time_start'));
  var y = d.get('year');
  d = y.add(d.getFraction('year'));
  // d=d.getFraction('year')
  var db = ee.Image.constant(d).rename(['year']).float();
  if(maskTime){db = db.updateMask(img.select([0]).mask())}
  
  return img.addBands(db);
}
function addYearFractionBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var y = d.get('year');
  // d = y.add(d.getFraction('year'));
  d=d.getFraction('year');
  var db = ee.Image.constant(d).rename(['year']).float();
  db = db;//.updateMask(img.select([0]).mask())
  return img.addBands(db);
}
function addYearYearFractionBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var y = d.get('year');
  // d = y.add(d.getFraction('year'));
  d=d.getFraction('year');
  var db = ee.Image.constant(y).add(ee.Image.constant(d)).rename(['year']).float();
  db = db;//.updateMask(img.select([0]).mask())
  return img.addBands(db);
}
function addYearBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var y = d.get('year');
  
  var db = ee.Image.constant(y).rename(['year']).float();
  db = db;//.updateMask(img.select([0]).mask())
  return img.addBands(db).float();
}
function addJulianDayBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var julian = ee.Image(ee.Number.parse(d.format('DD'))).rename(['julianDay']);

  return img.addBands(julian).float();
}
function addYearJulianDayBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var yj = ee.Image(ee.Number.parse(d.format('YYDD'))).rename(['yearJulian']);
  return img.addBands(yj).float();
}
function addFullYearJulianDayBand(img){
  var d = ee.Date(img.get('system:time_start'));
  var julian = ee.Number(d.getRelative('day','year')).add(1).format('%03d');
  var y = ee.String(d.get('year'));
  var yj = yj = ee.Image(ee.Number.parse(d.format('YYYYDD'))).rename(['yearJulian']).int64();
  
  return img.addBands(yj).float();
}
function offsetImageDate(img,n,unit){
  var date = ee.Date(img.get('system:time_start'));
  date = date.advance(n,unit);
  // date = ee.Date.fromYMD(100,date.get('month'),date.get('day'))
  return img.set('system:time_start',date.millis());
}
////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
var fringeCountThreshold = 279;//Define number of non null observations for pixel to not be classified as a fringe
///////////////////////////////////////////////////
//Kernel used for defringing
var k = ee.Kernel.fixed(41, 41, 
[[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 
[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]
);
/////////////////////////////////////////////
//Algorithm to defringe Landsat scenes
function defringeLandsat(img){
  //Find any pixel without sufficient non null pixels (fringes)
  var m = img.mask().reduce(ee.Reducer.min());

  //Apply kernel
  var sum = m.reduceNeighborhood(ee.Reducer.sum(), k, 'kernel');
  // Map.addLayer(img,vizParams,'with fringes')
  // Map.addLayer(sum,{'min':20,'max':241},'sum41',false)

  //Mask pixels w/o sufficient obs
  sum = sum.gte(fringeCountThreshold);

  img = img.mask(sum);
  // Map.addLayer(img,vizParams,'defringed')
  return img;
}
//////////////////////////////////////////////////////
//Function to find unique values of a field in a collection
function uniqueValues(collection,field){
    var values  =ee.Dictionary(collection.reduceColumns(ee.Reducer.frequencyHistogram(),[field]).get('histogram')).keys();
    
    return values;
  }
///////////////////////////////////////////////////////
//Function to simplify data into daily mosaics
//This procedure must be used for proper processing of S2 imagery
function dailyMosaics(imgs){
  //Simplify date to exclude time of day
  imgs = imgs.map(function(img){
    var d = ee.String(img.date().format('YYYY-MM-dd'));
    var orbit = ee.Number(img.get('SENSING_ORBIT_NUMBER')).int16().format();
    return img.set({'date-orbit':d.cat(ee.String('_')).cat(orbit),'date':d});
  });
 
  //Find the unique days
  var dayOrbits =  ee.Dictionary(imgs.aggregate_histogram('date-orbit')).keys();
  print('Day-Orbits:',dayOrbits);
  
  function getMosaic(d){
    var date = ee.Date(ee.String(d).split('_').get(0));
    var orbit = ee.Number.parse(ee.String(d).split('_').get(1));
    
    var t = imgs.filterDate(date,date.advance(1,'day'))
            .filter(ee.Filter.eq('SENSING_ORBIT_NUMBER',orbit));
    
    var f = ee.Image(t.first());
    t = t.mosaic();
    t = t.set('system:time_start',date.millis());
    t = t.copyProperties(f);
    return t;
    }
 
    imgs = dayOrbits.map(getMosaic);
    imgs = ee.ImageCollection.fromImages(imgs);
    print('N s2 mosaics:',imgs.size());
    return imgs;
}
///////////////////////////////////////////////////////
// Sentinel 1 processing
// Adapted from: https://code.earthengine.google.com/39a3ad5ac59cd8af14e3dbd78436d2b5
// Author: Warren Scott

//--------------------------------------- DEFINE SPECKLEFUNCTION---------------------------------------------------*/

// Sigma Lee filter
function toNatural(img){
  return ee.Image(10.0).pow(img.select(0).divide(10.0));
}
function toDB(img){
  return ee.Image(img).log10().multiply(10.0);
}

// The RL speckle filter from https://code.earthengine.google.com/2ef38463ebaf5ae133a478f173fd0ab5 by Guido Lemoine
// As coded in the SNAP 3.0 S1TBX:
function RefinedLee(img){
  // img must be in natural units, i.e. not in dB!
  // Set up 3x3 kernels 
  var weights3 = ee.List.repeat(ee.List.repeat(1,3),3);
  var kernel3 = ee.Kernel.fixed(3,3, weights3, 1, 1, false);

  var mean3 = img.reduceNeighborhood(ee.Reducer.mean(), kernel3);
  var variance3 = img.reduceNeighborhood(ee.Reducer.variance(), kernel3);

  // Use a sample of the 3x3 windows inside a 7x7 windows to determine gradients and directions
  var sample_weights = ee.List([[0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0], 
    [0,1,0,1,0,1,0], [0,0,0,0,0,0,0], [0,1,0,1,0,1,0],[0,0,0,0,0,0,0]]);

  var sample_kernel = ee.Kernel.fixed(7,7, sample_weights, 3,3, false);

  // Calculate mean and variance for the sampled windows and store as 9 bands
  var sample_mean = mean3.neighborhoodToBands(sample_kernel);
  var sample_var = variance3.neighborhoodToBands(sample_kernel);

  // Determine the 4 gradients for the sampled windows
  var gradients = sample_mean.select(1).subtract(sample_mean.select(7)).abs();
  gradients = gradients.addBands(sample_mean.select(6).subtract(sample_mean.select(2)).abs());
  gradients = gradients.addBands(sample_mean.select(3).subtract(sample_mean.select(5)).abs());
  gradients = gradients.addBands(sample_mean.select(0).subtract(sample_mean.select(8)).abs());

  // And find the maximum gradient amongst gradient bands
  var max_gradient = gradients.reduce(ee.Reducer.max());

  // Create a mask for band pixels that are the maximum gradient
  var gradmask = gradients.eq(max_gradient);

  // duplicate gradmask bands: each gradient represents 2 directions
  var gradmask = gradmask.addBands(gradmask);

  // Determine the 8 directions
  var directions = sample_mean.select(1).subtract(sample_mean.select(4))
    .gt(sample_mean.select(4).subtract(sample_mean.select(7))).multiply(1);
  directions = directions.addBands(sample_mean.select(6).subtract(sample_mean.select(4))
    .gt(sample_mean.select(4).subtract(sample_mean.select(2))).multiply(2));
  directions = directions.addBands(sample_mean.select(3).subtract(sample_mean.select(4))
    .gt(sample_mean.select(4).subtract(sample_mean.select(5))).multiply(3));
  directions = directions.addBands(sample_mean.select(0).subtract(sample_mean.select(4))
    .gt(sample_mean.select(4).subtract(sample_mean.select(8))).multiply(4));
    
  // The next 4 are the not() of the previous 4
  var directions = directions.addBands(directions.select(0).not().multiply(5));
  directions = directions.addBands(directions.select(1).not().multiply(6));
  directions = directions.addBands(directions.select(2).not().multiply(7));
  directions = directions.addBands(directions.select(3).not().multiply(8));

  // Mask all values that are not 1-8
  directions = directions.updateMask(gradmask);

  // "collapse" the stack into a singe band image (due to masking, each pixel has just one value (1-8) in it's directional band, and is otherwise masked)
  directions = directions.reduce(ee.Reducer.sum());  

  // var pal = ['ffffff','ff0000','ffff00', '00ff00', '00ffff', '0000ff', 'ff00ff', '000000'];
  // Map.addLayer(directions.reduce(ee.Reducer.sum()), {min:1, max:8, palette: pal}, 'Directions', false);

  var sample_stats = sample_var.divide(sample_mean.multiply(sample_mean));

  // Calculate localNoiseVariance
  var sigmaV = sample_stats.toArray().arraySort().arraySlice(0,0,5).arrayReduce(ee.Reducer.mean(), [0]);

  // Set up the 7*7 kernels for directional statistics
  var rect_weights = ee.List.repeat(ee.List.repeat(0,7),3).cat(ee.List.repeat(ee.List.repeat(1,7),4));

  var diag_weights = ee.List([[1,0,0,0,0,0,0], [1,1,0,0,0,0,0], [1,1,1,0,0,0,0],[1,1,1,1,0,0,0], [1,1,1,1,1,0,0], [1,1,1,1,1,1,0], [1,1,1,1,1,1,1]]);

  var rect_kernel = ee.Kernel.fixed(7,7, rect_weights, 3, 3, false);
  var diag_kernel = ee.Kernel.fixed(7,7, diag_weights, 3, 3, false);

  // Create stacks for mean and variance using the original kernels. Mask with relevant direction.
  var dir_mean = img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel).updateMask(directions.eq(1));
  var dir_var = img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel).updateMask(directions.eq(1));

  dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel).updateMask(directions.eq(2)));
  dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel).updateMask(directions.eq(2)));

  // and add the bands for rotated kernels
  for (var i=1; i<4; i++) {
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), rect_kernel.rotate(i))
      .updateMask(directions.eq(2*i+1)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), rect_kernel.rotate(i))
      .updateMask(directions.eq(2*i+1)));
    dir_mean = dir_mean.addBands(img.reduceNeighborhood(ee.Reducer.mean(), diag_kernel.rotate(i))
      .updateMask(directions.eq(2*i+2)));
    dir_var = dir_var.addBands(img.reduceNeighborhood(ee.Reducer.variance(), diag_kernel.rotate(i))
      .updateMask(directions.eq(2*i+2)));
  }

  // "collapse" the stack into a single band image (due to masking, each pixel has just one value in it's directional band, and is otherwise masked)
  dir_mean = dir_mean.reduce(ee.Reducer.sum());
  dir_var = dir_var.reduce(ee.Reducer.sum());

  // A finally generate the filtered value
  var varX = dir_var.subtract(dir_mean.multiply(dir_mean).multiply(sigmaV)).divide(sigmaV.add(1.0));

  var b = varX.divide(dir_var);

  var result = dir_mean.add(b.multiply(img.subtract(dir_mean)));
  return(result.arrayFlatten([['sum']]));
}
//////////////////////////////////////////////////////
// Load and filter Sentinel-1 GRD data by predefined parameters 
function getS1(studyArea,startYear,endYear,startJulian,endJulian,polarization,pass_direction){
  if(polarization===undefined || polarization === null){polarization = 'VV'}
  if(pass_direction===undefined || pass_direction === null){pass_direction = 'ASCENDING'}

  var collection= ee.ImageCollection('COPERNICUS/S1_GRD')
  .filter(ee.Filter.calendarRange(startYear,endYear,'year'))
  .filter(ee.Filter.calendarRange(startJulian,endJulian))
  .filter(ee.Filter.eq('instrumentMode','IW'))
  .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
  .filter(ee.Filter.eq('orbitProperties_pass',pass_direction))
  .filter(ee.Filter.eq('resolution_meters',10))
  .filterBounds(studyArea)
  .select([polarization]);

  return collection;
}
//////////////////////////////////////////////////////
//Function for acquiring Sentinel2 imagery
//See default arguments below
//Required arguments: studyArea,startDate,endDate,startJulian,endJulian
//Can be called on with parameters as an object or ordered set of parameters 
function getS2(){
  var defaultArgs = {
    'studyArea':null,
    'startDate':null,
    'endDate':null,
    'startJulian':null,
    'endJulian':null,
    'resampleMethod':'aggregate',
    'toaOrSR':'TOA',
    'convertToDailyMosaics':true,
    'addCloudProbability':true //LSC
    };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.toaOrSR =  args.toaOrSR.toUpperCase();
  

  var s2CollectionDict = {'TOA':'COPERNICUS/S2_HARMONIZED','SR':'COPERNICUS/S2_SR_HARMONIZED'};
  
  var sensorBandDict = {
      'SR': ['B1','B2','B3','B4','B5','B6','B7','B8','B8A', 'B9', 'B11','B12'],
      'TOA': ['B1','B2','B3','B4','B5','B6','B7','B8','B8A', 'B9', 'B10', 'B11','B12']
    };
  var sensorBandNameDict = {
      'SR': ['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'swir1', 'swir2'],
      'TOA': ['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'cirrus','swir1', 'swir2']
    };
    
  // Specify S2 continuous bands if resampling is set to something other than near
  var s2_continuous_bands = sensorBandNameDict[args.toaOrSR];
  //Get some s2 data
  var s2s = ee.ImageCollection(s2CollectionDict[args.toaOrSR])
                    .filterDate(args.startDate,args.endDate.advance(1,'day'))
                    .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
                    .filterBounds(args.studyArea)
                    .map(function(img){
                      
                      var t = img.select(sensorBandDict[args.toaOrSR]).divide(10000);//Rescale to 0-1
                      // t = t.addBands(img.select(['QA60']));
                      // var out = t.copyProperties(img).copyProperties(img,['system:time_start','system:footprint']);
                    return img.addBands(t,null,true);
                      })
                      .select(['QA60'].concat(sensorBandDict[args.toaOrSR]),['QA60'].concat(sensorBandNameDict[args.toaOrSR]));
                      // .map(function(img){return img.resample('bicubic') }) ;
  
  if(args.addCloudProbability){ 
    print('Joining pre-computed cloud probabilities from: COPERNICUS/S2_CLOUD_PROBABILITY');
    var cloudProbabilities = ee.ImageCollection("COPERNICUS/S2_CLOUD_PROBABILITY")
                    .filterDate(args.startDate,args.endDate.advance(1,'day'))
                    .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
                    .filterBounds(args.studyArea)
                    .select(['probability'],['cloud_probability']);
                    
    var cloudProbabilitiesIds = ee.List(ee.Dictionary(cloudProbabilities.aggregate_histogram('system:index')).keys());
    var s2sIds = ee.List(ee.Dictionary(s2s.aggregate_histogram('system:index')).keys());
    var missing = s2sIds.removeAll(cloudProbabilitiesIds);
    print('Missing cloud probability ids:',missing);
    print('N s2 images before joining with cloud prob:',s2s.size());
    s2s = joinCollections(s2s,cloudProbabilities, false,'system:index');
    print('N s2 images after joining with cloud prob:',s2s.size());
    
    
  }
  
  
  if(['bilinear','bicubic'].indexOf(args.resampleMethod) > -1){
    print('Setting resample method to ',args.resampleMethod);
    s2s = s2s.map(function(img){return img.addBands(img.select(s2_continuous_bands).resample(args.resampleMethod),null,true)});
  }
  else if(args.resampleMethod === 'aggregate'){
    print('Setting to aggregate instead of resample ');
    s2s = s2s.map(function(img){return img.addBands(img.select(s2_continuous_bands).reduceResolution(ee.Reducer.mean(), true, 64),null,true)});
  }
  
  //Convert to daily mosaics to avoid redundant observations in MGRS overlap areas and edge artifacts for shadow masking
  if(args.convertToDailyMosaics){
    print('Converting S2 data to daily orbit mosaics');
    s2s = dailyMosaics(s2s);
  }
  
  // This needs to happen AFTER the mosaicking step or else we still have edge artifacts
  s2s = s2s.map(function(img){return img.updateMask(img.mask().reduce(ee.Reducer.min()))});
  
  return s2s.set(args);
}
var getSentinel2 = getS2;
//////////////////////////////////////////////////////////////////
// Set up dictionaries to manage various Landsat collections, rescale factors, band names, etc
var landsat_C2_L2_rescale_dict = {
  'C1':{'refl_mult':0.0001,'refl_add':0,'temp_mult':0.1,'temp_add':0},
  'C2':{'refl_mult':0.0000275,'refl_add':-0.2,'temp_mult':0.00341802,'temp_add':149.0},
  };

// Specify Landsat continuous bands if resampling is set to something other than near
var landsat_continuous_bands = ['blue','green','red','nir','swir1','temp', 'swir2'];

// Set up bands and corresponding band names
var landsatSensorBandDict = {
  'C1_L4_TOA':['B1','B2','B3','B4','B5','B6','B7','BQA'],
  'C2_L4_TOA':['B1','B2','B3','B4','B5','B6','B7','QA_PIXEL'],
  'C1_L5_TOA':['B1','B2','B3','B4','B5','B6','B7','BQA'],
  'C2_L5_TOA':['B1','B2','B3','B4','B5','B6','B7','QA_PIXEL'],
  'C1_L7_TOA':['B1','B2','B3','B4','B5','B6_VCID_1','B7','BQA'],
  'C2_L7_TOA':['B1','B2','B3','B4','B5','B6_VCID_1','B7','QA_PIXEL'],
  'C1_L8_TOA':['B2','B3','B4','B5','B6','B10','B7','BQA'],
  'C2_L8_TOA':['B2','B3','B4','B5','B6','B10','B7','QA_PIXEL'],
  'C2_L9_TOA':['B2','B3','B4','B5','B6','B10','B7','QA_PIXEL'],
  'C1_L4_SR':['B1','B2','B3','B4','B5','B6','B7','pixel_qa'],
  'C2_L4_SR':['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','ST_B6','SR_B7','QA_PIXEL'],
  'C1_L5_SR':['B1','B2','B3','B4','B5','B6','B7','pixel_qa'],
  'C2_L5_SR':['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','ST_B6','SR_B7','QA_PIXEL'],
  'C1_L7_SR':['B1','B2','B3','B4','B5','B6','B7','pixel_qa'],
  'C2_L7_SR':['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','ST_B6','SR_B7','QA_PIXEL'],
  'C1_L8_SR':['B2','B3','B4','B5','B6','B10','B7','pixel_qa'],
  'C2_L8_SR':['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','ST_B10','SR_B7','QA_PIXEL'],
  'C2_L9_SR':['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','ST_B10','SR_B7','QA_PIXEL']
};

// Provide common band names
var landsatSensorBandNameDict = {
  'C1_TOA': ['blue','green','red','nir','swir1','temp','swir2','BQA'],
  'C1_SR': ['blue','green','red','nir','swir1','temp', 'swir2','pixel_qa'],
  'C1_SRFMASK': ['pixel_qa'],
  'C2_TOA': ['blue','green','red','nir','swir1','temp','swir2','QA_PIXEL'],
  'C2_SR': ['blue','green','red','nir','swir1','temp', 'swir2','QA_PIXEL']
  };

// Set up collections
var landsatCollectionDict = {
  'C1_L8_TOA': 'LANDSAT/LC08/C01/T1',
  'C1_L7_TOA': 'LANDSAT/LE07/C01/T1',
  'C1_L5_TOA': 'LANDSAT/LT05/C01/T1',
  'C1_L4_TOA': 'LANDSAT/LT04/C01/T1',
  'C1_L8_SR': 'LANDSAT/LC08/C01/T1_SR',
  'C1_L7_SR': 'LANDSAT/LE07/C01/T1_SR',
  'C1_L5_SR': 'LANDSAT/LT05/C01/T1_SR',
  'C1_L4_SR': 'LANDSAT/LT04/C01/T1_SR',
  'C2_L9_TOA': 'LANDSAT/LC09/C02/T1',
  'C2_L8_TOA': 'LANDSAT/LC08/C02/T1',
  'C2_L7_TOA': 'LANDSAT/LE07/C02/T1',
  'C2_L5_TOA': 'LANDSAT/LT05/C02/T1',
  'C2_L4_TOA': 'LANDSAT/LT04/C02/T1',
  'C2_L9_SR': 'LANDSAT/LC09/C02/T1_L2',
  'C2_L8_SR': 'LANDSAT/LC08/C02/T1_L2',
  'C2_L7_SR': 'LANDSAT/LE07/C02/T1_L2',
  'C2_L5_SR': 'LANDSAT/LT05/C02/T1_L2',
  'C2_L4_SR': 'LANDSAT/LT04/C02/T1_L2'
  };

// Name of cFmask qa bits band for Collections 1 and 2
var landsatFmaskBandNameDict = {'C1':'pixel_qa','C2':'QA_PIXEL'};
//////////////////////////////////////////////////////////////////
// Method for rescaling reflectance and surface temperature data to 0-1 and Kelvin respectively
// This was adapted from the method provided by Google for rescaling Collection 2:
// https://code.earthengine.google.com/?scriptPath=Examples%3ADatasets%2FLANDSAT_LC08_C02_T1_L2
function applyScaleFactors(image,landsatCollectionVersion){
  var factor_dict = landsat_C2_L2_rescale_dict[landsatCollectionVersion];
  var opticalBands = image.select('blue','green','red','nir','swir1','swir2').multiply(factor_dict['refl_mult']).add(factor_dict['refl_add']).float();
  var thermalBands = image.select('temp').multiply(factor_dict['temp_mult']).add(factor_dict['temp_add']).float();
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}
//////////////////////////////////////////////////////////////////
// Function for acquiring Landsat image collections
//See default arguments below
//Required arguments: studyArea,startDate,endDate,startJulian,endJulian
//Can be called on with parameters as an object or ordered set of parameters 
function getLandsat(){
  
  var defaultArgs = {
    'studyArea':null,
    'startDate':null,
    'endDate':null,
    'startJulian':null,
    'endJulian':null,
    'toaOrSR':'SR',
    'includeSLCOffL7':false,
    'defringeL5':false,
    'addPixelQA':false,
    'resampleMethod':'near',
    'landsatCollectionVersion' : 'C1'
    };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.toaOrSR =  args.toaOrSR.toUpperCase();
  
  
  function getLandsatCollection(landsatCollectionVersion,whichC,toaOrSR){
    var c = ee.ImageCollection(landsatCollectionDict[landsatCollectionVersion+'_'+whichC+'_'+toaOrSR])
        .filterDate(args.startDate,args.endDate.advance(1,'day'))
        .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
        .filterBounds(args.studyArea)
        .filter(ee.Filter.lte('WRS_ROW',120));
    if(args.toaOrSR.toLowerCase() === 'toa'){
      c = c.map(ee.Algorithms.Landsat.TOA);
    }
    c = c.select(landsatSensorBandDict[landsatCollectionVersion+'_'+whichC+'_'+toaOrSR],
                  landsatSensorBandNameDict[landsatCollectionVersion+'_'+toaOrSR]);
    
    if(args.toaOrSR.toLowerCase() === 'sr'){
      c = c.map(function(image){return applyScaleFactors(image,landsatCollectionVersion)});
    }
    return c;
  }
  function getLandsatCollections(toaOrSR,landsatCollectionVersion){
    // Get Landsat data
    var l4s = getLandsatCollection(landsatCollectionVersion,'L4',toaOrSR);
    var l5s = getLandsatCollection(landsatCollectionVersion,'L5',toaOrSR)
      ;
    if(args.defringeL5){
      print('Defringing L4 and L5');
      l4s = l4s.map(defringeLandsat);
      l5s = l5s.map(defringeLandsat);
    };
    var l8s = getLandsatCollection(landsatCollectionVersion,'L8',toaOrSR)
    
    var ls; var l7s;
    if(args.includeSLCOffL7){
      print('Including All Landsat 7');
      l7s =getLandsatCollection(landsatCollectionVersion,'L7',toaOrSR)
    }else{
      print('Only including SLC On Landsat 7');
      l7s = getLandsatCollection(landsatCollectionVersion,'L7',toaOrSR)
          .filterDate(ee.Date.fromYMD(1998,1,1),ee.Date.fromYMD(2003,5,31).advance(1,'day'));
    };
    // Merge collections
    ls = ee.ImageCollection(l4s.merge(l5s).merge(l7s).merge(l8s));
    
    // Bring in Landsat 9 if using Collection 2
    if(landsatCollectionVersion.toLowerCase() === 'c2'){
      var l9s = getLandsatCollection(landsatCollectionVersion,'L9',toaOrSR);
      ls = ee.ImageCollection(ls.merge(l9s));
    }
      
    return ls;
  }
  var ls = getLandsatCollections(args.toaOrSR,args.landsatCollectionVersion);
  
  //If TOA and Fmask need to merge Fmask qa bits with toa- this gets the qa band from the sr collections
  if(args.toaOrSR.toLowerCase() === 'toa' && args.addPixelQA === true && args.landsatCollectionVersion.toLowerCase() == 'c1'){
    print('Acquiring SR qa bands for applying Fmask to TOA data');
    var l4sTOAFMASK =  ee.ImageCollection(landsatCollectionDict['C1_L4_SR'])
              .filterDate(args.startDate,args.endDate.advance(1,'day'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .filterBounds(args.studyArea)
              .filter(ee.Filter.lte('WRS_ROW',120))
              .select(landsatSensorBandNameDict['C1_SRFMASK']);
              
    var l5sTOAFMASK =  ee.ImageCollection(landsatCollectionDict['C1_L5_SR'])
              .filterDate(args.startDate,args.endDate.advance(1,'day'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .filterBounds(args.studyArea)
              .filter(ee.Filter.lte('WRS_ROW',120))
              .select(landsatSensorBandNameDict['C1_SRFMASK']);
    var l8sTOAFMASK =  ee.ImageCollection(landsatCollectionDict['C1_L8_SR'])
              .filterDate(args.startDate,args.endDate.advance(1,'day'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .filterBounds(args.studyArea)
              .filter(ee.Filter.lte('WRS_ROW',120))
              .select(landsatSensorBandNameDict['C1_SRFMASK']);
    
    var lsTOAFMASK;
    if(args.includeSLCOffL7){ 
      print('Including All Landsat 7 for TOA QA');
      var l7sTOAFMASK =  ee.ImageCollection(landsatCollectionDict['C1_L7_SR'])
              .filterDate(args.startDate,args.endDate.advance(1,'day'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .filterBounds(args.studyArea)
              .filter(ee.Filter.lte('WRS_ROW',120))
              .select(landsatSensorBandNameDict['C1_SRFMASK']);
    
    }else{
      print('Only including SLC On Landsat 7 for TOA QA');
      var l7sTOAFMASK =  ee.ImageCollection(landsatCollectionDict['C1_L7_SR'])
              .filterDate(ee.Date.fromYMD(1998,1,1),ee.Date.fromYMD(2003,5,31).advance(1,'day'))
              .filterDate(args.startDate,args.endDate.advance(1,'day'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .filterBounds(args.studyArea)
              .filter(ee.Filter.lte('WRS_ROW',120))
              .select(landsatSensorBandNameDict['C1_SRFMASK']);
    }
    
    lsTOAFMASK = ee.ImageCollection(l4sTOAFMASK.merge(l5sTOAFMASK).merge(l7sTOAFMASK).merge(l8sTOAFMASK));
    //Join the TOA with SR QA bands
    print('Joining TOA with SR QA bands');
    print(ls.size(),lsTOAFMASK.size())
    ls = joinCollections(ls.select([0,1,2,3,4,5,6]),lsTOAFMASK,false,'system:index');
    print("ls images:", ls)
  }
  
  
  // Make sure all bands have data
  ls = ls.map(function(img){
    img = img.updateMask(img.select(['blue','green','red','nir','swir1','swir2']).mask().reduce(ee.Reducer.min()));
    return img//.multiply(multImageDict[args.toaOrSR]).float()
      //.copyProperties(img,['system:time_start','system:footprint']).copyProperties(img);
  });
  
  if(['bilinear','bicubic'].indexOf(args.resampleMethod) > -1){
    print('Setting resample method to ',args.resampleMethod);
    ls = ls.map(function(img){return img.addBands(img.select(landsat_continuous_bands).resample(args.resampleMethod),null,true)});
  }else if(args.resampleMethod === 'aggregate'){
    print('Setting to aggregate instead of resample ');
    ls = ls.map(function(img){return img.addBands(img.select(landsat_continuous_bands).reduceResolution(ee.Reducer.mean(), true, 64),null,true)});
  }
  
  return ls.set(args);
}
var getImageCollection = getLandsat;

////////////////////////////////////////////////////////////////////////////////
// Helper function to apply an expression and linearly rescale the output.
// Used in the landsatCloudScore function below.
function rescale(img, exp, thresholds) {
  return img.expression(exp, {img: img})
    .subtract(thresholds[0]).divide(thresholds[1] - thresholds[0]);
}
////////////////////////////////////////

/////////////////////////////////////////////
/***
 * Implementation of Basic cloud shadow shift
 * 
 * Author: Gennadii Donchyts
 * License: Apache 2.0
 */
 //Cloud heights added by Ian Housman
 //yMult bug fix adapted from code written by Noel Gorelick by Ian Housman
function projectShadows(cloudMask,image,irSumThresh,contractPixels,dilatePixels,cloudHeights,yMult){
  if(yMult === undefined || yMult === null){
    yMult = ee.Algorithms.If(ee.Algorithms.IsEqual(image.select([3]).projection(), ee.Projection("EPSG:4326")),1,-1);
  }
  var meanAzimuth = image.get('MEAN_SOLAR_AZIMUTH_ANGLE');
  var meanZenith = image.get('MEAN_SOLAR_ZENITH_ANGLE');
  ///////////////////////////////////////////////////////
  // print('a',meanAzimuth);
  // print('z',meanZenith)
  
  //Find dark pixels
  var darkPixels = image.select(['nir','swir1','swir2']).reduce(ee.Reducer.sum()).lt(irSumThresh)
    .focal_min(contractPixels).focal_max(dilatePixels)
  ;//.gte(1);
  
  
  //Get scale of image
  var nominalScale = cloudMask.projection().nominalScale();
  //Find where cloud shadows should be based on solar geometry
  //Convert to radians
  var azR =ee.Number(meanAzimuth).add(180).multiply(Math.PI).divide(180.0);
  var zenR  =ee.Number(meanZenith).multiply(Math.PI).divide(180.0);
  
  
 
  //Find the shadows
  var shadows = cloudHeights.map(function(cloudHeight){
    cloudHeight = ee.Number(cloudHeight);
    
    var shadowCastedDistance = zenR.tan().multiply(cloudHeight);//Distance shadow is cast
    var x = azR.sin().multiply(shadowCastedDistance).divide(nominalScale);//X distance of shadow
    var y = azR.cos().multiply(shadowCastedDistance).divide(nominalScale).multiply(yMult);//Y distance of shadow
    // print(x,y)
   
    return cloudMask.changeProj(cloudMask.projection(), cloudMask.projection().translate(x, y));
    
    
  });
  
  
  var shadowMask = ee.ImageCollection.fromImages(shadows).max();
  
  //Create shadow mask
  shadowMask = shadowMask.and(cloudMask.not());
  shadowMask = shadowMask.and(darkPixels).focal_min(contractPixels).focal_max(dilatePixels);
  // Map.addLayer(cloudMask.updateMask(cloudMask),{'min':1,'max':1,'palette':'88F'},'Cloud mask');
  // Map.addLayer(shadowMask.updateMask(shadowMask),{'min':1,'max':1,'palette':'880'},'Shadow mask');
  
  var cloudShadowMask = shadowMask.or(cloudMask);
  
  image = image.updateMask(cloudShadowMask.not()).addBands(shadowMask.rename(['cloudShadowMask']));
  return image;
}
//See defaultArgs for list of params
//img is a required parameter
//Params can be provided as an object or parameter separated by commas
function projectShadowsWrapper(){
   var defaultArgs = {
    'img':null,
    'cloudThresh':20,
    'irSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'cloudHeights':ee.List.sequence(500,10000,500)
  };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  
  var cloudMask = sentinel2CloudScore(args.img).gt(args.cloudThresh)
    .focal_min(args.contractPixels).focal_max(args.dilatePixels);

  var img = projectShadows(cloudMask,args.img,args.irSumThresh,args.contractPixels,args.dilatePixels,args.cloudHeights);

  return img.set(args);
}
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
// Function to mask clouds using the Sentinel-2 QA band.
function maskS2clouds(image) {
  var qa = image.select('QA60').int16();
  
  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = Math.pow(2, 10);
  var cirrusBitMask = Math.pow(2, 11);
  
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0));

  // Return the masked and scaled data.
  return image.updateMask(mask);
}
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Compute a cloud score and adds a band that represents the cloud mask.  
// This expects the input image to have the common band names: 
// ["red", "blue", etc], so it can work across sensors.
function landsatCloudScore(img) {
  // Compute several indicators of cloudiness and take the minimum of them.
  var score = ee.Image(1.0);
  // Clouds are reasonably bright in the blue band.
  score = score.min(rescale(img, 'img.blue', [0.1, 0.3]));
 
  // Clouds are reasonably bright in all visible bands.
  score = score.min(rescale(img, 'img.red + img.green + img.blue', [0.2, 0.8]));
   
  // Clouds are reasonably bright in all infrared bands.
  score = score.min(
    rescale(img, 'img.nir + img.swir1 + img.swir2', [0.3, 0.8]));

  // Clouds are reasonably cool in temperature.
  // Unmask temperature to a cold cold temp so it doesn't exclude the pixels entirely
  // This is an issue largely with SR data where a suspected cloud temperature value is masked out
  var tempUnmasked = img.select(['temp']).unmask(270);
  score = score.min(rescale(tempUnmasked,'img', [300, 290]));

  // However, clouds are not snow.
  var ndsi = img.normalizedDifference(['green', 'swir1']);
  score = score.min(rescale(ndsi, 'img', [0.8, 0.6]));
  
 
  score = score.multiply(100).byte();
  score = score.clamp(0,100);
  return score;
}
////////////////////////////////////////////////////////////////////////////////
//Wrapper for applying cloudScore function
//Required params: collection,cloudScoreFunction
function applyCloudScoreAlgorithm(collection,cloudScoreFunction,cloudScoreThresh,cloudScorePctl,contractPixels,dilatePixels,performCloudScoreOffset,preComputedCloudScoreOffset){
  // var defaultArgs = {
  //   'collection':null,
  //   'cloudScoreFunction':null,
  //   'cloudScoreThresh':20,
  //   'cloudScorePctl':10,
  //   'contractPixels':1.5,
  //   'dilatePixels':3.5,
  //   'performCloudScoreOffset':true,
  //   'preComputedCloudScoreOffset':null
  //   };
  
  // var args = prepArgumentsObject(arguments,defaultArgs);
 
  
  if(performCloudScoreOffset === undefined || performCloudScoreOffset === null){performCloudScoreOffset = true}
  if(preComputedCloudScoreOffset === undefined || preComputedCloudScoreOffset === null){preComputedCloudScoreOffset = null};
  // Add cloudScore
  var collection = collection.map(function(img){
    var cs = cloudScoreFunction(img).rename(['cloudScore']);
    return img.addBands(cs);
  });

  if(performCloudScoreOffset){
    var minCloudScore;
    if(preComputedCloudScoreOffset === null){
      print('Computing cloudScore offset');
      // Find low cloud score pctl for each pixel to avoid comission errors
      minCloudScore = collection.select(['cloudScore'])
        .reduce(ee.Reducer.percentile([cloudScorePctl]));
      // Map.addLayer(minCloudScore,{'min':0,'max':30},'minCloudScore',false);
    }else{
      print('Using pre-computed cloudScore offset');
      minCloudScore = preComputedCloudScoreOffset.rename(['cloudScore']);
    }
  }else{
    print('Not computing cloudScore offset');
    var minCloudScore = ee.Image(0).rename(['cloudScore']);
  }
  
  // Apply cloudScore
  var collection = collection.map(function(img){
    var cloudMask = img.select(['cloudScore']).subtract(minCloudScore)
      .lt(cloudScoreThresh)
      .focal_max(contractPixels).focal_min(dilatePixels).rename('cloudMask');
    return img.updateMask(cloudMask);
  });
  
  return collection;
}
////////////////////////////////////////////////////////////////////////////////
// Functions for applying fmask to SR data
var fmaskBitDict = {'C1':{
                    'cloud' : 5, 
                    'shadow': 3,
                    'snow':4
                    },
                'C2':{
                    'cloud' : 3, 
                    'shadow': 4,
                    'snow':5
                  }
                };

// LSC updated 4/16/19 to add medium and high confidence cloud masks
// Supported fmaskClass options: 'cloud', 'shadow', 'snow', 'high_confidence_cloud', 'med_confidence_cloud'
function cFmask(img,fmaskClass,bitMaskBandName){
  if(bitMaskBandName === undefined || bitMaskBandName === null){bitMaskBandName = 'QA_PIXEL'}
     var qa = img.select('pixel_qa').int16();
  if(fmaskClass == 'high_confidence_cloud'){
     var m = qa.bitwiseAnd(ee.Image(1 << 6)).neq(0).And(qa.bitwiseAnd(1 << 7).neq(0));
  }else if(fmaskClass == 'med_confidence_cloud'){
     var m = qa.bitwiseAnd(ee.Image(1 << 7)).neq(0);
  }else{
    var m = qa.bitwiseAnd(fmaskBitDict[fmaskClass]).neq(0);
  }
  return img.updateMask(m.not());
}
// Method for applying a single bit bit mask
function applyBitMask(img,bit,bitMaskBandName){
  if(bitMaskBandName === undefined || bitMaskBandName === null){bitMaskBandName = 'QA_PIXEL'}
  var m = img.select([bitMaskBandName]).uint16();
  m = m.bitwiseAnd(ee.Image(1<<bit)).neq(0);
  return img.updateMask(m.not());
}

function cFmaskCloud(img,landsatCollectionVersion,bitMaskBandName){
  if(bitMaskBandName === undefined || bitMaskBandName === null){bitMaskBandName = 'QA_PIXEL'}
  return applyBitMask(img,fmaskBitDict[landsatCollectionVersion]['cloud'],bitMaskBandName);
}
function cFmaskCloudShadow(img,landsatCollectionVersion,bitMaskBandName){
  if(bitMaskBandName === undefined || bitMaskBandName === null){bitMaskBandName = 'QA_PIXEL'}
  return applyBitMask(img,fmaskBitDict[landsatCollectionVersion]['shadow'],bitMaskBandName);
}
////////////////////////////////////////////////////////////////////////////////
// Function for finding dark outliers in time series.
// Original concept written by Carson Stam and adapted by Ian Housman.
// Masks out pixels that are dark, and dark outliers.
//See defaultArgs below
//Only parameter that must be provided is collection
function simpleTDOM2(){
  var defaultArgs = {
    'collection':null,
    'zScoreThresh':-1,
    'shadowSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'shadowSumBands':['nir','swir1'],
    'preComputedTDOMIRMean':null,
    'preComputedTDOMIRStdDev':null
  };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  
  // Get some pixel-wise stats for the time series
  var irMean;var irStdDev;
  if(args.preComputedTDOMIRMean === null || args.preComputedTDOMIRMean === undefined){
    print('Computing irMean for TDOM');
    irMean = args.collection.select(args.shadowSumBands).mean();
  }else{
    print('Using pre-computed irMean for TDOM');
    irMean = args.preComputedTDOMIRMean;
  }
  if(args.preComputedTDOMIRStdDev === null || args.preComputedTDOMIRStdDev === undefined){
    print('Computing irStdDev for TDOM');
    irStdDev = args.collection.select(args.shadowSumBands).reduce(ee.Reducer.stdDev());
  }else{
    print('Using pre-computed irStdDev for TDOM');
    irStdDev = args.preComputedTDOMIRStdDev;
  }
  
  // Mask out dark dark outliers
  var collection = args.collection.map(function(img){
    var zScore = img.select(args.shadowSumBands).subtract(irMean).divide(irStdDev);
    var irSum = img.select(args.shadowSumBands).reduce(ee.Reducer.sum());
    var TDOMMask = zScore.lt(args.zScoreThresh).reduce(ee.Reducer.sum()).eq(args.shadowSumBands.length)
      .and(irSum.lt(args.shadowSumThresh));
    TDOMMask = TDOMMask.focal_min(args.contractPixels).focal_max(args.dilatePixels);
    return img.updateMask(TDOMMask.not());
  });
  
  return collection.set(args);
}

////////////////////////////////////////////////////////////////////////////////
// Function to add common (and less common) spectral indices to an image.
// Includes the Normalized Difference Spectral Vector from (Angiuli and Trianni, 2014)
function addIndices(img){
  // Add Normalized Difference Spectral Vector (NDSV)
  img = img.addBands(img.normalizedDifference(['blue','green']).rename('ND_blue_green'));
  img = img.addBands(img.normalizedDifference(['blue','red']).rename('ND_blue_red'));
  img = img.addBands(img.normalizedDifference(['blue','nir']).rename('ND_blue_nir'));
  img = img.addBands(img.normalizedDifference(['blue','swir1']).rename('ND_blue_swir1'));
  img = img.addBands(img.normalizedDifference(['blue','swir2']).rename('ND_blue_swir2'));

  img = img.addBands(img.normalizedDifference(['green','red']).rename('ND_green_red'));
  img = img.addBands(img.normalizedDifference(['green','nir']).rename('ND_green_nir')); //NDWBI
  img = img.addBands(img.normalizedDifference(['green','swir1']).rename('ND_green_swir1')); //NDSI, MNDWI
  img = img.addBands(img.normalizedDifference(['green','swir2']).rename('ND_green_swir2'));

  img = img.addBands(img.normalizedDifference(['red','swir1']).rename('ND_red_swir1'));
  img = img.addBands(img.normalizedDifference(['red','swir2']).rename('ND_red_swir2'));
  
  
  img = img.addBands(img.normalizedDifference(['nir','red']).rename('ND_nir_red')); //NDVI
  img = img.addBands(img.normalizedDifference(['nir','swir1']).rename('ND_nir_swir1')); //NDWI, LSWI, -NDBI
  img = img.addBands(img.normalizedDifference(['nir','swir2']).rename('ND_nir_swir2')); //NBR, MNDVI

  img = img.addBands(img.normalizedDifference(['swir1','swir2']).rename('ND_swir1_swir2'));
  
  // Add ratios
  img = img.addBands(img.select('swir1').divide(img.select('nir')).rename('R_swir1_nir')); //ratio 5/4
  img = img.addBands(img.select('red').divide(img.select('swir1')).rename('R_red_swir1')); // ratio 3/5

  // Add Enhanced Vegetation Index (EVI)
  var evi = img.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': img.select('nir'),
      'RED': img.select('red'),
      'BLUE': img.select('blue')
  }).float();
  img = img.addBands(evi.rename('EVI'));
  
  // Add Soil Adjust Vegetation Index (SAVI)
  // using L = 0.5;
  var savi = img.expression(
    '(NIR - RED) * (1 + 0.5)/(NIR + RED + 0.5)', {
      'NIR': img.select('nir'),
      'RED': img.select('red')
  }).float();
  img = img.addBands(savi.rename('SAVI'));
  
  // Add Index-Based Built-Up Index (IBI)
  var ibi_a = img.expression(
    '2*SWIR1/(SWIR1 + NIR)', {
      'SWIR1': img.select('swir1'),
      'NIR': img.select('nir')
    }).rename('IBI_A');
  var ibi_b = img.expression(
    '(NIR/(NIR + RED)) + (GREEN/(GREEN + SWIR1))', {
      'NIR': img.select('nir'),
      'RED': img.select('red'),
      'GREEN': img.select('green'),
      'SWIR1': img.select('swir1')
    }).rename('IBI_B');
  ibi_a = ibi_a.addBands(ibi_b);
  var ibi = ibi_a.normalizedDifference(['IBI_A','IBI_B']);
  img = img.addBands(ibi.rename('IBI'));
  

  return img;
}
///////////////////////////////////////////
//Function to  add SAVI and EVI
function addSAVIandEVI(img){
  // Add Enhanced Vegetation Index (EVI)
  var evi = img.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
      'NIR': img.select('nir'),
      'RED': img.select('red'),
      'BLUE': img.select('blue')
  }).float();
  img = img.addBands(evi.rename('EVI'));
  
  // Add Soil Adjust Vegetation Index (SAVI)
  // using L = 0.5;
  var savi = img.expression(
    '(NIR - RED) * (1 + 0.5)/(NIR + RED + 0.5)', {
      'NIR': img.select('nir'),
      'RED': img.select('red')
  }).float();

  
  ////////////////////////////////////////////////////////////////////////////////
  //NIRv: Badgley, G., Field, C. B., & Berry, J. A. (2017). Canopy near-infrared reflectance and terrestrial photosynthesis. Science Advances, 3, e1602244.
  //https://www.researchgate.net/publication/315534107_Canopy_near-infrared_reflectance_and_terrestrial_photosynthesis
  // NIRv function: ‘image’ is a 2 band stack of NDVI and NIR
  //////////////////////////////////////////////////////////////////////////////////////////
  var NIRv =  img.select(['NDVI']).subtract(0.08)
              .multiply(img.select(['nir']));//.multiply(0.0001))

  img = img.addBands(savi.rename('SAVI')).addBands(NIRv.rename('NIRv'));
  return img;
}
/////////////////////////////////////////////////////////////////
//Function for only adding common indices
function simpleAddIndices(in_image){
    in_image = in_image.addBands(in_image.normalizedDifference(['nir', 'red']).select([0],['NDVI']));
    in_image = in_image.addBands(in_image.normalizedDifference(['nir', 'swir2']).select([0],['NBR']));
    in_image = in_image.addBands(in_image.normalizedDifference(['nir', 'swir1']).select([0],['NDMI']));
    in_image = in_image.addBands(in_image.normalizedDifference(['green', 'swir1']).select([0],['NDSI']));
  
    return in_image;
}
///////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Function for adding common indices
////////////////////////////////////////////////////////////////////////////////
function addSoilIndices(img){
  img = img.addBands(img.normalizedDifference(['red','green']).rename('NDCI'));
  img = img.addBands(img.normalizedDifference(['red','swir2']).rename('NDII'));
  img = img.addBands(img.normalizedDifference(['swir1','nir']).rename('NDFI'));
  
  var bsi = img.expression(
  '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))', {
    'BLUE': img.select('blue'),
    'RED': img.select('red'),
    'NIR': img.select('nir'),
    'SWIR1': img.select('swir1')
  }).float();
  img = img.addBands(bsi.rename('BSI'));
  
  var hi = img.expression(
    'SWIR1 / SWIR2',{
      'SWIR1': img.select('swir1'),
      'SWIR2': img.select('swir2')
    }).float();
  img = img.addBands(hi.rename('HI'));  
  return img.float();
}
/////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
// Function to compute the Tasseled Cap transformation and return an image
// with the following bands added: ['brightness', 'greenness', 'wetness', 
// 'fourth', 'fifth', 'sixth']
function getTasseledCap(image) {
 
  var bands = ee.List(['blue','green','red','nir','swir1','swir2']);
  // // Kauth-Thomas coefficients for Thematic Mapper data
  // var coefficients = ee.Array([
  //   [0.3037, 0.2793, 0.4743, 0.5585, 0.5082, 0.1863],
  //   [-0.2848, -0.2435, -0.5436, 0.7243, 0.0840, -0.1800],
  //   [0.1509, 0.1973, 0.3279, 0.3406, -0.7112, -0.4572],
  //   [-0.8242, 0.0849, 0.4392, -0.0580, 0.2012, -0.2768],
  //   [-0.3280, 0.0549, 0.1075, 0.1855, -0.4357, 0.8085],
  //   [0.1084, -0.9022, 0.4120, 0.0573, -0.0251, 0.0238]
  // ]);
  
  //Crist 1985 coeffs - TOA refl (http://www.gis.usu.edu/~doug/RS5750/assign/OLD/RSE(17)-301.pdf)
  var coefficients = ee.Array([[0.2043, 0.4158, 0.5524, 0.5741, 0.3124, 0.2303],
                    [-0.1603, -0.2819, -0.4934, 0.7940, -0.0002, -0.1446],
                    [0.0315, 0.2021, 0.3102, 0.1594, -0.6806, -0.6109],
                    [-0.2117, -0.0284, 0.1302, -0.1007, 0.6529, -0.7078],
                    [-0.8669, -0.1835, 0.3856, 0.0408, -0.1132, 0.2272],
                   [0.3677, -0.8200, 0.4354, 0.0518, -0.0066, -0.0104]]);
  // Make an Array Image, with a 1-D Array per pixel.
  var arrayImage1D = image.select(bands).toArray();
  
  // Make an Array Image with a 2-D Array per pixel, 6x1.
  var arrayImage2D = arrayImage1D.toArray(1);
  
  var componentsImage = ee.Image(coefficients)
    .matrixMultiply(arrayImage2D)
    // Get rid of the extra dimensions.
    .arrayProject([0])
    // Get a multi-band image with TC-named bands.
    .arrayFlatten(
      [['brightness', 'greenness', 'wetness', 'fourth', 'fifth', 'sixth']])
    .float();
  
  return image.addBands(componentsImage);
}
function simpleGetTasseledCap(image) {
 
  var bands = ee.List(['blue','green','red','nir','swir1','swir2']);
  // // Kauth-Thomas coefficients for Thematic Mapper data
  // var coefficients = ee.Array([
  //   [0.3037, 0.2793, 0.4743, 0.5585, 0.5082, 0.1863],
  //   [-0.2848, -0.2435, -0.5436, 0.7243, 0.0840, -0.1800],
  //   [0.1509, 0.1973, 0.3279, 0.3406, -0.7112, -0.4572],
  //   [-0.8242, 0.0849, 0.4392, -0.0580, 0.2012, -0.2768],
  //   [-0.3280, 0.0549, 0.1075, 0.1855, -0.4357, 0.8085],
  //   [0.1084, -0.9022, 0.4120, 0.0573, -0.0251, 0.0238]
  // ]);
  
  //Crist 1985 coeffs - TOA refl (http://www.gis.usu.edu/~doug/RS5750/assign/OLD/RSE(17)-301.pdf)
  var coefficients = ee.Array([[0.2043, 0.4158, 0.5524, 0.5741, 0.3124, 0.2303],
                    [-0.1603, -0.2819, -0.4934, 0.7940, -0.0002, -0.1446],
                    [0.0315, 0.2021, 0.3102, 0.1594, -0.6806, -0.6109]]);
  // Make an Array Image, with a 1-D Array per pixel.
  var arrayImage1D = image.select(bands).toArray();
  
  // Make an Array Image with a 2-D Array per pixel, 6x1.
  var arrayImage2D = arrayImage1D.toArray(1);
  
  var componentsImage = ee.Image(coefficients)
    .matrixMultiply(arrayImage2D)
    // Get rid of the extra dimensions.
    .arrayProject([0])
    // Get a multi-band image with TC-named bands.
    .arrayFlatten(
      [['brightness', 'greenness', 'wetness']])
    .float();
  
  return image.addBands(componentsImage);
}
///////////////////////////////////////////////////////////////////////////////
// Function to add Tasseled Cap angles and distances to an image.
// Assumes image has bands: 'brightness', 'greenness', and 'wetness'.
function addTCAngles(image){
  // Select brightness, greenness, and wetness bands
  var brightness = image.select(['brightness']);
  var greenness = image.select(['greenness']);
  var wetness = image.select(['wetness']);
  
  // Calculate Tasseled Cap angles and distances
  var tcAngleBG = brightness.atan2(greenness).divide(Math.PI).rename('tcAngleBG');
  var tcAngleGW = greenness.atan2(wetness).divide(Math.PI).rename('tcAngleGW');
  var tcAngleBW = brightness.atan2(wetness).divide(Math.PI).rename('tcAngleBW');
  var tcDistBG = brightness.hypot(greenness).rename('tcDistBG');
  var tcDistGW = greenness.hypot(wetness).rename('tcDistGW');
  var tcDistBW = brightness.hypot(wetness).rename('tcDistBW');
  image = image.addBands(tcAngleBG).addBands(tcAngleGW)
    .addBands(tcAngleBW).addBands(tcDistBG).addBands(tcDistGW)
    .addBands(tcDistBW);
  return image;
}
////////////////////////////////////////////////////
//Only adds tc bg angle as in Powell et al 2009
//https://www.sciencedirect.com/science/article/pii/S0034425709003745?via%3Dihub
function simpleAddTCAngles(image){
  // Select brightness, greenness, and wetness bands
  var brightness = image.select(['brightness']);
  var greenness = image.select(['greenness']);
  var wetness = image.select(['wetness']);
  
  // Calculate Tasseled Cap angles and distances
  var tcAngleBG = brightness.atan2(greenness).divide(Math.PI).rename('tcAngleBG');
  
  return image.addBands(tcAngleBG);
}
///////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
// Function to add solar zenith and azimuth in radians as bands to image
function addZenithAzimuth(img,toaOrSR,zenithDict,azimuthDict){
  if(zenithDict === undefined || zenithDict === null){zenithDict = {
    'TOA': 'SUN_ELEVATION',
    'SR': 'SOLAR_ZENITH_ANGLE'};
  }
  if(azimuthDict === undefined || azimuthDict === null){azimuthDict = {
    'TOA': 'SUN_AZIMUTH',
    'SR': 'SOLAR_AZIMUTH_ANGLE'
  };
  }
  
  var zenith = ee.Image.constant(img.get(zenithDict[toaOrSR]))
    .multiply(Math.PI).divide(180).float().rename('zenith');
  
  var azimuth = ee.Image.constant(img.get(azimuthDict[toaOrSR]))
    .multiply(Math.PI).divide(180).float().rename('azimuth');
    
  return img.addBands(zenith).addBands(azimuth);
}

////////////////////////////////////////////////////////////////////////////////
// Function for computing the mean squared difference medoid from an image 
// collection
function medoidMosaicMSD(inCollection,medoidIncludeBands) {
  if (medoidIncludeBands === undefined || medoidIncludeBands === null) {
    medoidIncludeBands = ee.Image(inCollection.first()).bandNames();
  }
  // Find the median
  var median = inCollection.select(medoidIncludeBands).median();
  
  // Find the squared difference from the median for each image
  var medoid = inCollection.map(function(img){
    var diff = ee.Image(img).select(medoidIncludeBands).subtract(median).pow(2);
    img = addYearBand(img);
    img = addJulianDayBand(img);
    return diff.reduce('sum').multiply(-1).addBands(img);
  });
  
  // Minimize the distance across all bands
  medoid = medoid.qualityMosaic('sum');
  medoid = medoid.select(medoid.bandNames().remove('sum'));
  
  return medoid;
}

////////////////////////////////////////////////////////////////////////////////
// Function to export a provided image to an EE asset
function exportToAssetWrapper(imageForExport,assetName,assetPath,
  pyramidingPolicyObject,roi,scale,crs,transform){
  //Make sure image is clipped to roi in case it's a multi-part polygon
  imageForExport = imageForExport.clip(roi);
  assetName = assetName.replace(/\s+/g,'-');//Get rid of any spaces
  
  if(pyramidingPolicyObject === null || pyramidingPolicyObject === undefined){
    pyramidingPolicyObject = {'.default':'mean'};
  }else if(typeof(pyramidingPolicyObject)=== 'string'){
    pyramidingPolicyObject = {'.default':pyramidingPolicyObject};
  }
  print('Exporting:',assetName);
  Export.image.toAsset(imageForExport, assetName, assetPath, 
    pyramidingPolicyObject, null, roi, scale, crs, transform, 1e13);
}
var exportToAssetWrapper2 = exportToAssetWrapper;
var exportToAssetWrapper3 = exportToAssetWrapper;
//Function to export to Drive and properly take care of clipping/no data
function exportToDriveWrapper(imageForExport,outputName,driveFolderName,roi,scale,crs,transform,outputNoData){
  if(outputNoData === null || outputNoData === undefined){outputNoData = -32768}
  //Make sure image is clipped to roi in case it's a multi-part polygon
  imageForExport = imageForExport.clip(roi).unmask(outputNoData,false);

  outputName = outputName.replace("/\s+/g",'-');//Get rid of any spaces
  try{
    roi = roi.geometry();
  }
  catch(e){
    var x = e;
  }
  //Ensure bounds are in web mercator
  var outRegion = roi.bounds(100,crs);
  print('Exporting:',outputName);
  Export.image.toDrive(imageForExport, outputName, driveFolderName, outputName, null, outRegion, scale, crs, transform, 1e13);
}
function exportToCloudStorageWrapper(imageForExport,outputName,bucketName,roi,scale,crs,transform,outputNoData){
  if(outputNoData === null || outputNoData === undefined){outputNoData = -32768}
  //Make sure image is clipped to roi in case it's a multi-part polygon
  imageForExport = imageForExport.clip(roi).unmask(outputNoData,false);

  outputName = outputName.replace("/\s+/g",'-');//Get rid of any spaces
  try{
    roi = roi.geometry();
  }
  catch(e){
    var x = e;
  }
  //Ensure bounds are in web mercator
  var outRegion = roi.bounds(100,crs);
  print('Exporting:',outputName);
  Export.image.toCloudStorage(imageForExport, outputName, bucketName, outputName, null, outRegion, scale, crs, transform, 1e13);
}
// exportToDriveWrapper(ee.Image(1),'jsTest1','jsTest',geometry,30,'EPSG:5070')
//////////////////////////////////////////////////
//Function for wrapping dates when the startJulian < endJulian
//Checks for year with majority of the days and the wrapOffset
function wrapDates(startJulian,endJulian){
  //Set up date wrapping
  var wrapOffset = 0;
  var yearWithMajority = 0;
    if (startJulian > endJulian) {
      wrapOffset = 365;
      var y1NDays = 365-startJulian;
      var y2NDays = endJulian;
      if(y2NDays > y1NDays){yearWithMajority = 1;}
    }
  return [wrapOffset,yearWithMajority];
}
////////////////////////////////////////////////////////////////////////////////
// Create composites for each year within startYear and endYear range
//See default args for necessary params
//There are no default params- all must be provided either listed out in the function call or as an object
function compositeTimeSeries(){
  var defaultArgs = {
    'ls':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'timebuffer':null,
    'weights':null,
    'compositingMethod':null,
    'compositingReducer':null
  }
  var args = prepArgumentsObject(arguments,defaultArgs);

  print(args);
  var dummyImage = ee.Image(args.ls.first());
  
  args.dateWrapping = wrapDates(args.startJulian,args.endJulian);
  args.wrapOffset = args.dateWrapping[0];
  args.yearWithMajority = args.dateWrapping[1];
  
  //Iterate across each year
  var ts = ee.List.sequence(args.startYear+args.timebuffer,args.endYear-args.timebuffer).getInfo()
    .map(function(year){
   
    // Set up dates
    var startYearT = year-args.timebuffer;
    var endYearT = year+args.timebuffer;
    var startDateT = ee.Date.fromYMD(startYearT,1,1).advance(args.startJulian-1,'day');
    var endDateT = ee.Date.fromYMD(endYearT,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
    
  
    // print(year,startDateT,endDateT);
    
    //Set up weighted moving widow
    var yearsT = ee.List.sequence(startYearT,endYearT);
    
    var z = yearsT.zip(args.weights);
    var yearsTT = z.map(function(i){
      i = ee.List(i);
      return ee.List.repeat(i.get(0),i.get(1));
    }).flatten();
    // print('Weighted composite years for year:',year,yearsTT);
    
    //Iterate across each year in list
    var images = yearsTT.map(function(yr){
      // Set up dates
      
      var startDateT = ee.Date.fromYMD(yr,1,1).advance(args.startJulian-1,'day');
      var endDateT = ee.Date.fromYMD(yr,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
      
      // Filter images for given date range
      var lsT = args.ls.filterDate(startDateT,endDateT.advance(1,'day'));
      lsT = fillEmptyCollections(lsT,dummyImage);
      return lsT;
    });
    var lsT = ee.ImageCollection(ee.FeatureCollection(images).flatten());
    
    var count = lsT.select([0]).count().rename(['compositeObsCount']);
    // Compute median or medoid or apply reducer
    var composite;
    if(args.compositingReducer !== undefined && args.compositingReducer !== null){
      composite = lsT.reduce(args.compositingReducer);
    }
    else if (args.compositingMethod.toLowerCase() === 'median') {
      composite = lsT.median();
    }
    else {

      composite = medoidMosaicMSD(lsT,['green','red','nir','swir1','swir2']);
    }
    composite = composite.addBands(count).float();
    return composite.set({'system:time_start':ee.Date.fromYMD(year+ args.yearWithMajority,6,1).millis(),
                        'startDate':startDateT.millis(),
                        'endDate':endDateT.millis(),
                        'startJulian':args.startJulian,
                        'endJulian':args.endJulian,
                        'yearBuffer':args.timebuffer,
                        'yearWeights': listToString(args.weights),
                        'yrOriginal':year,
                        'yrUsed': year + args.yearWithMajority
    });
  });
  return ee.ImageCollection(ts).set(args);
}



////////////////////////////////////////////////////////////////////////////////
// Function to calculate illumination condition (IC). Function by Patrick Burns 
// (pb463@nau.edu) and Matt Macander 
// (mmacander@abrinc.com)
function illuminationCondition(img){
  // Extract solar zenith and azimuth bands
  var SZ_rad = img.select('zenith');
  var SA_rad = img.select('azimuth');
  
  // Creat terrain layers
  // var dem = ee.Image('CGIAR/SRTM90_V4');
  var dem = ee.Image('USGS/NED');
  var slp = ee.Terrain.slope(dem);
  var slp_rad = ee.Terrain.slope(dem).multiply(Math.PI).divide(180);
  var asp_rad = ee.Terrain.aspect(dem).multiply(Math.PI).divide(180);
  
  // Calculate the Illumination Condition (IC)
  // slope part of the illumination condition
  var cosZ = SZ_rad.cos();
  var cosS = slp_rad.cos();
  var slope_illumination = cosS.expression("cosZ * cosS", 
                                          {'cosZ': cosZ,
                                           'cosS': cosS.select('slope')});
  // aspect part of the illumination condition
  var sinZ = SZ_rad.sin(); 
  var sinS = slp_rad.sin();
  var cosAziDiff = (SA_rad.subtract(asp_rad)).cos();
  var aspect_illumination = sinZ.expression("sinZ * sinS * cosAziDiff", 
                                           {'sinZ': sinZ,
                                            'sinS': sinS,
                                            'cosAziDiff': cosAziDiff});
  // full illumination condition (IC)
  var ic = slope_illumination.add(aspect_illumination);

  // Add IC to original image
  return img.addBands(ic.rename('IC'))
    .addBands(cosZ.rename('cosZ'))
    .addBands(cosS.rename('cosS'))
    .addBands(slp.rename('slope'));
}

////////////////////////////////////////////////////////////////////////////////
// Function to apply the Sun-Canopy-Sensor + C (SCSc) correction method to each 
// image. Function by Patrick Burns (pb463@nau.edu) and Matt Macander 
// (mmacander@abrinc.com)
function illuminationCorrection(img, scale,studyArea,bandList){
  if(bandList === null || bandList === undefined){
    bandList = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'temp']; 
  }
  
  var props = img.toDictionary();
  var st = img.get('system:time_start');
  var img_plus_ic = img;
  var mask2 = img_plus_ic.select('slope').gte(5)
    .and(img_plus_ic.select('IC').gte(0))
    .and(img_plus_ic.select('nir').gt(-0.1));
  var img_plus_ic_mask2 = ee.Image(img_plus_ic.updateMask(mask2));
  
  // Specify Bands to topographically correct  
  var compositeBands = img.bandNames();
  var nonCorrectBands = img.select(compositeBands.removeAll(bandList));
  
  function apply_SCSccorr(bandList){
    var method = 'SCSc';
    var out = img_plus_ic_mask2.select('IC', bandList).reduceRegion({
      reducer: ee.Reducer.linearFit(),
      geometry: studyArea,
      scale: scale,
      maxPixels: 1e13
    }); 
    var out_a = ee.Number(out.get('scale'));
    var out_b = ee.Number(out.get('offset'));
    var out_c = out_b.divide(out_a);
    // Apply the SCSc correction
    var SCSc_output = img_plus_ic_mask2.expression(
      "((image * (cosB * cosZ + cvalue)) / (ic + cvalue))", {
      'image': img_plus_ic_mask2.select(bandList),
      'ic': img_plus_ic_mask2.select('IC'),
      'cosB': img_plus_ic_mask2.select('cosS'),
      'cosZ': img_plus_ic_mask2.select('cosZ'),
      'cvalue': out_c
    });
    
    return SCSc_output;
  }
  
  var img_SCSccorr = ee.Image(bandList.map(apply_SCSccorr))
    .addBands(img_plus_ic.select('IC'));
  var bandList_IC = ee.List([bandList, 'IC']).flatten();
  img_SCSccorr = img_SCSccorr.unmask(img_plus_ic.select(bandList_IC)).select(bandList);
  
  return img_SCSccorr.addBands(nonCorrectBands)
    .setMulti(props)
    .set('system:time_start',st);
}
//Function for converting an array to a string delimited by the space parameter
function listToString(list,space){
  if(space === undefined){space = ' '}
  var out = '';
  list.map(function(s){out = out + s.toString()+space});
  out = out.slice(0,out.length-space.length);
  return out;
}
////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////
// A function to mask out pixels that did not have observations for MODIS.
var maskEmptyPixels = function(image) {
  // Find pixels that had observations.
  var withObs = image.select('num_observations_1km').gt(0);
  return image.mask(image.mask().and(withObs));
};
//////////////////////////////////////////////////////////////////////////
/*
 * A function that returns an image containing just the specified QA bits.
 *
 * Args:
 *   image - The QA Image to get bits from.
 *   start - The first bit position, 0-based.
 *   end   - The last bit position, inclusive.
 *   name  - A name for the output image.
 */
var getQABits = function(image, start, end, newName) {
    // Compute the bits we need to extract.
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    // Return a single band image of the extracted QA bits, giving the band
    // a new name.
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};
/////////////////////////////////////////////////////////////////
// A function to mask out cloudy pixels.
var maskCloudsWQA = function(image) {
  // Select the QA band.
  var QA = image.select('state_1km');
  // Get the internal_cloud_algorithm_flag bit.
  var internalCloud = getQABits(QA, 10, 10, 'internal_cloud_algorithm_flag');
  // Return an image masking out cloudy areas.
  return image.mask(image.mask().and(internalCloud.eq(0)));
};
/////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//Comparable bands: https://pbs.twimg.com/media/Cr2V5GJUAAAU6DX.jpg
//Source: code.earthengine.google.com
// Compute a cloud score.  This expects the input image to have the common
// band names: ["red", "blue", etc], so it can work across sensors.
function modisCloudScore(img) {
  var useTempInCloudMask = true;
  // A helper to apply an expression and linearly rescale the output.
  var rescale = function(img, exp, thresholds) {
    return img.expression(exp, {img: img})
        .subtract(thresholds[0]).divide(thresholds[1] - thresholds[0]);
  };
  // Map.addLayer(img,vizParamsFalse,'img',false)
  // Compute several indicators of cloudyness and take the minimum of them.
  var score = ee.Image(1.0);
  
  // Clouds are reasonably bright in the blue band.
  // score = score.min(rescale(img, 'img.blue', [0.1, 0.3]));
  // Map.addLayer(score,{min:0,max:1},'blue')
  // Clouds are reasonably bright in all visible bands.
  var vizSum = rescale(img, 'img.red + img.green + img.blue', [0.2, 0.8]);
  score = score.min(vizSum);
  // Map.addLayer(score,{min:0,max:1},'blue+viz',false)
  // Clouds are reasonably bright in all infrared bands.
  var irSum =rescale(img, 'img.nir  + img.swir2 + img.swir2', [0.3, 0.8]);
  score = score.min(irSum);
  
  // Map.addLayer(score,{min:0,max:1},'blue+viz+ir',false)
  
  // However, clouds are not snow.
  var ndsi = img.normalizedDifference(['green', 'swir2']);
  var snowScore = rescale(ndsi, 'img', [0.8, 0.6]);
  score =score.min(snowScore);
  // Map.addLayer(score,{min:0,max:1},'blue+viz+ir+ndsi',false)
  //For MODIS, provide the option of not using thermal since it introduces
  //a precomputed mask that may or may not be wanted
  if(useTempInCloudMask === true){
    // Clouds are reasonably cool in temperature.
    // var maskMax = img.select(['temp']).mask().focal_min(5)
    // var tempScore = rescale(img, 'img.temp', [320, 300]);
    // tempScore = ee.Image(1).where(maskMax,tempScore)
    // score = score.min(tempScore);
    
    score = score.where(img.select(['temp']).mask().not(),1);
  }
  // Map.addLayer(score,{min:0,max:1},'blue+viz+ir+ndsi+temp',false)
  score = score.multiply(100);
  score = score.clamp(0,100).byte();
  // var masked = img.updateMask(score.lt(5))
  // Map.addLayer(masked,vizParamsFalse,'imgMasked',false)
  return score.rename(['cloudScore']);
}

////////////////////////////////////////
// Cloud masking algorithm for Sentinel2
//Built on ideas from Landsat cloudScore algorithm
//Currently in beta and may need tweaking for individual study areas
function sentinel2CloudScore(img) {
  

  // Compute several indicators of cloudyness and take the minimum of them.
  var score = ee.Image(1);
  var blueCirrusScore = ee.Image(0);
  
  // Clouds are reasonably bright in the blue or cirrus bands.
  //Use .max as a pseudo OR conditional
  blueCirrusScore = blueCirrusScore.max(rescale(img, 'img.blue', [0.1, 0.5]));
  blueCirrusScore = blueCirrusScore.max(rescale(img, 'img.cb', [0.1, 0.5]));
  // blueCirrusScore = blueCirrusScore.max(rescale(img, 'img.cirrus', [0.1, 0.3]));
  
  // var reSum = rescale(img,'(img.re1+img.re2+img.re3)/3',[0.5, 0.7])
  // Map.addLayer(blueCirrusScore,{'min':0,'max':1})
  score = score.min(blueCirrusScore);


  // Clouds are reasonably bright in all visible bands.
  score = score.min(rescale(img, 'img.red + img.green + img.blue', [0.2, 0.8]));
  
  // Clouds are reasonably bright in all infrared bands.
  score = score.min(
      rescale(img, 'img.nir + img.swir1 + img.swir2', [0.3, 0.8]));
  
  
  // However, clouds are not snow.
  var ndsi =  img.normalizedDifference(['green', 'swir1']);
 
  
  score=score.min(rescale(ndsi, 'img', [0.8, 0.6]));
  
  score = score.multiply(100).byte();
  score = score.clamp(0,100).rename(['cloudScore']);
 
  return score;
}
/////////////////////////////////////////////////////////////////////////////////

// snow masking adapted from: 
// https://earth.esa.int/documents/10174/3166008/ESA_Training_Vilnius_07072017_SAR_Optical_Snow_Ice_Exercises.pdf
// dilate pixels = 3.5
function sentinel2SnowMask(img, dilatePixels){
  
  // calculate ndsi
  var ndsi = img.normalizedDifference(['green', 'swir1']);
  
  // IF NDSI > 0.40 AND ρ(NIR) > 0.11 THEN snow in open land
  // IF 0.1 < NDSI < 0.4 THEN snow in forest
  var snowOpenLand = ndsi.gt(0.4).and(img.select(['nir']).gt(0.11));
  var snowForest = ndsi.gt(0.1).and(ndsi.lt(0.4));
  
  // Fractional snow cover (FSC, 0 % - 100% snow) can be detected by the approach of Salomonson
  // and Appel (2004, 2006), which was originally developed for MODIS data:
  // FSC = –0.01 + 1.45 * NDSI
  var fsc = ndsi.multiply(1.45).subtract(0.01);
  
  // final snow mask
  if(dilatePixels === undefined || dilatePixels === null){dilatePixels = 3.5}
  
  var snowMask = ((snowOpenLand.or(snowForest)).not()).focal_min(dilatePixels);
  return img.updateMask(snowMask);
}

///////////////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////
//MODIS processing
//////////////////////////////////////////////////
//Comparable Landsat bands to MODIS https://pbs.twimg.com/media/Cr2V5GJUAAAU6DX.jpg
//Some globals to deal with multi-spectral MODIS
// var wTempSelectOrder = [2,3,0,1,4,6,5];//Band order to select to be Landsat 5-like if thermal is included
// var wTempStdNames = ['blue', 'green', 'red', 'nir', 'swir1','temp','swir2'];

// var woTempSelectOrder = [2,3,0,1,4,5];//Band order to select to be Landsat 5-like if thermal is excluded
// var woTempStdNames = ['blue', 'green', 'red', 'nir', 'swir1','swir2'];

//Band names from different MODIS resolutions
//Try to take the highest spatial res for a given band
var modis250SelectBands = ['sur_refl_b01','sur_refl_b02'];
var modis250BandNames = ['red','nir'];

var modis500SelectBands = ['sur_refl_b03','sur_refl_b04','sur_refl_b06','sur_refl_b07'];
var modis500BandNames = ['blue','green','swir1','swir2'];

var combinedModisBandNames = ['red','nir','blue','green','swir1','swir2'];

var dailyViewAngleBandNames = ['SensorZenith','SensorAzimuth','SolarZenith','SolarAzimuth'];
var compositeViewAngleBandNames = ['SolarZenith', 'ViewZenith', 'RelativeAzimuth'];
//Dictionary of MODIS collections
var modisCDict = {
  'eightDayNDVIA' : 'MODIS/006/MYD13Q1',
  'eightDayNDVIT' : 'MODIS/006/MOD13Q1',
  
  
  'eightDaySR250A' : 'MODIS/006/MYD09Q1',
  'eightDaySR250T' : 'MODIS/006/MOD09Q1',
  
  'eightDaySR500A' : 'MODIS/006/MYD09A1',
  'eightDaySR500T' : 'MODIS/006/MOD09A1',
  
  'eightDayLST1000A' : 'MODIS/006/MYD11A2',
  'eightDayLST1000T' : 'MODIS/006/MOD11A2',
  
  // 'dailyNDVIA' : 'MODIS/MYD09GA_NDVI',
  // 'dailyNDVIT' : 'MODIS/MOD09GA_NDVI',
  
  
  'dailySR250A' : 'MODIS/006/MYD09GQ',
  'dailySR250T' : 'MODIS/006/MOD09GQ',
  
  'dailySR500A' : 'MODIS/006/MYD09GA',
  'dailySR500T' : 'MODIS/006/MOD09GA',
  
  'dailyLST1000A' : 'MODIS/006/MYD11A1',
  'dailyLST1000T' : 'MODIS/006/MOD11A1'
};
var multModisDict = {
    'tempNoAngleDaily': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,0.02,1,1]),
                        ['blue','green','red','nir','swir1','temp','swir2','Emis_31','Emis_32']],
    'tempNoAngleComposite': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,0.02,1,1]),
                        ['blue','green','red','nir','swir1','temp','swir2','Emis_31','Emis_32']],
                        
    'tempAngleDaily': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,1,1,1,1,0.02,1,1]),
                      ['blue','green','red','nir','swir1','temp','swir2','SensorZenith','SensorAzimuth','SolarZenith','SolarAzimuth','Emis_31','Emis_32']],
    'tempAngleComposite': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,1,1,1,0.02,1,1]),
                      ['blue','green','red','nir','swir1','temp','swir2','SolarZenith', 'ViewZenith', 'RelativeAzimuth','Emis_31','Emis_32']],
                      
    'noTempNoAngleDaily': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001]),
                      ['blue','green','red','nir','swir1','swir2']],
    'noTempNoAngleComposite': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001]),
                      ['blue','green','red','nir','swir1','swir2']],
                      
    'noTempAngleDaily': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,1,1,1,1]),
                      ['blue','green','red','nir','swir1','swir2','SensorZenith','SensorAzimuth','SolarZenith','SolarAzimuth']],
    'noTempAngleComposite': [ee.Image([0.0001,0.0001,0.0001,0.0001,0.0001,0.0001,1,1,1]),
                      ['blue','green','red','nir','swir1','swir2','SolarZenith', 'ViewZenith', 'RelativeAzimuth']],
  };
/////////////////////////////////////////////////
//Helper function to join two collections. Adapted from: code.earthengine.google.com
function joinCollections(c1,c2, maskAnyNullValues,property,propertySecondary){
  if(maskAnyNullValues === undefined || maskAnyNullValues === null){maskAnyNullValues = true}
  if(property === undefined || property === null){property = 'system:time_start'}
  if(propertySecondary === undefined || propertySecondary === null){propertySecondary=property}
  var MergeBands = function(element) {
    // A function to merge the bands together.
    // After a join, results are in 'primary' and 'secondary' properties.
    return ee.Image.cat(element.get('primary'), element.get('secondary'));
  };

  var join = ee.Join.inner();
  var filter = ee.Filter.equals(property, null, propertySecondary);
  var joined = ee.ImageCollection(join.apply(c1, c2, filter));

  joined = ee.ImageCollection(joined.map(MergeBands));
  if(maskAnyNullValues){
    joined = joined.map(function(img){return img.mask(img.mask().and(img.reduce(ee.Reducer.min()).neq(0)))});
  }
  return joined;
}

function smartJoin(primary,secondary,hourDiff){
  var millis = hourDiff * 60 * 60 * 1000;
  
  // Create a time filter to define a match as overlapping timestamps.
var maxDiffFilter = //ee.Filter.or(
  ee.Filter.maxDifference({
    difference: millis,
    leftField: 'system:time_start',
    rightField: 'system:time_start'
  })
  // ,
  // ee.Filter.maxDifference({
  //   difference: millis,
  //   leftField: 'system:time_start',
  //   rightField: 'system:time_start'
  // })
// );
  // Define the join.
  var saveBestJoin = ee.Join.saveBest({
    matchKey: 'bestImage',
    measureKey: 'timeDiff'
  });
  var MergeBands = function(element) {
        // A function to merge the bands together.
        // After a join, results are in 'primary' and 'secondary' properties.
        return ee.Image.cat(element, element.get('bestImage'));
      };
  // Apply the join.
  var joined = saveBestJoin.apply(primary, secondary, maxDiffFilter);
  joined = joined.map(MergeBands);
  return joined;
}
//Join collections by space (intersection) and time (specified by user)
function spatioTemporalJoin(primary,secondary,hourDiff,outKey){
  if(outKey === undefined || outKey === null){outKey = 'secondary'}
  if(hourDiff === undefined || hourDiff === null){hourDiff = 24}
  var time = hourDiff* 60 * 60 * 1000;
  
  var outBns = ee.Image(secondary.first()).bandNames().map(function(bn){return ee.String(bn).cat('_').cat(outKey)});
  // Define a spatial filter as geometries that intersect.
  var spatioTemporalFilter = ee.Filter.and(
    ee.Filter.maxDifference({
      difference: time,
      leftField: 'system:time_start',
      rightField: 'system:time_start'
    }),
    ee.Filter.intersects({
    leftField: '.geo',
    rightField: '.geo',
    maxError: 10
  })
  );
  // Define a save all join.
  var saveBestJoin = ee.Join.saveBest({
    matchKey: outKey,
    measureKey: 'timeDiff'
  });
  
  // Apply the join.
  var joined = saveBestJoin.apply(primary, secondary, spatioTemporalFilter);
  var MergeBands = function(element) {
        // A function to merge the bands together.
        // After a join, results are in 'primary' and 'secondary' properties.
        return ee.Image.cat(element, ee.Image(element.get(outKey)).rename(outBns));
      };
  joined = joined.map(MergeBands);
  return joined;
    
}
//Simple inner join function for featureCollections
//Matches features based on an exact match of the fieldName parameter
//Retains the geometry of the primary, but copies the properties of the secondary collection
function joinFeatureCollections(primary,secondary,fieldName,fieldNameSecondary){
  if(fieldNameSecondary === undefined || fieldNameSecondary === null){fieldNameSecondary=fieldName}
  // Use an equals filter to specify how the collections match.
  var f = ee.Filter.equals({
    leftField: fieldName,
    rightField: fieldNameSecondary
  });
  
  // Define the join.
  var innerJoin = ee.Join.inner('primary', 'secondary');
  
  // Apply the join.
  var joined = innerJoin.apply(primary, secondary, f);
  joined = joined.map(function(f){
    var p = ee.Feature(f.get('primary'));
    var s = ee.Feature(f.get('secondary'));
    return p.copyProperties(s);
  });
  return joined;
}
//////////////////////////////////////////////////////
//////////////////////////////////////////////////////
//Method for removing spikes in time series
function despikeCollection(c,absoluteSpike,bandNo){
  c = c.toList(10000,0);
  
  //Get book ends for adding back at the end
  var first = c.slice(0,1);
  var last = c.slice(-1,null);
  
  //Slice the left, center, and right for the moving window
  var left = c.slice(0,-2);
  var center = c.slice(1,-1);
  var right = c.slice(2,null);
  
  //Find how many images there are to compare
  var seq = ee.List.sequence(0,left.length().subtract(1));
  
  //Compare the center to the left and right images
  var outCollection = seq.map(function(i){
    var lt = ee.Image(left.get(i));
    var rt = ee.Image(right.get(i));
    
    var ct = ee.Image(center.get(i));
    var time_start = ct.get('system:time_start');
    var time_end = ct.get('system:time_end');
    var si = ct.get('system:index');
   
    
    
    var diff1 = ct.select([bandNo]).add(1).subtract(lt.select([bandNo]).add(1));
    var diff2 = ct.select([bandNo]).add(1).subtract(rt.select([bandNo]).add(1));
    
    var highSpike = diff1.gt(absoluteSpike).and(diff2.gt(absoluteSpike));
    var lowSpike = diff1.lt(- absoluteSpike).and(diff2.lt(- absoluteSpike));
    var BinarySpike = highSpike.or(lowSpike);
    
    //var originalMask = ct.mask();
    // ct = ct.mask(BinarySpike.eq(0));
    
    var doNotMask = lt.mask().not().or(rt.mask().not());
    var lrMean = lt.add(rt);
    lrMean = lrMean.divide(2);
    // var out = ct.mask(doNotMask.not().and(ct.mask()))
    var out = ct.where(BinarySpike.eq(1).and(doNotMask.not()),lrMean);
    return out.set('system:index',si).set('system:time_start', time_start).set('system:time_end', time_end);
    
    
  });
  //Add the bookends back on
  outCollection =  ee.List([first,outCollection,last]).flatten();
   
  return ee.ImageCollection.fromImages(outCollection);
  
}


///////////////////////////////////////////////////////////
//Function to get MODIS data from various collections
//Will pull from daily or 8-day composite collections based on the boolean variable "daily"
function getModisData(args){
  
    var defaultArgs = {
            'startYear': null,
            'endYear': null,
            'startJulian' : null,
            'endJulian' : null,
            'daily':true,
            'maskWQA':false,
            'zenithThresh' :90,
            'useTempInCloudMask': true,
            'addLookAngleBands' : false,
            'resampleMethod' : 'bicubic'};
    
  
    var args = prepArgumentsObject(arguments,defaultArgs);
  
    
    var a250C;var t250C;var a500C;var t500C;var a1000C;var t1000C;
    var a250CV6;var t250CV6;var a500CV6;var t500CV6;var a1000CV6;var t1000CV6;
    var viewAngleBandNames;
      //Find which collections to pull from based on daily or 8-day
      if(args.daily === false){
        a250C = modisCDict.eightDaySR250A;
        t250C = modisCDict.eightDaySR250T;
        a500C = modisCDict.eightDaySR500A;
        t500C = modisCDict.eightDaySR500T;
        a1000C = modisCDict.eightDayLST1000A;
        t1000C = modisCDict.eightDayLST1000T;
        
        viewAngleBandNames = compositeViewAngleBandNames;
      }
     else{
        a250C = modisCDict.dailySR250A;
        t250C = modisCDict.dailySR250T;
        a500C = modisCDict.dailySR500A;
        t500C = modisCDict.dailySR500T;
        a1000C = modisCDict.dailyLST1000A;
        t1000C = modisCDict.dailyLST1000T;
        
        viewAngleBandNames = dailyViewAngleBandNames;
      }
      
    //Pull images from each of the collections  
    var a250 = ee.ImageCollection(a250C)
              .filter(ee.Filter.calendarRange(args.startYear,args.endYear,'year'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .select(modis250SelectBands,modis250BandNames);
    
            
    var t250 = ee.ImageCollection(t250C)
              .filter(ee.Filter.calendarRange(args.startYear,args.endYear,'year'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .select(modis250SelectBands,modis250BandNames);
    
    // var af = ee.Image(a250.first());
    // var tf = ee.Image(t250.first());
    // var abit1 = af.select(['QC_250m']).bitwiseAnd(Math.pow(2,1));
    // var tbit1 = tf.select(['QC_250m']).bitwiseAnd(Math.pow(2,1));
    // var abit8 = af.select(['QC_250m']).bitwiseAnd(Math.pow(2,8));
    // var tbit8= tf.select(['QC_250m']).bitwiseAnd(Math.pow(2,8));
    // Map.addLayer(abit1,{min:0,max:2},'abit1')
    // Map.addLayer(tbit1,{min:0,max:2},'tbit1')
    // Map.addLayer(abit8,{min:0,max:2},'abit8')
    // Map.addLayer(tbit8,{min:0,max:2},'tbit8')
    // Map.addLayer(a250.count(),{min:0,max:16},'aCount')
    // Map.addLayer(t250.count(),{min:0,max:16},'tCount')
    // Map.addLayer(a250.select(modis250SelectBands,modis250BandNames),{},'a')
    // Map.addLayer(t250.select(modis250SelectBands,modis250BandNames),{},'t')
    function get500(c){
      var images = ee.ImageCollection(c)
              .filter(ee.Filter.calendarRange(args.startYear,args.endYear,'year'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian));
              
              //Mask pixels above a certain zenith
              if(args.daily === true){
                if(args.maskWQA === true){print('Masking with QA band:',c)}
                images = images
              .map(function(img){
                img = img.mask(img.mask().and(img.select(['SolarZenith']).lt(args.zenithThresh*100)));
                if(args.maskWQA === true){
                  
                  img = maskCloudsWQA (img);
                }
                return img;
              });
              }
              if(args.addLookAngleBands){
                 images = images.select(ee.List(modis500SelectBands).cat(viewAngleBandNames),ee.List(modis500BandNames).cat(viewAngleBandNames));
              }else{
                images = images.select(modis500SelectBands,modis500BandNames);
              }
              return images;
    } 
    
    var a500 = get500(a500C);
    var t500 = get500(t500C);
    

    //If thermal collection is wanted, pull it as well
    if(args.useTempInCloudMask === true){
      var t1000 = ee.ImageCollection(t1000C)
              .filter(ee.Filter.calendarRange(args.startYear,args.endYear,'year'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .select([0,8,9],['temp','Emis_31','Emis_32']);
            
      var a1000 = ee.ImageCollection(a1000C)
              .filter(ee.Filter.calendarRange(args.startYear,args.endYear,'year'))
              .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian))
              .select([0,8,9],['temp','Emis_31','Emis_32']);    
    }
    
    //Now all collections are pulled, start joining them
    //First join the 250 and 500 m Aqua
      var a;var t;var tSelectOrder;var tStdNames;
      a = joinCollections(a250,a500,false);
      
      //Then Terra
      t = joinCollections(t250,t500,false);
      
      //If temp was pulled, join that in as well
      //Also select the bands in an L5-like order and give descriptive names
      if(args.useTempInCloudMask === true){
        a = joinCollections(a,a1000,false);
        t = joinCollections(t,t1000,false);
        
        // tSelectOrder = wTempSelectOrder;
        // tStdNames = wTempStdNames;
      }
      //If no thermal was pulled, leave that out
      // else{
      //   tSelectOrder = woTempSelectOrder;
      //   tStdNames = woTempStdNames;
      // }
    
      a = a.map(function(img){return img.set({'platform':'aqua'})});
      t = t.map(function(img){return img.set({'platform':'terra'})});
      
      //Join Terra and Aqua 
      var joined = ee.ImageCollection(a.merge(t))//.select(tSelectOrder,tStdNames);
     
      
      
      
    var dailyPiece;var tempPiece;var anglePiece;
    if(args.daily){dailyPiece = 'Daily'}else{dailyPiece = 'Composite'}
    if(args.useTempInCloudMask){tempPiece = 'temp'}else{tempPiece = 'noTemp'}
    if(args.addLookAngleBands){anglePiece = 'Angle'}else{anglePiece = 'NoAngle'}
    var multKey = tempPiece+anglePiece+dailyPiece;
    var mult = multModisDict[multKey];
    var multImage = mult[0];
    var multNames = mult[1];
    // print(multKey,multImage,multNames);
    
    joined = joined.map(function(img){return img.multiply(multImage).float().select(multNames)
        .copyProperties(img,['system:time_start','system:time_end','system:index'])
        .copyProperties(img);
      });
  if(['bilinear','bicubic'].indexOf(args.resampleMethod) > -1){
    print('Setting resampling method',args.resampleMethod);
    joined = ee.ImageCollection(joined).map(function(img){return img.resample(args.resampleMethod) });
  }
  else if(args.resampleMethod === 'aggregate'){
    print('Setting to aggregate instead of resample ');
    joined = joined.map(function(img){return img.reduceResolution(ee.Reducer.mean(), true, 64)});
  }
  return joined.set(args);
    
  }
//////////////////////////////////////////////////////////////////
//Function to get cloud, cloud shadow busted modis images
//Takes care of matching different modis collections as well
function getProcessedModis(args){

  var defaultArgs = {
            'startYear': null,
            'endYear': null,
            'startJulian' : null,
            'endJulian' : null,
            'zenithThresh' :90,
            'addLookAngleBands' : true,
            'applyCloudScore' : true,
            'applyTDOM' : true,
            'useTempInCloudMask': true,
            'cloudScoreThresh' : 20,
            'performCloudScoreOffset' :true,
            'cloudScorePctl' : 10,
            'zScoreThresh' : -1,
            'shadowSumThresh' : 0.35,
            'contractPixels' : 0,
            'dilatePixels' : 2.5,
            'shadowSumBands' : ['nir','swir2'],
            'resampleMethod' : 'bicubic',
            'preComputedCloudScoreOffset' : null,
            'preComputedTDOMIRMean' : null,
            'preComputedTDOMIRStdDev' : null,
            'addToMap' : true,
            'crs' : 'EPSG:4326',
            'scale' : 250,
            'transform' : null}
    
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  print(args)
  args.toaOrSR =  'SR';
  args.origin = 'MODIS';
  args.daily = true;
  args.maskWQA = false;
  

  // Get joined modis collection
  var modisImages = getModisData(args)
  

  if(args.addToMap){Map.addLayer(modisImages.median().reproject(args.crs,args.transform,args.scale),vizParamsFalse,'Raw Median')};


  if(args.applyCloudScore){
    print('Applying cloudScore')
    modisImages = applyCloudScoreAlgorithm(modisImages,modisCloudScore,args.cloudScoreThresh,args.cloudScorePctl,args.contractPixels,args.dilatePixels,args.performCloudScoreOffset,args.preComputedCloudScoreOffset)
  
    if(args.addToMap){
      Map.addLayer(modisImages.median().reproject(args.crs,args.transform,args.scale),vizParamsFalse,'Cloud Masked Median',false)
      Map.addLayer(modisImages.min().reproject(args.crs,args.transform,args.scale),vizParamsFalse,'Cloud Masked Min',false)
    }
  }
  if(args.applyTDOM){
    print('Applying TDOM') 
    // Find and mask out dark outliers
    modisImages = simpleTDOM2(modisImages,args.zScoreThresh,args.shadowSumThresh,args.contractPixels,args.dilatePixels,args.shadowSumBands,args.preComputedTDOMIRMean,args.preComputedTDOMIRStdDev)

    if(args.addToMap){
      Map.addLayer(modisImages.median().reproject(args.crs,args.transform,args.scale),vizParamsFalse,'Cloud/Cloud Shadow Masked Median',false)
      Map.addLayer(modisImages.min().reproject(args.crs,args.transform,args.scale),vizParamsFalse,'Cloud/Cloud Shadow Masked Min',false) 
    }
  }
  modisImages = modisImages.map(simpleAddIndices)
  modisImages = modisImages.map(function(img){return img.float()})
  return modisImages.set(args)
}
//////////////////////////////////////////////////////////////////
///Function to take images and create a median composite every n days
function nDayComposites(images,startYear,endYear,startJulian,endJulian,compositePeriod){
  
  //create dummy image for with no values
  var dummyImage = ee.Image(images.first());

  //convert to composites as defined above
  function getYrImages(yr){
    //take the year of the image
    var yr = ee.Number(yr).int16();
    //filter out images for the year
    var yrImages = images.filter(ee.Filter.calendarRange(yr,yr,'year'));
  
    //use dummy image to fill in gaps for GEE processing
    yrImages = fillEmptyCollections(yrImages,dummyImage);
    return yrImages
  }
  //Get images for a specified start day
  function getJdImages(yr,yrImages,start){
    yr = ee.Number(yr).int16();
    start = ee.Number(start).int16();
    var date = ee.Date.fromYMD(yr,1,1).advance(start.subtract(1),'day');
    var index = date.format('yyyy-MM-dd');
    var end = start.add(compositePeriod-1).int16();
    var jdImages = yrImages.filter(ee.Filter.calendarRange(start,end));
    var jdImages = fillEmptyCollections(jdImages,dummyImage);
    var composite = jdImages.median();
    return composite.set({'system:index':index,'system:time_start':date.millis()})
  }
  //Set up wrappers
  function jdWrapper(yr,yrImages){
    return ee.FeatureCollection(ee.List.sequence(startJulian,endJulian,compositePeriod).map(function(start){return getJdImages(yr,yrImages,start)}))
  }
  function yrWrapper(yr){
    var yrImages = getYrImages(yr)
    return jdWrapper(yr,yrImages)
  }
  var composites = ee.FeatureCollection(ee.List.sequence(startYear,endYear).map(function(yr){return yrWrapper(yr)}))
  //return the composites as an image collection
  composites = ee.ImageCollection(composites.flatten());

  return composites
}
//////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
function exportCollection(exportPathRoot,outputName,studyArea, crs,transform,scale,
collection,startYear,endYear,startJulian,endJulian,compositingReducer,timebuffer,exportBands){
  
  //Take care of date wrapping
  var dateWrapping = wrapDates(startJulian,endJulian);
  var wrapOffset = dateWrapping[0];
  var yearWithMajority = dateWrapping[1];
  
  //Clean up output name
  outputName = outputName.replace(/\s+/g,'-');
  outputName = outputName.replace(/\//g,'-');
  
  //Select bands for export
  collection = collection.select(exportBands);
  
  //Iterate across each year and export image
  ee.List.sequence(startYear+timebuffer,endYear-timebuffer).getInfo()
    .map(function(year){
      print('Exporting:',year);
    // Set up dates
    var startYearT = year-timebuffer;
    var endYearT = year+timebuffer+yearWithMajority;
    
    // Get yearly composite
    var composite = collection.filter(ee.Filter.calendarRange(year+yearWithMajority,year+yearWithMajority,'year'));
    composite = ee.Image(composite.first()).clip(studyArea);
    
    // Display the Landsat composite
    // Map.addLayer(composite.reproject(crs,transform,scale), vizParamsTrue, year.toString() + ' True Color ' , false);
    // Map.addLayer(composite.reproject(crs,transform,scale), vizParamsFalse, year.toString() + ' False Color ', false);
    // Add metadata, cast to integer, and export composite
    composite = composite.set({
      'system:time_start': ee.Date.fromYMD(year+yearWithMajority,6,1).millis(),
      'yearBuffer':timebuffer
    });
  
    // Export the composite 
    // Set up export name and path
    var exportName = outputName  +'_'  + startYearT + '_' + endYearT+'_' + 
      startJulian + '_' + endJulian ;
   
    
    var exportPath = exportPathRoot + '/' + exportName;
    // print('Write down the Asset ID:', exportPath);
  
    exportToAssetWrapper(composite,exportName,exportPath,'mean',
      studyArea,null,crs,transform);
    });
}
/////////////////////////////////////////////////////////////
// Function to export composite collection
//See below for necessary arguments
//All parameters must be provided
function exportCompositeCollection(){
  
  
   var defaultArgs = {
              'exportPathRoot':null,
              'outputName':null,
              'studyArea':null, 
              'crs':null,
              'transform':null,
              'scale':null,
              'collection':null,
              'startYear':null,
              'endYear':null,
              'startJulian':null,
              'endJulian':null,
              'compositingMethod':null,
              'timebuffer':null,
              'exportBands':null,
              'toaOrSR':null,
              'weights':null,
              'applyCloudScore':null, 
              'applyFmaskCloudMask':null,
              'applyTDOM':null,
              'applyFmaskCloudShadowMask':null,
              'applyFmaskSnowMask':null,
              'includeSLCOffL7':null,
              'correctIllumination':null,
              'nonDivideBands':['temp'],
              'resampleMethod':'near',
              'origin':'Landsat',
              'applyCloudProbability':null
    };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  
  args.pyramidingPolicy = 'mean';
  
  args.collection = args.collection.select(args.exportBands);
  print('Export bands:',args.exportBands);
  print('Non divide bands:',args.nonDivideBands);
   //Take care of date wrapping
  args.dateWrapping = wrapDates(args.startJulian,args.endJulian);
  args.wrapOffset = args.dateWrapping[0];
  args.yearWithMajority = args.dateWrapping[1];
  
  //Clean up output name
  args.outputName = args.outputName.replace(/\s+/g,'-');
  args.outputName = args.outputName.replace(/\//g,'-');
  
  
  var years = ee.List.sequence(args.startYear+args.timebuffer,args.endYear-args.timebuffer).getInfo()
    .map(function(year){
      
    // Set up dates
    var startYearT = year-args.timebuffer;
    var endYearT = year+args.timebuffer+args.yearWithMajority;
    
    // Get yearly composite
    var composite = args.collection.filter(ee.Filter.calendarRange(year+args.yearWithMajority,year+args.yearWithMajority,'year'));
    composite = ee.Image(composite.first());
    
    
  
    // Reformat data for export
    var compositeBands = composite.bandNames();
    if(args.nonDivideBands !== null){
      var composite10k = composite.select(compositeBands.removeAll(args.nonDivideBands))
      .multiply(10000);
      composite = composite10k.addBands(composite.select(args.nonDivideBands))
      .select(compositeBands).int16();
    }
    else{
      composite = composite.multiply(10000).int16();
    }
    
   
    args.startYearComposite = startYearT;
    args.endYearComposite = endYearT;
    args.systemTimeStartYear = year+args.yearWithMajority;
    args.yearOriginal = year;
    args.yearUsed = args.systemTimeStartYear;
    args['system:time_start'] = ee.Date.fromYMD(args.systemTimeStartYear,6,1).millis();
    
    
    // Export the composite 
    // Set up export name and path
    args.exportName = args.outputName  + '_' + args.toaOrSR + '_' + args.compositingMethod + 
      '_'  + startYearT + '_' + endYearT+'_' + 
      args.startJulian + '_' + args.endJulian ;
   
    args.exportPath = args.exportPathRoot + '/' + args.exportName;
    
    // Add metadata, cast to integer, and export composite
    composite = composite.set(args);
    
    // Display the Landsat composite
    Map.addLayer(composite, vizParamsTrue10k,  args.yearUsed.toString() + ' True Color ' + 
      args.toaOrSR, false);
    Map.addLayer(composite, vizParamsFalse10k,  args.yearUsed.toString() + ' False Color ' + 
      args.toaOrSR, false);
      
      
    print('Exporting:',composite);
    exportToAssetWrapper(composite,args.exportName,args.exportPath,args.pyramidingPolicy,
      args.studyArea,args.scale,args.crs,args.transform);
    });
}
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
//Wrapper function for getting Landsat imagery
//See default arguments below
//Required arguments: studyArea,startYear,endYear,startJulian,endJulian, crs, scale or transform
function getLandsatWrapper(){
  
   var defaultArgs = {
    'studyArea':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'timebuffer':0,
    'weights':[1],
    'compositingMethod':'medoid',
    'toaOrSR':'SR',
    'includeSLCOffL7':false,
    'defringeL5':false,
    'applyCloudScore':false,
    'applyFmaskCloudMask':true,
    'applyTDOM':false,
    'applyFmaskCloudShadowMask':true,
    'applyFmaskSnowMask':false,
    'cloudScoreThresh':10,
    'performCloudScoreOffset':true,
    'cloudScorePctl':10,
    'zScoreThresh':-1,
    'shadowSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'correctIllumination':false,
    'correctScale':250,
    'exportComposites':false,
    'outputName':'Landsat-Composite',
    'exportPathRoot':'users/ianhousman/test',
    'crs':'EPSG:5070',
    'transform':[30,0,-2361915.0,0,-30,3177735.0],
    'scale':null,
    'resampleMethod':'near', 
    'harmonizeOLI': false,
    'preComputedCloudScoreOffset':null,
    'preComputedTDOMIRMean':null,
    'preComputedTDOMIRStdDev':null,
    'landsatCollectionVersion':'C2'
    };
   
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.toaOrSR =  args.toaOrSR.toUpperCase();
  args.origin = 'Landsat';
  
  // Prepare dates
  //Wrap the dates if needed
  args.wrapOffset = 0;
  if (args.startJulian > args.endJulian) {
    args.wrapOffset = 365;
  }
   
  args.startDate = ee.Date.fromYMD(args.startYear,1,1).advance(args.startJulian-1,'day');
  args.endDate = ee.Date.fromYMD(args.endYear,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
  print('Start and end dates:', args.startDate, args.endDate);

  //Get processed Landsat scenes
  var ls = getProcessedLandsatScenes(args);
  
  // Add zenith and azimuth
  if (args.correctIllumination){
    print('Adding zenith and azimuth for terrain correction');
    ls = ls.map(function(img){
      return addZenithAzimuth(img,args.toaOrSR);
    });
  }
  

  args.ls = ls;
  // Create composite time series
  var ts = compositeTimeSeries(args);
  
  
  // Correct illumination
  if (args.correctIllumination){
    
    var f = ee.Image(ts.first());
    Map.addLayer(f,vizParamsFalse,'First-non-illuminated',false);
  
    print('Correcting illumination');
    ts = ts.map(illuminationCondition)
      .map(function(img){
        return illuminationCorrection(img, args.correctScale,args.studyArea);
      });
    var f = ee.Image(ts.first());
    Map.addLayer(f,vizParamsFalse,'First-illuminated',false);
  }
  args.collection = ts;
  
  //Export composites
  if(args.exportComposites){// Export composite collection
    if(args.compositingMethod == 'medoid'){
      args.exportBands =['blue', 'green', 'red', 'nir', 'swir1','swir2','temp','compositeObsCount','sensor','year','julianDay'];
      args.nonDivideBands = ['temp','compositeObsCount','sensor','year','julianDay'];
    }
    else{
      args.exportBands = ['blue', 'green', 'red', 'nir', 'swir1', 'swir2', 'temp','compositeObsCount'];
      args.nonDivideBands = ['temp','compositeObsCount'];
    }
    print('Args:',args);
    exportCompositeCollection(args);
  }
  
  args.processedScenes = ls;
  args.processedComposites = ts;
  return args;
}

//Wrapper function for getting Landsat imagery
function getProcessedLandsatScenes(){
    
   var defaultArgs = {
    'studyArea':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'toaOrSR':'SR',
    'includeSLCOffL7':false,
    'defringeL5':false,
    'applyCloudScore':false,
    'applyFmaskCloudMask':true,
    'applyTDOM':false,
    'applyFmaskCloudShadowMask':true,
    'applyFmaskSnowMask':false,
    'cloudScoreThresh':10,
    'performCloudScoreOffset':true,
    'cloudScorePctl':10,
    'zScoreThresh':-1,
    'shadowSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'resampleMethod':'near', 
    'harmonizeOLI':false,
    'preComputedCloudScoreOffset':null,
    'preComputedTDOMIRMean':null,
    'preComputedTDOMIRStdDev':null,
    'landsatCollectionVersion':'C2'
    };
  
    var args = prepArgumentsObject(arguments,defaultArgs);
    args.toaOrSR =  args.toaOrSR.toUpperCase();
    args.origin = 'Landsat';
  
  // Prepare dates
  //Wrap the dates if needed
  args.wrapOffset = 0;
  if (args.startJulian > args.endJulian) {
    args.wrapOffset = 365;
  }
  args.startDate = ee.Date.fromYMD(args.startYear,1,1).advance(args.startJulian-1,'day');
  args.endDate = ee.Date.fromYMD(args.endYear,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
  print('Start and end dates:', args.startDate, args.endDate);

  
  args.addPixelQA;
  if(args.toaOrSR.toLowerCase() === 'toa' && args.landsatCollectionVersion.toLowerCase() == 'c1'&& (args.applyFmaskCloudMask === true ||  args.applyFmaskCloudShadowMask === true || args.applyFmaskSnowMask === true)){
      args.addPixelQA = true;
      // applyFmaskCloudMask = false;
  
      // applyFmaskCloudShadowMask = false;
  
      // applyFmaskSnowMask = false;
    }else{args.addPixelQA = false;}
    
  // Get Landsat image collection
  var ls = getLandsat(args);
  
  // //Apply Roy 2016 harmonization if specified
  // if(harmonizeOLI){
  //   print('Apply Roy 2016 harmonization to OLI');
  //   var lsTMs = ls.filter(ee.Filter.equals('SATELLITE','LANDSAT_8').not());
  //   var lsOLIs = ls.filter(ee.Filter.equals('SATELLITE','LANDSAT_8'));
  //   lsOLIs = lsOLIs.map(harmonizationRoy);
    
  //   ls = ee.ImageCollection(lsTMs.merge(lsOLIs));
  // }

  // Apply relevant cloud masking methods
  if(args.applyCloudScore){
    print('Applying cloudScore');
    ls = applyCloudScoreAlgorithm(ls,landsatCloudScore,args.cloudScoreThresh,args.cloudScorePctl,args.contractPixels,args.dilatePixels,args.performCloudScoreOffset,args.preComputedCloudScoreOffset);     
  }
  
  if(args.applyFmaskCloudMask){
    print('Applying Fmask cloud mask');
    ls = ls.map(function(img){return applyBitMask(img,fmaskBitDict[args.landsatCollectionVersion]['cloud'],landsatFmaskBandNameDict[args.landsatCollectionVersion])});
  }
  
  if(args.applyTDOM){
    print('Applying TDOM');
    //Find and mask out dark outliers
    args.collection = ls;
    ls = simpleTDOM2(args);
  }
  if(args.applyFmaskCloudShadowMask){
    print('Applying Fmask shadow mask');
    ls = ls.map(function(img){return applyBitMask(img,fmaskBitDict[args.landsatCollectionVersion]['shadow'],landsatFmaskBandNameDict[args.landsatCollectionVersion])});
  }
  if(args.applyFmaskSnowMask){
    print('Applying Fmask snow mask');
    ls = ls.map(function(img){return applyBitMask(img,fmaskBitDict[args.landsatCollectionVersion]['snow'],landsatFmaskBandNameDict[args.landsatCollectionVersion])});
  }
  
  // Add common indices- can use addIndices for comprehensive indices 
  //or simpleAddIndices for only common indices
  ls = ls.map(simpleAddIndices)
          .map(getTasseledCap)
          .map(simpleAddTCAngles);  
  
  //Add sensor band
  ls = ls.map(function(img){return addSensorBand(img,args.landsatCollectionVersion+'_landsat',args.toaOrSR)});
  
  
  return ls.set(args);
}
///////////////////////////////////////////////////////////////////
//Wrapper function for getting Sentinel2 imagery
function getProcessedSentinel2Scenes(){
  var defaultArgs = {
    'studyArea':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'applyQABand':false,
    'applyCloudScore':false,
    'applyShadowShift':false,
    'applyTDOM':true,
    'cloudScoreThresh':20,
    'performCloudScoreOffset':true,
    'cloudScorePctl':10,
    'cloudHeights':ee.List.sequence(500,10000,500),
    'zScoreThresh': -1,
    'shadowSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'resampleMethod':'aggregate',
    'toaOrSR':'TOA',
    'convertToDailyMosaics':true,
    'applyCloudProbability':true,
    'preComputedCloudScoreOffset':null,
    'preComputedTDOMIRMean':null,
    'preComputedTDOMIRStdDev':null,
    'cloudProbThresh': 40
    };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.toaOrSR =  args.toaOrSR.toUpperCase();
  args.origin = 'Sentinel2';
  args.addCloudProbability = args.applyCloudProbability; //LSC
  print(args)
  
  // Prepare dates
  //Wrap the dates if needed
  args.wrapOffset = 0;
  if (args.startJulian > args.endJulian) {
    args.wrapOffset = 365;
  }
  args.startDate = ee.Date.fromYMD(args.startYear,1,1).advance(args.startJulian-1,'day');
  args.endDate = ee.Date.fromYMD(args.endYear,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
  print('Start and end dates:', args.startDate, args.endDate);

  
  // Get Sentinel2 image collection
  var s2s = getS2(args);
  // Map.addLayer(s2s.median().reproject('EPSG:32612',null,30),{min:0.05,max:0.4,bands:'swir1,nir,red'});
  
  if(args.applyQABand){
    print('Applying QA band cloud mask');
    s2s = s2s.map(maskS2clouds);
    // Map.addLayer(s2s.mosaic(),{min:0.05,max:0.4,bands:'swir1,nir,red'},'QA cloud masked');
  
  }
  if(args.applyCloudScore){
    print('Applying cloudScore');
     s2s = applyCloudScoreAlgorithm(s2s,sentinel2CloudScore,args.cloudScoreThresh,args.cloudScorePctl,args.contractPixels,args.dilatePixels,args.performCloudScoreOffset,args.preComputedCloudScoreOffset);
    // Map.addLayer(s2s.mosaic(),{min:0.05,max:0.4,bands:'swir1,nir,red'},'Cloud score cloud masked');
  }
  if(args.applyCloudProbability){
    print('Applying cloud probability');
    s2s = s2s.map(function(img){return img.updateMask(img.select(['cloud_probability']).lte(args.cloudProbThresh))})
  }
  if(args.applyShadowShift){
    print('Applying shadow shift');
    s2s = s2s.map(function(img){return projectShadowsWrapper(img,cloudScoreThresh,shadowSumThresh,contractPixels,dilatePixels,cloudHeights)});
    // Map.addLayer(s2s.mosaic(),{min:0.05,max:0.4,bands:'swir1,nir,red'},'shadow shift shadow masked');
  }
  if(args.applyTDOM){
    print('Applying TDOM');
    args.collection = s2s;
    s2s = simpleTDOM2(args);
    // Map.addLayer(s2s.mosaic(),{min:0.05,max:0.4,bands:'swir1,nir,red'},'TDOM shadow masked');
  }

  // Add common indices- can use addIndices for comprehensive indices 
  //or simpleAddIndices for only common indices
  s2s = s2s.map(simpleAddIndices)
          .map(getTasseledCap)
          .map(simpleAddTCAngles);  
  
  //Add sensor band
  s2s = s2s.map(function(img){return addSensorBand(img,'sentinel2',args.toaOrSR)});
  
  return s2s.set(args);
}

/////////////////////////////////////////////////////////////////////
//Wrapper function for getting Landsat imagery
function getSentinel2Wrapper(){  
  
   var defaultArgs = {
    'studyArea':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'timebuffer':0,
    'weights':[1],
    'compositingMethod':'medoid',
    'applyQABand':false,
    'applyCloudScore':false,
    'applyShadowShift':false,
    'applyTDOM':true,
    'cloudScoreThresh':20,
    'performCloudScoreOffset':true,
    'cloudScorePctl':10,
    'cloudHeights':ee.List.sequence(500,10000,500),
    'zScoreThresh': -1,
    'shadowSumThresh':0.35,
    'contractPixels':1.5,
    'dilatePixels':3.5,
    'correctIllumination':false,
    'correctScale':250,
    'exportComposites':false,
    'outputName':'Sentinel2-Composite',
    'exportPathRoot':'users/iwhousman/test',
    'crs':'EPSG:5070',
    'transform':[10,0,-2361915.0,0,-10,3177735.0],
    'scale':null,
    'resampleMethod':'aggregate',
    'toaOrSR':'TOA',
    'convertToDailyMosaics':true,
    'applyCloudProbability':true,
    'preComputedCloudScoreOffset':null,
    'preComputedTDOMIRMean':null,
    'preComputedTDOMIRStdDev':null,
    'cloudProbThresh': 40
    };
  
  var args = prepArgumentsObject(arguments,defaultArgs);
  args.toaOrSR =  args.toaOrSR.toUpperCase();
  args.origin = 'Sentinel2';
  
  var s2s = getProcessedSentinel2Scenes(args);
  
  // // Add zenith and azimuth
  // if (correctIllumination){
  //   s2s = s2s.map(function(img){
  //     return addZenithAzimuth(img,'TOA',{'TOA':'MEAN_SOLAR_ZENITH_ANGLE'},{'TOA':'MEAN_SOLAR_AZIMUTH_ANGLE'});
  //   });
  // }
 
  // Create composite time series
  args.ls = s2s;
  var ts = compositeTimeSeries(args);
  print('ts',ts)
  args.collection = ts;
  
  // Correct illumination
  // if (correctIllumination){
  //   var f = ee.Image(ts.first());
  //   Map.addLayer(f,vizParamsFalse,'First-non-illuminated',false);
  
  //   print('Correcting illumination');
  //   ts = ts.map(illuminationCondition)
  //     .map(function(img){
  //       return illuminationCorrection(img, correctScale,studyArea,[ 'blue', 'green', 'red','nir','swir1', 'swir2']);
  //     });
  //   var f = ee.Image(ts.first());
  //   Map.addLayer(f,vizParamsFalse,'First-illuminated',false);
  // }
  
  //Export composites
  if(args.exportComposites){// Export composite collection
    
    var exportBandDict = {
      'SR_medoid':['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'swir1', 'swir2','compositeObsCount','sensor','year','julianDay'],
      'SR_median':['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'swir1', 'swir2','compositeObsCount'],
      'TOA_medoid':['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'cirrus', 'swir1', 'swir2','compositeObsCount','sensor','year','julianDay'],
      'TOA_median':['cb', 'blue', 'green', 'red', 're1','re2','re3','nir', 'nir2', 'waterVapor', 'cirrus', 'swir1', 'swir2','compositeObsCount']
    };
    var nonDivideBandDict = {
      'medoid':['compositeObsCount','sensor','year','julianDay'],
      'median':['compositeObsCount']
    };
    args.exportBands = exportBandDict[args.toaOrSR + '_'+args.compositingMethod];
    args.nonDivideBands = nonDivideBandDict[args.compositingMethod];
    exportCompositeCollection(args);
  }
  args.processedScenes = s2s;
  args.processedComposites = ts;
  return args;
  
  return args;
}
////////////////////////////////////////////////////////////////////////////////
//Hybrid get Landsat and Sentinel 2 processed scenes
//Handles getting processed scenes  with Landsat and Sentinel 2
function getProcessedLandsatAndSentinel2Scenes(){
  
  var defaultArgs = {
          'studyArea':null,
          'startYear':null,
          'endYear':null,
          'startJulian':null,
          'endJulian':null,
          'toaOrSR':'TOA',
          'includeSLCOffL7':false,
          'defringeL5':false,
          'applyQABand':false,
          'applyCloudProbability':true,
          'applyShadowShift':false,
          'applyCloudScoreLandsat':false,
          'applyCloudScoreSentinel2':false,
          'applyTDOMLandsat':true,
          'applyTDOMSentinel2':true,
          'applyFmaskCloudMask':true,
          'applyFmaskCloudShadowMask':true,
          'applyFmaskSnowMask':false,
          'cloudHeights':ee.List.sequence(500,10000,500),
          'cloudScoreThresh':20,
          'performCloudScoreOffset':true,
          'cloudScorePctl':10,
          'zScoreThresh':-1,
          'shadowSumThresh':0.35,
          'contractPixels':1.5,
          'dilatePixels':3.5,
          'landsatResampleMethod':'near',
          'sentinel2ResampleMethod':'aggregate',
          'convertToDailyMosaics':true,
          'runChastainHarmonization':true,
          'correctIllumination':false,
          'correctScale':250,
          'preComputedLandsatCloudScoreOffset':null,
          'preComputedLandsatTDOMIRMean':null,
          'preComputedLandsatTDOMIRStdDev':null,
          'preComputedSentinel2CloudScoreOffset':null,
          'preComputedSentinel2TDOMIRMean':null,
          'preComputedSentinel2TDOMIRStdDev':null,
          'cloudProbThresh': 40,
          'landsatCollectionVersion' : 'C2'
        };
        
    var args = prepArgumentsObject(arguments,defaultArgs);
    
    args.toaOrSR =  args.toaOrSR.toUpperCase();
    
    if(args.toaOrSR === 'SR'){args.runChastainHarmonization = false}
  
    print('initial args:',typeof(args),args)
    //Get Landsat
    args.preComputedCloudScoreOffset = args.preComputedLandsatCloudScoreOffset;
    args.preComputedTDOMIRMean = args.preComputedLandsatTDOMIRMean;
    args.preComputedTDOMIRStdDev = args.preComputedSentinel2TDOMIRStdDev;
    args.applyCloudScore = args.applyCloudScoreLandsat;
    args.applyTDOM = args.applyTDOMLandsat;
    args.resampleMethod = args.landsatResampleMethod;
    var ls = getProcessedLandsatScenes(args);
   
    //Get Sentinel 2
    args.preComputedCloudScoreOffset = args.preComputedSentinel2CloudScoreOffset;
    args.preComputedTDOMIRMean = args.preComputedSentinel2TDOMIRMean;
    args.preComputedTDOMIRStdDev = args.preComputedSentinel2TDOMIRStdDev;
    args.applyCloudScore = args.applyCloudScoreSentinel2;
    args.applyTDOM = args.applyTDOMSentinel2;
    args.resampleMethod = args.sentinel2ResampleMethod
    var s2s = getProcessedSentinel2Scenes(args);
    
    // Map.addLayer(ls.median(),getImagesLib.vizParamsFalse,'ls');
    // Map.addLayer(s2s.median(),getImagesLib.vizParamsFalse,'s2s');
    
    //Select off common bands between Landsat and Sentinel 2
    var commonBands =  ['blue', 'green', 'red','nir','swir1', 'swir2','sensor'];
    ls = ls.select(commonBands);
    s2s = s2s.select(commonBands);
    
    //Fill in any empty collections
    //If they're both empty, this will not work
    var dummyImage =ee.Image(ee.ImageCollection(ee.Algorithms.If(ls.toList(1).length().gt(0),ls,s2s)).first());;
    ls = fillEmptyCollections(ls,dummyImage);
    s2s = fillEmptyCollections(s2s,dummyImage);
    
    if(args.runChastainHarmonization && args.toaOrSR === 'TOA'){
      
      //Seperate each sensor
      var tm = ls.filter(ee.Filter.inList('SENSOR_ID',['TM','ETM']));
      var oli = ls.filter(ee.Filter.eq('SENSOR_ID','OLI_TIRS'));
      var msi = s2s;
    
      //Fill if no images exist for particular Landsat sensor
      //Allow it to fail of no images exist for Sentinel 2 since the point
      //of this method is to include S2
      tm = fillEmptyCollections(tm,ee.Image(ls.first()));
      oli = fillEmptyCollections(oli,ee.Image(ls.first()));
    
      print('Running Chastain et al 2019 harmonization');
      
      // Map.addLayer(oli.median(),getImagesLib.vizParamsFalse,'oli before');
      // Map.addLayer(msi.median(),getImagesLib.vizParamsFalse,'msi before');
     
      //Apply correction
      //Currently coded to go to ETM+
      
      //No need to correct ETM to ETM
      // tm = tm.map(function(img){return getImagesLib.harmonizationChastain(img, 'ETM','ETM')});
      // etm = etm.map(function(img){return getImagesLib.harmonizationChastain(img, 'ETM','ETM')});
      
      //Harmonize the other two
      oli = oli.map(function(img){return harmonizationChastain(img, 'OLI','ETM')});
      msi = msi.map(function(img){return harmonizationChastain(img, 'MSI','ETM')});
      // Map.addLayer(oli.median(),getImagesLib.vizParamsFalse,'oli after');
      // Map.addLayer(msi.median(),getImagesLib.vizParamsFalse,'msi after');
      
      s2s = msi;
      
    
      //Merge Landsat back together
      ls = ee.ImageCollection(tm.merge(oli));
    
    }
   
    // Merge Landsat and S2
    var merged = ls.merge(s2s);
    merged = merged.map(simpleAddIndices)
              .map(getTasseledCap)
              .map(simpleAddTCAngles);
    args.origin = 'Landsat-Sentinel2-Hybrid';
    merged = merged.set(args);
    print('Total s2s:',s2s.size());
    print('Total landsats:',ls.size());
    print('Total merged:',merged.size())
    print(merged.aggregate_histogram('sensor'))
    return merged
}
///////////////////////////////////////////////////////////////////////////////
//Function to register an imageCollection to images within it
//Always uses the first image as the reference image
function coRegisterCollection(images,referenceBands){
  if(referenceBands === undefined || referenceBands === null){referenceBands = ['nir']}
  var referenceImageIndex = 0;
  var referenceImage = ee.Image(images.toList(referenceImageIndex+1).get(referenceImageIndex)).select(referenceBands);

  function registerImage(image){
        //Determine the displacement by matching only the referenceBand bands.
        var displacement_params = {
            'referenceImage': referenceImage,
            'maxOffset': 20.0,
            'projection': null,
            'patchWidth': 20.0,
            'stiffness': 5
            };
        var displacement = image.select(referenceBands).displacement(displacement_params);
        return image.displace(displacement);
    }
  var out = ee.ImageCollection(ee.ImageCollection(images.toList(10000,1)).map(registerImage));
  out = ee.ImageCollection(images.limit(1).merge(out));
    
  return out;
}
///////////////////////////////////////////////////////////////////////////////
//Function to find a subset of a collection
//For each group (e.g. tile or orbit or path), all images within that group will be registered
//As single collection is returned
function coRegisterGroups(imgs,fieldName,fieldIsNumeric){
  if(fieldName === undefined || fieldName === null){fieldName = 'SENSING_ORBIT_NUMBER'}
  if(fieldIsNumeric === undefined || fieldIsNumeric === null){fieldIsNumeric = true}
  var groups = ee.Dictionary(imgs.aggregate_histogram(fieldName)).keys();
  if(fieldIsNumeric){
    groups = groups.map(function(n){return ee.Number.parse(n)});
  }    
  var out =ee.ImageCollection(ee.FeatureCollection(groups.map(function(group){
    return coRegisterCollection(imgs.filter(ee.Filter.eq(fieldName,group)))})).flatten());
    
    return out;
}
///////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//Hybrid get Landsat and Sentinel 2 wrapper function
//Handles getting processed scenes and composites with Landsat and Sentinel 2
function getLandsatAndSentinel2HybridWrapper(){
  
  var defaultArgs = {
          'studyArea':null,
          'startYear':null,
          'endYear':null,
          'startJulian':null,
          'endJulian':null,
          'timebuffer': 0,
          'weights': [1],
          'compositingMethod':'medoid',
          'toaOrSR':'TOA',
          'includeSLCOffL7':false,
          'defringeL5':false,
          'applyQABand':false,
          'applyCloudProbability':true,
          'applyShadowShift':false,
          'applyCloudScoreLandsat':false,
          'applyCloudScoreSentinel2':false,
          'applyTDOMLandsat':true,
          'applyTDOMSentinel2':true,
          'applyFmaskCloudMask':true,
          'applyFmaskCloudShadowMask':true,
          'applyFmaskSnowMask':false,
          'cloudHeights':ee.List.sequence(500,10000,500),
          'cloudScoreThresh':20,
          'performCloudScoreOffset':true,
          'cloudScorePctl':10,
          'zScoreThresh':-1,
          'shadowSumThresh':0.35,
          'contractPixels':1.5,
          'dilatePixels':3.5,
          'landsatResampleMethod':'near',
          'sentinel2ResampleMethod':'aggregate',
          'convertToDailyMosaics':true,
          'runChastainHarmonization':true,
          'correctIllumination':false,
          'correctScale':250,
          'exportComposites':false,
          'outputName':'Landsat-Sentinel2-Hybrid',
          'exportPathRoot':'users/iwhousman/test/compositeCollection',
          'crs':'EPSG:5070',
          'transform':[30,0,-2361915.0,0,-30,3177735.0],
          'scale':null,
          'preComputedLandsatCloudScoreOffset':null,
          'preComputedLandsatTDOMIRMean':null,
          'preComputedLandsatTDOMIRStdDev':null,
          'preComputedSentinel2CloudScoreOffset':null,
          'preComputedSentinel2TDOMIRMean':null,
          'preComputedSentinel2TDOMIRStdDev':null,
          'cloudProbThresh': 40,
          'landsatCollectionVersion':'C2'
        }
        
  var args = prepArgumentsObject(arguments,defaultArgs);
  
    
  var merged = getProcessedLandsatAndSentinel2Scenes(args);
  print('Merged',merged)
  args.ls = merged;
  
  //Create hybrid composites
  var composites = compositeTimeSeries(args);
  args.collection = composites;
  args.origin = 'Landsat-Sentinel2-Hybrid';
  print(composites)
  if(args.exportComposites){// Export composite collection
    
    var exportBandDict = {
      'medoid':['blue', 'green', 'red','nir','swir1', 'swir2','compositeObsCount','sensor','year','julianDay'],
      'median':['blue', 'green', 'red','nir','swir1', 'swir2','compositeObsCount']
    };
    var nonDivideBandDict = {
      'medoid':['compositeObsCount','sensor','year','julianDay'],
      'median':['compositeObsCount']
    };
    args.exportBands = exportBandDict[args.compositingMethod];
    args.nonDivideBands = nonDivideBandDict[args.compositingMethod];
    print('Args:',args);
    exportCompositeCollection(args);
    
  }
  
  args.processedScenes = merged;
  args.processedComposites = composites;
  
  return args;
 
  
  // return [merged,composites];
}
///////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////
//Harmonic regression
////////////////////////////////////////////////////////////////////
//Function to give year.dd image and harmonics list (e.g. [1,2,3,...])
function getHarmonicList(yearDateImg,transformBandName,harmonicList){
    var t= yearDateImg.select([transformBandName]);
    var selectBands = ee.List.sequence(0,harmonicList.length-1);
    
    var sinNames = harmonicList.map(function(h){
      var ht = h*100;
      return ee.String('sin_').cat(ht.toString()).cat('_').cat(transformBandName);
    });
    var cosNames = harmonicList.map(function(h){
      var ht =h*100;
      return ee.String('cos_').cat(ht.toString()).cat('_').cat(transformBandName);
    });
    
    // var sinCosNames = harmonicList.map(function(h){
    //   var ht =h*100
    //   return ee.String('sin_x_cos_').cat(ht.toString()).cat('_').cat(transformBandName)
    // })
    
    var multipliers = ee.Image(harmonicList).multiply(ee.Number(Math.PI).float()) 
    var sinInd = (t.multiply(ee.Image(multipliers))).sin().select(selectBands,sinNames).float()
    var cosInd = (t.multiply(ee.Image(multipliers))).cos().select(selectBands,cosNames).float();
    // var sinCosInd = sinInd.multiply(cosInd).select(selectBands,sinCosNames);
    
    return yearDateImg.addBands(sinInd.addBands(cosInd));//.addBands(sinCosInd)
  }
//////////////////////////////////////////////////////
//Takes a dependent and independent variable and returns the dependent, 
// sin of ind, and cos of ind
//Intended for harmonic regression
function getHarmonics2(collection,transformBandName,harmonicList,detrend){
  if(detrend === undefined || detrend === null){detrend = false}
  
  var depBandNames = ee.Image(collection.first()).bandNames().remove(transformBandName);
  var depBandNumbers = depBandNames.map(function(dbn){
    return depBandNames.indexOf(dbn);
  });
  
  var out = collection.map(function(img){
    var outT = getHarmonicList(img,transformBandName,harmonicList)
    .copyProperties(img,['system:time_start','system:time_end']);
    return outT;
  });
  
  if(!detrend){
    var outBandNames = ee.Image(out.first()).bandNames().removeAll(['year'])
    out = out.select(outBandNames)
  }
  
  // Map.addLayer(out)
  var indBandNames = ee.Image(out.first()).bandNames().removeAll(depBandNames);
  var indBandNumbers = indBandNames.map(function(ind){
    return ee.Image(out.first()).bandNames().indexOf(ind);
  });
  
  out = out.set({'indBandNames':indBandNames,'depBandNames':depBandNames,
                'indBandNumbers':indBandNumbers,'depBandNumbers':depBandNumbers
  });
  
  return out;
}
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////
//Simplifies the use of the robust linear regression reducer
//Assumes the dependent is the first band and all subsequent bands are independents
function newRobustMultipleLinear2(dependentsIndependents){//,dependentBands,independentBands){
  //Set up the band names

  var dependentBands = ee.List(dependentsIndependents.get('depBandNumbers'));
  var independentBands = ee.List(dependentsIndependents.get('indBandNumbers'));
  var bns = ee.Image(dependentsIndependents.first()).bandNames();
  var dependents = ee.List(dependentsIndependents.get('depBandNames'));
  var independents = ee.List(dependentsIndependents.get('indBandNames'));
  
  // var dependent = bns.slice(0,1);
  // var independents = bns.slice(1,null)
  var noIndependents = independents.length().add(1);
  var noDependents = dependents.length();
  
  var outNames = ee.List(['intercept']).cat(independents);
 
  //Add constant band for intercept and reorder for 
  //syntax: constant, ind1,ind2,ind3,indn,dependent
  var forFit = dependentsIndependents.map(function(img){
    var out = img.addBands(ee.Image(1).select([0],['constant']));
    out = out.select(ee.List(['constant',independents]).flatten());
    return out.addBands(img.select(dependents));
  });
  
  //Apply reducer, and convert back to image with respective bandNames
  var reducerOut = forFit.reduce(ee.Reducer.linearRegression(noIndependents,noDependents));
  // var test = forFit.reduce(ee.Reducer.robustLinearRegression(noIndependents,noDependents,0.2))
  // var resids = test
  // .select([1],['residuals']).arrayFlatten([dependents]);
  // Map.addLayer(resids,{},'residsImage');
  // Map.addLayer(reducerOut.select([0]),{},'coefficients');
  // Map.addLayer(test.select([1]),{},'tresiduals');
  // Map.addLayer(reducerOut.select([1]),{},'roresiduals');
  reducerOut = reducerOut
  .select([0],['coefficients']).arrayTranspose().arrayFlatten([dependents,outNames]);
  reducerOut = reducerOut
  .set({'noDependents':ee.Number(noDependents),
  'modelLength':ee.Number(noIndependents)
    
  });
  
  return reducerOut;
};


/////////////////////////////////////////////////////////////////
//Code for finding the date of peak of green
//Also converts it to Julian day, month, and day of month
var monthRemap =[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12 ];
var monthDayRemap = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31 ];
var julianDay = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 280, 281, 282, 283, 284, 285, 286, 287, 288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 298, 299, 300, 301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 312, 313, 314, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328, 329, 330, 331, 332, 333, 334, 335, 336, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 357, 358, 359, 360, 361, 362, 363, 364, 365 ];


//Function for getting the date of the peak of veg vigor- can handle bands negatively correlated to veg in
//changeDirDict dictionary above
function getPeakDate(coeffs,peakDirection){
  if(peakDirection === null || peakDirection === undefined){peakDirection = 1};
  
  var sin = coeffs.select([0]);
  var cos = coeffs.select([1]);
  
  //Find where in cycle slope is zero
  var greenDate = ((sin.divide(cos)).atan()).divide(2*Math.PI).rename(['peakDate']);
  var greenDateLater = greenDate.add(0.5);
  //Check which d1 slope = 0 is the max by predicting out the value
  var predicted1 = coeffs.select([0])
                  .add(sin.multiply(greenDate.multiply(2*Math.PI).sin()))
                  .add(cos.multiply(greenDate.multiply(2*Math.PI).cos()))
                  .rename('predicted')
                  .multiply(ee.Image.constant(peakDirection))
                  .addBands(greenDate);
  var predicted2 = coeffs.select([0])
                  .add(sin.multiply(greenDateLater.multiply(2*Math.PI).sin()))
                  .add(cos.multiply(greenDateLater.multiply(2*Math.PI).cos()))
                  .rename('predicted')
                  .multiply(ee.Image.constant(peakDirection))
                  .addBands(greenDateLater);
  var finalGreenDate = ee.ImageCollection([predicted1,predicted2]).qualityMosaic('predicted').select(['peakDate']).rename(['peakJulianDay']);
  
  finalGreenDate = finalGreenDate.where(finalGreenDate.lt(0), greenDate.add(1)).multiply(365).int16();
  
  //Convert to month and day of month
  var greenMonth = finalGreenDate.remap(julianDay,monthRemap).rename(['peakMonth']);
  var greenMonthDay = finalGreenDate.remap(julianDay,monthDayRemap).rename(['peakDayOfMonth']);
  var greenStack = finalGreenDate.addBands(greenMonth).addBands(greenMonthDay);
  return greenStack;
  // Map.addLayer(greenStack,{'min':1,'max':12},'greenMonth',false);
}
//Function for getting left sum under the curve for a single growing season
//Takes care of normalization by forcing the min value along the curve 0
//by taking the amplitude as the intercept
//Assumes the sin and cos coeffs are the harmCoeffs
//t0 is the start time (defaults to 0)(min value should be but doesn't have to be 0)
//t1 is the end time (defaults to 1)(max value should be but doesn't have to be 1)
//
//Example of what this code is doing can be found here:
//  http://www.wolframalpha.com/input/?i=integrate+0.15949074923992157+%2B+-0.08287599*sin(2+PI+T)+%2B+-0.11252010613*cos(2+PI+T)++from+0+to+1
function getAreaUnderCurve(harmCoeffs,t0,t1){
  if(t0 === null || t0 === undefined){t0 = 0}
  if(t1 === null || t1 === undefined){t1 = 1}
  
  //Pull apart the model
  var amplitude = harmCoeffs.select([1]).hypot(harmCoeffs.select([0]));
  var intereceptNormalized = amplitude;//When making the min 0, the intercept becomes the amplitude (the hypotenuse)
  var sin = harmCoeffs.select([0]);
  var cos = harmCoeffs.select([1]);
  
  //Find the sum from - infinity to 0
  var sum0 = intereceptNormalized.multiply(t0)
            .subtract(sin.divide(2*Math.PI).multiply(Math.sin(2*Math.PI*t0)))
            .add(cos.divide(2*Math.PI).multiply(Math.cos(2*Math.PI*t0)));
  //Find the sum from - infinity to 1
  var sum1 = intereceptNormalized.multiply(t1)
            .subtract(sin.divide(2*Math.PI).multiply(Math.sin(2*Math.PI*t1)))
            .add(cos.divide(2*Math.PI).multiply(Math.cos(2*Math.PI*t1)));
  //Find the difference
  var leftSum = sum1.subtract(sum0).rename(['AUC']);
  return leftSum;
}
///////////////////////////////////////////////
function getPhaseAmplitudePeak(coeffs,t0,t1){
  if(t0 === null || t0 === undefined){t0 = 0}
  if(t1 === null || t1 === undefined){t1 = 1}
  //Parse the model
  var bandNames = coeffs.bandNames();
  var bandNumber = bandNames.length();
  var noDependents = ee.Number(coeffs.get('noDependents'));
  var modelLength = ee.Number(coeffs.get('modelLength'));
  var interceptBands = ee.List.sequence(0,bandNumber.subtract(1),modelLength);
  
  var models = ee.List.sequence(0,noDependents.subtract(1));
  
  var parsedModel =models.map(function(mn){
    mn = ee.Number(mn);
    return bandNames.slice(mn.multiply(modelLength),mn.multiply(modelLength).add(modelLength));
  });
  
  // print('Parsed harmonic regression model',parsedModel);

  //Iterate across models to convert to phase, amplitude, and peak
  var phaseAmplitude =parsedModel.map(function(pm){
      pm = ee.List(pm);
      var modelCoeffs = coeffs.select(pm);
      
      var intercept = modelCoeffs.select('.*_intercept');
      var harmCoeffs = modelCoeffs.select('.*_200_year');
      var outName = ee.String(ee.String(pm.get(1)).split('_').get(0));
      var sign = ee.Number(ee.Dictionary(changeDirDict).get(outName)).multiply(-1);
      
 
  
      var amplitude = harmCoeffs.select([1]).hypot(harmCoeffs.select([0]))
                    .multiply(2)
                    .rename([outName.cat('_amplitude')]);
      var phase = harmCoeffs.select([0]).atan2(harmCoeffs.select([1]))
                    .unitScale(-Math.PI, Math.PI)
                    .rename([outName.cat('_phase')]);
      
      //Get peak date info
      var peakDate = getPeakDate(harmCoeffs,sign);
      var peakDateBandNames = peakDate.bandNames();
      peakDateBandNames = peakDateBandNames.map(function(bn){return outName.cat(ee.String('_').cat(ee.String(bn)))});
      
      //Get the left sum
      var leftSum = getAreaUnderCurve(harmCoeffs,t0,t1);
      var leftSumBandNames = leftSum.bandNames();
      leftSumBandNames = leftSumBandNames.map(function(bn){return outName.cat(ee.String('_').cat(ee.String(bn)))});
     
      return amplitude
            .addBands(phase)
            .addBands(peakDate.rename(peakDateBandNames))
            .addBands(leftSum.rename(leftSumBandNames));
    
    });
  
    //Convert to an image
    phaseAmplitude = ee.ImageCollection.fromImages(phaseAmplitude);
    
    phaseAmplitude = ee.Image(collectionToImage(phaseAmplitude)).float()
          .copyProperties(coeffs,['system:time_start']);
    // print('pa',phaseAmplitude);
    return phaseAmplitude;


}
/////////////////////////////////////////////////////
//Function for applying harmonic regression model to set of predictor sets
function newPredict(coeffs,harmonics){
  //Parse the model
  var bandNames = coeffs.bandNames();
  var bandNumber = bandNames.length();
  var noDependents = ee.Number(coeffs.get('noDependents'));
  var modelLength = ee.Number(coeffs.get('modelLength'));
  var interceptBands = ee.List.sequence(0,bandNumber.subtract(1),modelLength);
  var timeBand = ee.List(harmonics.get('indBandNames')).get(0);
  var actualBands = harmonics.get('depBandNumbers');
  var indBands = harmonics.get('indBandNumbers');
  var indBandNames = ee.List(harmonics.get('indBandNames'));
  var depBandNames = ee.List(harmonics.get('depBandNames'));
  var predictedBandNames = depBandNames.map(function(depbnms){return ee.String(depbnms).cat('_predicted')});
  var predictedBandNumbers = ee.List.sequence(0,predictedBandNames.length().subtract(1));

  var models = ee.List.sequence(0,noDependents.subtract(1));
  var parsedModel =models.map(function(mn){
    mn = ee.Number(mn);
    return bandNames.slice(mn.multiply(modelLength),mn.multiply(modelLength).add(modelLength));
  });
  // print('Parsed harmonic regression model',parsedModel,predictedBandNames);
  
  //Apply parsed model
  var predicted =harmonics.map(function(img){
    var time = img.select(timeBand);
    var actual = img.select(actualBands).float();
    var predictorBands = img.select(indBandNames);
    
    //Iterate across each model for each dependent variable
    var predictedList =parsedModel.map(function(pm){
      pm = ee.List(pm);
      var modelCoeffs = coeffs.select(pm);
      var outName = ee.String(pm.get(1)).cat('_predicted');
      var intercept = modelCoeffs.select(modelCoeffs.bandNames().slice(0,1));
      var others = modelCoeffs.select(modelCoeffs.bandNames().slice(1,null));
    
      predicted = predictorBands.multiply(others).reduce(ee.Reducer.sum()).add(intercept).float();
      return predicted.float();
    
    });
    //Convert to an image
    predictedList = ee.ImageCollection.fromImages(predictedList);
    var predictedImage = collectionToImage(predictedList).select(predictedBandNumbers,predictedBandNames);
    
    //Set some metadata
    var out = actual.addBands(predictedImage.float())
    .copyProperties(img,['system:time_start','system:time_end']);
    return out;
    
  });
  predicted = ee.ImageCollection(predicted);
  // var g = Chart.image.series(predicted,plotPoint,ee.Reducer.mean(),90);
  // print(g);
  // Map.addLayer(predicted,{},'predicted',false);
  
  return predicted;
}
//////////////////////////////////////////////////////
//Function to get a dummy image stack for synthetic time series
function getDateStack(startYear,endYear,startJulian,endJulian,frequency){
  var years = ee.List.sequence(startYear,endYear);
  var dates = ee.List.sequence(startJulian,endJulian,frequency);
  //print(startYear,endYear,startJulian,endJulian)
  var dateSets = years.map(function(yr){
    var ds = dates.map(function(d){
      return ee.Date.fromYMD(yr,1,1).advance(d,'day');
    });
    return ds;
  });
  var l = range(1,indexNames.length+1);
  l = l.map(function(i){return i%i});
  var c = ee.Image(l).rename(indexNames);
  c = c.divide(c);
 
  dateSets = dateSets.flatten();
  var stack = dateSets.map(function(dt){
    dt = ee.Date(dt);
    var y = dt.get('year');
    var d = dt.getFraction('year');
    var i = ee.Image(y.add(d)).float().select([0],['year']);
    
    i = c.addBands(i).float()
    .set('system:time_start',dt.millis())
    .set('system:time_end',dt.advance(frequency,'day').millis());
    return i;
    
  });
  stack = ee.ImageCollection.fromImages(stack);
  return stack;
}



////////////////////////////////////////////////////////////////////
function getHarmonicCoefficientsAndFit(allImages,indexNames,whichHarmonics,detrend){
  if(detrend === undefined || detrend === null){detrend = false}
  if(whichHarmonics === undefined || whichHarmonics === null){whichHarmonics = [2]}
  
  //Select desired bands
  var allIndices = allImages.select(indexNames);
  
  //Add date band
  if(detrend){
    allIndices = allIndices.map(addDateBand);
  }
  else{
    allIndices = allIndices.map(addYearFractionBand);
  }
  
  //Add independent predictors (harmonics)
  var withHarmonics = getHarmonics2(allIndices,'year',whichHarmonics,detrend);
  var withHarmonicsBns = ee.Image(withHarmonics.first()).bandNames().slice(indexNames.length+1,null);
  
  //Optionally chart the collection with harmonics
  // var g = Chart.image.series(withHarmonics.select(withHarmonicsBns),plotPoint,ee.Reducer.mean(),30);
  // print(g);
  
  //Fit a linear regression model
  var coeffs = newRobustMultipleLinear2(withHarmonics);
  
  //Can visualize the phase and amplitude if only the first ([2]) harmonic is chosen
  // if(whichHarmonics == 2){
  //   var pa = getPhaseAmplitude(coeffs);
  // // Turn the HSV data into an RGB image and add it to the map.
  // var seasonality = pa.select([1,0]).addBands(allIndices.select([indexNames[0]]).mean()).hsvToRgb();
  // // Map.addLayer(seasonality, {}, 'Seasonality');
  // }
  
  
  
  // Map.addLayer(coeffs,{},'Harmonic Regression Coefficients',false);
  var predicted = newPredict(coeffs,withHarmonics);
  return [coeffs,predicted];
}
///////////////////////////////////////////////////////////////
//Simple predict function for harmonic coefficients
//Expects coeffs from getHarmonicCoefficientsAndFit function
//Date image is expected to be yyyy.dd where dd is the day of year / 365 (proportion of year)
//ex. synthImage(coeffs,ee.Image([2019.6]),['blue','green','red','nir','swir1','swir2','NBR','NDVI'],[2,4],true)
function synthImage(coeffs,dateImage,indexNames,harmonics,detrend){
  
  //Set up constant image to multiply coeffs by
  var constImage = ee.Image(1);
  if(detrend){constImage = constImage.addBands(dateImage);}
  harmonics.map(function(harm){
    constImage = constImage.addBands(ee.Image([dateImage.multiply(harm*Math.PI).sin()]))
                           .addBands(ee.Image([dateImage.multiply(harm*Math.PI).cos()]));
  });
  
  //Predict values for each band                    
  var out = ee.Image(1);
  out = ee.Image(ee.List(indexNames).iterate(function(bn, out) {
    bn = ee.String(bn);
    //Select coeffs for that band
    var coeffssBn = coeffs.select(ee.String(bn).cat('.*'));
    
    var predicted = constImage.multiply(coeffssBn).reduce('sum').rename(bn);
    return ee.Image(out).addBands(predicted);
  },out));
  
  out = out.select(ee.List.sequence(1, out.bandNames().size().subtract(1)));
 
  return out;
}
///////////////////////////////////////////////////////////////
// function getHarmonicFit(allImages,indexNames,whichHarmonics){
//   getHarmonicCoefficients(allImages,indexNames,whichHarmonics)
//   // newPredict(coeffs,withHarmonics)
  
// //   var dateStack = getDateStack(startDate.get('year'),endDate.get('year'),startDate.getFraction('year').multiply(365),endDate.getFraction('year').multiply(365),syntheticFrequency);
// //   var synthHarmonics = getHarmonics2(dateStack,'year',whichHarmonics)
// //   var predictedBandNames = indexNames.map(function(nm){
// //     return ee.String(nm).cat('_predicted')
// //   })
// //   var syntheticStack = ee.ImageCollection(newPredict(coeffs,synthHarmonics)).select(predictedBandNames,indexNames)
 
// //   //Filter out and visualize synthetic test image
// //   Map.addLayer(syntheticStack.median(),vizParams,'Synthetic All Images Composite',false);
// //   var test1ImageSynth = syntheticStack.filterDate(test1Start,test1End);
// //   Map.addLayer(test1ImageSynth,vizParams,'Synthetic Test 1 Composite',false);
// //   var test2ImageSynth = syntheticStack.filterDate(test2Start,test2End);
// //   Map.addLayer(test2ImageSynth,vizParams,'Synthetic Test 2 Composite',false);
  
  
// //   //Export image for download
// //   var forExport = setNoData(coeffs.clip(sa),outNoData);
// //   Map.addLayer(forExport,vizParamsCoeffs,'For Export',false);
// //   Export.image(forExport,exportName,{'crs':crs,'region':regionJSON,'scale':exportRes,'maxPixels':1e13})
  
// //   Export.table(ee.FeatureCollection([metaData]),exportName + '_metadata');
// //   return syntheticStack
// }
////////////////////////////////////////////////////////////////////////////////
//Wrapper function to get climate data
// Supports:
// NASA/ORNL/DAYMET_V3
// NASA/ORNL/DAYMET_V4
// UCSB-CHG/CHIRPS/DAILY (precipitation only)
//and possibly others
function getClimateWrapper(collectionName,studyArea,startYear,endYear,startJulian,endJulian,
  timebuffer,weights,compositingReducer,
  exportComposites,exportPathRoot,crs,transform,scale,exportBands){
    
   var defaultArgs = {
    'collectionName':'NASA/ORNL/DAYMET_V4',
    'studyArea':null,
    'startYear':null,
    'endYear':null,
    'startJulian':null,
    'endJulian':null,
    'timebuffer':0,
    'weights':[1],
    'compositingReducer':ee.Reducer.mean(),
    'exportComposites':false,
    'exportPathRoot':'users/iwhousman/test/climate-test',
    'crs':'EPSG:5070',
    'transform':[30,0,-2361915.0,0,-30,3177735.0],
    'scale':null,
    'exportBands':null, 
    };
   
  var args = prepArgumentsObject(arguments,defaultArgs);
  print(args)
    
  // Prepare dates
  //Wrap the dates if needed
  args.wrapOffset = 0;
  if (args.startJulian > args.endJulian) {
    args.wrapOffset = 365;
  }
  args.startDate = ee.Date.fromYMD(args.startYear,1,1).advance(args.startJulian-1,'day');
  args.endDate = ee.Date.fromYMD(args.endYear,1,1).advance(args.endJulian-1+args.wrapOffset,'day');
  print('Start and end dates:', args.startDate, args.endDate);
  print('Julian days are:',args.startJulian,args.endJulian);
  //Get climate data
  var c = ee.ImageCollection(args.collectionName)
          .filterBounds(args.studyArea)
          .filterDate(args.startDate,args.endDate.advance(1,'day'))
          .filter(ee.Filter.calendarRange(args.startJulian,args.endJulian));
  
  c = c.map(function(img){return img.resample('bicubic')});
  
  // Create composite time series
  var ts = compositeTimeSeries(c,args.startYear,args.endYear,args.startJulian,args.endJulian,args.timebuffer,args.weights,null,args.compositingReducer);
    
  if(args.exportComposites){
    //Set up export bands if not specified
    if(args.exportBands === null || args.exportBands === undefined){
      args.exportBands = ee.Image(ts.first()).bandNames();
    }
    print('Export bands are:',args.exportBands);
    //Export collection
    exportCollection(args.exportPathRoot,args.collectionName,args.studyArea, args.crs,args.transform,args.scale,
      ts,args.startYear,args.endYear,args.startJulian,args.endJulian,args.compositingReducer,args.timebuffer,args.exportBands);
     
  }
  
  return ts;
  }
//////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
//Adds absolute difference from a specified band summarized by a provided percentile
//Intended for custom sorting across collections
var addAbsDiff = function(inCollection, qualityBand, percentile,sign){
  var bestQuality = inCollection.select([qualityBand]).reduce(ee.Reducer.percentile([percentile]));
  var out = inCollection.map(function(image) {
    var delta = image.select([qualityBand]).subtract(bestQuality).abs().multiply(sign);
    return image.addBands(delta.select([0], ['delta']));
  });
  return out
};
////////////////////////////////////////////////////////////
//Method for applying the qualityMosaic function using a specified percentile
//Useful when the max of the quality band is not what is wanted
var customQualityMosaic = function(inCollection,qualityBand,percentile){
  //Add an absolute difference from the specified percentile
  //This is inverted for the qualityMosaic function to properly prioritize
  var inCollectionDelta = addAbsDiff(inCollection, qualityBand, percentile,-1);
  
  //Apply the qualityMosaic function
  return inCollectionDelta.qualityMosaic('delta');

};
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////
//On-the-fly basic water masking method
//This method is used to provide a time-sensitive water mask
//This method tends to work well if there is no wet snow present
//Wet snow over flat areas can result in false positives
//Designed to work with TOA data. SR data will result in false negatives (omission)
function simpleWaterMask(img,contractPixels,slope_thresh,elevationImagePath,elevationFocalMeanRadius){
  if(contractPixels === null || contractPixels === undefined){contractPixels = 0};
  if(slope_thresh === null || slope_thresh === undefined){slope_thresh = 10};
  if(elevationImagePath === null || elevationImagePath === undefined){elevationImagePath = "USGS/NED"};
  if(elevationFocalMeanRadius === null || elevationFocalMeanRadius === undefined){elevationFocalMeanRadius = 5.5};
  
  
  img = addTCAngles(img);
  
  //Find flat areas
  var ned = ee.Image(elevationImagePath).resample('bicubic');
  var slope = ee.Terrain.slope(ned.focal_mean(elevationFocalMeanRadius));
  var flat = slope.lte(slope_thresh);
  
  var waterMask = img.select(['tcAngleBW']).gte(-0.05)
    .and(img.select(['tcAngleBG']).lte(0.05))
    .and(img.select(['brightness']).lt(0.3))
    .and(flat).focal_min(contractPixels);
  
  return waterMask.rename(['waterMask']);
}
// End Functions
////////////////////////////////////////////////////////////////////////////////////////////////////
//Jeff Ho Method for algal bloom detection
//https://www.nature.com/articles/s41586-019-1648-7

/// Simplified Script for Landsat Water Quality
// Produces a map of an algal bloom in Lake Erie on 2011/9/3
// Created on 12/7/2015 by Jeff Ho

// Specifies a threshold for hue to estimate "green" pixels
// this is used as an additional filter to refine the algorithm above
var HoCalcGreenness = function (img) {
  // map r, g, and b for more readable algebra below
  var r = img.select(['red']);
  var g = img.select(['green']);
  var b = img.select(['blue']);
  
  // calculate intensity, hue
  var I = r.add(g).add(b).rename(['I']);
  var mins = r.min(g).min(b).rename(['mins']);
  var H = mins.where(mins.eq(r),
    (b.subtract(r)).divide(I.subtract(r.multiply(3))).add(1) );
  H = H.where(mins.eq(g),
    (r.subtract(g)).divide(I.subtract(g.multiply(3))).add(2) );
  H = H.where(mins.eq(b),
    (g.subtract(b)).divide(I.subtract(b.multiply(3))) );
    
  //pixels with hue below 1.6 more likely to be bloom and not suspended sediment
  var Hthresh = H.lte(1.6);
  
  return H.rename('H');
};

// Apply bloom detection algorithm
exports.HoCalcAlgorithm1 = function(image) {
  var truecolor = 1;  // show true color image as well
  var testThresh = false; // add a binary image classifying into "bloom"and "non-bloom
  var bloomThreshold = 0.02346; //threshold for classification fit based on other data
  var greenessThreshold = 1.6;

  // Algorithm 1 based on:
  // Wang, M., & Shi, W. (2007). The NIR-SWIR combined atmospheric 
  //  correction approach for MODIS ocean color data processing. 
  //  Optics Express, 15(24), 15722–15733.
  
  // Add secondary filter using greenness function below
  image = image.addBands(HoCalcGreenness(image));

  // Apply algorithm 1: B4 - 1.03*B5
  var bloom1 = image.select('nir').subtract(image.select('swir1').multiply(1.03)).rename('bloom1');

  // Get binary image by applying the threshold
  var bloom1_mask = image.select("H").lte(greenessThreshold).rename(["bloom1_mask"]);
  
  //return original image + bloom, bloom_thresh
  return image
          .addBands(bloom1)
          .addBands(bloom1_mask);
};
//
// Apply bloom detection algorithm
exports.HoCalcAlgorithm2 = function(image) {
  // Algorithm 2 based on: 
  // Matthews, M. (2011) A current review of empirical procedures 
  //  of remote sensing in inland and near-coastal transitional 
  //  waters, International Journal of Remote Sensing, 32:21, 
  //  6855-6899, DOI: 10.1080/01431161.2010.512947
  
  // Apply algorithm 2: B2/B1
  var bloom2 = image.select('green')
              .divide(image.select('blue'))
              .rename(['bloom2']);
  
  //return original image + bloom, bloom_thresh
  return image
          .addBands(bloom2);
};

//////////////////////////////////////////////////////////////////////////
// END FUNCTIONS
////////////////////////////////////////////////////////////////////////////////
exports.sieve = sieve;
exports.setNoData = setNoData;
exports.addSensorBand = addSensorBand;
exports.addJulianDayBand = addJulianDayBand;
exports.addYearYearFractionBand = addYearYearFractionBand;
exports.addYearBand = addYearBand;
exports.addDateBand = addDateBand;
exports.addYearJulianDayBand = addYearJulianDayBand;
exports.offsetImageDate = offsetImageDate;
exports.addFullYearJulianDayBand = addFullYearJulianDayBand;
exports.wrapDates = wrapDates;
exports.collectionToImage = collectionToImage;
exports.getImageCollection = getImageCollection;
exports.getLandsat = getLandsat;
exports.getS2 = getS2;
exports.getSentinel2 = getSentinel2;
exports.getS1 = getS1;
exports.RefinedLee = RefinedLee;
exports.vizParamsFalse = vizParamsFalse;
exports.vizParamsTrue = vizParamsTrue;
exports.vizParamsFalse10k = vizParamsFalse10k;
exports.vizParamsTrue10k = vizParamsTrue10k;
exports.rescale = rescale;
exports.landsatCloudScore = landsatCloudScore;
exports.sentinel2CloudScore = sentinel2CloudScore;
exports.sentinel2SnowMask = sentinel2SnowMask;
exports.projectShadowsWrapper = projectShadowsWrapper;
exports.applyCloudScoreAlgorithm = applyCloudScoreAlgorithm;
exports.cFmask = cFmask;
exports.applyBitMask = applyBitMask;
exports.simpleTDOM2 = simpleTDOM2;
exports.medoidMosaicMSD = medoidMosaicMSD;
exports.addIndices = addIndices;
exports.addSAVIandEVI = addSAVIandEVI;
exports.simpleAddIndices = simpleAddIndices;
exports.getTasseledCap = getTasseledCap;
exports.simpleGetTasseledCap = simpleGetTasseledCap;
exports.simpleAddTCAngles = simpleAddTCAngles;
exports.compositeTimeSeries = compositeTimeSeries;
exports.addZenithAzimuth = addZenithAzimuth;
exports.illuminationCorrection = illuminationCorrection;
exports.illuminationCondition = illuminationCondition;
exports.addTCAngles = addTCAngles;
exports.simpleAddTCAngles = simpleAddTCAngles;
exports.exportCompositeCollection = exportCompositeCollection;


exports.getProcessedLandsatScenes = getProcessedLandsatScenes;
exports.getProcessedSentinel2Scenes = getProcessedSentinel2Scenes;
exports.getProcessedLandsatAndSentinel2Scenes = getProcessedLandsatAndSentinel2Scenes;

exports.coRegisterCollection = coRegisterCollection;
exports.coRegisterGroups = coRegisterGroups;

exports.getLandsatWrapper = getLandsatWrapper;
exports.getSentinel2Wrapper =getSentinel2Wrapper;

exports.getLandsatAndSentinel2HybridWrapper = getLandsatAndSentinel2HybridWrapper

exports.getModisData = getModisData;
exports.modisCloudScore = modisCloudScore;
exports.despikeCollection = despikeCollection;
exports.exportToAssetWrapper = exportToAssetWrapper;
exports.exportToAssetWrapper2 = exportToAssetWrapper2;
exports.exportToDriveWrapper = exportToDriveWrapper;
exports.exportToCloudStorageWrapper = exportToCloudStorageWrapper;
exports.exportCollection = exportCollection;
exports.joinCollections = joinCollections;
exports.smartJoin = smartJoin;
exports.spatioTemporalJoin = spatioTemporalJoin;
exports.joinFeatureCollections = joinFeatureCollections;
exports.listToString = listToString;
exports.harmonizationRoy = harmonizationRoy;
exports.harmonizationChastain = harmonizationChastain;
exports.fillEmptyCollections = fillEmptyCollections;
exports.nDayComposites = nDayComposites;
exports.getHarmonicCoefficientsAndFit = getHarmonicCoefficientsAndFit;
exports.getPhaseAmplitudePeak = getPhaseAmplitudePeak;
exports.getAreaUnderCurve = getAreaUnderCurve;
exports.synthImage = synthImage;

exports.getClimateWrapper = getClimateWrapper;
exports.exportCollection = exportCollection;
exports.changeDirDict = changeDirDict;
exports.addSoilIndices = addSoilIndices;

exports.addAbsDiff = addAbsDiff;
exports.customQualityMosaic  = customQualityMosaic;
exports.compositeDates = compositeDates;
exports.defringeLandsat = defringeLandsat;

exports.simpleWaterMask = simpleWaterMask;
exports.common_projections = common_projections;
exports.testAreas = {};
exports.testAreas.CO = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-108.28630509064759, 38.085343638120925],
          [-108.28630509064759, 37.18051220092945],
          [-106.74821915314759, 37.18051220092945],
          [-106.74821915314759, 38.085343638120925]]], null, false),
    exports.testAreas.CA = 
    /* color: #d63000 */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-119.96383760287506, 37.138150574108714],
          [-119.96383760287506, 36.40774412106424],
          [-117.95333955600006, 36.40774412106424],
          [-117.95333955600006, 37.138150574108714]]], null, false);
    exports.testAreas.HI = ee.Geometry.Polygon(
        [[[-160.50824874450544, 22.659814513909474],
          [-160.50824874450544, 18.54750309959827],
          [-154.35590499450544, 18.54750309959827],
          [-154.35590499450544, 22.659814513909474]]], null, false);
