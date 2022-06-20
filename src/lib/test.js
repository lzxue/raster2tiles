var TileHelper = require('./tilehelp');
const tile = new TileHelper(256);
const zoom = 2;
console.log('latLonToMeters',tile.lonLatToMeters(120,30))
console.log('lonLatToTile',tile.lonLatToTile(120,30,zoom))
console.log('googleTile',tile.googleTile(1,1,zoom))