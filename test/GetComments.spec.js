const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const GetComments = require('./GetComments');

const dir = path.resolve(__dirname, 'comments');
const PORT = 3000;
const readFile = Promise.promisify(fs.readFile);

function setUpApp(opts, cb) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  var app = express();
  app.get('/favicon.ico', function (req, res) {});

  this.getComments = new GetComments(app, opts);
  this.server = app.listen(PORT, cb);
  this.baseUri = 'http://localhost:' + PORT;
}

function tearDownApp(cb) {
  if (fs.existsSync(dir)) {
    rmdirSync(dir);
  }
  this.server.close(cb);
}

describe('GetComments in Live mode', function () {  
  beforeEach(function (done) {
    setUpApp.call(this, {
      liveSite: 'https://jsonplaceholder.typicode.com',
    }, done);
  });

  afterEach(function (done) {
    tearDownApp.call(this, done);
  });

  it('can save a stub', function (done) {
    request({
      uri: this.baseUri + '/comments?postId=1',
      json: true,
    }).then(function (responseJson) {
      return readFile(path.resolve(dir, 'comments_postId-1.json'))
        .then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(fileBody).to.deep.equal(responseJson);
          done();
        });
    }).catch(done);
  });
});

