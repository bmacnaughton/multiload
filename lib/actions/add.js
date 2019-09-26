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

    if (options.arg) {
      if (options.arg.startsWith('max-actions=')) {
        this.maxActions = +options.arg.slice('max-actions='.length);
      }
    }
  }

  execute () {
    const ipso = makePlainText()
    const body = {title: ipso, completed: false}

    this.adds += 1
    return this.httpPost(this.url, body, this.httpOptions).then(r => {
      // return the todo just added
      if (this.wasSampled(r.headers)) {
        this.sampled += 1
      }
      this.output((et, stats) => this.makeStatsLine(et, stats));
      return r.data.todo
    })
  }

  getStatsNames () {
    return ['adds', 'sampled', ];
  }

  makeStatsLine (et, stats = this.getStats()) {
    const {adds, sampled} = stats;
    return [
      'adds: ', adds, '(', Action.rd(adds / et), '/s), ',
      'sampled: ', sampled,
      '(', Action.rd(sampled / adds * 100, 0), '%)'
    ].join('')
  }
}

function makePlainText (min = 10, max = 30) {
  const length = min + Math.random() * (max - min)
  return randomstring.generate(length)
}

module.exports = ActionAdd
