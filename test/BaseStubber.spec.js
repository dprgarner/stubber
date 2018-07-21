import fs from 'fs';
import path from 'path';

import { expect } from 'chai';
import express from 'express';
import { promisify } from 'util';
import request from 'request-promise';
import { sync as rmdirSync } from 'rimraf';
import winston from 'winston';

import BaseStubber from '../src/BaseStubber';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
winston.remove(winston.transports.Console);

const responsesDir = path.resolve(__dirname, 'responses');
const matchersFile = path.resolve(responsesDir, 'matchers.json');

const APP_PORT = 3005;
const LIVE_PORT = 3006;
const HOSTNAME = `http://${process.env.HOSTNAME || 'localhost'}`;
const appUri = `${HOSTNAME}:${APP_PORT}`;
const liveUri = `${HOSTNAME}:${LIVE_PORT}`;

var requests = [
  {
    req: {
      method: 'GET',
      path: '/comments',
      query: { postId: '1' },
    },
    res: {
      name: 'comments_postId-1.json',
      statusCode: 200,
    },
  },
  {
    req: {
      method: 'GET',
      path: '/comments',
      query: { postId: '2' },
    },
    res: {
      name: 'comments_postId-2.json',
      statusCode: 200,
    },
  },
  {
    req: {
      method: 'POST',
      path: '/comments',
      query: {},
      body: { hello: 'world' },
    },
    res: {
      name: 'comments_hello-world.json',
      statusCode: 201,
    },
  },
];

var responseJson = [
  {
    postId: 1,
    id: 1,
    name: 'id labore ex et quam laborum',
    email: 'Eliseo@gardner.biz',
    body: 'Bello!',
  },
];

const listen = (app, port) =>
  new Promise((resolve, reject) => {
    var server = app.listen(port, err => {
      if (err) return reject(err);
      return resolve(server);
    });
  });

// Sets up a dummy live server that accepts gets and posts.
function setUpLiveServer() {
  var app = express();
  app.get('/comments', function(req, res) {
    res.json(responseJson);
  });
  app.post('/comments', function(req, res) {
    res.status(201).json(responseJson);
  });
  return listen(app, LIVE_PORT);
}

function tearDownApp(appServer, liveServer) {
  if (fs.existsSync(responsesDir)) rmdirSync(responsesDir);

  var closeApp = promisify(appServer.close.bind(appServer));
  var closeLive = promisify(liveServer.close.bind(liveServer));
  return Promise.all([closeApp(), closeLive()]);
}

function setUpApp(opts) {
  var app = express();
  this.baseStubber = new BaseStubber(app, {
    ...opts,
    matchersFile,
    responsesDir,
  });

  return listen(app, APP_PORT)
    .then(server => {
      this.appServer = server;
      return setUpLiveServer();
    })
    .then(server => {
      this.liveServer = server;
      this.liveServer.setTimeout(100);
    });
}

describe('BaseStubber in existing-matchers mode', function() {
  beforeEach(function() {
    if (!fs.existsSync(responsesDir)) fs.mkdirSync(responsesDir);
    fs.writeFileSync(matchersFile, JSON.stringify(requests));
    fs.writeFileSync(
      path.resolve(responsesDir, 'comments_postId-1.json'),
      JSON.stringify(responseJson)
    );
    fs.writeFileSync(
      path.resolve(responsesDir, 'comments_hello-world.json'),
      JSON.stringify(responseJson)
    );
    return setUpApp.call(this, {});
  });

  afterEach(function() {
    return tearDownApp(this.appServer, this.liveServer);
  });

  it('returns previously-saved stubs from GETs', function() {
    return request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(actualJson => {
      expect(responseJson).to.deep.equal(actualJson);
    });
  });

  it('returns previously-saved stubs and status codes from POSTs', function() {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: { hello: 'world' },
      resolveWithFullResponse: true,
    }).then(res => {
      expect(res.body).to.deep.equal(responseJson);
      expect(res.statusCode).to.equal(201);
    });
  });

  it('errors when there is no matching query', function() {
    return request({
      uri: appUri + '/comments?postId=3',
      json: true,
    })
      .then(function() {
        throw new Error('Expected an error response');
      })
      .catch(function(err) {
        if (!err.statusCode) throw err;
        expect(err.statusCode).to.equal(500);
      });
  });

  it('errors when there is no matching post body', function() {
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: { hello: 'not the world' },
    })
      .then(function() {
        throw new Error('Expected an error response');
      })
      .catch(function(err) {
        if (!err.statusCode) throw err;
        expect(err.statusCode).to.equal(500);
      });
  });

  it('errors when matcher exists but stub file does not exist', function() {
    this.baseStubber.matchers.push({
      req: {
        path: '/comments',
        query: {},
        body: { hello: 'guys' },
      },
      res: {
        name: 'missing-file.json',
      },
    });
    return request({
      uri: appUri + '/comments',
      json: true,
      method: 'POST',
      body: { hello: 'guys' },
    })
      .then(function() {
        throw new Error('Expected an error response');
      })
      .catch(function(err) {
        if (!err.statusCode) throw err;
        expect(err.statusCode).to.equal(500);
      });
  });

  it('records all requests made', function() {
    return request({
      uri: appUri + '/comments?postId=1',
      json: true,
    }).then(
      function() {
        expect(this.baseStubber._requestsMade).to.deep.equal({
          'comments_hello-world.json': 0,
          'comments_postId-1.json': 1,
          'comments_postId-2.json': 0,
        });
      }.bind(this)
    );
  });

  it('returns a list of matched requests', function() {
    this.baseStubber._requestsMade = {
      'comments_hello-world.json': 0,
      'comments_postId-1.json': 1,
      'comments_postId-2.json': 2,
    };
    expect(this.baseStubber.getMatchedRequests()).to.deep.equal([
      'comments_postId-1.json',
      'comments_postId-2.json',
    ]);
  });

  it('returns a list of unmatched requests', function() {
    this.baseStubber._requestsMade = {
      'comments_hello-world.json': 0,
      'comments_postId-1.json': 1,
      'comments_postId-2.json': 2,
    };
    expect(this.baseStubber.getUnmatchedRequests()).to.deep.equal([
      'comments_hello-world.json',
    ]);
  });

  it('shortens long names', function() {
    var longName = [
      'aaaaaaaaaaaaaaaa1111111111111111',
      'aaaaaaaaaaaaaaaa1111111111111111',
      'aaaaaaaaaaaaaaaa1111111111111111',
      'aaaaaaaaaaaaaaaa1111111111111111',
      'b',
    ].join('');
    var name = this.baseStubber.shortenAndMakeUnique(longName);
    expect(name)
      .to.have.length(128)
      .and.to.not.equal(longName);
  });

  it('makes names unique', function() {
    var name = this.baseStubber.shortenAndMakeUnique('comments_postId-1');
    expect(name).to.not.equal('comments_postId-1');
  });

  it('sanitizes names', function() {
    var name = this.baseStubber.shortenAndMakeUnique('/**oi!z/0@ q.q');
    expect(name).to.equal('___oi!z_0__q_q');
  });
});

describe('BaseStubber in create-matchers mode', function() {
  describe('without existing matchers', function() {
    beforeEach(function() {
      return setUpApp.call(this, { liveSite: liveUri });
    });

    afterEach(function() {
      return tearDownApp(this.appServer, this.liveServer);
    });

    it('saves and returns unrecognised responses to GETs', function() {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      }).then(function(responseJson) {
        return readFile(
          path.resolve(responsesDir, 'comments_postId-1.json')
        ).then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(fileBody).to.deep.equal(responseJson);
        });
      });
    });

    it('saves and returns unrecognised responses to POSTs', function() {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: { hello: 'world' },
        resolveWithFullResponse: true,
      }).then(function(res) {
        return readFile(
          path.resolve(responsesDir, 'comments_hello-world.json')
        ).then(function(fileString) {
          var fileBody = JSON.parse(fileString);
          expect(res.body).to.deep.equal(fileBody);
          expect(res.statusCode).to.equal(201);
        });
      });
    });

    it('creates new matchers', function() {
      var initialLength = this.baseStubber.matchers.length;
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: { hello: 'world' },
      }).then(
        function() {
          var matchers = this.baseStubber.matchers;
          expect(matchers).to.have.length(initialLength + 1);
          expect(matchers[initialLength]).to.deep.equal({
            req: {
              method: 'POST',
              path: '/comments',
              query: {},
              body: { hello: 'world' },
            },
            res: {
              name: 'comments_hello-world.json',
              statusCode: 201,
            },
          });
        }.bind(this)
      );
    });

    it('records all requests made', function() {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: { hello: 'world' },
      }).then(
        function() {
          expect(this.baseStubber._requestsMade).to.deep.equal({
            'comments_hello-world.json': 1,
          });
        }.bind(this)
      );
    });
  });

  describe('with existing matchers', function() {
    beforeEach(function() {
      if (!fs.existsSync(responsesDir)) fs.mkdirSync(responsesDir);
      this.alternateResponse = { different: 'response' };
      fs.writeFileSync(
        path.resolve(responsesDir, 'comments_postId-1.json'),
        JSON.stringify(this.alternateResponse)
      );
      fs.writeFileSync(
        path.resolve(responsesDir, 'comments_hello-world.json'),
        JSON.stringify(this.alternateResponse)
      );
      fs.writeFileSync(matchersFile, JSON.stringify(requests));
      return setUpApp.call(this, { liveSite: liveUri });
    });

    afterEach(function() {
      return tearDownApp(this.appServer, this.liveServer);
    });

    it('returns previously-saved stubs from GETs', function() {
      return request({
        uri: appUri + '/comments?postId=1',
        json: true,
      }).then(
        function(actualJson) {
          expect(actualJson).to.deep.equal(this.alternateResponse);
        }.bind(this)
      );
    });

    it('returns previously-saved stubs from POSTs', function() {
      return request({
        uri: appUri + '/comments',
        json: true,
        method: 'POST',
        body: { hello: 'world' },
      }).then(
        function(actualJson) {
          expect(actualJson).to.deep.equal(this.alternateResponse);
        }.bind(this)
      );
    });

    it('errors if the new matcher does not match the request', function() {
      this.baseStubber.createMatcher = function() {
        return {
          req: { bad: 'matcher' },
          res: { name: 'comments_postId-1.json' },
        };
      };
      return request({
        uri: appUri + '/comments?postId=3',
        json: true,
      })
        .then(function() {
          throw new Error('Expected an error response');
        })
        .catch(function(err) {
          if (!err.statusCode) throw err;
          expect(err.statusCode).to.equal(500);
        });
    });
  });
});
