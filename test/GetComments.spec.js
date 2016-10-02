const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const GetComments = require('./GetComments');

const readFile = Promise.promisify(fs.readFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3000;
const LIVE_PORT = 3001;
const appUri = 'http://localhost:' + APP_PORT;
const liveUri = 'http://localhost:' + LIVE_PORT;

// Imitates the dummy live server.
function setUpLiveServer(port, cb) {
  var app = express();
  app.get('/comments', function (req, res) {
    res.json([{
      postId: 1,
      id: 1,
      name: 'id labore ex et quam laborum',
      email: 'Eliseo@gardner.biz',
      body: 'Bello!',
    }]);
  });
  return app.listen(port, cb);
}

function setUpApp(opts, cb) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  var app = express();
  this.getComments = new GetComments(app, opts);
  this.getComments.log = function () {};

  this.appServer = app.listen(APP_PORT, function (err) {
    if (err) return cb(err);
    this.liveServer = setUpLiveServer(LIVE_PORT, cb);
  }.bind(this));
}

function tearDownApp(cb) {
  if (fs.existsSync(dir)) rmdirSync(dir);
  this.appServer.close(function (err) {
    if (err) return cb(err);
    this.liveServer.close(cb);
  }.bind(this));
}

describe('GetComments in Live mode', function () {  
  beforeEach(function (done) {
    setUpApp.call(this, {liveSite: liveUri}, done);
  });

  afterEach(function (done) {
    tearDownApp.call(this, done);
  });

  it('saves a response and returns the saved response', function (done) {
    request({
      uri: appUri + '/comments?postId=1',
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