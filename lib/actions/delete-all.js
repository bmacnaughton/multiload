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
    return axios.delete(`${this.url}/*`, this.httpOptions)
      .then(r => {
        // unknown how many deleted.
        return -1;
      })
  }

  makeStatsLine (et) {
    return [
      'todo deleteAll executed'
    ].join('');
  }
}

module.exports = ActionDeleteAll;
