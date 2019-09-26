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
    this.url = host + options.url || '/aws/kinesis';
    this.allowEmptyBody = options.allowEmptyBody;
    this.httpOptions = options.httpOptions;
    this.posts = 0;
    this.sampled = 0;
  }

  execute (req) {
    if (!req && !this.allowEmptyBody) {
      req = {data: ''};
    }

    this.posts += 1
    return this.httpPost(this.url, req, this.httpOptions).then(r => {
      // return the todo just added
      if (this.wasSampled(r.headers)) {
        this.sampled += 1
      }
      this.output((et, stats) => this.makeStatsLine(et, stats))
      return r.data.todo
    })
  }

  getStatsName () {
    return ['posts', 'sampled',];
  }

  makeStatsLine (et, stats = this.getStats()) {
    const {posts, sampled} = stats;
    return [
      'posts: ', posts, '(', Action.rd(posts / et), '/s), ',
      'sampled: ', sampled,
      '(', Action.rd(sampled / posts * 100, 0), '%)'
    ].join('')
  }
}

module.exports = ActionPost;
