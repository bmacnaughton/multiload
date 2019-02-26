'use strict'

const axios = require('axios')
const dutils = require('./docker-utils')

//
// always and never are not primitive settings.
// always = SAMPLE_START,SAMPLE_THROUGH_ALWAYS
// never = SAMPLE_BUCKET_ENABLED (START and THROUGH_ALWAYS are cleared)
//
let jcModeMap = {
  always: 'SAMPLE_START,SAMPLE_THROUGH_ALWAYS,SAMPLE_BUCKET_ENABLED',
  never: 'SAMPLE_BUCKET_ENABLED'
}
jcModeMap[0] = jcModeMap.never
jcModeMap[1] = jcModeMap.always

exports.modes = Object.keys(jcModeMap)

let axiosOptions = {
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json'
  }
}

exports.JavaCollector = function (containerName, port) {
  this.containerName = containerName
  this.internalPort = port
  this.p = dutils.getExposedPort(containerName, port).then(port => {
    this.internalPort = port
    this.baseUrl = 'http://localhost:' + port + '/collectors'
    return axios.get(this.baseUrl, axiosOptions).then(r => {
      this.collectors = r.data
      this.collectorIds = Object.keys(r.data)
      if (this.collectorIds.length === 1) {
        this.id = this.collectorIds[0]
        return this.id
      }
      return undefined
    })
  })
}

exports.JavaCollector.prototype.getSettings = function (collectorId) {
  return this.p.then(id => {
    id = id || collectorId || 1
    let settingsUrl = this.baseUrl + '/' + id + '/settings'
    return axios.get(settingsUrl, axiosOptions).then(r => {
      this.settings = r.data[0]
      return this.settings
    })
  })
}

exports.JavaCollector.prototype.setMode = function (mode, collectorId) {
  if (!jcModeMap[mode]) {
    return Promise.reject('invalid mode')
  }
  return this.p.then(id => {
    id = id || collectorId || 1
    return this.getSettings().then(curSettings => {
      if (curSettings.flags === jcModeMap[mode]) {
        return mode
      }
      let settingsUrl = this.baseUrl + '/' + id + '/settings'
      // need to change the flags
      if (curSettings.key.serviceKey === null) {
        curSettings.key.serviceKey = ''
      }
      curSettings.flags = jcModeMap[mode]
      curSettings = [curSettings]
      console.log(curSettings)
      return axios.put(settingsUrl, curSettings, axiosOptions).then(r => {
        return mode
      })
    })
  })
}
