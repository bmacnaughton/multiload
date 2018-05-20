const axios = require('axios')
const Action = require('./action')

//
// class-based delay implementation
//
class ActionDelay extends Action{
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
  }

  execute() {
    let start = Action.mstime()
    return this.httpGet(this.url, this.httpOptions).then(r => {
      let last = this.collectStats(start, r)
      this.output(et => this.makeStatsLine(et, last))
      return r
    })
  }

  collectStats(start, r) {
    this.delayCalls += 1
    this.totalServerDelay += r.data.actualDelay
    this.totalDelay += Action.mstime() - start
    // return this action's data as opposed to any object-global
    // storage in case requests overlap
    return {
      totalDelay: Action.mstime() - start,
      serverDelay: r.data.actualDelay
    }
  }

  makeStatsLine(et, r) {
    return [
      'n: ', this.delayCalls,
      ', delay (tot, server) avg (',
      Action.rd(this.totalDelay / this.delayCalls), ', ',
      Action.rd(this.totalServerDelay / this.delayCalls),
      ') last (', r.totalDelay, ', ', r.serverDelay, ')'
    ].join('');
  }
}

module.exports = ActionDelay
