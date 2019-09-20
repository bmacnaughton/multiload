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
    const f = (et) => this.makeStatsLine(et);

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
    const req = {title: ipso, completed: false}

    return this.httpPost(this.url, req, this.httpOptions).then(r => {
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

  makeStatsLine (et) {
    const totActions = this.addCount + this.delCount
    const totSampled = this.addsSampled + this.delsSampled
    return [
      'a:', this.addCount, '(', Action.rd(this.addCount / et), '/s), ',
      'd:', this.delCount, '(', Action.rd(this.delCount / et), '/s), ',
      'sampled a:', this.addsSampled, ', d:', this.delsSampled,
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
