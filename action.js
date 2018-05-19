
class Action {
  constructor (host, output, options) {
    this.host = host
    this.output = output
    this.options = options
    this.agent = options.agentConfigured
    this.badHeader = options.badHeader
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

  wasSampled (headers) {
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
}

module.exports = Action
