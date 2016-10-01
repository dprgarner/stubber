const path = require('path');
const fs = require('fs');

const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

const queryDictsMatch = require('./utils').queryDictsMatch;

const writeFile = Promise.promisify(fs.writeFile);
const readFile = Promise.promisify(fs.readFile);


function GetItem(app, opts) {
  this.createStubs = opts.createStubs;
  this.liveSite = opts.liveSite;
  app.get('/:path', this.matchStub.bind(this), this.createStub.bind(this));
}

Object.assign(GetItem.prototype, {
  requestsFile: path.resolve('items', 'requests.json'),

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

  lookupStub: function(itemPath, query) {
    return this.getRequestStubs()
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
  },

  saveStub: function(stub) {
    return this.getRequestStubs()
      .then(function (stubs) {
        stubs.push(stub);
        return writeFile(
          path.resolve(this.requestsFile), JSON.stringify(stubs, null, 2)
        );
      }.bind(this));
  },

  getStubName: function(query) {
    var nameComponents = ['comments'];
    nameComponents = nameComponents.concat(_.map(query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  // Middleware which attempts to match a stub.
  matchStub: function(req, res, next) {
    console.log(req.params.path, req.query);

    this.lookupStub(req.params.path, req.query)
      .then(function (stub) {
        if (stub) {
          console.log(`  Matched stub "${stub.name}"`);
          return res.sendFile(stub.file);
        }
        if (!this.createStubs) return res.status(500).end(
          'Request did not match any item stub.'
        );
        next();
      }.bind(this));
  },

  // Middleware which creates the request stub, saves the response stub, and
  // returns the response.
  createStub: function(req, res) {
    console.log(`  Did not match any stub - requesting ${req.url}`);
    var name = this.getStubName(req.query);

    request(this.liveSite + req.url).then(function (body) {
      return Promise.all([
        writeFile(path.resolve('items', name + '.json'), body),
        this.saveStub({
          name: name,
          path: 'comments',
          query: req.query,
          file: name,
        })
      ]).then(function () {
        console.log(`  Saved stub '${name}'`);
        res.type('json').end(body);
      });
    }.bind(this)).catch(function (err) {
      res.status(500).end('Error: ' + err.message);
    });
  },
});

module.exports = GetItem;