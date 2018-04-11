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

// doesn't work unless running with permissions to write the file.
function clearLog (containerName) {
  let cmd = [
    'docker inspect -f \'{{.LogPath }}\' ',
    containerName,
    //' 2 > /dev/null'
  ].join('')

  return execAndReturn(cmd).then(path => {
    return truncate(path)
  })
}

//
// given a container name return the environment
//
function getEnvironment (containerName) {
  let cmd = [
    'docker inspect -f \'{{ json .Config.Env }}\' ', containerName
  ].join('')

  return execAndReturn(cmd).then(env => env)
}

var funcs = {
  getExposedPort: getExposedPort,
  clearLog: clearLog,
  getEnvironment: getEnvironment
}

if (module.parent) {
  module.exports = funcs
} else {
  let argv = process.argv.slice(2)

  let fn = argv[0]

  if (fn === 'get-port') {
    getExposedPort(argv[1], argv[2]).then(
      port => console.log(port)
    ).catch(e => {
      console.log('cannot get-port: ', e.message)
    })
  } else if (fn === 'clear-log') {
    console.log ('not implemented')
    process.exit(1)
  } else if (fn === 'get-environment') {
    getEnvironment(argv[1]).then(
      env => console.log(JSON.parse(env).join('\n'))
    ).catch(e => {
      console.log('cannot get environment: ', e.message)
    })
  } else {
    console.log('invalid function')
    process.exit(1)
  }
}
