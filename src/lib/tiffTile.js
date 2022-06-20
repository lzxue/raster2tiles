const gdal = require("gdal-next")
const fs = require('fs');
var shortid = require('shortid');
const TileHelper = require('./tilehelp')
class TileTiff {
    constructor(ds) {
        this.tileHelper = new TileHelper(256, 'google');
        this.dataset = ds;
        this.rawDataset = ds;
        this.extent = this.getRasterExtent();
        this.noDataValue = -32768;
        if (!fs.existsSync('./tiles')) {
            fs.mkdirSync('./tiles')
        }
        this.zoomDataset = {
        };
    }
    getDataType() {
        if (this.dataset) {
            const band = this.dataset.bands.get(1);
            return band.dataType;
        }
        return null
    }
    setDataset(ds) {
        this.dataset = ds
    }
    //
    createTile(x, y, z) {
        const origin = this.getTileOrigin(x, y, z);
        const tileData = this.readRaster(origin);
        this.writeTiffTile(x, y, z, tileData);
    }
    createBoundsTile(z) {
        // if (!this.zoomDataset[z]) {
        //     this.zoomDataset[z] = {
        //         dataset: this.reprojectRaster(this.rawDataset, z, `./temp/${z}/${shortid.generate()}.tiff`),
        //         path: `./temp/${z}/${shortid.generate()}.tiff`
        //     }
        // }
        // this.dataset = this.zoomDataset[z].dataset;
        const tileBounds = this.getRasterTileBoundByzoom(z);
        const rasterSize = this.dataset.rasterSize;


        for (var x = tileBounds[0][0]; x <= tileBounds[1][0]; x++) {
            for (var y = tileBounds[0][1]; y <= tileBounds[1][1]; y++) {
                this.createTile(x, y, z)
            }

        }

        // TODO 计算每个瓦片的

    }
    // 获取数据的经纬度范围
    getRasterExtent() {
        const ds = this.dataset
        const size = ds.rasterSize
        const minCorner = { x: 0, y: size.y };
        const maxCorner = { x: size.x, y: 0 };
        const geotransform = ds.geoTransform;
        const wgs84 = gdal.SpatialReference.fromEPSG(4326);
        const coord_transform = new gdal.CoordinateTransformation(ds.srs, wgs84);
        const min = {
            x: geotransform[0] + minCorner.x * geotransform[1] + minCorner.y * geotransform[2],
            y: geotransform[3] + minCorner.x * geotransform[4] + minCorner.y * geotransform[5]
        }
        const max = {
            x: geotransform[0] + maxCorner.x * geotransform[1] + maxCorner.y * geotransform[2],
            y: geotransform[3] + maxCorner.x * geotransform[4] + maxCorner.y * geotransform[5]
        }
        const minWgs84 = coord_transform.transformPoint(min);
        const maxWgs84 = coord_transform.transformPoint(max);
        return [minWgs84.y, minWgs84.x, maxWgs84.y, maxWgs84.x]
    }
    // 获取瓦片范围
    getRasterTileBoundByzoom(z) {
        const corner = this.extent;
        return this.tileHelper.boundsToTileExtent(corner[0], corner[1], corner[2], corner[3], z);
    }

    // 重采样数据
    reprojectRaster(dataset, zoom, path) {
        const driver = dataset.driver;
        const tileHelp = this.tileHelper;
        const resolution = tileHelp.resolution(zoom);
        const rasterSize = dataset.rasterSize;
        const newSize = this.scaleZoomSize(rasterSize.x, rasterSize.y, dataset.geoTransform[1], dataset.geoTransform[5], resolution);
        const outDs = driver.create(path, newSize.x, newSize.y, 1, this.getDataType());
        const gcp = dataset.getGCPs();
        const gcpProject = dataset.srs.toWKT();
        const [x, xtr, xr, yx, yr, ytr] = dataset.geoTransform;
        // const geotransform = dataset.geoTransform;
        // const corner = this.getRasterExtent();
        // const epsg3857 = gdal.SpatialReference.fromEPSG(4326)
        // const coord_transform = new gdal.CoordinateTransformation(dataset.srs, epsg3857);
        // const pt_orig = {
        //     x:geotransform[0],
        //     y:geotransform[3]
        //   }

        // const pt_wgs84 = coord_transform.transformPoint(pt_orig)
        // console.log(pt_wgs84)
        // TODO  支持坐标转换
        outDs.geoTransform = [x, resolution, xr, yx, yr, -resolution];
        outDs.setGCPs(gcp, gcpProject);
        outDs.bands.get(1).colorInterpretation = dataset.bands.get(1).colorInterpretation;
        const option = {
            src: dataset,
            dst: outDs,
            s_srs: dataset.srs,
            t_srs: dataset.srs,
            resampling: gdal.GRA_NearestNeighbor,

        };
        gdal.reprojectImage(option)
        outDs.flush()

    }
    // 计算重采样后数据的大小
    scaleZoomSize(width, height, xSize, ySize, resolution) {
        return {
            x: Math.round(width * xSize / resolution),
            y: Math.abs(Math.round(height * ySize / resolution))
        }
    }
    // 读取指定起点的瓦片数据 
    readRaster(origin) {
        const tileHelp = this.tileHelper;
        const band = this.dataset.bands.get(1);
        const rasterSize = this.dataset.rasterSize;
        const start = [Math.min(Math.max(0, origin[0]), rasterSize.x - 1), Math.min(Math.max(0, origin[1]), rasterSize.y - 1)];
        const end = [Math.min(rasterSize.x - start[0] - 2, tileHelp.tileSize), Math.min(rasterSize.y - start[1] - 1, tileHelp.tileSize)];
        const data = Array.from(band.pixels.read(start[0], start[1], end[0], end[1]))
        return {
            data,
            height: end[1],
            width: end[0]
        }
    }
    writeTiffTile(x, y, z, data) {
        const dataset = this.dataset;
        const driver = dataset.driver;
        const tileHelp = this.tileHelper;
        if (!fs.existsSync(`./tiles/${z}`)) {
            fs.mkdirSync(`./tiles/${z}`)
        }
        if (!fs.existsSync(`./tiles/${z}/${x}`)) {
            fs.mkdirSync(`./tiles/${z}/${x}`)
        }
        const outDs = driver.create(`./tiles/${z}/${x}/${y}.tiff`, tileHelp.tileSize, tileHelp.tileSize, 1, this.getDataType());
        const gcp = dataset.getGCPs();
        const gcpProject = dataset.srs.toWKT();
        const resolution = tileHelp.resolution(z);
        const originMeters = tileHelp.pixelsToMeters(x * 256, y * 256, z)
        const geoTransform = [originMeters[0], resolution, 0, originMeters[1], 0, -resolution];
        outDs.geoTransform = geoTransform;

        outDs.setGCPs(gcp, gcpProject)
        const outBand = outDs.bands.get(1);
        // outBand.colorInterpretation = dataset.bands.get(1).colorInterpretation;
        outBand.noDataValue = this.noDataValue;
        outDs.srs = dataset.srs;
        // TODO 数据类型
        outBand.pixels.write(0, 0, data.width, data.height, new Int8Array(data.data))
        outBand.computeStatistics(false)
        outDs.flush()
    }
    getTileOrigin(x, y, z) {
        // Todo 计算 Tiff 左上角
        const tileHelp = this.tileHelper;
        const corner = this.extent;
        const leftTopPixels = tileHelp.lonLatToPixels(corner[0], corner[3], z);
        const tilePixles = [x * tileHelp.tileSize, y * tileHelp.tileSize];
        const originPixels = [tilePixles[0] - leftTopPixels[0], tilePixles[1] - leftTopPixels[1]]
        return [Math.ceil(originPixels[0]), Math.ceil(originPixels[1])];

    }
    getPixelExtent(z) {
        const tileHelp = this.tileHelper;
        const corner = this.extent;
        const leftTopPixels = tileHelp.lonLatToPixels(corner[0], corner[3], z);
        const bottomRightPixels = tileHelp.lonLatToPixels(corner[2], corner[1], z);
        return [leftTopPixels, bottomRightPixels]

    }

}
module.exports = TileTiff