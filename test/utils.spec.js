import { expect } from 'chai';
import * as utils from '../src/utils';

describe('utils', () => {
  describe('queryDictsMatch', () => {
    it('returns true on the same object', () => {
      var dict = {
        a: [1],
      };
      expect(utils.queryDictsMatch(dict, dict)).to.be.true;
    });

    it('returns true on two identical objects', () => {
      var dict1 = { a: [1], b: ['2'] };
      var dict2 = { a: [1], b: ['2'] };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns true if arrays have same elements in a different order', () => {
      var dict1 = { a: ['1', '2'] };
      var dict2 = { a: ['2', '1'] };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns false if the objects do not match keys', () => {
      var dict1 = { a: [1], c: ['2'] };
      var dict2 = { a: [1], b: ['2'] };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns false if the objects do not match values', () => {
      var dict1 = { a: [1], b: ['2'] };
      var dict2 = { a: [1], b: ['3'] };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns false if two non-array values are distinct', () => {
      var dict1 = { a: [1], b: 2 };
      var dict2 = { a: [1], b: 3 };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });

    it('returns true if all non-array values are equal', () => {
      var dict1 = { a: [1], b: 2 };
      var dict2 = { a: [1], b: 2 };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.true;
    });

    it('returns false if stringy values are not equal', () => {
      var dict1 = { a: [1], b: 'abc' };
      var dict2 = { a: [1], b: 'cba' };
      expect(utils.queryDictsMatch(dict1, dict2)).to.be.false;
    });
  });
});
