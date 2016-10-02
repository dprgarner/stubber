const fs = require('fs');
const path = require('path');

const Promise = require('bluebird');
const request = require('request-promise');

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

function BaseStubber(app, opts) {
  throw new Error('Not implemented');
}

Object.assign(BaseStubber.prototype, {
  directory: null,
  requestsFile: null,

  log: function(message) {
    console.log(message);
  },

  // Returns parsed requests.json.
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

  // Finds a matching stub if any, and errors if no matching stub.
  lookupStub: function(req) {
    this.log(req.params.path + ', ' + JSON.stringify(req.query));

    return this.getRequestStubs()
      .then(function (stubs) {
        for (var i = 0; i < stubs.length; i++) {
          if (this.matches(req, stubs[i])) {
            var filePath = path.resolve(this.directory, stubs[i].name + '.json');
            return {name: stubs[i].name, filePath: filePath};
          }
        }
      }.bind(this))
      .then(function (stub) {
        if (stub) {
          this.log(`  Matched stub "${stub.name}"`);
          return readFile(stub.filePath);
        } else {
          // TODO this isn't exceptional, should not be an error.
          throw new Error('Request did not match any item stub.');
        }
      }.bind(this));
  },

  // Appends stub to requests.json and saves.
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

  // Middleware which creates the request stub, saves the response stub, and
  // returns the response.
  saveAndReturnStub: function(req, res) {
    var that = this;
    this.log(`  Did not match any stub - requesting ${req.url}`);
    var name = this.getStubName(req);

    request(this.liveSite + req.url).then(function (body) {
      return Promise.all([
        writeFile(path.resolve(that.directory, name + '.json'), body),
        that.saveStub(that.createStub(req, name))
      ]).then(function () {
        that.log(`  Saved stub '${name}'`);
        res.type('json').end(body);
      });
    }).catch(function (err) {
      that.log(`  Error: ${err.message}`);
      res.status(500).end('Error: ' + err.message);
    });
  },
});

module.exports = BaseStubber;