'use strict';

const Action = require('../action')

//
// class-based delay implementation
//
class ActionDelay extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.httpOptions = options.httpOptions
    this.delay = options.delay
    this.url = host + '/delay/' + options.delay
    this.delayCalls = 0
    this.totalServerDelay = 0
    this.totalDelay = 0

    // this option can only be a number, e.g., the command line included
    // and actions-arg, e.g., --action=delay::5000
    this.delay = 1500;
    if ('arg' in options) {
      const delay = +options.arg;
      if (delay) {
        this.delay = delay;
      }
    }
  }

  execute () {
    const start = Action.mstime()
    return this.httpGet(this.url, this.httpOptions).then(r => {
      this.collectStats(start, r);
      this.output((et, stats) => this.makeStatsLine(et, stats))
      return r
    })
  }

  collectStats (start, r) {
    this.delayCalls += 1
    this.totalServerDelay += r.data.actualDelay
    this.totalDelay += Action.mstime() - start
    // return this action's data as opposed to any object-global
    // storage in case requests overlap
    this.lastDelay = Action.mstime() - start;
    this.lastServerDelay = r.data.actualDelay;
    return {
      totalDelay: Action.mstime() - start,
      serverDelay: r.data.actualDelay
    }
  }

  getStatsNames () {
    return ['delayCalls', 'totalDelay', 'totalServerDelay', 'lastDelay', 'lastServerDelay'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      'n: ', stats.delayCalls,
      ', delay (tot, server) avg (',
      Action.rd(stats.totalDelay / stats.delayCalls), ', ',
      Action.rd(stats.totalServerDelay / stats.delayCalls),
      `) last (${stats.lastDelay / stats._n}, ${stats.lastServerDelay / stats._n})`
    ].join('');
  }
}

module.exports = ActionDelay
