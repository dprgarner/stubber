const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const equal = require('deep-equal')
const jsonParser = require('body-parser').json()
const Promise = require('bluebird');
const request = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

function BaseStubber(app, opts) {
  if (!fs.existsSync(this.responsesDir)) fs.mkdirSync(this.responsesDir);
  this.liveSite = opts.liveSite;

  try {
    this.requestStubs = JSON.parse(fs.readFileSync(this.requestsFile));
  } catch (err) {
    if (err.code === 'ENOENT') this.requestStubs = [];
    else throw err;
  }

  this.requestsMade = {};
  _.each(this.requestStubs, function (val) {
    this.requestsMade[val.name] = false;
  }.bind(this));

  this.matchStub = this.matchStub.bind(this);
  this.saveAndReturnStub = this.saveAndReturnStub.bind(this);

  this.initialize(app, opts);
}

BaseStubber.extend = function (newPrototype) {
  function SubClass() {
    return BaseStubber.apply(this, arguments);
  };
  SubClass.prototype = _.create(BaseStubber.prototype, newPrototype);
  SubClass.prototype.constructor = SubClass;
  return SubClass;
};

Object.assign(BaseStubber.prototype, {
  responsesDir: null,
  requestsFile: null,

  log: function(message) {
    console.log(message);
  },

  // The default BaseStubber will match all requests.
  initialize: function (app) {
    app.get('*', this.matchStub, this.saveAndReturnStub);
    app.post('*', jsonParser, this.matchStub, this.saveAndReturnStub);
    app.put('*', jsonParser, this.matchStub, this.saveAndReturnStub);
    app.delete('*', this.matchStub, this.saveAndReturnStub);
  },

  // Boolean function for determining whether a request object and a saved
  // stub match.
  matches: function(req, savedStub) {
    var itemPath = req.path;
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
    this.log(
      req.path
      + ', ' + JSON.stringify(req.query)
      + ', ' + JSON.stringify(req.body || '')
    );

    for (var i = 0; i < this.requestStubs.length; i++) {
      if (this.matches(req, this.requestStubs[i])) {
        var filePath = path.resolve(
          this.responsesDir, this.requestStubs[i].name + '.json'
        );
        return {name: this.requestStubs[i].name, filePath: filePath};
      }
    }
  },

  // Middleware which attempts to match a stub.
  matchStub: function(req, res, next) {
    try {
      var stub = this.lookupStub(req);
      if (stub) {
        this.log(`  Matched stub "${stub.name}"`);
        this.requestsMade[stub.name] = true;
        return readFile(stub.filePath)
        .then(function (body) {
          return res.end(body);
        });
      } else if (this.liveSite) {
        return next();
      } else {
        throw new Error('Request did not match any item stub.');
      }
    } catch (err) {
      var errorMessage = [
        '  Error: ' + err.message,
        '  Request Path: ' + req.path,
        '  Request QueryDict: ' + JSON.stringify(req.query),
        '  Request Body: ' + JSON.stringify(req.body || ''),
      ].join('\n');
      this.log(errorMessage);
      return res.status(500).end(errorMessage);
    }
  },

  // Generates a name for the stub from the request object.
  getStubName: function(req) {
    var nameComponents = [req.path.replace(/\//g, '_').slice(1)];
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
      path: req.path,
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
    function handleError(err) {
      var errorMessage = [
        '  Error: ' + err.message,
        '  Request Path: ' + req.path,
        '  Request QueryDict: ' + JSON.stringify(req.query),
        '  Request Body: ' + JSON.stringify(req.body || ''),
      ].join('\n');
      this.log(errorMessage);
      return res.status(500).end(errorMessage);
    }

    try {
      this.log(`  Did not match any stub - requesting ${req.url}`);
      var name = this.getStubName(req);
      var data = {
        method: req.method,
        uri: this.liveSite + req.url,
        query: req.query,
      };
      if (req.method === 'POST') data.body = JSON.stringify(req.body);
    } catch (err) {
      return handleError(err);
    }

    return request(data)
    .then(function (body) {
      return Promise.all([
        writeFile(path.resolve(this.responsesDir, name + '.json'), body),
        this.saveStub(this.createStub(req, name))
      ])
      .then(function () {
        this.log(`  Saved stub '${name}'`);
        return res.type('json').end(body);
      }.bind(this));
    }.bind(this))
    .catch(handleError.bind(this));
  },
});

module.exports = BaseStubber;