import * as sinon from 'sinon';
import { expect } from 'chai';
import { RunResult, TestResult, RunState, TestState, CoverageCollectionPerTest, CoverageCollection } from 'stryker-api/test_runner';
import { StrykerOptions } from 'stryker-api/core';
import { StatementMapDictionary } from '../../src/coverage/CoverageInstrumenter';
import MutantTestMatcher from '../../src/MutantTestMatcher';
import Mutant from '../../src/Mutant';

describe('MutantTestMatcher', () => {

  let sut: MutantTestMatcher;
  let mutants: any[];
  let runResult: RunResult;
  let statementMapDictionary: StatementMapDictionary;
  let strykerOptions: StrykerOptions;

  beforeEach(() => {
    mutants = [];
    statementMapDictionary = Object.create(null);
    runResult = { tests: [], state: RunState.Complete };
    strykerOptions = {};
    sut = new MutantTestMatcher(mutants, runResult, statementMapDictionary, strykerOptions);
  });

  describe('with coverageAnalysis: "perTest"', () => {

    beforeEach(() => strykerOptions.coverageAnalysis = 'perTest');

    describe('matchWithMutants()', () => {
      describe('with 2 mutants and 2 testResults', () => {
        let mutantOne: any, mutantTwo: any, testResultOne: TestResult, testResultTwo: TestResult;
        beforeEach(() => {
          mutantOne = { mutantOne: true, filename: 'fileWithMutantOne', location: { start: { line: 5, column: 6 }, end: { line: 5, column: 6 } }, addTestResult: sinon.stub() };
          mutantTwo = { mutantTwo: true, filename: 'fileWithMutantTwo', location: { start: { line: 10, column: 0 }, end: { line: 10, column: 0 } }, addTestResult: sinon.stub() };
          testResultOne = {
            state: TestState.Success,
            name: 'test one'
          };
          runResult.tests.push(testResultOne);
          testResultTwo = {
            state: TestState.Success,
            name: 'test two'
          };
          runResult.tests.push(testResultTwo);
          mutants.push(mutantOne);
          mutants.push(mutantTwo);
        });

        describe('without code coverage info', () => {

          beforeEach(() => {
            sut.matchWithMutants();
          });

          it('should add both tests to the mutants', () => {
            expect(mutantOne.addTestResult).to.have.been.calledWith(0, testResultOne);
            expect(mutantOne.addTestResult).to.have.been.calledWith(1, testResultTwo);
            expect(mutantTwo.addTestResult).to.have.been.calledWith(0, testResultOne);
            expect(mutantTwo.addTestResult).to.have.been.calledWith(1, testResultTwo);
          });
        });

        describe('without the tests having covered the mutants', () => {

          beforeEach(() => {
            const covCollectionPerFile: CoverageCollectionPerTest = {
              0: {
                anOtherFile: { s: { '1': 1 } } // covers, but in wrong src file
              },
              1: {
                fileWithMutantOne: { s: { 1: 1, 2: 1, 3: 0 } }, // Covers, but not smallest statement based on column
                fileWithMutantTwo: { s: { 1: 1, 2: 0, 3: 1 } } // Covers, but not smallest statement based on row number
              }
            };
            runResult.coverage = covCollectionPerFile;

            statementMapDictionary['anOtherFile'] = {
              '1': { // covers but in wrong src file
                start: { line: 5, column: 0 },
                end: { line: 5, column: 8 }
              }
            };
            statementMapDictionary['fileWithMutantOne'] = {
              '1': {
                start: { line: 3, column: 0 },
                end: { line: 5, column: 10 }
              },
              '2': {
                start: { line: 5, column: 0 },
                end: { line: 5, column: 10 }
              },
              '3': { // Smallest statement that surrounds the mutant. Differs based on column number
                start: { line: 5, column: 4 },
                end: { line: 5, column: 8 }
              }
            };
            statementMapDictionary['fileWithMutantTwo'] = {
              '1': {
                start: { line: 0, column: 1 },
                end: { line: 10, column: 5 }
              },
              '2': { // Smallest  statement that surround the mutant. Differs based on line number
                start: { line: 9, column: 1 },
                end: { line: 10, column: 5 }
              },
              '3': {
                start: { line: 10, column: 1 },
                end: { line: 10, column: 5 }
              }
            };
            sut.matchWithMutants();
          });

          it('should not have added the run results to the mutants', () => {
            expect(mutantOne.addTestResult).to.not.have.been.called;
            expect(mutantTwo.addTestResult).to.not.have.been.called;
          });
        });

        describe('with tests having covered the mutants', () => {

          beforeEach(() => {
            statementMapDictionary['fileWithMutantOne'] = {
              '1': { start: { line: 4, column: 0 }, end: { line: 6, column: 0 } }
            };
            statementMapDictionary['fileWithMutantTwo'] = {
              '1': { start: { line: 10, column: 0 }, end: { line: 10, column: 0 } }
            };

            runResult.coverage = {
              0: {
                fileWithMutantOne: { s: { '1': 1 } },
                fileWithMutantTwo: { s: { '1': 1 } }
              },
              1: {
                fileWithMutantOne: { s: { '1': 1 } }
              }
            };
            sut.matchWithMutants();
          });

          it('should have added the run results to the mutants', () => {
            expect(mutantOne.addTestResult).to.have.been.calledWith(0, testResultOne);
            expect(mutantOne.addTestResult).to.have.been.calledWith(1, testResultTwo);
            expect(mutantTwo.addTestResult).to.have.been.calledWith(0, testResultOne);
            expect(mutantTwo.addTestResult).to.not.have.been.calledWith(1, testResultTwo);
          });
        });

      });

      describe('should not result in regression', () => {
        it('should match up mutant for issue #151 (https://github.com/stryker-mutator/stryker/issues/151)', () => {

          const mutant = new Mutant('BlockStatement', 'juice-shop\\app\\js\\controllers\\SearchResultController.js', '', `{\n}`, { 'start': { 'line': 13, 'column': 38 }, 'end': { 'line': 24, 'column': 5 } }, [357, 615]);
          mutants.push(mutant);

          const coverageResult: CoverageCollection = { 'juice-shop\\app\\js\\controllers\\SearchResultController.js': { 's': { '1': 1, '2': 1, '3': 1, '4': 0, '5': 1, '6': 0, '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0, '13': 0, '14': 0, '15': 0, '16': 0, '17': 0, '18': 0, '19': 0, '20': 0, '21': 0, '22': 0, '23': 0, '24': 0, '25': 0, '26': 0, '27': 0, '28': 0, '29': 0, '30': 0, '31': 0, '32': 1, '33': 1, '34': 1, '35': 1, '36': 0, '37': 0 }, } };

          statementMapDictionary['juice-shop\\app\\js\\controllers\\SearchResultController.js'] = { '1': { 'start': { 'line': 1, 'column': 0 }, 'end': { 'line': 84, 'column': 5 } }, '2': { 'start': { 'line': 13, 'column': 4 }, 'end': { 'line': 24, 'column': 5 } }, '3': { 'start': { 'line': 14, 'column': 6 }, 'end': { 'line': 23, 'column': 8 } }, '4': { 'start': { 'line': 20, 'column': 12 }, 'end': { 'line': 20, 'column': 21 } }, '5': { 'start': { 'line': 26, 'column': 4 }, 'end': { 'line': 72, 'column': 5 } }, '6': { 'start': { 'line': 27, 'column': 6 }, 'end': { 'line': 71, 'column': 8 } }, '7': { 'start': { 'line': 28, 'column': 8 }, 'end': { 'line': 28, 'column': 51 } }, '8': { 'start': { 'line': 29, 'column': 8 }, 'end': { 'line': 29, 'column': 25 } }, '9': { 'start': { 'line': 30, 'column': 8 }, 'end': { 'line': 53, 'column': 9 } }, '10': { 'start': { 'line': 31, 'column': 10 }, 'end': { 'line': 52, 'column': 11 } }, '11': { 'start': { 'line': 32, 'column': 12 }, 'end': { 'line': 32, 'column': 24 } }, '12': { 'start': { 'line': 33, 'column': 12 }, 'end': { 'line': 50, 'column': 14 } }, '13': { 'start': { 'line': 34, 'column': 14 }, 'end': { 'line': 34, 'column': 68 } }, '14': { 'start': { 'line': 35, 'column': 14 }, 'end': { 'line': 47, 'column': 16 } }, '15': { 'start': { 'line': 36, 'column': 16 }, 'end': { 'line': 44, 'column': 18 } }, '16': { 'start': { 'line': 37, 'column': 18 }, 'end': { 'line': 41, 'column': 20 } }, '17': { 'start': { 'line': 38, 'column': 20 }, 'end': { 'line': 38, 'column': 62 } }, '18': { 'start': { 'line': 40, 'column': 20 }, 'end': { 'line': 40, 'column': 55 } }, '19': { 'start': { 'line': 43, 'column': 18 }, 'end': { 'line': 43, 'column': 34 } }, '20': { 'start': { 'line': 46, 'column': 16 }, 'end': { 'line': 46, 'column': 32 } }, '21': { 'start': { 'line': 49, 'column': 14 }, 'end': { 'line': 49, 'column': 30 } }, '22': { 'start': { 'line': 51, 'column': 12 }, 'end': { 'line': 51, 'column': 17 } }, '23': { 'start': { 'line': 54, 'column': 8 }, 'end': { 'line': 68, 'column': 9 } }, '24': { 'start': { 'line': 55, 'column': 10 }, 'end': { 'line': 67, 'column': 12 } }, '25': { 'start': { 'line': 56, 'column': 12 }, 'end': { 'line': 64, 'column': 14 } }, '26': { 'start': { 'line': 57, 'column': 14 }, 'end': { 'line': 61, 'column': 16 } }, '27': { 'start': { 'line': 58, 'column': 16 }, 'end': { 'line': 58, 'column': 54 } }, '28': { 'start': { 'line': 60, 'column': 16 }, 'end': { 'line': 60, 'column': 51 } }, '29': { 'start': { 'line': 63, 'column': 14 }, 'end': { 'line': 63, 'column': 30 } }, '30': { 'start': { 'line': 66, 'column': 12 }, 'end': { 'line': 66, 'column': 28 } }, '31': { 'start': { 'line': 70, 'column': 8 }, 'end': { 'line': 70, 'column': 24 } }, '32': { 'start': { 'line': 74, 'column': 4 }, 'end': { 'line': 74, 'column': 63 } }, '33': { 'start': { 'line': 76, 'column': 4 }, 'end': { 'line': 83, 'column': 6 } }, '34': { 'start': { 'line': 77, 'column': 6 }, 'end': { 'line': 77, 'column': 37 } }, '35': { 'start': { 'line': 78, 'column': 6 }, 'end': { 'line': 80, 'column': 7 } }, '36': { 'start': { 'line': 79, 'column': 8 }, 'end': { 'line': 79, 'column': 89 } }, '37': { 'start': { 'line': 82, 'column': 6 }, 'end': { 'line': 82, 'column': 22 } } };

          runResult.coverage = { 0: coverageResult };
          runResult.tests.push({
            name: 'controllers SearchResultController should open a modal dialog with product details',
            state: TestState.Success
          });
          sut.matchWithMutants();
          expect(mutant.scopedTestIds).to.have.length(1);
          expect(mutant.scopedTestIds[0]).to.be.eq(0);
        });
      });
    });
  });



});