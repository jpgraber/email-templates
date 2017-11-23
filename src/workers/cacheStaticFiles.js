const path = require('path')

async function connect(container) {
  const { pathSettings, repositories, file } = container

  if (!pathSettings || !repositories || !file) {
    throw new Error('missing required dependency')
  }

  const { cacheRepository } = repositories
  const { readFileStreamAsync, readDirAsync, encodeFileBase64 } = file

  if (!cacheRepository || !readFileStreamAsync || !readDirAsync || !encodeFileBase64) {
    throw new Error('missing required dependency')
  }

  return async () => {
    // Read in static files
    const dirFiles = await readDirAsync(pathSettings.fileDir)

    // Read in files
    await Promise.all(dirFiles.map(async f => {
      const bitmap = await readFileStreamAsync(path.resolve(pathSettings.fileDir, f))
      const base64Str = encodeFileBase64(bitmap)

      await cacheRepository.set(f, {
        bitmap,
        base64Str
      })
    }))
  }
}

module.exports = Object.create({ connect })
