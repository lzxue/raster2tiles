#!/usr/bin/env node
const gdal = require("gdal-next")
// const chalk = require('chalk');
const fs = require('fs');
const TiffTile = require('./src/lib/tiffTile');
const pkg = require('./package.json');
const commander = require('commander'); // include commander in git clone of commander repo
const program = new commander.Command();

program
    .option('-o, --out <path>', 'output file path, if not input use src path instead')
    .option('-s, --src <path>', 'source file path')
    .option('-z, --minZoom <type>', '最小等级')
    .option('-Z, --maxZoom <type>', '最大等级');

program.parse(process.argv);

// program
// .version(pkg.version)
// .description(chalk.green('GoGoCode  代码转换从未如此简单  https://gogocode.io'));

const options = program.opts();
console.log(options)
if (options.out) {
    if (!fs.existsSync(options.out)) {
        fs.mkdirSync(options.out)
        fs.mkdirSync(`${options.out}/temp`)
    }
}
if (options.minZoom && options.maxZoom && options.src) {
    var dataset = gdal.open(options.src);
    const tiffTile = new TiffTile(dataset,options.out);
    for (let i = options.minZoom; i <= options.maxZoom; i++) {
        tiffTile.createBoundsTile(i);
    }
    fs.rm

}


console.log('完成')
