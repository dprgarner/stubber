const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const equal = require('deep-equal')
const jsonParser = require('body-parser').json()
const Promise = require('bluebird');
const request = require('request-promise');
const sanitize = require('sanitize-filename');
const typeIs = require('type-is').is;
const winston = require('winston');

const queryDictsMatch = require('./utils').queryDictsMatch;

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {'timestamp': true});

function BaseStubber(app, opts) {
  if (!this.matchersFile) throw new Error('Undefined matchers file');
  if (!this.responsesDir) throw new Error('Undefined responses directory');
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

var extend = function (newPrototype) {
  var parent = this;
  function SubClass() {
    return parent.apply(this, arguments);
  }
  SubClass.prototype = _.create(BaseStubber.prototype, newPrototype);
  SubClass.prototype.constructor = SubClass;
  SubClass.extend = extend;
  return SubClass;
};
BaseStubber.extend = extend

_.extend(BaseStubber.prototype, {
  matchersFile: null,
  responsesDir: null,

  handleError: function(req, res, err) {
    var errorObject = {
      error: err.message,
      req: _.pick(req, ['path', 'query', 'body']),
    }
    var errorMessage = JSON.stringify(
      errorObject, null, 2
    );

    winston.error(errorMessage);
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
      req.method === matcherReq.method
      && req.path === matcherReq.path
      && queryDictsMatch(req.query, matcherReq.query)
      && equal(req.body, matcherReq.body)
    );
  },

  // Finds a matching stub, if any.
  getMatcher: function(req) {
    winston.debug('Request object: ' + JSON.stringify(
      _.pick(req, ['path', 'query', 'body']), null, 2)
    );

    for (var i = 0; i < this.matchers.length; i++) {
      if (this.isMatch(req, this.matchers[i].req)) {
        return this.matchers[i];
      }
    }
  },

  // Middleware which attempts to match a request to a stub.
  matchRequest: function(req, res, next) {
    return Promise.resolve()
    .then(function () {
      var match = this.getMatcher(req);
      if (match) {
        winston.info('  Matched ' + match.res.filename);
        this.requestsMade[match.res.filename] = true;
        var filePath = path.resolve(this.responsesDir, match.res.filename);
        return readFile(filePath)
        .then(function (body) {
          return res.status(match.res.statusCode).end(body);
        });
      } else if (this.liveSite) {
        return next();
      } else {
        throw new Error('Request was not matched to any stub.');
      }
    }.bind(this))
    .catch(function (err) {
      return this.handleError(req, res, err)
    }.bind(this));
  },

  // Given a file name without extension, ensure that no other matching
  // filename exists, that no strange characters appear in the name, and that
  // the filename is not ridiculously long.
  shortenAndMakeUnique: function (unsafeName) {
    var name = sanitize(unsafeName, {replacement: '_'});
    name = name.replace(/\./g, '_');
    name = name.replace(/\s/g, '_');

    if (name.length > 128 || _.some(this.matchers, function (matcher) {
      return matcher.res.filename.split('.')[0] === name;
    })) {
      name = name.slice(0, 118) + '_' + Date.now().toString().slice(-9);
    }
    return name;
  },

  // Generates a name for the matcher from the request object.
  getMatcherName: function(req) {
    var nameComponents = [req.path.slice(1)];
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
  // request and live response.
  createMatcher: function (req, liveResponse) {
    var contentType = liveResponse.headers['content-type'];
    var extension = typeIs(contentType, 'json') ? '.json' : '';
    var name = this.shortenAndMakeUnique(this.getMatcherName(req));

    var matcher = {
      req: {
        method: req.method,
        path: req.path,
        query: req.query,
      },
      res: {
        filename: name + extension,
        statusCode: liveResponse.statusCode,
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
    return Promise.resolve()
    .then(function () {
      winston.info('  Request was not matched - requesting ' + req.url);
      var newRequestData = {
        method: req.method,
        uri: this.liveSite + req.url,
        query: req.query,
        resolveWithFullResponse: true,
      };
      if (req.body) newRequestData.body = JSON.stringify(req.body);
      return request(newRequestData)
    }.bind(this))
    .then(function (liveResponse) {
      var matcher = this.createMatcher(req, liveResponse);
      // Sanity check: the new matcher must match the existing request.
      if (!this.isMatch(req, matcher.req)) {
        throw new Error('Created matcher must match the current request');
      }
      return Promise.all([
        writeFile(
          path.resolve(this.responsesDir, matcher.res.filename), liveResponse.body
        ),
        this.saveMatcher(matcher)
      ])
      .then(function () {
        winston.info('  Saved matcher and stub to ' + matcher.res.filename);
        return res.status(liveResponse.statusCode).end(liveResponse.body);
      }.bind(this));
    }.bind(this))
    .catch(function (err) {
      return this.handleError(req, res, err)
    }.bind(this));
  },
});

module.exports = BaseStubber;
