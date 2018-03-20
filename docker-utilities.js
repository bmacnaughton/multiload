'use strict'

const exec = require('child_process').exec

exports.getExposedPort = function (containerName, port) {
  // command from this really useful page:
  // https://docs.docker.com/engine/reference/commandline/inspect/#get-an-instances-log-path
  let cmd = [
    'docker inspect --format=\'{{(index (index .NetworkSettings.Ports "',
    port, '/tcp") 0).HostPort}}\' ',
    containerName
  ].join('')

  return new Promise((resolve, reject) => exec(cmd, function(err, stdout, stderr) {
    if (err) {
      reject(err)
    } else {
      resolve(parseInt(stdout))
    }
  }))
}
