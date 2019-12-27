'use strict';

const Action = require('../action')

//
// class-based chain implementation.
//
// the chain action takes an argument of the chain to follow, e.g.,
// chain=?target=https://google.com or, more torturously,
// chain=?target=https://localhost:8088/chain?target=https://localhost:8088/chain?target=https://localhost:8088/delay=1500
//
class ActionChain extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.httpOptions = options.httpOptions
    this.output = output
    this.url = `${host}/chain`;
    if (options.arg) {
      this.url = `${this.url}${options.arg}`;
    }
    this.inFlight = 0
    this.count = 0
    this.sampled = 0
  }

  execute () {
    return this.httpGet(this.url, this.httpOptions).then(r => {
      this.collectStats(r)
      this.output((et, stats) => this.makeStatsLine(et, stats))
      return r
    })
  }

  collectStats (r) {
    this.count += 1;
    if (this.wasSampled(r.headers)) {
      this.sampled += 1;
    }
  }

  getStatsNames () {
    return ['count', 'sampled'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      'n: ', this.count, '(', Action.rd(this.count / et), '/s), ',
      'sampled: ', this.sampled, '(', Action.rd(this.sampled / et), '/s) ',
      Action.rd(this.sampled / this.count * 100, 0), '%'
    ].join('');
  }
}

module.exports = ActionChain
