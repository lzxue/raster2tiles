const gdal = require("gdal-next")
const fs = require('fs');
var shortid = require('shortid');
const TileHelper = require('./tilehelp')
const DataTypeEnum = {
    'Byte': Uint8Array,
    'Float32': Float32Array,
    'Float64': Float64Array,
    'Int16': Int16Array,
    'UInt16': Uint16Array,
    'Int32': Int32Array,
    'UInt32': Uint32Array,

}
class TileTiff {
    constructor(ds,out) {
        this.tileHelper = new TileHelper(256, 'google');
        this.dataset = ds;
        this.rawDataset = ds;
        this.outPath = out;
        this.extent = this.getRasterExtent();
        this.noDataValue = -32768;
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
        const fileName = `${this.outPath}/temp/${z}_${shortid.generate()}.tiff`;
        this.reprojectRaster(this.rawDataset, z, fileName);
        this.dataset = gdal.open(fileName);
        console.log(z, ': 重采样完成')
        const tileBounds = this.getRasterTileBoundByzoom(z);
        const totalTile = Math.abs((tileBounds[1][0] - tileBounds[0][0] + 1) * (tileBounds[0][1] - tileBounds[1][1] + 1));
        console.log(`开启切片共 ${totalTile}个`)
        var startIndex = 0;
        for (var x = tileBounds[0][0]; x <= tileBounds[1][0]; x++) {
            for (var y = tileBounds[0][1]; y <= tileBounds[1][1]; y++) {

                this.createTile(x, y, z)
                if (startIndex % (Math.floor(totalTile / 10)) === 0) {
                    console.log(`已完成 ${Math.floor(startIndex / (Math.floor(totalTile / 10))) * 10}%`)
                }
                startIndex++
            }

        }
        fs.rmSync(fileName)
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
        outDs.flush();
        outDs.close();

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
        const end = [Math.min(origin[0] + 256, rasterSize.x), Math.min(origin[1] + 256, rasterSize.y)]
        const x = origin[0] < 0 ? -  origin[0] : 0;
        const y = origin[1] < 0 ? -  origin[1] : 0;
        const height= end[1] -start[1]
        const width= end[0] -start[0]
        const data = Array.from(band.pixels.read(start[0], start[1], width, height))
        return {
            data,
            x,
            y,
            height,
            width
        }
     
    }
    writeTiffTile(x, y, z, data) {
        const dataset = this.dataset;
        const driver = dataset.driver;
        const tileHelp = this.tileHelper;
        if (!fs.existsSync(`${this.outPath}/${z}`)) {
            fs.mkdirSync(`${this.outPath}/${z}`)
        }
        if (!fs.existsSync(`${this.outPath}/${z}/${x}`)) {
            fs.mkdirSync(`${this.outPath}/${z}/${x}`)
        }
        const outDs = driver.create(`${this.outPath}/${z}/${x}/${y}.tiff`, tileHelp.tileSize, tileHelp.tileSize, 1, this.getDataType());
        const gcp = dataset.getGCPs();
        const gcpProject = dataset.srs.toWKT();
        const resolution = tileHelp.resolution(z);
        const originMeters = tileHelp.pixelsToMeters(x * 256, y * 256, z)
        const geoTransform = [originMeters[0], resolution, 0, originMeters[1], 0, -resolution];
        outDs.geoTransform = geoTransform;

        outDs.setGCPs(gcp, gcpProject)
        const outBand = outDs.bands.get(1);
        outBand.colorInterpretation = dataset.bands.get(1).colorInterpretation;
        outBand.noDataValue = this.noDataValue;
        outDs.srs = dataset.srs;
        outBand.fill(this.noDataValue);
        // TODO 数据类型
        outBand.pixels.write(data.x, data.y, data.width, data.height, new DataTypeEnum[this.getDataType()](data.data))
        outBand.computeStatistics(true)
        outDs.flush()
        outDs.close();
    }
    getTileOrigin(x, y, z) {
        // Todo 计算 Tiff 左上角
        const tileHelp = this.tileHelper;
        const corner = this.extent;
        const leftTopPixels = tileHelp.lonLatToPixels(corner[0], corner[3], z);
        const tilePixles = [x * tileHelp.tileSize, y * tileHelp.tileSize];

        const originPixels = [tilePixles[0] - leftTopPixels[0], tilePixles[1] - leftTopPixels[1]];

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