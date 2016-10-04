const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const equal = require('deep-equal')
const Promise = require('bluebird');
const request = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

function BaseStubber(app, opts) {
  if (!fs.existsSync(this.directory)) fs.mkdirSync(this.directory);
  this.liveSite = opts.liveSite;
  this._requestsMade = {};

  try {
    this.requestStubs = JSON.parse(fs.readFileSync(this.requestsFile));
  } catch (err) {
    if (err.code === 'ENOENT') this.requestStubs = [];
    else throw err;
  }
}

Object.assign(BaseStubber.prototype, {
  directory: null,
  requestsFile: null,

  log: function(message) {
    console.log(message);
  },

  // Returns the parsed requests json file.
  getRequestStubs: function() {
    return Promise.resolve(this.requestStubs);
  },

  // Returns a dict of all the stubs which have been matched since initialisation.
  getRequestsMade: function () {
    var that = this;
    return this.getRequestStubs()
      .then(function (stubs) {
        _.each(stubs, function (stub) {
          if (!that._requestsMade[stub.name]) that._requestsMade[stub.name] = false;
        });
        return that._requestsMade;
      });
  },

  // Boolean function for determining whether a request object and a saved
  // stub match.
  matches: function(req, savedStub) {
    var itemPath = req.params.path;
    var query = req.query;
    var body = req.body;
    return (
      itemPath === savedStub.path
      && queryDictsMatch(query, savedStub.query)
      && equal(body, savedStub.body)
    );
  },

  // Finds a matching stub, if any.
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
      }.bind(this));
  },

  // Middleware which attempts to match a stub.
  matchStub: function(req, res, next) {
    this.lookupStub(req)
      .then(function (stub) {
        if (stub) {
          this.log(`  Matched stub "${stub.name}"`);
          this._requestsMade[stub.name] = true;
          return readFile(stub.filePath)
            .then(function (body) {
              return res.end(body);
            });
        } else if (this.liveSite) {
          return next();
        } else {
          throw new Error('Request did not match any item stub.');
        }
      }.bind(this))
      .catch(function (err) {
        this.log(`  Error: ${err.message}`);
        return res.status(500).end(err.message);
      }.bind(this));
  },

  // Generates a name for the stub from the request object.
  getStubName: function(req) {
    var nameComponents = [req.params.path];
    nameComponents = nameComponents.concat(_.map(req.query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    nameComponents = nameComponents.concat(_.map(req.body, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  // A function for determining how the saved stub is generated from the
  // request.
  createStub: function (req, name) {
    var stub = {
      name: name,
      path: req.params.path,
      query: req.query,
    };
    if (req.body) stub.body = req.body
    return stub;
  },

  // Appends stub to requests json file and saves.
  saveStub: function(stub) {
    this.requestStubs.push(stub);
    return writeFile(this.requestsFile, JSON.stringify(
      this.requestStubs, null, 2
    ));
  },

  // Middleware which creates the request stub, saves the response stub, and
  // returns the response.
  saveAndReturnStub: function(req, res) {
    var that = this;
    this.log(`  Did not match any stub - requesting ${req.url}`);
    var name = this.getStubName(req);

    var data = {
      method: req.method,
      uri: this.liveSite + req.url,
      query: req.query,
    };
    if (req.method === 'POST') data.body = JSON.stringify(req.body);

    request(data).then(function (body) {
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