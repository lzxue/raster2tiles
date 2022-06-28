var gdal = require("gdal-next")
var dataset = gdal.open("/Users/lizhengxue/Downloads/tile/landcover_JiangXi.tif");
var TiffTile = require('./lib/tiffTile');


//  const tileHelp = new TileHelper(256, 'google');

const tiffTile = new TiffTile(dataset);

for(let i=12; i< 15;i++){
    tiffTile.createBoundsTile(i);
}





