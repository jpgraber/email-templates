const phantom       = require('phantom')
const path          = require('path')
const fs            = require('fs')
const { promisify } = require('util')
const uuidv4        = require('uuid/v4');

const readFileAsync  = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const makeTmpSvgFilePath = uuid => path.resolve(__dirname, 'tmp_files', `${uuid}.html`)
const makeTmpPngFilePath = uuid => path.resolve(__dirname, 'tmp_files', `${uuid}.png`)

const writeSvgtoTmpFile = (string, filePath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath)
    file.on("finish", resolve);
    file.on("error", reject)

    file.write(string)
    file.end();
  });
}

async function base64_encode(file) {
  const bitmap = await readFileAsync(file)

  return new Buffer(bitmap).toString('base64')
}

async function connect(container) {
  async function svgToPngBase64Encoded(svgMarkup, opts={}) {
    const uuid = uuidv4() // 'df7cca36-3d7a-40f4-8f06-ae03cc22f045'
    const sourceFile = makeTmpSvgFilePath(uuid)
    const destFile = makeTmpPngFilePath(uuid)

    await writeSvgtoTmpFile(svgMarkup, sourceFile)

    const instance = await phantom.create()
    const page = await instance.createPage()
    const viewportSize = opts.viewportSize || { width: 100, height: 100 }

    await page.property('viewportSize', viewportSize)

    const status = await page.open(sourceFile)
    const content = await page.property('body')

    await page.render(destFile)

    return await base64_encode(destFile)
  }

  return {
    svgToPngBase64Encoded
  }
}

 module.exports = Object.create({connect})
