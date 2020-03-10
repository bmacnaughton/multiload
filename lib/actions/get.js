'use strict';
const Action = require('../action')

//
// get todos
//
class ActionGet extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.count = 0
    this.sampled = 0
    this.getTodosTime = 0;
  }

  execute () {
    let hrtime = process.hrtime();
    return this.httpGet(this.url, this.httpOptions).then(r => {
      hrtime = process.hrtime(hrtime);
      hrtime = hrtime[0] * 1e3 + hrtime[1] / 1e6;

      this.collectStats(r, hrtime)
      this.output((et, stats) => this.makeStatsLine(et, stats))
      return r
    })
  }

  collectStats (r, hrtime) {
    this.count += 1;
    if (this.wasSampled(r.headers)) {
      this.sampled += 1;
    }
    this.getTodosTime += hrtime;
  }

  getStatsNames () {
    return ['count', 'sampled', 'getTodosTime'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      `todo-get: ${stats.count}`,
      `, sampled: ${stats.sampled}`,
      `, ${Action.rd(stats.count / et)}/sec`,
      ` Δt ${Action.rd(stats.getTodosTime / stats.count)}`
    ].join('');
  }
}

module.exports = ActionGet
