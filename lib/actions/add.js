'use strict';

const randomstring = require('randomstring')
const Action = require('../action')

//
// class-based add implementation
//
class ActionAdd extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.adds = 0
    this.sampled = 0
    this.addTodoTime = 0;

    if (options.arg) {
      if (options.arg.startsWith('max-actions=')) {
        this.maxActions = +options.arg.slice('max-actions='.length);
      }
    }
  }

  execute () {
    const ipso = makePlainText()
    const body = {title: ipso, completed: false}

    let hrtime = process.hrtime();
    return this.httpPost(this.url, body, this.httpOptions).then(r => {
      hrtime = process.hrtime(hrtime);
      hrtime = hrtime[0] * 1e3 + hrtime[1] / 1e6;
      this.collectStats(r, hrtime);
      this.output((et, stats) => this.makeStatsLine(et, stats));
      // return the todo just added
      return r.data.todo
    })
  }

  collectStats (r, hrtime) {
    this.adds += 1;
    if (this.wasSampled(r.headers)) {
      this.sampled += 1;
    }
    this.addTodoTime += hrtime;
  }

  getStatsNames () {
    return ['adds', 'sampled', 'addTodoTime'];
  }

  makeStatsLine (et, stats = this.getStats()) {
    const {adds, sampled} = stats;
    return [
      `todo-add: ${adds}(${Action.rd(adds / et)}/s)`,
      `, sampled: ${sampled}(${Action.rd(sampled / adds * 100, 0)}%)`,
      ` Δt ${Action.rd(stats.addTodoTime / stats.adds)}`
    ].join('')
  }
}

function makePlainText (min = 10, max = 30) {
  const length = min + Math.random() * (max - min)
  return randomstring.generate(length)
}

module.exports = ActionAdd
