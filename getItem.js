const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const Promise = require('bluebird');
const rp = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);

const requestsFile = path.resolve('items', 'requests.json');

exports.lookupStub = function(itemPath, query) {
  return readFile(requestsFile)
    .catch(function (err) {
      if (err.code === 'ENOENT') return '[]';
      throw err;
    })
    .then(function (bodyString) {
      var itemStubs = JSON.parse(bodyString);
      for (var i = 0; i < itemStubs.length; i++) {
        if (
          itemPath === itemStubs[i].path
          && queryDictsMatch(query, itemStubs[i].query)
        ) {
          var file = path.resolve('items', itemStubs[i].file + '.json');
          return {name: itemStubs[i].name, file: file};
        }
      }
    });
};

exports.saveStub = function (stub) {
  return readFile(requestsFile)
    .catch(function (err) {
      if (err.code === 'ENOENT') return '[]';
      throw err;
    })
    .then(function (bodyString) {
      var items = JSON.parse(bodyString);
      items.push(stub);
      return writeFile(
        path.resolve(requestsFile), JSON.stringify(items, null, 2)
      );
    });
};

exports.getName = function (query) {
  var nameComponents = ['comments'];
  nameComponents = nameComponents.concat(_.map(query, function (val, key) {
    var valString = (_.isArray(val)) ? val.join('-') : val;
    return key +  '-' + valString;
  }));
  return nameComponents.join('_');
};

exports.add = function(app, opts) {
  app.get('/:path', function (req, res, next) {
    // Attempt to match a stub.
    console.log(req.params.path, req.query);
 
    exports.lookupStub(req.params.path, req.query)
      .then(function (stub) {
        if (stub) {
          console.log(`  Matched stub "${stub.name}"`);
          return res.sendFile(stub.file);
        }
        if (!opts.createStubs) return res.status(500).end(
          'Request did not match any item stub.'
        );
        next();
      });
  }, function (req, res) {
    // Create the request stub, save the response stub, and return.
    console.log(`  Did not match any stub - requesting ${req.url}`);
    var name = exports.getName(req.query);

    rp(opts.liveSite + req.url)
      .then(function (body) {
        return writeFile(path.resolve('items', name + '.json'), body)
          .then(function () {
            console.log(`  Created stub ${name}`);
            return exports.saveStub({
              name: name,
              path: 'comments',
              query: req.query,
              file: name,
            });
          })
          .then(function () {
            res.type('json').end(body);
          });
      })
      .catch(function (err) {
        res.status(500).end('Error: ' + err.message);
      });
  });
};