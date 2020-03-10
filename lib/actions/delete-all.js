'use strict';

const Action = require('../action')

//
// delete all todos
//
class ActionDeleteAll extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.count = 0
  }

  execute () {
    this.count += 1;
    return this.httpDelete(`${this.url}/*`, this.httpOptions)
      .then(r => {
        this.output((et, stats) => this.makeStatsLine(et, stats));
        return r;
      })
  }

  getStatsNames () {
    // this cheats and uses deleteCount and deleteTime because this
    // is the only request that uses DELETE.
    return ['count', 'deleteCount', 'deleteTime'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      `delete-all: ${stats.count} `,
      `(${Action.rd(stats.count / et)}/s) `,
      `Δt ${Action.rd(stats.deleteTime / stats.deleteCount)}`
    ].join('');
  }
}

module.exports = ActionDeleteAll;
