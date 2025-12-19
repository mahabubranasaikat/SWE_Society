const express = require('express');
const router = express.Router();
const electionController = require('../controllers/electionController');

// Default Posts (must come before :id routes to avoid conflict)
router.get('/elections/posts/default', electionController.getDefaultPosts);

// Elections
router.get('/elections', electionController.getElections);
router.get('/elections/:id', electionController.getElectionById);
router.post('/elections', electionController.createElection);
router.put('/elections/:id', electionController.updateElection);
router.patch('/elections/:id/status', electionController.updateElectionStatus);
router.delete('/elections/:id', electionController.deleteElection);

// Candidates
router.post('/elections/:electionId/candidates', electionController.registerCandidate);
router.get('/elections/:electionId/candidates', electionController.getElectionCandidates);
router.get('/elections/:electionId/candidates/check', electionController.checkCandidateStatus);
router.get('/elections/:electionId/posts/:postId/candidates', electionController.getCandidatesByPost);
router.post('/elections/candidates/:candidateId/approve', electionController.approveCandidate);
router.post('/elections/candidates/:candidateId/reject', electionController.rejectCandidate);
router.delete('/elections/candidates/:candidateId', electionController.deleteCandidate);

// Voting
router.post('/elections/:electionId/vote-request', electionController.requestVote);
router.get('/elections/:electionId/vote-requests', electionController.getVoteRequests);
router.post('/elections/vote-requests/:requestId/approve', electionController.approveVoteRequest);
router.post('/elections/vote-requests/:requestId/reject', electionController.rejectVoteRequest);
router.delete('/elections/vote-requests/:requestId', electionController.deleteVoteRequest);
router.get('/elections/:electionId/votes/check', electionController.checkUserVoted);
router.post('/elections/:electionId/vote', electionController.castVote);

// Results
router.get('/elections/:electionId/results', electionController.getElectionResults);
router.get('/elections/:electionId/stats', electionController.getElectionStats);
router.get('/elections/:electionId/audit-log', electionController.getAuditLog);
router.get('/elections/:electionId/voter-logs', electionController.getVoterLogs);

module.exports = router;
