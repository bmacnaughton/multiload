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
    this.getDelay = options.delayFn || this.delay
    this.maxActions = options.maximum || Infinity;
    this.httpAgent = options.httpAgent;
    this.httpsAgent = options.httpsAgent;

    this.getCount = 0;
    this.postCount = 0;
    this.deleteCount = 0;
    this.getTime = 0;
    this.postTime = 0;
    this.deleteTime = 0;

    // keep track of how many requests have not received
    // a response.
    this.inFlight = 0
  }

  _common (r) {
    // used to check samples.
  }

  httpGet (url, options) {
    const opts = Object.assign({}, this.httpOptions, options);
    this.inFlight += 1
    this.getCount += 1
    let hrtime = process.hrtime.bigint();
    return axios.get(url, opts)
      .then(r => {
        hrtime = Number(hrtime - process.hrtime.bigint()) / 1e6;
        this.getTime += hrtime;
        this._common(r)
        return r
      })
      .finally(() => {
        this.inFlight -= 1
      });
  }

  httpPost (url, req, options) {
    if (!options) {
      options = this.httpOptions
    }
    this.inFlight += 1
    this.postCount += 1
    let hrtime = process.hrtime.bigint();
    return axios.post(url, req, options).then(r => {
      hrtime = Number(hrtime - process.hrtime.bigint()) / 1e6;
      this.getTime += hrtime;
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
    this.deleteCount += 1
    let hrtime = process.hrtime.bigint();
    return axios.delete(url, options).then(r => {
      hrtime = Number(hrtime - process.hrtime.bigint()) / 1e6;
      this.getTime += hrtime;
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
