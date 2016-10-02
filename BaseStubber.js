const fs = require('fs');

const Promise = require('bluebird');

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

function BaseStubber(app, opts) {
  this.liveSite = opts.liveSite;
  app.get('/:path', this.matchStub.bind(this), this.createStub.bind(this));
}

Object.assign(BaseStubber.prototype, {
  directory: null,
  requestsFile: null,

  log: function(message) {
    console.log(message);
  },

  getRequestStubs: function() {
    return readFile(this.requestsFile)
      .catch(function (err) {
        if (err.code === 'ENOENT') return '[]';
        throw err;
      })
      .then(function (bodyString) {
        return JSON.parse(bodyString);
      });
  },

  saveStub: function(stub) {
    return this.getRequestStubs()
      .then(function (stubs) {
        stubs.push(stub);
        return writeFile(this.requestsFile, JSON.stringify(stubs, null, 2));
      }.bind(this));
  },

  // Middleware which attempts to match a stub.
  matchStub: function(req, res, next) {
    this.lookupStub(req)
      .then(function (body) {
        return res.end(body);
      })
      .catch(function (err) {
        if (this.liveSite) {
          return next();
        }
        this.log(`  Error: ${err.message}`);
        return res.status(500).end(err.message);
      }.bind(this));
  },
});

module.exports = BaseStubber;