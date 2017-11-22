const path = require('path')

async function connect(container) {
  const { fileConverter, file } = container

  if (!fileConverter || !file) {
    throw new Error('missing required dependencies')
  }

  const { createReadStream } = file

  async function createProcess() {
    return new Promise((resolve, reject) => {
      const opts = {
        inputformat: 'html',
        outputformat: 'png'
      }

      fileConverter.createProcess(opts, (err, process) => {
        if (err) {
          return reject(err)
        }
        resolve(process)
      })
    })
  }

  async function waitForProcessToFinish(process) {
    return new Promise((resolve, reject) => {
      console.log('waiting for process to finish')
      process.refresh()
      process.wait((err, updatedProcess) => {
        console.log('process has finished')
        if (err) {
          process.delete();
          return reject(err)
        }
        resolve(updatedProcess)
      })
    })
  }

  async function startProcess(process, file, opts={}) {
    return new Promise((resolve, reject) => {
      async function callback(err, process) {
        if (err) {
          process.delete()
          return reject(err)
        }

        resolve(await waitForProcessToFinish(process))
      }

      const converteroptions = (opts.width && opts.height) ?
      { resize: `${opts.width}x${opts.height}` } : {}

      const args = {
        wait: true,
        input: 'upload',
        outputformat: 'png',
        converteroptions
      }

      process.start(args, callback)

      // Upload the file to start the process
      process.upload(createReadStream(file))
    })
  }

  async function downloadFile(process, path) {
    return new Promise((resolve, reject) => {
      const ws = process.pipe(file.createWriteStream(path))

      ws.on('finish', resolve)
      ws.on('error', reject)
    })
  }

  return {
    createProcess,
    startProcess,
    downloadFile
  }
}

 module.exports = Object.create({connect})