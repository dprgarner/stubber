const expect = require('chai').expect;
const utils = require('../utils');

describe('utils', function () {
  describe('queryDictsMatch', function () {
    it('returns true on the same object', function () {
      var dict = {
        a: [1],
      };
      expect(utils.queryDictsMatch(dict, dict)).to.be.true;
    });

    it('returns true on two identical objects', function () {
      var dict1 = {a: [1], b: ['2']};
      var dict2 = {a: [1], b: ['2']};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns true if arrays have same elements', function () {
      var dict1 = {a: ['1', '2']};
      var dict2 = {a: ['2', '1']};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns false if the objects do not match keys', function () {
      var dict1 = {a: [1], c: ['2']};
      var dict2 = {a: [1], b: ['2']};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns false if the objects do not match values', function () {
      var dict1 = {a: [1], b: ['2']};
      var dict2 = {a: [1], b: ['3']};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns false if two non-array values are distinct', function () {
      var dict1 = {a: [1], b: 2};
      var dict2 = {a: [1], b: 3};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns true if all non-array values are equal', function () {
      var dict1 = {a: [1], b: 2};
      var dict2 = {a: [1], b: 2};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns false if stringy values are not equal', function () {
      var dict1 = {a: [1], b: "abc"};
      var dict2 = {a: [1], b: "cba"};
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });
  });
});