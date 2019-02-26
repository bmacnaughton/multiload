const randomstring = require('randomstring')
const Action = require('../action')

//
// class-based add implementation
//
class ActionAdd extends Action {
  constructor(host, output, options) {
    super(...arguments)
    this.host = host
    this.output = output
    this.url = host + '/api/todos'
    this.httpOptions = options.httpOptions
    this.count = 0
    this.sampled = 0
  }

  execute () {
    let ipso = makePlainText()
    let req = {title: ipso, completed: false}

    this.count += 1
    return this.httpPost(this.url, req, this.httpOptions).then(r => {
      // return the todo just added
      if (this.wasSampled(r.headers)) {
        this.sampled += 1
      }
      this.output(et => this.makeStatsLine(et))
      return r.data.todo
    })

  }

  makeStatsLine (et) {
    return [
      'adds: ', this.count, '(', Action.rd(this.count / et), '/s), ',
      'sampled: ', this.sampled,
      '(', Action.rd(this.sampled / this.count * 100, 0), '%)'
    ].join('')
  }
}

function makePlainText(min = 10, max = 30) {
  let length = min + Math.random() * (max - min)
  return randomstring.generate(length)
}

module.exports = ActionAdd
