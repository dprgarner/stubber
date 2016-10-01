const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

const requestsFile = path.resolve('items', 'requests.json');

exports.getRequestStubs = function() {
  return readFile(requestsFile)
    .catch(function (err) {
      if (err.code === 'ENOENT') return '[]';
      throw err;
    })
    .then(function (bodyString) {
      return JSON.parse(bodyString);
    });
};

exports.lookupStub = function(itemPath, query) {
  return exports.getRequestStubs()
    .then(function (stubs) {
      for (var i = 0; i < stubs.length; i++) {
        if (
          itemPath === stubs[i].path
          && queryDictsMatch(query, stubs[i].query)
        ) {
          var file = path.resolve('items', stubs[i].file + '.json');
          return {name: stubs[i].name, file: file};
        }
      }
    });
};

exports.saveStub = function(stub) {
  return exports.getRequestStubs()
    .then(function (stubs) {
      stubs.push(stub);
      return writeFile(
        path.resolve(requestsFile), JSON.stringify(stubs, null, 2)
      );
    });
};

exports.getStubName = function(query) {
  var nameComponents = ['comments'];
  nameComponents = nameComponents.concat(_.map(query, function (val, key) {
    var valString = (_.isArray(val)) ? val.join('-') : val;
    return key +  '-' + valString;
  }));
  return nameComponents.join('_');
};

// Middleware which attempt to match a stub.
exports.matchStub = function(req, res, next) {
  console.log(req.params.path, req.query);

  exports.lookupStub(req.params.path, req.query)
    .then(function (stub) {
      if (stub) {
        console.log(`  Matched stub "${stub.name}"`);
        return res.sendFile(stub.file);
      }
      if (!req.opts.createStubs) return res.status(500).end(
        'Request did not match any item stub.'
      );
      next();
    });
};

// Middleware which creates the request stub, saves the response stub, and
// returns the response.
exports.createStub = function(req, res) {
  console.log(`  Did not match any stub - requesting ${req.url}`);
  var name = exports.getStubName(req.query);

  request(req.opts.liveSite + req.url).then(function (body) {
    return Promise.all([
      writeFile(path.resolve('items', name + '.json'), body),
      exports.saveStub({
        name: name,
        path: 'comments',
        query: req.query,
        file: name,
      })
    ]).then(function () {
      res.type('json').end(body);
    });
  }).catch(function (err) {
    res.status(500).end('Error: ' + err.message);
  });
}

exports.add = function(app) {
  app.get('/:path', exports.matchStub, exports.createStub);
};