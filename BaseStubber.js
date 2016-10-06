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
    this.matchers = JSON.parse(fs.readFileSync(this.matchersFile));
  } catch (err) {
    if (err.code === 'ENOENT') this.matchers = [];
    else throw err;
  }

  this.requestsMade = {};
  _.each(this.matchers, function (val) {
    this.requestsMade[val.res.filename] = false;
  }.bind(this));

  this.matchRequest = this.matchRequest.bind(this);
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
  matchersFile: null,

  log: function(message) {
    console.log(message);
  },

  handleError: function(req, res, err) {
    var errorMessage = [
      '  Error: ' + err.message,
      '  Request Path: ' + req.path,
      '  Request QueryDict: ' + JSON.stringify(req.query || {}),
      '  Request Body: ' + JSON.stringify(req.body || ''),
    ].join('\n');
    this.log(errorMessage);
    return res.status(500).end(errorMessage);
  },

  // The default BaseStubber will match all requests.
  initialize: function (app) {
    app.get('*', this.matchRequest, this.saveAndReturnStub);
    app.post('*', jsonParser, this.matchRequest, this.saveAndReturnStub);
    app.put('*', jsonParser, this.matchRequest, this.saveAndReturnStub);
    app.delete('*', this.matchRequest, this.saveAndReturnStub);
  },

  // Boolean-returning function for determining whether a request object
  // matches a saved request.
  isMatch: function(req, matcherReq) {
    return (
      req.path === matcherReq.path
      && queryDictsMatch(req.query, matcherReq.query)
      && equal(req.body, matcherReq.body)
    );
  },

  // Finds a matching stub, if any.
  getMatcher: function(req) {
    this.log(
      req.path
      + ', ' + JSON.stringify(req.query)
      + ', ' + JSON.stringify(req.body || '')
    );

    for (var i = 0; i < this.matchers.length; i++) {
      if (this.isMatch(req, this.matchers[i].req)) {
        return this.matchers[i];
      }
    }
  },

  // Middleware which attempts to match a request to a stub.
  matchRequest: function(req, res, next) {
    try {
      var match = this.getMatcher(req);
      if (match) {
        this.log(`  Matched "${match.res.filename}"`);
        this.requestsMade[match.res.filename] = true;
        var filePath = path.resolve(this.responsesDir, match.res.filename);
        return readFile(filePath)
        .then(function (body) {
          return res.end(body);
        })
        .catch(function (err) {
          return this.handleError(req, res, err)
        }.bind(this));
      } else if (this.liveSite) {
        return next();
      } else {
        throw new Error('Request was not matched to any stub.');
      }
    } catch (err) {
      return this.handleError(req, res, err);
    }
  },

  // Generates a name for the matcher from the request object.
  getMatcherName: function(req) {
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

  // A function for determining how the saved matcher is generated from the
  // request.
  createMatcher: function (req) {
    var matcher = {
      req: {
        path: req.path,
        query: req.query,
      },
      res: {
        filename: this.getMatcherName(req) + '.json',
      },
    };
    if (req.body) matcher.req.body = req.body
    return matcher;
  },

  // Appends the matcher to the json file and saves.
  saveMatcher: function(matcher) {
    this.matchers.push(matcher);
    return writeFile(this.matchersFile, JSON.stringify(
      this.matchers, null, 2
    ));
  },

  // Middleware which creates the matcher, saves the response stub, and
  // returns the response.
  saveAndReturnStub: function(req, res) {
    try {
      this.log(`  Request was not matched - requesting ${req.url}`);
      var matcher = this.createMatcher(req);
      var newRequestData = {
        method: req.method,
        uri: this.liveSite + req.url,
        query: req.query,
      };
      if (req.body) newRequestData.body = JSON.stringify(req.body);
    } catch (err) {
      return this.handleError(req, res, err)
    }

    return request(newRequestData)
    .then(function (body) {
      return Promise.all([
        writeFile(path.resolve(this.responsesDir, matcher.res.filename), body),
        this.saveMatcher()
      ])
      .then(function () {
        this.log(`  Saved matcher '${matcher.res.filename}'`);
        return res.type('json').end(body);
      }.bind(this));
    }.bind(this))
    .catch(function (err) {
      return this.handleError(req, res, err)
    });
  },
});

module.exports = BaseStubber;