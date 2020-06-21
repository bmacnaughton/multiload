'use strict';

const https = require('https');
const url = require('url');

// https://docs.appoptics.com/api/#annotations

class Annotations {
  constructor (key, opts = {}) {
    if (!key) {
      throw new Error('Annotations() requires a key');
    }
    this.key = key;

    // defaults
    this.defaults = Object.assign({}, opts);

    // url processing.
    if (opts.host) {
      this.url = `https://${opts.host}/v1/annotations`;
    } else {
      this.url = 'https://api.appoptics.com/v1/annotations';
    }
    // get rid of host; it's not a valid option for the annotation api.
    delete this.defaults.host;

    this.sent = 0;

    this.errorCount = 0;
    this.lastErrorEvent = undefined;

    this.non200Count = 0;
    this.lastNon200 = undefined;
    this.lastNon200Received = undefined;

  }

  send (streamName, title, opts = {}) {
    const defaults = Object.assign({title}, this.defaults, opts);

    let pres;
    let prej;
    const p = new Promise((resolve, reject) => {
      pres = resolve;
      prej = reject;
    });

    const times = {
      start_time: Math.round(Date.now() / 1000),
    };
    const body = Object.assign({}, times, defaults);
    //console.log('sending', body)

    const payload = JSON.stringify(body);

    const u = url.parse(`${this.url}/${streamName}`);
    const port = u.port || u.protocol === 'https:' ? 443 : 80;

    // save the http request options.
    this.options = {
      hostname: u.hostname,
      port,
      path: u.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(this.key + ':').toString('base64'),
        'Content-Length': payload.length,
      }
    };

    let not200 = false;
    const req = https.request(this.options, res => {
      this.sent += 1;

      if (res.statusCode !== 200) {
        not200 = true;
        this.non200Count += 1;
        this.lastNon200 = res.statusCode;
      }

      let received = [];
      res.on('data', d => {
        received.push(d.toString('utf8'));
      })

      res.on('end', () => {
        received = received.join('');
        this.lastReceived = received;
        if (not200) {
          this.lastNon200Received = received;
        }
        pres({headers: res.headers, statusCode: res.statusCode, body: received});
      })
    })

    req.on('error', e => {
      this.errorCount += 1;
      this.lastErrorEvent = e;
      prej(e);
    })

    req.write(payload);
    req.end();

    return p;
  }

  getStats () {
    return {
      sent: this.sent,
      errorCount: this.errorCount,
      lastErrorEvent: this.lastErrorEvent,
      non200Count: this.non200Count,
      lastNon200: this.lastNon200,
      lastNon200Received: this.lastNon200Received,
    };
  }
}

module.exports = Annotations

//
// simple test
//
//if (!module.parent || module.parent.id === '<repl>') {
//  console.log(process.argv)
//  const a = new Annotations(process.env.AO_SWOKEN_PROD);
//  a.send('todo-server-started', 'information about the versions and commit tag')
//    .then(r => console.log(r));
//}

//
// make this a simple command line utility.
//
/* eslint-disable no-console */
if (!module.parent) {
  const os = require('os');
  if (process.argv.length < 5) {
    console.log('syntax: annotations key stream title description [source=os.hostname()]');
    console.log('  e.g., node ./annotations.js $AO_TOKEN_PROD "started-the-server" "short title" "lots of details"');
    process.exit(1);
  }
  let show;
  if (process.argv.length > 5) {
    show = true;
  }
  const [,, key, stream, title, description, source] = process.argv;

  // default options for all sends.
  const options = {
    source: source || os.hostname(),
    description,
  };
  const a = new Annotations(key, options);

  // override with same options for fun
  a.send(stream, title, options)
    .then(r => {
      if (r.statusCode >= 200 && r.statusCode < 300) {
        try {
          const body = JSON.parse(r.body);
          console.log(show ? body : body.id);
          process.exit(0);
        } catch (e) {
          console.log('error decoding JSON', e);
          process.exit(1);
        }
      }
      console.log(r);
      process.exit(1);
    });
}

