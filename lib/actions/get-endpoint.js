'use strict';

const Action = require('../action')

//
// get arbitrary server endpoint information
//
class ActionGetEndpoint extends Action {
  constructor (host, output, options) {
    super(...arguments);
    if (!this.options.arg) {
      throw new Error('get-endpoint requires an argument');
    }
    this.host = host;
    this.output = output;
    this.url = host + '/' + this.options.arg;

    this.endpointCalls = 0;
    this.deltaT = 0;
    this.httpOptions = options.httpOptions;
  }

  execute () {
    const start = Action.mstime();
    return this.httpGet(this.url, this.httpOptions).then(r => {
      return this.collectStats(start);
    }).then(stats => {
      this.output(et => this.makeStatsLine(et, stats));
      return stats;
    })
  }

  collectStats (start) {
    this.endpointCalls += 1;
    this.deltaT += Action.mstime() - start;
  }

  getStatsNames () {
    return ['endpointCalls', 'deltaT'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      'endpointCalls: ', stats.endpointCalls,
      ', deltaT avg (',
      Action.rd(stats.deltaT / stats.endpointCalls),
      ')',
    ].join('');
  }
}

module.exports = ActionGetEndpoint;

