import fs from 'fs';
import path from 'path';

import _ from 'lodash';
import equal from 'deep-equal';
import bodyParser from 'body-parser';
import request from 'request-promise';
import { promisify } from 'util';
import sanitize from 'sanitize-filename';
import { is as typeIs } from 'type-is';
import winston from 'winston';
import { queryDictsMatch } from './utils';

const jsonParser = bodyParser.json();

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, { timestamp: true });

function BaseStubber(app, opts) {
  if (!this.responsesDir)
    this.responsesDir = path.resolve(
      __dirname,
      '..',
      'data',
      this.name + 'Responses'
    );
  if (!this.matchersFile)
    this.matchersFile = path.resolve(
      __dirname,
      '..',
      'data',
      this.name + '.json'
    );
  if (!fs.existsSync(this.responsesDir)) fs.mkdirSync(this.responsesDir);
  this.liveSite = opts.liveSite;

  try {
    this.matchers = JSON.parse(fs.readFileSync(this.matchersFile));
  } catch (err) {
    if (err.code === 'ENOENT') this.matchers = [];
    else throw err;
  }

  this._requestsMade = {};
  _.each(
    this.matchers,
    function(matcher) {
      this.setMatchedRequests(matcher, 0);
    }.bind(this)
  );

  this.matchRequest = this.matchRequest.bind(this);
  this.saveAndReturnStub = this.saveAndReturnStub.bind(this);

  this.initialize(app, opts);
}

var extend = function(newPrototype) {
  var parent = this;
  function SubClass() {
    return parent.apply(this, arguments);
  }
  SubClass.prototype = _.create(BaseStubber.prototype, newPrototype);
  SubClass.prototype.constructor = SubClass;
  SubClass.extend = extend;
  return SubClass;
};
BaseStubber.extend = extend;

_.extend(BaseStubber.prototype, {
  name: 'BaseStubber',

  handleError: function(req, res, err) {
    var errorObject = {
      error: err.message,
      req: _.pick(req, ['path', 'query', 'body']),
    };
    var errorMessage = JSON.stringify(errorObject, null, 2);

    winston.error(errorMessage);
    return res.status(500).end(errorMessage);
  },

  // The default BaseStubber will match all requests.
  initialize: function(app) {
    app.get('*', this.matchRequest, this.saveAndReturnStub);
    app.post('*', jsonParser, this.matchRequest, this.saveAndReturnStub);
    app.put('*', jsonParser, this.matchRequest, this.saveAndReturnStub);
    app.delete('*', this.matchRequest, this.saveAndReturnStub);
  },

  // Boolean-returning function for determining whether a request object
  // matches a saved request.
  isMatch: function(req, matcherReq) {
    return (
      req.method === matcherReq.method &&
      req.path === matcherReq.path &&
      queryDictsMatch(req.query, matcherReq.query) &&
      equal(req.body, matcherReq.body)
    );
  },

  // Finds a matching stub, if any.
  getMatcher: function(req) {
    winston.debug(
      'Request object: ' +
        JSON.stringify(_.pick(req, ['path', 'query', 'body']), null, 2)
    );

    for (var i = 0; i < this.matchers.length; i++) {
      if (this.isMatch(req, this.matchers[i].req)) {
        return this.matchers[i];
      }
    }
  },

  relaySavedResponse: function(res, match) {
    var filePath = path.resolve(this.responsesDir, match.res.name);
    return readFile(filePath).then(function(body) {
      winston.debug('  Matched ' + match.res.name);
      return res.status(match.res.statusCode).end(body);
    });
  },

  // Middleware which attempts to match a request to a stub.
  matchRequest: function(req, res, next) {
    return Promise.resolve()
      .then(
        function() {
          var match = this.getMatcher(req);
          if (match) {
            this.incrementMatchedRequests(match);
            return this.relaySavedResponse(res, match);
          } else if (this.liveSite) {
            return next();
          } else {
            throw new Error('Request was not matched to any stub.');
          }
        }.bind(this)
      )
      .catch(
        function(err) {
          return this.handleError(req, res, err);
        }.bind(this)
      );
  },

  setMatchedRequests: function(matcher, value) {
    this._requestsMade[matcher.res.name] = value;
  },

  incrementMatchedRequests: function(matcher) {
    this._requestsMade[matcher.res.name] += 1;
  },

  getMatchedRequests: function() {
    return _.keys(_.pickBy(this._requestsMade));
  },

  getUnmatchedRequests: function() {
    return _.keys(_.omitBy(this._requestsMade));
  },

  // Given a file name without extension, ensure that no other matching
  // name exists, that no strange characters appear in the name, and that
  // the name is not ridiculously long.
  shortenAndMakeUnique: function(unsafeName) {
    var name = sanitize(unsafeName, { replacement: '_' });
    name = name.replace(/\./g, '_');
    name = name.replace(/\s/g, '_');
    name = name.replace(/@/g, '_');

    if (
      name.length > 128 ||
      _.some(this.matchers, function(matcher) {
        return matcher.res.name.split('.')[0] === name;
      })
    ) {
      name =
        name.slice(0, 118) +
        '_' +
        Date.now()
          .toString()
          .slice(-9);
    }
    return name;
  },

  // Generates a name for the matcher from the request object.
  getMatcherName: function(req) {
    var nameComponents = [req.path.slice(1)];
    nameComponents = nameComponents.concat(
      _.map(req.query, function(val, key) {
        var valString = _.isArray(val) ? val.join('-') : val;
        return key + '-' + valString;
      })
    );
    nameComponents = nameComponents.concat(
      _.map(req.body, function(val, key) {
        var valString = _.isArray(val) ? val.join('-') : val;
        return key + '-' + valString;
      })
    );
    return nameComponents.join('_');
  },

  // A function for determining how the saved matcher is generated from the
  // request and live response.
  createMatcher: function(req, liveResponse) {
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
        name: name + extension,
        statusCode: liveResponse.statusCode,
      },
    };
    if (req.body) matcher.req.body = req.body;
    return matcher;
  },

  makeLiveRequest: function(req) {
    var newRequestData = {
      method: req.method,
      uri: this.liveSite + req.url,
      query: req.query,
      resolveWithFullResponse: true,
    };
    if (req.body) newRequestData.body = JSON.stringify(req.body);
    return request(newRequestData);
  },

  saveResponse: function(matcher, liveResponse) {
    return writeFile(
      path.resolve(this.responsesDir, matcher.res.name),
      liveResponse.body
    ).then(
      function() {
        winston.debug('  Saved stub to file to ' + matcher.res.name);
      }.bind(this)
    );
  },

  // Appends the matcher to the json file and saves.
  saveMatcher: function(matcher) {
    this.matchers.push(matcher);
    return writeFile(
      this.matchersFile,
      JSON.stringify(this.matchers, null, 2)
    ).then(
      function() {
        winston.debug('  Saved matcher to file ' + this.matchersFile);
      }.bind(this)
    );
  },

  relayLiveResponse: function(res, liveResponse) {
    return res.status(liveResponse.statusCode).end(liveResponse.body);
  },

  // Middleware which creates the matcher, saves the response stub, and
  // returns the response.
  saveAndReturnStub: function(req, res) {
    return Promise.resolve()
      .then(
        function() {
          winston.debug('  Request was not matched - requesting ' + req.url);
          return this.makeLiveRequest(req);
        }.bind(this)
      )
      .then(
        function(liveResponse) {
          var matcher = this.createMatcher(req, liveResponse);
          // Sanity check: the new matcher must match the existing request.
          if (!this.isMatch(req, matcher.req)) {
            throw new Error('Created matcher must match the current request');
          }
          this.setMatchedRequests(matcher, 1);
          return Promise.all([
            this.saveResponse(matcher, liveResponse),
            this.saveMatcher(matcher),
          ]).then(
            function() {
              return this.relayLiveResponse(res, liveResponse);
            }.bind(this)
          );
        }.bind(this)
      )
      .catch(
        function(err) {
          return this.handleError(req, res, err);
        }.bind(this)
      );
  },
});

module.exports = BaseStubber;
