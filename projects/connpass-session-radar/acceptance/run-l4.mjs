import assert from 'node:assert/strict';
import { acceptanceInput, fetchFailureCanary } from './dsl/daily-digest.mjs';
import { steps } from './steps/daily-digest.steps.mjs';

const scenarios = [
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-01');
    steps.digestWasDelivered(capture);
    steps.eventIsVisible(capture, 'matching-event');
    steps.remainingSeatEstimateIsNumeric(capture, 'matching-event');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-02');
    steps.eventIsHidden(capture, 'nonmatching-event');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-03');
    steps.noMatchingEventsWasDelivered(capture);
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-04');
    steps.failureWasDelivered(capture, fetchFailureCanary);
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-05');
    steps.eventHasCapacity(capture, 'participation-event', 'remaining-estimate');
    steps.eventHasCapacity(capture, 'advertisement-event', 'omitted-for-advertisement');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-06');
    steps.eventIsVisible(capture, 'active-event');
    steps.eventIsHidden(capture, 'cancelled-event');
  },
  async (bridge) => {
    steps.committedConditionsAreYaml(acceptanceInput('CSR-D-07'), 'revised-conditions');
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-07');
    steps.eventIsVisible(capture, 'matches-revised-condition');
    steps.eventIsHidden(capture, 'matches-previous-condition-only');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-08');
    steps.eventHasCapacity(capture, 'unlimited-event', 'unlimited');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-09');
    steps.eventHasCapacity(capture, 'no-seat-event', 'full');
    steps.eventHasCapacity(capture, 'waitlisted-event', 'full');
  },
  async (bridge) => {
    const capture = await steps.dailyDelivery(bridge, 'CSR-D-10');
    steps.eventIsVisible(capture, 'within-window-event');
    steps.eventIsHidden(capture, 'after-window-event');
  },
];

const bridgePath = process.argv[2];
assert.ok(bridgePath, 'Usage: node acceptance/run-l4.mjs <acceptance-bridge-module>');
const bridgeModule = await import(bridgePath);
const bridge = bridgeModule.default ?? bridgeModule;

for (const scenario of scenarios) await scenario(bridge);
console.log('CSR-D-01..CSR-D-10 L4 acceptance translation passed');
