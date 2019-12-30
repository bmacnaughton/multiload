'use strict';

const Action = require('../action')
const axios = require('axios');

//
// class-based get todos implementation
//
class ActionDelete extends Action {
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
    return axios.get(this.url, this.httpOptions).then(r => {
      const outstanding = []
      const todosToDelete = r.data
      while (todosToDelete.length) {
        const todo = todosToDelete.shift()
        // small delay so not all requests are queued before yielding
        // to the event loop.
        const p = Action.wait(10).then(() => {
          this.queued += 1
          return axios.delete(`${this.url}/${todo._id}`, this.httpOptions)
        })
        // non-errors count as 1
        outstanding.push(p.then(r => {
          this.queued -= 1
          this.deleted += 1
          this.output((et, stats) => this.makeStatsLine(et, stats))
          return 1
        }).catch(e => {
          this.errors += 1
          return 0
        }))
      }
      return outstanding
    }).then(outstanding => {
      return this.deleted
    })

  }

  getStatsNames () {
    return ['queued', 'deleted', 'errors', ];
  }

  makeStatsLine (et, stats = this.getStats()) {
    return [
      'todo deletes queued: ', this.queued,
      ', deleted: ', this.deleted,
      ', errors: ', this.errors
    ].join('');
  }
}

module.exports = ActionDelete
