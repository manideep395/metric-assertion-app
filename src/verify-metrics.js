/**
 * Core Metric Calculators and Assertion Logic
 */

export function calculateMetrics(drafts, floor = 2.0) {
  const processed = drafts.filter(d => d.status !== 'pending');
  const totalProcessedCount = processed.length;

  if (totalProcessedCount === 0) {
    return {
      conversionRate: 0,
      medianTimeToConvert: 0,
      editRate: 0,
      assertionPassed: true,
      totalProcessed: 0,
      convertedCount: 0,
      editedCount: 0,
      rejectedCount: 0
    };
  }

  const converted = processed.filter(d => d.status === 'converted' || d.status === 'edited');
  const edited = processed.filter(d => d.status === 'edited');
  const rejected = processed.filter(d => d.status === 'rejected');

  const conversionRate = totalProcessedCount > 0 ? (converted.length / totalProcessedCount) * 100 : 0;
  // Edit Rate: percentage of accepted/converted drafts that required manual modification
  const editRate = converted.length > 0 ? (edited.length / converted.length) * 100 : 0;

  // Calculate median time-to-convert for converted drafts
  const conversionTimes = converted
    .map(d => d.timeToConvert)
    .filter(t => t !== undefined && t !== null)
    .sort((a, b) => a - b);

  let medianTimeToConvert = 0;
  if (conversionTimes.length > 0) {
    const mid = Math.floor(conversionTimes.length / 2);
    if (conversionTimes.length % 2 !== 0) {
      medianTimeToConvert = conversionTimes[mid];
    } else {
      medianTimeToConvert = (conversionTimes[mid - 1] + conversionTimes[mid]) / 2;
    }
  }

  // Assertion: Median time-to-convert exceeds the floor threshold
  // Only assert if there is at least one converted draft
  const assertionPassed = conversionTimes.length > 0 ? medianTimeToConvert >= floor : true;

  return {
    conversionRate: Number(conversionRate.toFixed(2)),
    medianTimeToConvert: Number(medianTimeToConvert.toFixed(3)),
    editRate: Number(editRate.toFixed(2)),
    assertionPassed,
    totalProcessed: totalProcessedCount,
    convertedCount: converted.length,
    editedCount: edited.length,
    rejectedCount: rejected.length
  };
}

/**
 * Simulator for Thoughtful Reviewer (Human)
 */
export function simulateThoughtfulReviewer(count = 20) {
  const drafts = [];
  for (let i = 1; i <= count; i++) {
    const roll = Math.random();
    let status = 'converted';
    let editCount = 0;
    
    // Simulate thinking and action times (seconds)
    let readTime = 2.5 + Math.random() * 3.5; // 2.5s to 6.0s
    let editTime = 0;

    if (roll < 0.1) {
      // 10% chance of rejection
      status = 'rejected';
    } else if (roll < 0.5) {
      // 40% chance of edit and convert
      status = 'edited';
      editCount = Math.floor(Math.random() * 3) + 1;
      editTime = 1.5 + Math.random() * 2.5; // 1.5s to 4.0s for editing
    } else {
      // 50% chance of converting without edits
      status = 'converted';
    }

    const timeToConvert = status !== 'rejected' ? readTime + editTime : null;

    drafts.push({
      id: `draft-${i}`,
      content: `This is the body of auto-draft #${i}.`,
      status,
      editCount,
      timeToConvert,
      createdAt: 0,
      convertedAt: timeToConvert
    });
  }
  return drafts;
}

/**
 * Simulator for Queue-Clearing Bot (Automated / Rubber-stamping)
 */
export function simulateQueueClearingBot(count = 20) {
  const drafts = [];
  for (let i = 1; i <= count; i++) {
    // Bot accepts immediately without reading or editing
    const timeToConvert = 0.05 + Math.random() * 0.1; // 50ms to 150ms
    drafts.push({
      id: `draft-${i}`,
      content: `This is the body of auto-draft #${i}.`,
      status: 'converted',
      editCount: 0,
      timeToConvert,
      createdAt: 0,
      convertedAt: timeToConvert
    });
  }
  return drafts;
}

// Self-test execution if run directly by Node
if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('verify-metrics.js')) {
  console.log('--- STARTING METRICS ASSERTION TESTS ---');
  
  const floor = 2.0; // 2 seconds floor
  console.log(`Configured Assertion Floor: ${floor}s\n`);

  // Test 1: Thoughtful Reviewer
  console.log('Running Thoughtful Reviewer simulation...');
  const reviewerDrafts = simulateThoughtfulReviewer(50);
  const reviewerMetrics = calculateMetrics(reviewerDrafts, floor);
  console.log('Resulting Metrics:');
  console.log(`- Total Processed: ${reviewerMetrics.totalProcessed}`);
  console.log(`- Conversion Rate: ${reviewerMetrics.conversionRate}% (Healthy!)`);
  console.log(`- Edit Rate: ${reviewerMetrics.editRate}%`);
  console.log(`- Median Time-to-Convert: ${reviewerMetrics.medianTimeToConvert}s`);
  console.log(`- Assertion Passed: ${reviewerMetrics.assertionPassed ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  
  if (!reviewerMetrics.assertionPassed) {
    console.error('FAIL: Expected Thoughtful Reviewer to pass the assertion.');
    process.exit(1);
  }

  console.log('\n----------------------------------------\n');

  // Test 2: Queue-Clearing Bot
  console.log('Running Queue-Clearing Bot simulation...');
  const botDrafts = simulateQueueClearingBot(50);
  const botMetrics = calculateMetrics(botDrafts, floor);
  console.log('Resulting Metrics:');
  console.log(`- Total Processed: ${botMetrics.totalProcessed}`);
  console.log(`- Conversion Rate: ${botMetrics.conversionRate}% (Healthy!)`);
  console.log(`- Edit Rate: ${botMetrics.editRate}%`);
  console.log(`- Median Time-to-Convert: ${botMetrics.medianTimeToConvert}s`);
  console.log(`- Assertion Passed: ${botMetrics.assertionPassed ? 'YES (PASSED)' : 'NO (FAILED)'}`);

  if (botMetrics.assertionPassed) {
    console.error('FAIL: Expected Queue-Clearing Bot to fail the assertion.');
    process.exit(1);
  }

  // Critical Trap Verification: Check if conversion rate is identical or healthy in both, while one fails the assertion
  if (botMetrics.conversionRate >= 90 && !botMetrics.assertionPassed) {
    console.log('\nTRAP VERIFIED: Conversion rate is extremely healthy (90%+), but the assertion caught the bot due to median time-to-convert being below the floor.');
  }

  console.log('\nAll programmatic tests passed successfully!');
}
