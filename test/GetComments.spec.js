const fs = require('fs');
const path = require('path');

const expect = require('chai').expect;
const express = require('express');
const Promise = require('bluebird');
const request = require('request-promise');
const rmdirSync = require('rimraf').sync;

const GetComments = require('./GetComments');

const readFile = Promise.promisify(fs.readFile);
const writeFile = Promise.promisify(fs.writeFile);

const dir = path.resolve(__dirname, 'comments');
const APP_PORT = 3000;
const LIVE_PORT = 3001;
const appUri = 'http://localhost:' + APP_PORT;
const liveUri = 'http://localhost:' + LIVE_PORT;

var requestsJson = [{
  "name": "comments_postId-1",
  "path": "comments",
  "query": {
    "postId": "1"
  },
  "file": "comments_postId-1"
}];

var responseJson = [{
  postId: 1,
  id: 1,
  name: 'id labore ex et quam laborum',
  email: 'Eliseo@gardner.biz',
  body: 'Bello!',
}];

// Imitates the dummy live server.
function setUpLiveServer(port, cb) {
  var app = express();
  app.get('/comments', function (req, res) {
    res.json(responseJson);
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
  // if (fs.existsSync(dir)) rmdirSync(dir);
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

  it('saves and returns unrecognised responses', function (done) {
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

  it('returns previously-saved stubs', function (done) {
    var alternateResponse = {different: 'response'};
    writeFile(
      path.resolve(dir, 'comments_postId-1.json'),
      JSON.stringify(alternateResponse)
    ).then(function () {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      });
    }).then(function (actualJson) {
      expect(actualJson).to.deep.equal(alternateResponse);
      done();
    }).catch(done);
  });
});

function createStubFiles(cb) {
  Promise.all([writeFile(
    path.resolve(dir, 'comments_postId-1.json'), JSON.stringify(responseJson)
  ), writeFile(
    path.resolve(dir, 'requests.json'), JSON.stringify(requestsJson)
  )])
  .then(function () {
    cb();
  })
  .catch(cb);
}

describe('GetComments in stub-only mode', function () {  
  beforeEach(function (done) {
    setUpApp.call(this, {}, function (err) {
      if (err) return done(err);
      createStubFiles(done);
    });
  });

  afterEach(function (done) {
    tearDownApp.call(this, done);
  });

  it('returns previously-saved stubs', function (done) {
    request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(function (actualJson) {
      expect(responseJson).to.deep.equal(actualJson);
      done();
    }).catch(done);
  });
});