class TileHelper {
    constructor(tileSize = 256,type = 'tms') {
        // "Initialize the TMS Global Mercator pyramid"
        this.tileSize = tileSize;
        this.type = type;
        this.initialResolution = 2 * Math.PI * 6378137 / this.tileSize
        this.originShift = 2 * Math.PI * 6378137 / 2.0
    }
    lonLatToMeters(lon, lat) {
        // "Converts given lat/lon in WGS84 Datum to XY in Spherical Mercator EPSG:3857"
        var mx = lon * this.originShift / 180.0;
        var my = Math.log(Math.tan((90 + lat) * Math.PI / 360.0)) / (Math.PI / 180.0)
        my = my * this.originShift / 180.0
        return [mx, my]
    }

    // "Converts XY point from Spherical Mercator EPSG:3857 to lat/lon in WGS84 Datum"
    metersToLatLon(mx, my) {
        var lon = (mx / this.originShift) * 180.0
        var lat = (my / this.originShift) * 180.0

        lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180.0)) - Math.PI / 2.0)
        return [lon, lat]

    }

    //  "Converts pixel coordinates in given zoom level of pyramid to EPSG:3857"
    pixelsToMeters(px, py, zoom) {

        var res = this.resolution(zoom)
        var mx = px * res - this.originShift
        var my = (this.type === 'tms' ? py : Math.pow(2,zoom) * 256 - py) * res - this.originShift
        return [mx, my]
    }

    //  "Converts EPSG:3857 to pyramid pixel coordinates in given zoom level"
    metersToPixels(mx, my, zoom) {
        var res = this.resolution(zoom)
        var px = (mx + this.originShift) / res
        var py = (my + this.originShift) / res
        py = this.type === 'tms' ? py : Math.pow(2,zoom) * 256 - py
        return [px, py]

    }
    // "Returns tile for given mercator coordinates"
    metersToTile(mx, my, zoom) {
        const [px, py] = this.metersToPixels(mx, my, zoom)
        return this.pixelsToTile(px, py)

    }
    
    tileToMeters(tx,ty,zoom) {
        return this.pixelsToMeters(tx*this.tileSize,ty*this.tileSize,zoom)

    }

    // "Returns a tile covering region in given pixel coordinates"

    pixelsToTile(px, py) {
        var tx = parseInt(Math.ceil(px / this.tileSize) - 1)
        var ty = parseInt(Math.ceil(py / this.tileSize) - 1)
        return [tx, ty]
    }

    //  "Move the origin of pixel coordinates to top-left corner"
    pixelsToRaster(px, py, zoom) {
        var mapSize = this.tileSize << zoom
        return [px, mapSize - py]
    }

    //"Returns bounds of the given tile in EPSG:3857 coordinates"
    tileBounds(tx, ty, zoom) {
        var [minx, miny] = this.pixelsToMeters(tx * this.tileSize, ty * this.tileSize, zoom)
        vat[maxx, maxy] = self.PixelsToMeters((tx + 1) * this.tileSize, (ty + 1) * this.tileSize, zoom)
        return (minx, miny, maxx, maxy)
    }

    // "Returns bounds of the given tile in latitude/longitude using WGS84 datum"
    tileLatLonBounds(tx, ty, zoom) {

        var bounds = this.tileBounds(tx, ty, zoom)
        var [minLat, minLon] = this.metersToLatLon(bounds[0], bounds[1])
        var [maxLat, maxLon] = this.metersToLatLon(bounds[2], bounds[3])

        return [minLat, minLon, maxLat, maxLon]
    }

    // "Resolution (meters/pixel) for given zoom level (measured at Equator)"
    resolution(zoom) {
        return this.initialResolution / Math.pow(2, zoom)
    }

    lonLatToPixels(lon, lat, zoom) {
        var [mx, my] = this.lonLatToMeters(lon, lat);
        return this.metersToPixels(mx, my, zoom)

    }

    lonLatToTile(lon, lat, zoom) {
        var [px, py] = this.lonLatToPixels(lon, lat, zoom);
        return this.pixelsToTile(px, py)
    }

    //"Converts TMS tile coordinates to Google Tile coordinates"
    googleTile(tx, ty, zoom) {
        return [tx, (2 ** zoom - 1) - ty]
    }
   
    boundsToTileExtent(minLon, minLat, maxLon, maxLat, zoom) {
        const [minTx, minTy] = this.lonLatToTile(minLon, maxLat, zoom);
        const [maxTx, maxTy] = this.lonLatToTile(maxLon, minLat, zoom);
        return [[minTx, minTy], [maxTx, maxTy]]
    }

    metersboundsToTileExtent(minX, minY, maxX, maxY, zoom) {
        const [minTx, minTy] = this.metersToTile(minX, maxY, zoom);
        const [maxTx, maxTy] = this.metersToTile(maxX, minY, zoom);
        return [[minTx, minTy], [maxTx, maxTy]]

    }

}

module.exports = TileHelper