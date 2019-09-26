'use strict';

const randomstring = require('randomstring')
const Action = require('../action')

//
// class-based add-delete implementation
//
class ActionAddDelete extends Action {
  constructor (host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.addCount = 0
    this.addsSampled = 0
    this.delCount = 0
    this.delsSampled = 0
  }

  execute () {
    const f = (et, stats) => this.makeStatsLine(et, stats);

    return this.addTodo().then(r => {
      this.addCount += 1
      if (this.wasSampled(r.headers)) {
        this.addsSampled += 1
      }
      this.output(f)

      // if there isn't a todo returned there isn't anything to delete
      if (!(r.data && r.data.todo)) {
        return Promise.reject('transaction failed')
      }

      return Action.wait(this.delay()).then(() => {
        this.deleteTodo(r.data.todo)
          .then(r => {
            this.delCount += 1
            if (this.wasSampled(r.headers)) this.delsSampled += 1
            this.output(f)
            return r
          })
      })
    })
  }

  // add a random todo
  addTodo () {
    const start = Action.mstime()
    const ipso = makePlainText()
    const body = {title: ipso, completed: false}

    return this.httpPost(this.url, body, this.httpOptions).then(r => {
      this.addTime += Action.mstime() - start
      return r
    })
  }

  // delete a specific ID
  deleteTodo (todo) {
    const start = Action.mstime()

    return this.httpDelete(this.url + '/' + todo._id, this.httpOptions).then(r => {
      this.delTime += Action.mstime() - start
      return r
    }).catch(e => {
      return e;
    })
  }

  getStatsNames () {
    return ['addCount', 'delCount', 'addsSampled', 'delsSampled',];
  }

  makeStatsLine (et, stats = this.getStats()) {

    const {addCount, delCount, addsSampled, delsSampled} = stats;
    const totActions = addCount + delCount
    const totSampled = addsSampled + delsSampled
    return [
      'a:', addCount, '(', Action.rd(addCount / et), '/s), ',
      'd:', delCount, '(', Action.rd(delCount / et), '/s), ',
      'sampled a:', addsSampled, ', d:', delsSampled,
      ', t:', totSampled, ' (', Action.rd(totSampled / totActions * 100, 0), '%)'
    ].join('')
  }
}

function makePlainText (min = 10, max = 30) {
  const length = min + random(max - min);
  return randomstring.generate(length);
}

function random (interval) {
  return Math.round(Math.random() * interval, 0)
}

module.exports = ActionAddDelete
