const axios = require('axios')
const randomstring = require('randomstring')
const Action = require('./action')

//
// class-based add-delete implementation
//
class ActionAddDelete extends Action {
  constructor(host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.inFlight = 0
    this.addCount = 0
    this.addsSampled = 0
    this.delCount = 0
    this.delsSampled = 0
  }

  execute () {
    var f = (et) => this.makeStatsLine(et)

    // rate is per second, so 1 / rate is seconds * 1000
    // to get ms, * 2 so random should average rate.
    let interval = 1 / this.options.rate * 2000

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

      return Action.wait(random(interval)).then(() => {
        this.deleteTodo(r.data.todo).then(r => {
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
    let start = Action.mstime()
    let ipso = makePlainText()
    let req = { title: ipso, completed: false }
    this.inFlight += 1
    return axios.post(this.url, req, this.httpOptions).then(r => {
      this.inFlight -= 1
      // accumulate time
      this.addTime += Action.mstime() - start
      return r
    }).catch(e => {
      console.log(e)
      this.inFlight -= 1
      return {}
    })
  }

  // delete a specific ID
  deleteTodo (todo) {
    let start = Action.mstime()
    this.inFlight += 1
    return axios.delete(this.url + '/' + todo._id, this.httpOptions).then(r => {
      this.inFlight -= 1
      this.delTime += Action.mstime() - start
      return r
    }).catch(e => {
      console.log(e)
      this.inFlight -= 1
      return {}
    })
  }

  makeStatsLine (et) {
    var totActions = this.addCount + this.delCount
    var totSampled = this.addsSampled + this.delsSampled
    return [
      'a:', this.addCount, '(', Action.rd(this.addCount / et), '/s), ',
      'd:', this.delCount, '(', Action.rd(this.delCount / et), '/s), ',
      'sampled a:', this.addsSampled, ', d:', this.delsSampled,
      ', t:', totSampled, ' (', Action.rd(totSampled/totActions*100, 0), '%)'
    ].join('')
  }
}


function makePlainText(min = 10, max = 30) {
  let length = min + Math.random() * (max - min)
  return randomstring.generate(length)
}

function random(interval) {
  return Math.round(Math.random() * interval, 0)
}

module.exports = ActionAddDelete
