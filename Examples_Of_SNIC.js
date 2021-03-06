/**** Start of imports. If edited, may not auto-convert in the playground. ****/
var selectedStudyArea = /* color: #ff5a0b */ee.Geometry.Polygon(
        [[[-110.906982421875, 41.20758898181025],
          [-111.0552978515625, 40.82212357516945],
          [-110.6597900390625, 40.65980593837852],
          [-110.2313232421875, 40.684803661591275],
          [-109.984130859375, 41.07106913080641]]]);
/***** End of imports. If edited, may not auto-convert in the playground. *****/


var studyArea = selectedStudyArea;

var startDate = ee.Date.fromYMD(2017,1,1);
var endDate = ee.Date.fromYMD(2017,12,31);

var getImagesLib = require('users/USFS_GTAC/modules:getImagesLib.js');

var Landsat = getImagesLib.getImageCollection(studyArea,startDate,endDate,1,365,'TOA',false,false);
Landsat = getImagesLib.simpleTDOM2(Landsat,-1,0.35,1.5,2.5)
Landsat = getImagesLib.applyCloudScoreAlgorithm(Landsat,getImagesLib.landsatCloudScore,20,10,1.5,2.5);

var Image = ee.Image(Landsat.filterMetadata('system:index','equals','2_LC08_037032_20170901').first()).clip(studyArea);

Map.addLayer(Image,{'bands': ['red','green','blue']},'after TDOM & cloud masking 1 Sep 2017',false);

var NDVI = Image.normalizedDifference(['nir','red']);

var Seg_1 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 5,
  'compactness': 1,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_1 = Seg_1.select('clusters').reproject('EPSG:5070',null,30)
  
var Seg_2 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 5,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_2 = Seg_2.select('clusters').reproject('EPSG:5070',null,30)

var Seg_3 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 5,
  'compactness': 0.5,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_3 = Seg_3.select('clusters').reproject('EPSG:5070',null,30)

var Seg_4 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 20,
  'compactness': 0.5,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_4 = Seg_4.select('clusters').reproject('EPSG:5070',null,30)

var Seg_5 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 20,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_5 = Seg_5.select('clusters').reproject('EPSG:5070',null,30)

var Seg_6 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 20,
  'compactness': 1,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_6 = Seg_6.select('clusters').reproject('EPSG:5070',null,30)

var Seg_7 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 10,
  'compactness': 1,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_7 = Seg_7.select('clusters').reproject('EPSG:5070',null,30);

var Image_band1 = Image.select(['blue','green','red']);

print ('Image_band1:',Image_band1);

var Seg_8 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band1,
  'size': 10,
  'compactness': 1,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_8 = Seg_8.select('clusters').reproject('EPSG:5070',null,30);

var Seg_9 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band1,
  'size': 10,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_9 = Seg_9.select('clusters').reproject('EPSG:5070',null,30);

var Seg_10 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 10,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_10 = Seg_10.select('clusters').reproject('EPSG:5070',null,30);

var Seg_11 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band1,
  'size': 10,
  'compactness': 0.5,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_11 = Seg_11.select('clusters').reproject('EPSG:5070',null,30);

var Seg_12 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image,
  'size': 10,
  'compactness': 0.5,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_12 = Seg_12.select('clusters').reproject('EPSG:5070',null,30);

var Image_band2 = Image.select(['nir','red','green']);

var Seg_13 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band2,
  'size': 10,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_13 = Seg_13.select('clusters').reproject('EPSG:5070',null,30);

var Seg_14 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band2,
  'size': 10,
  'compactness': 0.5,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_14 = Seg_14.select('clusters').reproject('EPSG:5070',null,30);

var Seg_15 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band2,
  'size': 10,
  'compactness': 1,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_15 = Seg_15.select('clusters').reproject('EPSG:5070',null,30);

var Image_band3 = Image.select(['nir','swir1','swir2']);

var Seg_16 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band3,
  'size': 10,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_16 = Seg_16.select('clusters').reproject('EPSG:5070',null,30);

var Seg_17 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band1,
  'size': 5,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_17 = Seg_17.select('clusters').reproject('EPSG:5070',null,30);

var Seg_18 = ee.Algorithms.Image.Segmentation.SNIC({
  'image': Image_band1,
  'size': 15,
  'compactness': 0,
  'connectivity': 8,
  'neighborhoodSize': null,
  'seeds': null});
  
var Seg_Clusters_18 = Seg_18.select('clusters').reproject('EPSG:5070',null,30);

Map.addLayer(Seg_Clusters_1,{},'Segmentation: 5,1',false);
Map.addLayer(Seg_Clusters_2,{},'Segmentation: 5,0',false);
Map.addLayer(Seg_Clusters_3,{},'Segmentation: 5,0.5',false);
Map.addLayer(Seg_Clusters_4,{},'Segmentation: 20,0.5',false);
Map.addLayer(Seg_Clusters_5,{},'Segmentation: 20,0',false);
Map.addLayer(Seg_Clusters_6,{},'Segmentation: 20,1',false);
Map.addLayer(Seg_Clusters_7,{},'Segmentation: 10,1',false);
Map.addLayer(Seg_Clusters_8,{},'bands 1,2,3 Segmentation: 10,1',false);
Map.addLayer(Seg_Clusters_9,{},'bands 1,2,3 Segmentation: 10,0',false);
Map.addLayer(Seg_Clusters_10,{},'Segmentation: 10,0',false);
Map.addLayer(Seg_Clusters_11,{},'bands 1,2,3 Segmentation: 10,0.5',false);
Map.addLayer(Seg_Clusters_12,{},'Segmentation: 10,0.5',false);
Map.addLayer(Seg_Clusters_13,{},'bands 4,3,2 Segmentation: 10,0',false);
Map.addLayer(Seg_Clusters_14,{},'bands 4,3,2 Segmentation: 10,0.5',false);
Map.addLayer(Seg_Clusters_15,{},'bands 4,3,2 Segmentation: 10,1',false);
Map.addLayer(Seg_Clusters_16,{},'bands 4,5,6 Segmentation: 10,0',false);
Map.addLayer(Seg_Clusters_17,{},'bands 1,2,3 Segmentation: 5,0',false);
Map.addLayer(Seg_Clusters_18,{},'bands 1,2,3 Segmentation: 15,0',false);

print ('Image:',Image);

