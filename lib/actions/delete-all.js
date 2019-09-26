'use strict';

const Action = require('../action')
const axios = require('axios');

//
// class-based get todos implementation
//
class ActionDeleteAll extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.queued = 0
    this.deleted = 0
    this.errors = 0
    this.count = 0
    this.sampled = 0
  }

  execute () {
    this.count += 1;
    return axios.delete(`${this.url}/*`, this.httpOptions)
      .then(r => {
        if (this.wasSampled(r.headers)) {
          this.sampled += 1
        }
        this.output((et, stats) => this.makeStatsLine(et, stats))
        // unknown how many deleted.
        return -1;
      })
  }

  getStatsNames () {
    return ['count',]
  }

  makeStatsLine (et, stats = this.getStats()) {
    return `delete-all: ${stats.count} (${Action.rd(stats.count / et)}/s)`
  }
}

module.exports = ActionDeleteAll;
