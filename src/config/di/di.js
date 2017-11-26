function initDI ({
  serverSettings,
  pathSettings,
  cacheSettings,
  cache,
  fileConverterSettings,
  fileConverter,
  file,
  models
}, mediator) {

  mediator.once('init', () => {
    mediator.on('cache.ready', cache => {
      // POJO container for DI
      const container = Object.create({})

      container.serverSettings = Object.assign({}, serverSettings)
      container.pathSettings = Object.assign({}, pathSettings)
      container.fileConverterSettings = Object.assign({}, fileConverterSettings)
      container.cache = cache
      container.fileConverter = fileConverter.connect(fileConverterSettings)
      container.file = Object.assign({}, file)
      container.models = Object.assign({}, models)

      mediator.emit('di.ready', container)
    })

    mediator.on('cache.error', err => mediator.emit('di.error', err))

    cache.connect(cacheSettings, mediator)

    mediator.emit('boot.ready')

  })
}

module.exports.initDI = initDI
