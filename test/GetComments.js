const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');

const BaseStubber = require('../BaseStubber');
const queryDictsMatch = require('../utils').queryDictsMatch;

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

function GetComments(app, opts) {
  this.liveSite = opts.liveSite;
  app.get('/:path', this.matchStub.bind(this), this.createStub.bind(this));
  if (!fs.existsSync(this.directory)) fs.mkdirSync(this.directory);
}

Object.assign(GetComments.prototype, BaseStubber.prototype, {
  directory: path.resolve(__dirname, 'comments'),
  requestsFile: path.resolve(__dirname, 'comments', 'requests.json'),

  getStubName: function(req) {
    var nameComponents = [req.params.path];
    nameComponents = nameComponents.concat(_.map(req.query, function (val, key) {
      var valString = (_.isArray(val)) ? val.join('-') : val;
      return key +  '-' + valString;
    }));
    return nameComponents.join('_');
  },

  // TODO extract out a comparison function
  lookupStub: function(req) {
    var itemPath = req.params.path;
    var query = req.query;
    this.log(itemPath + ', ' + JSON.stringify(query));

    return this.getRequestStubs()
      .then(function (stubs) {
        for (var i = 0; i < stubs.length; i++) {
          if (
            itemPath === stubs[i].path
            && queryDictsMatch(query, stubs[i].query)
          ) {
            var file = path.resolve(this.directory, stubs[i].file + '.json');
            return {name: stubs[i].name, file: file};
          }
        }
      }.bind(this))
      .then(function (stub) {
        if (stub) {
          this.log(`  Matched stub "${stub.name}"`);
          return readFile(stub.file);
        } else {
          // TODO this isn't exceptional, shouldnt be an error
          throw new Error('Request did not match any item stub.');
        }
      }.bind(this));
  },

  // Middleware which creates the request stub, saves the response stub, and
  // returns the response.
  createStub: function(req, res) {
    var that = this;
    this.log(`  Did not match any stub - requesting ${req.url}`);
    var name = this.getStubName(req);

    request(this.liveSite + req.url).then(function (body) {
      return Promise.all([
        writeFile(path.resolve(that.directory, name + '.json'), body),
        that.saveStub({
          name: name,
          path: 'comments',
          query: req.query,
          file: name,
        })
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

module.exports = GetComments;