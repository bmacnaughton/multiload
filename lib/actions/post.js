'use strict';

const Action = require('../action')

//
// class-based genric post implementation
//
class ActionPost extends Action {
  constructor (host, output, options) {
    super(...arguments);
    this.host = host;
    this.output = output;
    this.url = host + options.url || '/';
    this.allowEmptyBody = options.allowEmptyBody;
    this.httpOptions = options.httpOptions;
    this.count = 0;
    this.sampled = 0;
  }

  execute (req) {
    if (!req && !this.allowEmptyBody) {
      req = {data: ''};
    }

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
      'posts: ', this.count, '(', Action.rd(this.count / et), '/s), ',
      'sampled: ', this.sampled,
      '(', Action.rd(this.sampled / this.count * 100, 0), '%)'
    ].join('')
  }
}

module.exports = ActionPost;
