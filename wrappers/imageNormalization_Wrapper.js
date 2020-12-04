/////////// NORMALIZE FUNCTIONS //////////////////////////////////////////////////////////////////////////

//NORMALIZES THE SCENE AND CALCUATES INDICES AND TASSELED CAP
function normImages(polyList,Master,Image2) {
  if(polyList.length === 0) { 
    alert("Cannot normalize images until PIF polygons are drawn.");
  }else{   
    var master = Master.select(['blue', 'green', 'red','re1', 're2', 're3','nir', 'swir1', 'swir2']);
    print(master, "master image")
    
    // master = master.mosaic()
    //   .set("system:time_start",master.first().get("system:time_start"))
    //   .set("WRS_PATH",master.first().get("WRS_PATH"))
    //   .set("WRS_ROW",master.first().get("WRS_ROW"))
    //   .clip(master.union().geometry());
    
    var tonorm = Image2.select(['blue', 'green', 'red','re1', 're2', 're3', 'nir', 'swir1', 'swir2']);
    print(tonorm, "tonorm")
    Map.addLayer(tonorm, {min:0, max: 2000, gamma: 1.3, bands: ['red', 'green', 'blue']}, 'tonorm');
    
    // tonorm = tonorm.mosaic()
    //   .set("system:time_start",tonorm.first().get("system:time_start"))
    //   .set("WRS_PATH",tonorm.first().get("WRS_PATH"))
    //   .set("WRS_ROW",tonorm.first().get("WRS_ROW"))
    //   .clip(tonorm.union().geometry());
  
    // tonorm = addYearDOY(tonorm);
    // tonorm = addPathRow(tonorm);
  
    var z = 0.04;
    var bandsPIF = ['blue', 'green', 'red','re1', 're2', 're3', 'nir', 'swir1', 'swir2'];
    var nonSpectralBands = []; // ['year','DOY','pathRow'];
    
    var PIFpixels = getPIFsPair(tonorm, master, bandsPIF, z);
    var PIF_clip = PIFpixels.clip(ee.FeatureCollection(polyList));
    var norm = imgNormalizerMultiConstant(tonorm, master, PIF_clip, nonSpectralBands);
  
    var tcInputBands = ee.List(['blue', 'green', 'red','nir', 'swir1', 'swir2']);
    
    norm = PCA_PD(norm, 20,norm.get('system:footprint'));
    norm = addIndices(norm);
    norm = S2rescale(norm);
    norm = getTasseledCap(norm,tcInputBands);
    
    
    //print(norm,'NORM');
    //Map.addLayer(norm, {min:0, max: 2000, gamma: 1.3, bands: ['Red', 'Green', 'Blue']}, 'Normalized');
    
    return norm;
  }
}


function normImages2(polyList,Master,Image2) {
  if(polyList.length === 0) {
    alert("Cannot normalize images until PIF polygons are drawn.");
  }else{
    var master = Master.select(['blue', 'green', 'red','re1', 're2', 're3', 'nir', 'swir1', 'swir2']);
    
    // master = master.mosaic()
    //   .set("system:time_start",master.first().get("system:time_start"))
    //   .set("WRS_PATH",master.first().get("WRS_PATH"))
    //   .set("WRS_ROW",master.first().get("WRS_ROW"))
    //   .clip(master.union().geometry());
    
    var tonorm = Image2.select(['blue', 'green', 'red','re1', 're2', 're3','nir', 'swir1', 'swir2']);
    print(tonorm, "tonorm")
   
    // tonorm = tonorm.mosaic()
    //   .set("system:time_start",tonorm.first().get("system:time_start"))
    //   .set("WRS_PATH",tonorm.first().get("WRS_PATH"))
    //   .set("WRS_ROW",tonorm.first().get("WRS_ROW"))
    //   .clip(tonorm.union().geometry());
  
    // tonorm = addYearDOY(tonorm);
    // tonorm = addPathRow(tonorm);
  
    var z = 0.04;
    var bandsPIF = ['blue', 'green', 'red','re1', 're2', 're3','nir', 'swir1', 'swir2'];
    var nonSpectralBands = []; // ['year','DOY','pathRow'];
    
    var PIFpixels = getPIFsPair(tonorm, master, bandsPIF, z);
    var PIF_clip = PIFpixels.clip(ee.FeatureCollection(polyList));
    var norm = imgNormalizerMultiConstant(tonorm, master, PIF_clip, nonSpectralBands);
  
    var tcInputBands = ee.List(['blue', 'green', 'red','nir', 'swir1', 'swir2']);
    
    norm = PCA_PD(norm, 20,norm.get('system:footprint'));
    norm = addIndices(norm);
    norm = S2rescale(norm);
    norm = getTasseledCap(norm,tcInputBands);
    
    
    //print(norm,'NORM');
    //Map.addLayer(norm, {min:0, max: 2000, gamma: 1.3, bands: ['Red', 'Green', 'Blue']}, 'Normalized');
    
    return norm;
  }
}



// FUNCTION CALCULATES AND OUTPUTS MASTER IMAGE COLLECTION WITH INDICES AND TASSLED CAP
var outorig = function getOrig() {
  var imageId = app.picker.select1.getValue();
  var image1 = ee.ImageCollection([ee.Image(app.COLLECTION_ID + '/' + imageId)]);
  var master = image1.select(['blue', 'green', 'red','re1', 're2', 're3', 'nir', 'swir1', 'swir2']);
  
  master = master.mosaic()
    .set("system:time_start",master.first().get("system:time_start"))
    .set("WRS_PATH",master.first().get("WRS_PATH"))
    .set("WRS_ROW",master.first().get("WRS_ROW"))
    .clip(master.union().geometry());
 
  // master = addYearDOY(master);
  // master = addPathRow(master);
  
  var tcInputBands = ee.List(['blue', 'green', 'red','nir', 'swir1', 'swir2']);
  
  master = PCA_PD(master, 20, master.get('system:footprint'));
  master = addIndices(master);
  master = S2rescale(master);
  master = getTasseledCap(master,tcInputBands);
  
  print(master, 'master');
  return master;
};

// FUNCTION TO EXPORT MASTER IMAGE COLLECTION
function exportMaster(){
  var imageId = app.picker.select1.getValue();
  var outmaster = outorig(0);
  
  var outmaster_10m = outmaster.select(['blue', 'green', 'red','nir','NDVI']);
  var outmaster_20m = outmaster.select(['re1', 're2', 're3','swir1', 'swir2', 'NDMI', 'pc1','pc2','pc3']);
  // var outmaster_DOY = outmaster.select(['year', 'DOY', 'pathRow']);
  var outmaster_tc = outmaster.select(['brightness', 'greenness', 'wetness']);

  
  var exportRegion = outmaster.geometry();
  var prj = app.export.utm.getValue();
  var date = imageId.slice(0,8);  
  Export.image.toDrive({
    image: outmaster_10m,
    description: 'master_10m_' + date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
  
  Export.image.toDrive({
    image: outmaster_20m,
    description: 'master_20m_'+ date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
  
  // Export.image.toDrive({
  //   image: outmaster_DOY,
  //   description: 'master_DOY_'+ date,
  //   crs: prj,
  //   scale: 30,
  //   region: exportRegion,
  //   maxPixels: 1.0E13
  // });
  
  Export.image.toDrive({
    image: outmaster_tc,
    description: 'master_tc_'+ date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
}

// FUNCTION TO EXPORT NORAMLIZED IMAGE COLLECTION
function exportNorm(){
  var imageId2 = app.picker.select2.getValue();
  var norm = outnorm(0);
  
  //Select 30-m bands for export
  var norm_10m = norm.select(['blue', 'green', 'red','nir','NDVI']);
  var norm_20m = norm.select(['re1', 're2', 're3','swir1', 'swir2', 'NDMI', 'pc1','pc2','pc3']);
  // var norm_DOY = norm.select(['year', 'DOY', 'pathRow']);
  var norm_tc = norm.select(['brightness', 'greenness', 'wetness']);
  
  var exportRegion = norm.geometry();
  var prj = app.export.utm.getValue();
  var date = imageId2.slice(0,8);  
  
  Export.image.toDrive({
    image: norm_10m,
    description: 'normalized_10m_' + date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
  
  Export.image.toDrive({
    image: norm_20M,
    description: 'normalized_20m_' + date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
  
  // Export.image.toDrive({
  //   image: norm_DOY,
  //   description: 'normalized_DOY_' + date,
  //   crs: prj,
  //   scale: 30,
  //   region: exportRegion,
  //   maxPixels: 1.0E13
  // });
  
  Export.image.toDrive({
    image: norm_tc,
    description: 'normalized_tc_' + date,
    crs: prj,
    scale: 30,
    region: exportRegion,
    maxPixels: 1.0E13
  });
}

// Helper function to convert image collection into stack of image bands
function newCollectionToImage(collection){
  var stack = ee.Image(collection.iterate(function(img, prev) {
    return ee.Image(prev).addBands(img);
  }, ee.Image(1)));
  stack = stack.select(ee.List.sequence(1, stack.bandNames().size().subtract(1)));
  return stack;
}



function S2rescale (img){
  var img = img.select('blue', 'green', 'red','re1', 're2', 're3','nir', 'swir1', 'swir2', 'pc1','pc2','pc3', 'NDVI', 'NDMI');
  var img_main = img.select('pc1','pc2','pc3', 'NDVI', 'NDMI').multiply(1000);
  var img_other = img.select('blue', 'green', 'red','re1', 're2', 're3','nir', 'swir1', 'swir2');
  var mask = img.select('blue').neq(0);
  return img_other.addBands(img_main).updateMask(mask).int16();
}

//PCA Function
function PCA_PD(Image_In, scale, region){
  var bandNames = Image_In.bandNames();
  var getNewBandNames = function(prefix) {
  var seq = ee.List.sequence(1, bandNames.length());
  return seq.map(function(b) {
    return ee.String(prefix).cat(ee.Number(b).int());
  });
  };
  // Mean center the data to enable a faster covariance reducer
  // and an SD stretch of the principal components.
  var meanDict = Image_In.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: region,
  scale: scale,
  maxPixels: 1e13
  });
  var means = meanDict.toImage();
  var centered = Image_In.subtract(means);
  // Collapse the bands of the image into a 1D array per pixel.
  var arrays = centered.toArray();
  // Compute the covariance of the bands within the region.
  var covar = arrays.reduceRegion({
    reducer: ee.Reducer.centeredCovariance(),
    geometry: region,
    scale: scale,
    maxPixels: 1e13
  });
  // Get the 'array' covariance result and cast to an array.
  // This represents the band-to-band covariance within the region.
  var covarArray = ee.Array(covar.get('array'));
  // Perform an eigen analysis and slice apart the values and vectors.
  var eigens = covarArray.eigen();
  // This is a P-length vector of Eigenvalues.
  var eigenValues = eigens.slice(1, 0, 1);
  // This is a PxP matrix with eigenvectors in rows.
  var eigenVectors = eigens.slice(1, 1);
  // Convert the array image to 2D arrays for matrix computations.
  var arrayImage = arrays.toArray(1);
  // Left multiply the image array by the matrix of eigenvectors.
  var principalComponents = ee.Image(eigenVectors).matrixMultiply(arrayImage);
  // Turn the square roots of the Eigenvalues into a P-band image.
  var sdImage = ee.Image(eigenValues.sqrt())
      .arrayProject([0]).arrayFlatten([getNewBandNames('sd')]);
  // Turn the PCs into a P-band image, normalized by SD.
  var principalComponents_format = principalComponents
      // Throw out an an unneeded dimension, [[]] -> [].
      .arrayProject([0])
      // Make the one band array image a multi-band image, [] -> image.
      .arrayFlatten([getNewBandNames('pc')])
      // Normalize the PCs by their SDs.
      .divide(sdImage);
  var bandpc1 = principalComponents_format.select([0]);
  var bandpc2 = principalComponents_format.select([1]);
  var bandpc3 = principalComponents_format.select([2]);
  return Image_In.addBands(bandpc1).addBands(bandpc2).addBands(bandpc3);
}

//Function to add common spectral indices to an image:
function addIndices(img){
  // Add Normalized Difference Vegetation Index (NDVI)
  img = img.addBands(img.normalizedDifference(['nir','red']).rename('NDVI'));
  
  // Add Normalized Difference Moisture Index (NDMI)
  img = img.addBands(img.normalizedDifference(['nir','swir1']).rename('NDMI'));
  return img;
}
function getTasseledCap(image,bands) {
  // Kauth-Thomas coefficients for Thematic Mapper data
  var coefficients = ee.Array([
    [0.3037, 0.2793, 0.4743, 0.5585, 0.5082, 0.1863],
    [-0.2848, -0.2435, -0.5436, 0.7243, 0.0840, -0.1800],
    [0.1509, 0.1973, 0.3279, 0.3406, -0.7112, -0.4572],
    [-0.8242, 0.0849, 0.4392, -0.0580, 0.2012, -0.2768],
    [-0.3280, 0.0549, 0.1075, 0.1855, -0.4357, 0.8085],
    [0.1084, -0.9022, 0.4120, 0.0573, -0.0251, 0.0238]
  ]);
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
  
  return image.addBands(componentsImage, ['brightness', 'greenness', 'wetness']);
}
// Funtion to add year and DOY band
function addYearDOY(img){
  var d = ee.Date(img.get('system:footprint'));
  var y = d.get('year');
  var yb = ee.Image.constant(y).select(["constant"], ["year"]).int16();
  var day = ee.Image.constant(img.date().getRelative('day', 'year').add(1));
  var day_yb = yb.addBands(day.select(["constant"], ["DOY"]).int16());
  return img.addBands(day_yb);
}

function addPathRow(image)  {
  var path = ee.String(ee.Number.parse(image.get('WRS_PATH')));
  var row = ee.String(ee.Number.parse(image.get('WRS_ROW')));
  var pathRow = ee.Number.parse(path.cat(row));
  var constant_path = ee.Image.constant(pathRow).select(["constant"], ["pathRow"]);
  return image.addBands(constant_path);
} 

function setNoData(image,noDataValue){
  var m = image.mask();
  image = image.mask(ee.Image(1));
  image = image.where(m.not(),noDataValue);
  return image;
}
// Function for getting the pseudo-invariant features (PIFs)
function getPIFsPair(img1, img2, bandsPIF,z) {
  // Compute the difference to find unchanged pixels 
  var diff = img1.subtract(img2).select(bandsPIF);
  var inter = img1.geometry().intersection(img2.geometry(),1000);
  diff = diff.set('system:footprint',inter);
  var region = diff.geometry();
  var calcParamsAll = {     
          'reducer': ee.Reducer.mean().forEachBand(diff).combine(ee.Reducer.stdDev().forEachBand(diff),'s_',true),
          'geometry': region, 
          'scale': 90, 
          'bestEffort': true,
          'maxPixels': 500000000,
          'tileScale': 2
        };
  var s_bandsPIF = addPrefix(bandsPIF,'s_');
  // Compute the mean/stdDev value for the band
  var dict = diff.reduceRegion(calcParamsAll);
  var diffMean = ee.Image.constant(dict.select(bandsPIF).values()).rename(dict.select(bandsPIF).keys()).float();
  var StdDevTH = ee.Image.constant(dict.select(s_bandsPIF).values()).multiply(z).rename(dict.select(bandsPIF).keys()).float();
  var THupper = diffMean.add(StdDevTH);
  var THlower = diffMean.subtract(StdDevTH);
  var maskedTemp =  diff.lt(THupper).and(diff.gt(THlower));
  // Find the pixels that are have low variance in all the given bands and clip
  // this image to the region to avoid extrapolation 
  var potentialPIFs = maskedTemp.reduce(ee.Reducer.max()).clip(region);
  // Return these locations -Value of 1 with non PIFs masked out
  return potentialPIFs.mask(potentialPIFs);//.clip(geometry3);//.clip(water_removed);
}

// NORMALIZE W MULTIVARIATE REGRESSION WITH A CONSTANT BAND
// This function returns one corrected image and can be mapped across the stack
// to return a corrected stack
function imgNormalizerMultiConstant(slave, master, PIFpixels, dropBands){
  var slave_mask = slave.select([0]).mask();
  var master_mask = master.select([0]).mask();
  var diff = slave.subtract(master);
  var inter = slave.geometry().intersection(master.geometry(),1000);
  diff = diff.set('system:footprint',inter);
  var region = diff.geometry();
  var bandnames = master.bandNames().removeAll(dropBands);
  master = master.addBands(ee.Image(1).rename('constant')).updateMask(master_mask);
  slave = slave.addBands(ee.Image(1).rename('constant')).updateMask(slave_mask);
  var bandnamesPlus = bandnames.add('constant');
  var PIFslave = slave.mask(PIFpixels);
  var PIFmaster = master.mask(PIFpixels);
  // Loop through bands, get regression coeffs and correct
  var calcParamsLR = {     
        'reducer': ee.Reducer.linearRegression(bandnamesPlus.length(),1),
        'geometry': region, 
        'scale': 90, 
        'bestEffort': true,
        'maxPixels': 500000000,
        'tileScale': 2
      };
  var contArray = ee.List(bandnames).map(function(band){
    band = ee.String(band);
    var regImg = PIFslave.select(bandnamesPlus).addBands(PIFmaster.select(band).rename('master'));
    var LR = regImg.reduceRegion(calcParamsLR);
    var coeffs = ee.Array(LR.get('coefficients')).project([0]).toList();
    coeffs = ee.Image.constant(coeffs).rename(bandnamesPlus);
    var corrBand = slave.select(bandnamesPlus).multiply(coeffs).reduce('sum');
    return corrBand;//.toUint16();
  });
  // Concatenate the bands to form the corrected slave image
  contArray = ee.ImageCollection(contArray);
  var corrected = newCollectionToImage(contArray).rename(bandnames);
  // Add back in the dropped bands
  corrected = corrected.addBands(slave.select(dropBands)).updateMask(slave_mask);
  // Add the slave image footprint to the corrected image
  corrected = corrected.set('system:footprint',slave.geometry());
  
  return corrected; 
}

function addPrefix(list,prefix){
  return list.map(function(element){
    return prefix + element;
  });
}



