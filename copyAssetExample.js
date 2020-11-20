// This asset must be either an IMAGE or a TABLE
// This will not work for image collections.
var sourceAsset = 'projects/USFS/LCMS-NFS/Testing/Image_Name'
var destAsset = 'projects/lcms-292214/assets/migrationTest/Image_Name'

ee.data.copyAsset(sourceAsset, destAsset, false)