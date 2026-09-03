import express from 'express';
import { calculateMetrics } from './src/verify-metrics.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// In-memory state
let activeProfile = 'human'; // 'manual' | 'human' | 'bot'
let assertionFloor = 2.0; // seconds
let draftsQueue = [];
let historyData = [];
let logs = [];

const SAMPLE_DRAFTS = [
  "Hi, thank you for contacting customer support. I have checked your account, and the billing issue has been resolved. The refund will show on your bank statement within 3 to 5 business days. Please let me know if you need anything else.",
  "Hello, we sincerely apologize for the delay in shipping your order. A carrier delay occurred at our distribution center. We have upgraded your shipping to next-day delivery at no additional charge. Here is your tracking number: TRK-9842104.",
  "Hi there! Thank you for inquiring about our pricing tiers. The Business Plan starts at $49/user/month and includes unlimited storage, API access, and 24/7 dedicated support. I can set you up with a 14-day free trial if you'd like.",
  "Dear customer, regarding your database connection issue: please verify that the database host is set to the correct regional URL and that your inbound security group allows TCP traffic on port 5432. Let me know if you need help with config files.",
  "Hi team, here is the summary of the engineering sync. Action items are: 1) Deploy the metric assertion hook by Tuesday. 2) Set up performance alarms for the queue metrics. 3) Align on the conversion rate controls before the release.",
  "Hi! Yes, we offer volume discounts for organizations purchasing 50 or more licenses. I have attached the enterprise pricing sheet for your review. Let me know when you are free for a brief demo call next week.",
  "Hello, your service subscription renewal has been processed successfully. Your next billing date is September 22, 2026. You can download your official invoice directly from your profile settings page.",
  "Hi. We noticed a double payment on invoice #1084. We have automatically credited the excess amount back to your card. No action is required on your part. We apologize for the system glitch.",
  "Hey, thanks for the bug report. I was able to reproduce the error where the checkout button becomes disabled on mobile Safari. The patch is scheduled for release in the hotfix tonight at 10 PM PST.",
  "Greetings, your security compliance review has passed. The audit confirms full alignment with SOC2 requirements. All findings have been mitigated. The final certificate will be emailed shortly."
];

// Helper to initialize the queue
function initQueue(profile = activeProfile) {
  activeProfile = profile;
  draftsQueue = SAMPLE_DRAFTS.map((txt, index) => ({
    id: `draft-${Date.now()}-${index}`,
    originalText: txt,
    content: txt,
    status: 'pending', // 'pending' | 'converted' | 'edited' | 'rejected'
    editCount: 0,
    timeToConvert: null,
    createdAt: null,
    convertedAt: null
  }));
  historyData = [];
  
  const modeName = profile === 'human' ? 'Thoughtful Reviewer' : profile === 'bot' ? 'Queue-Clearing Bot' : 'Manual Workspace';
  logs = [{
    id: `log-init-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    message: `Initialized queue with 10 drafts. Ready for ${modeName} mode.`,
    type: 'info'
  }];
}

// Initialize queue on startup
initQueue();

// Get complete current state
app.get('/api/state', (req, res) => {
  res.json({
    activeProfile,
    assertionFloor,
    draftsQueue,
    historyData,
    logs,
    metrics: calculateMetrics(draftsQueue, assertionFloor)
  });
});

// Reset state for a specific profile
app.post('/api/reset', (req, res) => {
  const { profile } = req.body;
  initQueue(profile || activeProfile);
  res.json({
    activeProfile,
    assertionFloor,
    draftsQueue,
    historyData,
    logs,
    metrics: calculateMetrics(draftsQueue, assertionFloor)
  });
});

// Update assertion floor
app.post('/api/floor', (req, res) => {
  const { floor } = req.body;
  if (typeof floor === 'number' && floor >= 0.5 && floor <= 5.0) {
    assertionFloor = floor;
    res.json({
      activeProfile,
      assertionFloor,
      draftsQueue,
      historyData,
      logs,
      metrics: calculateMetrics(draftsQueue, assertionFloor)
    });
  } else {
    res.status(400).json({ error: 'Invalid floor value. Must be a number between 0.5 and 5.0.' });
  }
});

// Plan the next simulation step decision and timing parameters
app.post('/api/simulate/plan', (req, res) => {
  const { profile } = req.body;
  
  const nextPendingIndex = draftsQueue.findIndex(d => d.status === 'pending');
  if (nextPendingIndex === -1) {
    return res.status(400).json({ error: 'No pending drafts in the queue.' });
  }

  const draft = draftsQueue[nextPendingIndex];

  let readTime = 0;
  let editTime = 0;
  let targetStatus = 'converted';
  let editCount = 0;

  if (profile === 'human') {
    const roll = Math.random();
    readTime = 2.5 + Math.random() * 3.5; // 2.5s to 6.0s
    if (roll < 0.1) {
      targetStatus = 'rejected';
    } else if (roll < 0.5) {
      targetStatus = 'edited';
      editCount = Math.floor(Math.random() * 3) + 1;
      editTime = 1.5 + Math.random() * 2.5; // 1.5s to 4.0s editing
    } else {
      targetStatus = 'converted';
    }
  } else if (profile === 'bot') {
    readTime = 0.05 + Math.random() * 0.1; // 50ms to 150ms
    targetStatus = 'converted';
    editCount = 0;
  } else {
    return res.status(400).json({ error: 'Invalid profile for simulation step plan.' });
  }

  const totalTime = targetStatus !== 'rejected' ? readTime + editTime : null;

  res.json({
    draftIndex: nextPendingIndex,
    draftId: draft.id,
    readTime,
    editTime,
    status: targetStatus,
    editCount,
    timeToConvert: totalTime
  });
});

// Commit an action (manual review or simulation step completion)
app.post('/api/action', (req, res) => {
  const { draftId, status, content, editCount, timeToConvert } = req.body;

  const draftIndex = draftsQueue.findIndex(d => d.id === draftId);
  if (draftIndex === -1) {
    return res.status(404).json({ error: 'Draft not found.' });
  }

  const draft = { ...draftsQueue[draftIndex] };
  
  // Update draft details
  draft.status = status;
  draft.content = content || draft.originalText;
  draft.editCount = editCount || 0;
  draft.timeToConvert = timeToConvert;
  draft.createdAt = 0;
  draft.convertedAt = timeToConvert;

  draftsQueue[draftIndex] = draft;

  // Recalculate metrics for logging and history
  const updatedMetrics = calculateMetrics(draftsQueue, assertionFloor);

  // Append history data
  historyData.push({
    index: historyData.length + 1,
    draftId: draft.id,
    timeToConvert: draft.timeToConvert,
    conversionRate: updatedMetrics.conversionRate,
    editRate: updatedMetrics.editRate,
    assertionPassed: updatedMetrics.assertionPassed,
    status: draft.status
  });

  // Append log entry
  const actionLabel = draft.status === 'edited' ? 'Edited & Accepted' : draft.status === 'converted' ? 'Accepted Directly' : 'Rejected';
  const logType = draft.status === 'rejected' ? 'error' : (draft.timeToConvert < assertionFloor ? 'warning' : 'success');
  const sourcePrefix = activeProfile === 'human' ? '[HUMAN] ' : activeProfile === 'bot' ? '[BOT] ' : '';
  
  logs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    message: `${sourcePrefix}Draft #${draftIndex + 1} ${actionLabel.toLowerCase()} in ${timeToConvert ? timeToConvert.toFixed(2) + 's' : 'N/A'} (Floor: ${assertionFloor}s)`,
    type: logType
  });

  // If queue is completed, add a special completion log
  const nextPendingIndex = draftsQueue.findIndex(d => d.status === 'pending');
  if (nextPendingIndex === -1) {
    logs.unshift({
      id: `log-end-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      message: activeProfile === 'manual' 
        ? 'Queue completely cleared! Review final session metrics.' 
        : 'Simulation completed! All drafts processed.',
      type: 'info'
    });
  }

  res.json({
    activeProfile,
    assertionFloor,
    draftsQueue,
    historyData,
    logs,
    metrics: updatedMetrics
  });
});

// Undo the most recent processed draft action
app.post('/api/action/undo', (req, res) => {
  if (historyData.length === 0) {
    return res.status(400).json({ error: 'No actions to undo.' });
  }

  const lastHistory = historyData.pop();
  const draftIndex = draftsQueue.findIndex(d => d.id === lastHistory.draftId);
  
  if (draftIndex !== -1) {
    draftsQueue[draftIndex].status = 'pending';
    draftsQueue[draftIndex].content = draftsQueue[draftIndex].originalText;
    draftsQueue[draftIndex].editCount = 0;
    draftsQueue[draftIndex].timeToConvert = null;
    draftsQueue[draftIndex].createdAt = null;
    draftsQueue[draftIndex].convertedAt = null;

    logs.unshift({
      id: `log-undo-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(),
      message: `Reverted Draft #${draftIndex + 1} back to pending queue.`,
      type: 'info'
    });
  }

  const updatedMetrics = calculateMetrics(draftsQueue, assertionFloor);

  res.json({
    activeProfile,
    assertionFloor,
    draftsQueue,
    historyData,
    logs,
    metrics: updatedMetrics
  });
});

app.post('/api/logs/append', (req, res) => {
  const { message, type } = req.body;
  logs.unshift({
    id: `log-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString(),
    message,
    type: type || 'info'
  });
  res.json({ logs });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
