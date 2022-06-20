var gdal = require("gdal-next")
// var dataset = gdal.open("./data/landcover_3857_2.tif");
var dataset = gdal.open("./landcover.tiff");
var TileHelper = require('./lib/tilehelp')
var TiffTile = require('./lib/tiffTile');
var driver = dataset.driver;
var inBand = dataset.bands.get(1);
var rasterSize = dataset.rasterSize;


//  const tileHelp = new TileHelper(256, 'google');

const tiffTile = new TiffTile(dataset);
// tiffTile.reprojectRaster(dataset,8,'./landcover.tiff')

tiffTile.createBoundsTile(8);


