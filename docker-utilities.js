'use strict'

const exec = require('child_process').exec

function stripnl(string) {
  let nlEnding = s => s[s.length - 1] === '\n'
  return nlEnding(string) ? string.slice(0, -1) : string
}

function truncate (path) {
  return new Promise((resolve, reject) => {
    fs.truncate(path, 0, function (err) {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

//
// execute command and return a promise that will
// return the results of stdout (processed by fn, if
// supplied)
//
function execAndReturn(cmd, fn) {
  return new Promise((resolve, reject) => {
    let handler = function (err, stdout, stderr) {
      if (err) {
        reject(err)
      } else {
        resolve(fn ? fn(stdout) : stripnl(stdout))
      }
    }
    exec(cmd, handler)
  })
}

function getExposedPort (containerName, port) {
  // command from this really useful page:
  // https://docs.docker.com/engine/reference/commandline/inspect/#get-an-instances-log-path
  let cmd = [
    'docker inspect --format=\'{{(index (index .NetworkSettings.Ports "',
    port, '/tcp") 0).HostPort}}\' ',
    containerName
  ].join('')

  return execAndReturn(cmd, parseInt)
}

function clearLog (containerName) {
  let cmd = [
    'docker inspect -f \'{{.LogPath}}\' ',
    containerName,
    //' 2 > /dev/null'
  ].join('')

  return execAndReturn(cmd).then(path => {
    return truncate(path)
  })
}

var funcs = {
  getExposedPort: getExposedPort,
  clearLog: clearLog
}

if (module.parent) {
  exports = funcs
} else {
  let argv = process.argv.slice(2)

  let fn = argv[0]

  if (fn === 'get-port') {
    getExposedPort(argv[1], argv[2]).then(port => console.log(port))
  } else if (fn === 'clear-log') {
    console.log ('not implemented')
    process.exit(1)
  } else {
    console.log('invalid function')
    process.exit(1)
  }
}
