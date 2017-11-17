// cloudinary.uploader.upload("my_picture.jpg", function(result) {
  // console.log(result)
// });

async function connect(container) {
  const { cdn } = container

  if (!cdn) {
    throw new Error('missing required cache dependency')
  }

  function upload(file) {
    return new Promise(resolve => {
      cdn.uploader.upload(file, function({secure_url}) {
        resolve(secure_url)
      });
    })
  }

  return {
    upload
  }
}

 module.exports = Object.create({connect})