const axios = require('axios')

class Action {
  constructor (host, output, options) {
    this.host = host
    this.output = output
    this.options = options
    this.rate = options.rate || 1
    this.agent = options.agentConfigured
    this.badHeader = options.badHeader
    this.getDelay = options.delayFn || this.delay

    // keep track of how many requests have not received
    // a response.
    this.inFlight = 0
  }

  httpGet (url, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    return axios.get(url, this.httpOptions).finally(() => {
      this.inFlight -= 1
    })
  }

  httpPost (url, req, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    return axios.post(url, req, options).finally(() => {
      this.inFlight -= 1
    })
  }

  httpDelete (url, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    return axios.delete(url, options).finally(() => {
      this.inFlight -= 1
    })
  }

  delay () {
    // rate is actions/second => 1/rate is seconds/action
    // seconds/action * 1000 => ms/action
    // ms/action * 2 => yields average action/second ~= rate
    // Math.random * 1 / rate * 1000 * 2
    return Math.random() / this.rate * 2000
  }

  wasSampled(headers) {
    // validate header present and version correct
    if (this.agent === 'appoptics') {
      if (!headers['x-trace'] || headers['x-trace'].slice(0, 2) !== '2B') {
        console.error('x-trace not valid:', headers['x-trace'])
        throw new Error('x-trace not valid: ' + headers['x-trace'])
      }
    }

    if (this.badHeader) {
      let sentX = this.options.httpOptions.headers['x-trace']
      let receivedX = headers['x-trace']
      if (sentX.substr(2, 40) === receivedX.substr(2, 40)) {
        throw new Error('x-trace task ID same as bad header')
      }
    }
    return headers['x-trace'] && headers['x-trace'].slice(-2) === '01'
  }

  static mstime () {
    return new Date().getTime()
  }

  static rd (n, p) {
    return n.toFixed(p !== undefined ? p : 2)
  }

  static wait (ms) {
    if (ms === 0) {
      return Promise.resolve()
    }
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

module.exports = Action
