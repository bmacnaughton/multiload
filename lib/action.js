'use strict';

const axios = require('axios')

// TODO BAM - add action-specific help

// keep totals across all instances
let allChecked = 0
let allSampled = 0

class Action {
  constructor (host, output, options) {
    this.host = host
    this.output = output
    this.options = options
    this.rate = options.rate || 1;
    this.agent = options.agentConfigured
    this.badHeader = options.badHeader
    this.getDelay = options.delayFn || this.delay
    this.maxActions = options.maximum || Infinity;

    this.gets = 0
    this.posts = 0
    this.deletes = 0

    // keep track of how many requests have not received
    // a response.
    this.inFlight = 0

    // check sample status if intended
    this.checkedTotal = 0
    this.checkedSampled = 0
    // presume true as most common usage.
    this.checkSamples = true
    if ('checkSamples' in options) {
      this.checkSamples = options.checkSamples
    }
  }

  _common (r) {
    if (this.checkSamples) {
      this.checkedTotal += 1
      allChecked += 1
      if (this.wasSampled(r.headers)) {
        this.checkedSampled += 1
        allSampled += 1
      }
    }
  }

  httpGet (url, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    this.gets += 1
    return axios.get(url, this.httpOptions).then(r => {
      this._common(r)
      return r
    }).finally(() => {
      this.inFlight -= 1
    })
  }

  httpPost (url, req, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    this.posts += 1
    return axios.post(url, req, options).then(r => {
      this._common(r)
      return r
    }).finally(() => {
      this.inFlight -= 1
    })
  }

  httpDelete (url, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    this.deletes += 1
    return axios.delete(url, options).then(r => {
      this._common(r)
      return r
    }).finally(() => {
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

  wasSampled (headers) {
    // validate header present and version correct
    if (this.agent === 'appoptics') {
      if (!headers['x-trace'] || headers['x-trace'].slice(0, 2) !== '2B') {
        // eslint-disable-next-line no-console
        console.error('x-trace not valid:', headers['x-trace'])
        throw new Error('x-trace not valid: ' + headers['x-trace'])
      }
    }

    if (this.badHeader) {
      const sentX = this.options.httpOptions.headers['x-trace']
      const receivedX = headers['x-trace']
      if (sentX.substr(2, 40) === receivedX.substr(2, 40)) {
        throw new Error('x-trace task ID same as bad header')
      }
    }
    if (headers && headers['x-trace']) {
      return headers['x-trace'].slice(-2) === '01';
    }
    return false;
  }

  getStats () {
    const names = this.getStatsNames();
    // _n is the count of stats. because stats are aggregated
    // when more than one instance of a given transaction is
    // specified, _n will be aggregated resulting in the count.
    const stats = {_n: 1};

    for (let i = 0; i < names.length; i++) {
      stats[names[i]] = this[names[i]];
    }
    return stats;
  }

  aggregateStats (aStats, newStats) {
    // TODO BAM this is a placeholder for being able to aggregate level,
    // incremental, and possibly other types of stats including time-base
    // averages.
    throw new Error('aggregateStats() not implemented');
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

  static getAllSampled () {
    return {
      checked: allChecked,
      sampled: allSampled
    }
  }

  static clearAllSampled () {
    allChecked = allSampled = 0
  }
}

module.exports = Action
