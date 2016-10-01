const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const Promise = require('bluebird');
const rp = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);

var itemStubs = [
  {
    name: 'comments-id1',
    path: 'comments',
    query: {
      postId: '1',
    },
    file: 'comments-id1',
  },
];

exports.lookupStub = function(itemPath, query) {
  for (var i = 0; i < itemStubs.length; i++) {
    if (itemPath === itemStubs[i].path && queryDictsMatch(query, itemStubs[i].query)) {
      var file = path.resolve('items', itemStubs[i].file + '.json');
      return {name: itemStubs[i].name, file: file};
    }
  }
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

    var stub = exports.lookupStub(req.params.path, req.query);
    if (stub) {
      console.log(`  Matched stub "${stub.name}"`);
      return res.sendFile(stub.file);
    }
    if (!opts.createStubs) return res.status(500).end(
      'Request did not match any item stub.'
    );
    next();
  }, function (req, res) {
    // Create the request stub, save the response stub, and return.
    console.log(`  Did not match any stub - requesting ${req.url}`);
    var name = exports.getName(req.query);

    rp(opts.liveSite + req.url)
      .then(function (body) {
        return writeFile(path.resolve('items', name + '.json'), body)
          .then(function () {
            console.log(`  Created stub ${name}`);
            itemStubs.push({
              name: name,
              path: 'comments',
              query: req.query,
              file: name,
            });
            res.type('json').end(body);
          });
      })
      .catch(function (err) {
        res.status(500).end('Error: ' + err.message);
      });
  });
};