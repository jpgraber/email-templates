//http://localhost:3000/templates/alerts?alert_types=volume&analysis_name=KBHERSH&analysis_link=https%3A%2F%2Fappdev.dunami.com%2F%23%2Fchannel%2F1169%2Fanalysis%2F13504&folder_name=KC%20Devs&folder_link=https%3A%2F%2Fappdev.dunami.com%2F%23%2Fchannel%2F1169&stream_start_date=2017-10-26T17%3A03%3A49.069Z&stream_end_date=2017-12-26T17%3A03%3A49.069Z&stream_refresh_period=daily&new_post_count=234
const express    = require('express')
const httpStatus = require('http-status-codes')
const sgMail     = require('@sendgrid/mail')
const winston    = require('winston')

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const ALERT_TEMPLATE_ID = 'alert_template'

const connect = container => {
  const { services, repository, pathSettings, models, fileHelpers } = container

  if (!services || !repository || !pathSettings || !models || !fileHelpers) {
    throw new Error('missing required dependency')
  }

  const { templateEngine, d3Charts, svgToPng, fileConverter, cdn } = services

  if (!templateEngine || !d3Charts || !svgToPng || !fileConverter || !cdn) {
    throw new Error('missing required dependency')
  }

  const { buildD3Chart } = d3Charts
  const { convertSvgToPng } = svgToPng
  const { compileTemplate } = templateEngine

  const controller = express.Router()

  // ======================================================
  // Response Handling
  // ======================================================
  const handleResponse = (req, res) => {
    if (req.error) {
      const { message, status } = req.error
      res.status(status || httpStatus.INTERNAL_SERVER_ERROR).send({message})
    } else {
      res.status(httpStatus.OK).send(req.results)
    }
  }

  // ======================================================
  // Controller Methods
  // ======================================================
  function sendEmail(html) {
    const msg = {
      to: 'dunami.test@yahoo.com',
      from: 'justin.graber@pathar.net',
      subject: 'Email Template Test',
      html
    };
    sgMail.send(msg);
  }

  async function validateRequest(req, res, next) {
    const data = req.method === 'GET' ? req.query : req.body

    // Hack for 'GET' query params, convert strings to array
    if (typeof data.alert_types !== 'object') {
      data.alert_types = data.alert_types.split(',')
    }

    // Build the template data model
    try {
      req.templateData = await models.validate(data, 'alertTemplateRequest')
    } catch(err) {
      return res.status(httpStatus.BAD_REQUEST).send({err: err})
    }
    // Build the compiled template
    try {
      req.compiledTemplate = compileTemplate(ALERT_TEMPLATE_ID)
    } catch(err) {
      return res.status(httpStatus.BAD_REQUEST).send({err: err})
    }
    next()
  }

  async function uploadFileToCloud(fileId, isStatic) {
    const metaData = await cdn.retrieveObjectMetaData(fileId)

    // Object exists?
    if (metaData) {
      return
    }

    try {
      const fileBitmap = isStatic ? await fileHelpers.readStaticFile(fileId) : await fileHelpers.readTmpFile(fileId)
      await cdn.putPublicObject(fileId, fileBitmap)
    } catch(e) {
      winston.log('error', e)
    }
  }

  async function uploadFileToCache(fileId, isStatic) {
    const fileExists = await repository.exists(fileId)

    // File exists
    if (fileExists) {
      return
    }

    const fileBitmap = isStatic ? await fileHelpers.readStaticFile(fileId) : await fileHelpers.readTmpFile(fileId)
    const zippedValue = await fileHelpers.deflateFile(fileBitmap)

    repository.set(fileId, zippedValue.toString('base64'))
  }

  function buildTemplateCharts(chartArr, templateData) {
    return chartArr.map(async cur => {
      const contentId = fileHelpers.generateUniqueFileName(cur.chartName)
      const pngFileId = `${contentId}.png`
      const svgFileId = `${contentId}.svg`

      const fileData = {
        file_id: pngFileId,
        content_id: contentId,
        url_link: (templateData.image_source === 'link') ? cdn.makeObjectLink(pngFileId) : undefined
      }

      const chartSvg = buildD3Chart(cur.chartName, cur.markup, templateData[cur.dataProp])

      await fileHelpers.writeFileStreamAsync(chartSvg, fileHelpers.makeTmpFilePath(svgFileId))
      await convertSvgToPng(svgFileId, pngFileId, fileConverter, cur.opts)

      // async fire and forget
      if (templateData.image_source === 'link') {
        uploadFileToCloud(pngFileId, false)
      } else {
        uploadFileToCache(pngFileId)
      }

      return fileData
    })
  }

  function buildTemplateImages(imageArr, templateData) {
    return imageArr.map(cur => {
      const fileData = Object.assign({}, cur, {
        url_link: (templateData.image_source === 'link') ? cdn.makeObjectLink(cur.file_id) : undefined
      })

      // async fire and forget
      if (templateData.image_source === 'link') {
        uploadFileToCloud(fileData.file_id, true)
      } else {
        uploadFileToCache(fileData.file_id)
      }

      return fileData
    })
  }

  // Compile the template static images and d3 charts
  async function makeTemplateFiles(req, res, next) {
    const { templateData, compiledTemplate } = req
    const { images, charts } = compiledTemplate

    // Lazy load images
    const templateImages = buildTemplateImages(images.slice(), templateData)
    const templateCharts = buildTemplateCharts(charts.slice(), templateData)

    req.templateFiles = await Promise.all(templateImages.concat(templateCharts))

    next()
  }

  async function renderTemplate(req, res, next) {
    const { compiledTemplate, templateData, templateFiles: files } = req

    try {
      const renderArgs = {
        ...templateData,
        files
      }

      const templateObj = {
        html: compiledTemplate.render(renderArgs),
        files
      }

      req.results = await models.validate(templateObj, 'template')
      next()
    } catch(err) {
      // TODO: handle error
      console.log(err)
    }
  }

  function serveTemplateHTML(req, res, next) {
    // sendEmail(req.results.html)
    res.set('Content-Type', 'text/html')
    res.send(Buffer.from(req.results.html))
  }

  // ======================================================
  // Controller Routes
  // ======================================================
  controller.post('/', validateRequest, makeTemplateFiles, renderTemplate, handleResponse)
  controller.get('/', validateRequest, makeTemplateFiles, renderTemplate, serveTemplateHTML)

  return controller
}

module.exports = Object.assign({ connect })