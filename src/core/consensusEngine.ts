import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { Agent, ConsensusProposal, ConsensusResult, VotingRecord } from '../types';
import { Logger } from '../utils/logger';
import { CryptoUtils } from '../utils/cryptoUtils';

export interface ConsensusConfig {
  algorithm: 'raft' | 'pbft' | 'proof_of_stake' | 'delegated_proof_of_stake';
  quorumSize: number;
  timeout: number;
  maxProposals: number;
}

interface RaftState {
  currentTerm: number;
  votedFor?: string;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
  role: 'follower' | 'candidate' | 'leader';
  leaderId?: string;
}

interface LogEntry {
  term: number;
  index: number;
  command: any;
  timestamp: number;
  hash: string;
}

interface ProposalState {
  id: string;
  proposal: ConsensusProposal;
  votes: Map<string, boolean>;
  startTime: number;
  requiredVotes: number;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
}

export class ConsensusEngine extends EventEmitter {
  private config: ConsensusConfig;
  private redis: Redis;
  private logger: Logger;
  private cryptoUtils: CryptoUtils;
  private activeProposals: Map<string, ProposalState> = new Map();
  private votingHistory: VotingRecord[] = [];
  private agentReputation: Map<string, number> = new Map();
  
  // Raft-specific state
  private raftState: RaftState;
  private heartbeatInterval?: NodeJS.Timeout;
  private electionTimeout?: NodeJS.Timeout;
  
  // PBFT-specific state
  private pbftPhase: 'pre-prepare' | 'prepare' | 'commit' | 'idle' = 'idle';
  private messageLog: Map<string, any[]> = new Map();
  
  constructor(config: ConsensusConfig) {
    super();
    this.config = config;
    this.logger = new Logger('ConsensusEngine');
    this.redis = new Redis();
    this.cryptoUtils = new CryptoUtils();
    
    // Initialize Raft state
    this.raftState = {
      currentTerm: 0,
      log: [],
      commitIndex: -1,
      lastApplied: -1,
      role: 'follower'
    };
  }

  async initialize(): Promise<void> {
    try {
      // Subscribe to consensus channels
      await this.redis.subscribe(
        'nexus:consensus:proposal',
        'nexus:consensus:vote',
        'nexus:consensus:heartbeat',
        'nexus:consensus:election'
      );
      
      this.redis.on('message', (channel: string, message: string) => {
        this.handleRedisMessage(channel, JSON.parse(message));
      });
      
      // Initialize consensus algorithm
      await this.initializeConsensusAlgorithm();
      
      // Load reputation scores
      await this.loadAgentReputations();
      
      this.logger.info(`Consensus Engine initialized with ${this.config.algorithm} algorithm`);
      
    } catch (error) {
      this.logger.error('Failed to initialize Consensus Engine:', error);
      throw error;
    }
  }

  private async initializeConsensusAlgorithm(): Promise<void> {
    switch (this.config.algorithm) {
      case 'raft':
        await this.initializeRaft();
        break;
      case 'pbft':
        await this.initializePBFT();
        break;
      case 'proof_of_stake':
        await this.initializePoS();
        break;
      case 'delegated_proof_of_stake':
        await this.initializeDPoS();
        break;
    }
  }

  private async initializeRaft(): Promise<void> {
    // Start as follower
    this.raftState.role = 'follower';
    
    // Start election timeout
    this.resetElectionTimeout();
    
    this.logger.info('Raft consensus initialized');
  }

  private async initializePBFT(): Promise<void> {
    this.pbftPhase = 'idle';
    this.logger.info('PBFT consensus initialized');
  }

  private async initializePoS(): Promise<void> {
    // Load stake information
    await this.loadStakeInformation();
    this.logger.info('Proof of Stake consensus initialized');
  }

  private async initializeDPoS(): Promise<void> {
    // Load delegate information
    await this.loadDelegateInformation();
    this.logger.info('Delegated Proof of Stake consensus initialized');
  }

  async proposeDecision(proposal: ConsensusProposal): Promise<ConsensusResult> {
    const proposalId = `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate proposal
      this.validateProposal(proposal);
      
      // Create proposal state
      const proposalState: ProposalState = {
        id: proposalId,
        proposal,
        votes: new Map(),
        startTime: Date.now(),
        requiredVotes: this.calculateRequiredVotes(proposal),
        status: 'pending'
      };
      
      this.activeProposals.set(proposalId, proposalState);
      
      // Execute consensus based on algorithm
      const result = await this.executeConsensus(proposalState);
      
      // Record in voting history
      this.votingHistory.push({
        proposalId,
        proposal,
        result,
        timestamp: new Date(),
        participants: Array.from(proposalState.votes.keys())
      });
      
      // Clean up
      this.activeProposals.delete(proposalId);
      
      this.emit('consensusReached', result);
      this.logger.info(`Consensus reached for proposal ${proposalId}: ${result.approved}`);
      
      return result;
      
    } catch (error) {
      this.activeProposals.delete(proposalId);
      this.logger.error(`Consensus failed for proposal ${proposalId}:`, error);
      throw error;
    }
  }

  private validateProposal(proposal: ConsensusProposal): void {
    if (!proposal.type || !proposal.data) {
      throw new Error('Invalid proposal: missing required fields');
    }
    
    if (this.activeProposals.size >= this.config.maxProposals) {
      throw new Error('Maximum active proposals reached');
    }
  }

  private calculateRequiredVotes(proposal: ConsensusProposal): number {
    // Calculate based on quorum size and proposal criticality
    let baseQuorum = this.config.quorumSize;
    
    if (proposal.criticality === 'high') {
      baseQuorum = Math.ceil(baseQuorum * 1.2);
    }
    
    return Math.min(baseQuorum, proposal.eligibleVoters?.length || baseQuorum);
  }

  private async executeConsensus(proposalState: ProposalState): Promise<ConsensusResult> {
    switch (this.config.algorithm) {
      case 'raft':
        return await this.executeRaftConsensus(proposalState);
      case 'pbft':
        return await this.executePBFTConsensus(proposalState);
      case 'proof_of_stake':
        return await this.executePoSConsensus(proposalState);
      case 'delegated_proof_of_stake':
        return await this.executeDPoSConsensus(proposalState);
      default:
        throw new Error(`Unsupported consensus algorithm: ${this.config.algorithm}`);
    }
  }

  private async executeRaftConsensus(proposalState: ProposalState): Promise<ConsensusResult> {
    // Only leader can propose
    if (this.raftState.role !== 'leader') {
      throw new Error('Only Raft leader can propose decisions');
    }
    
    // Create log entry
    const logEntry: LogEntry = {
      term: this.raftState.currentTerm,
      index: this.raftState.log.length,
      command: proposalState.proposal,
      timestamp: Date.now(),
      hash: await this.cryptoUtils.hash(JSON.stringify(proposalState.proposal))
    };
    
    // Append to log
    this.raftState.log.push(logEntry);
    
    // Send append entries to followers
    await this.sendAppendEntries(logEntry);
    
    // Wait for majority acknowledgment
    const result = await this.waitForRaftMajority(proposalState);
    
    if (result.approved) {
      this.raftState.commitIndex = logEntry.index;
      await this.applyLogEntry(logEntry);
    }
    
    return result;
  }

  private async executePBFTConsensus(proposalState: ProposalState): Promise<ConsensusResult> {
    // PBFT three-phase protocol: pre-prepare, prepare, commit
    
    // Phase 1: Pre-prepare
    this.pbftPhase = 'pre-prepare';
    await this.broadcastPBFTMessage('pre-prepare', proposalState);
    
    // Phase 2: Prepare
    this.pbftPhase = 'prepare';
    const prepareResult = await this.waitForPBFTPhase('prepare', proposalState);
    
    if (!prepareResult) {
      return { approved: false, reason: 'Failed in prepare phase' };
    }
    
    // Phase 3: Commit
    this.pbftPhase = 'commit';
    await this.broadcastPBFTMessage('commit', proposalState);
    const commitResult = await this.waitForPBFTPhase('commit', proposalState);
    
    this.pbftPhase = 'idle';
    
    return {
      approved: commitResult,
      reason: commitResult ? 'PBFT consensus reached' : 'Failed in commit phase'
    };
  }

  private async executePoSConsensus(proposalState: ProposalState): Promise<ConsensusResult> {
    // Proof of Stake: voting power based on stake
    const eligibleValidators = await this.getEligibleValidators(proposalState.proposal);
    
    // Broadcast proposal to validators
    await this.broadcastToValidators(proposalState, eligibleValidators);
    
    // Wait for votes with stake-weighted counting
    const result = await this.waitForStakeWeightedVotes(proposalState, eligibleValidators);
    
    return result;
  }

  private async executeDPoSConsensus(proposalState: ProposalState): Promise<ConsensusResult> {
    // Delegated Proof of Stake: only delegates can vote
    const activeDelegates = await this.getActiveDelegates();
    
    if (activeDelegates.length === 0) {
      throw new Error('No active delegates available for consensus');
    }
    
    // Broadcast to delegates
    await this.broadcastToDelegates(proposalState, activeDelegates);
    
    // Wait for delegate votes
    const result = await this.waitForDelegateVotes(proposalState, activeDelegates);
    
    return result;
  }

  private async sendAppendEntries(logEntry: LogEntry): Promise<void> {
    const appendEntriesMessage = {
      type: 'append_entries',
      term: this.raftState.currentTerm,
      leaderId: 'self', // In production, this would be actual leader ID
      prevLogIndex: logEntry.index - 1,
      prevLogTerm: logEntry.index > 0 ? this.raftState.log[logEntry.index - 1].term : 0,
      entries: [logEntry],
      leaderCommit: this.raftState.commitIndex
    };
    
    await this.redis.publish('nexus:consensus:append_entries', JSON.stringify(appendEntriesMessage));
  }

  private async waitForRaftMajority(proposalState: ProposalState): Promise<ConsensusResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        proposalState.status = 'timeout';
        resolve({ approved: false, reason: 'Timeout waiting for Raft majority' });
      }, this.config.timeout);
      
      const checkMajority = () => {
        const approvalCount = Array.from(proposalState.votes.values())
          .filter(vote => vote).length;
        
        const requiredMajority = Math.floor(proposalState.requiredVotes / 2) + 1;
        
        if (approvalCount >= requiredMajority) {
          clearTimeout(timeout);
          proposalState.status = 'approved';
          resolve({ 
            approved: true, 
            votes: approvalCount,
            required: requiredMajority
          });
        } else if (proposalState.votes.size >= proposalState.requiredVotes) {
          clearTimeout(timeout);
          proposalState.status = 'rejected';
          resolve({ 
            approved: false, 
            reason: 'Insufficient votes',
            votes: approvalCount,
            required: requiredMajority
          });
        }
      };
      
      // Check immediately and set up interval
      checkMajority();
      const checkInterval = setInterval(() => {
        checkMajority();
        if (proposalState.status !== 'pending') {
          clearInterval(checkInterval);
        }
      }, 100);
    });
  }

  private async broadcastPBFTMessage(phase: string, proposalState: ProposalState): Promise<void> {
    const message = {
      type: `pbft_${phase}`,
      proposalId: proposalState.id,
      proposal: proposalState.proposal,
      timestamp: Date.now(),
      signature: await this.cryptoUtils.sign(JSON.stringify(proposalState.proposal))
    };
    
    await this.redis.publish(`nexus:consensus:pbft_${phase}`, JSON.stringify(message));
  }

  private async waitForPBFTPhase(phase: string, proposalState: ProposalState): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.config.timeout);
      
      const requiredMessages = Math.floor((proposalState.requiredVotes * 2) / 3); // 2/3 majority
      let receivedMessages = 0;
      
      const checkPhaseCompletion = () => {
        const messages = this.messageLog.get(`${proposalState.id}_${phase}`) || [];
        receivedMessages = messages.length;
        
        if (receivedMessages >= requiredMessages) {
          clearTimeout(timeout);
          resolve(true);
        }
      };
      
      const checkInterval = setInterval(() => {
        checkPhaseCompletion();
        if (receivedMessages >= requiredMessages) {
          clearInterval(checkInterval);
        }
      }, 100);
    });
  }

  private async getEligibleValidators(proposal: ConsensusProposal): Promise<string[]> {
    // Get validators with sufficient stake
    const minStake = await this.redis.get('nexus:consensus:min_stake') || '1000';
    const validators = await this.redis.smembers('nexus:consensus:validators');
    
    const eligibleValidators = [];
    for (const validator of validators) {
      const stake = await this.redis.get(`nexus:stake:${validator}`) || '0';
      if (parseInt(stake) >= parseInt(minStake)) {
        eligibleValidators.push(validator);
      }
    }
    
    return eligibleValidators;
  }

  private async broadcastToValidators(proposalState: ProposalState, validators: string[]): Promise<void> {
    const message = {
      type: 'pos_proposal',
      proposalId: proposalState.id,
      proposal: proposalState.proposal,
      validators,
      timestamp: Date.now()
    };
    
    await this.redis.publish('nexus:consensus:pos_proposal', JSON.stringify(message));
  }

  private async waitForStakeWeightedVotes(proposalState: ProposalState, validators: string[]): Promise<ConsensusResult> {
    return new Promise(async (resolve) => {
      const timeout = setTimeout(() => {
        proposalState.status = 'timeout';
        resolve({ approved: false, reason: 'Timeout waiting for stake-weighted votes' });
      }, this.config.timeout);
      
      let totalStake = 0;
      let approvalStake = 0;
      
      // Calculate total available stake
      for (const validator of validators) {
        const stake = parseInt(await this.redis.get(`nexus:stake:${validator}`) || '0');
        totalStake += stake;
      }
      
      const checkStakeWeightedResult = async () => {
        approvalStake = 0;
        
        for (const [validator, vote] of proposalState.votes) {
          if (vote) {
            const stake = parseInt(await this.redis.get(`nexus:stake:${validator}`) || '0');
            approvalStake += stake;
          }
        }
        
        const approvalPercentage = totalStake > 0 ? approvalStake / totalStake : 0;
        
        if (approvalPercentage > 0.5) { // Majority stake
          clearTimeout(timeout);
          proposalState.status = 'approved';
          resolve({ 
            approved: true, 
            stakePercentage: approvalPercentage,
            approvalStake,
            totalStake
          });
        } else if (proposalState.votes.size >= validators.length) {
          clearTimeout(timeout);
          proposalState.status = 'rejected';
          resolve({ 
            approved: false, 
            reason: 'Insufficient stake support',
            stakePercentage: approvalPercentage,
            approvalStake,
            totalStake
          });
        }
      };
      
      const checkInterval = setInterval(() => {
        checkStakeWeightedResult();
        if (proposalState.status !== 'pending') {
          clearInterval(checkInterval);
        }
      }, 200);
    });
  }

  private async getActiveDelegates(): Promise<string[]> {
    return await this.redis.smembers('nexus:consensus:active_delegates');
  }

  private async broadcastToDelegates(proposalState: ProposalState, delegates: string[]): Promise<void> {
    const message = {
      type: 'dpos_proposal',
      proposalId: proposalState.id,
      proposal: proposalState.proposal,
      delegates,
      timestamp: Date.now()
    };
    
    await this.redis.publish('nexus:consensus:dpos_proposal', JSON.stringify(message));
  }

  private async waitForDelegateVotes(proposalState: ProposalState, delegates: string[]): Promise<ConsensusResult> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        proposalState.status = 'timeout';
        resolve({ approved: false, reason: 'Timeout waiting for delegate votes' });
      }, this.config.timeout);
      
      const checkDelegateVotes = () => {
        const approvalCount = Array.from(proposalState.votes.values())
          .filter(vote => vote).length;
        
        const requiredMajority = Math.floor(delegates.length / 2) + 1;
        
        if (approvalCount >= requiredMajority) {
          clearTimeout(timeout);
          proposalState.status = 'approved';
          resolve({ 
            approved: true, 
            delegateVotes: approvalCount,
            totalDelegates: delegates.length
          });
        } else if (proposalState.votes.size >= delegates.length) {
          clearTimeout(timeout);
          proposalState.status = 'rejected';
          resolve({ 
            approved: false, 
            reason: 'Insufficient delegate support',
            delegateVotes: approvalCount,
            totalDelegates: delegates.length
          });
        }
      };
      
      const checkInterval = setInterval(() => {
        checkDelegateVotes();
        if (proposalState.status !== 'pending') {
          clearInterval(checkInterval);
        }
      }, 100);
    });
  }

  private resetElectionTimeout(): void {
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }
    
    // Random timeout between 150-300ms
    const timeout = 150 + Math.random() * 150;
    
    this.electionTimeout = setTimeout(() => {
      this.startElection();
    }, timeout);
  }

  private async startElection(): Promise<void> {
    if (this.raftState.role === 'leader') {
      return; // Already leader
    }
    
    this.raftState.role = 'candidate';
    this.raftState.currentTerm++;
    this.raftState.votedFor = 'self';
    
    this.logger.info(`Starting election for term ${this.raftState.currentTerm}`);
    
    // Send vote requests
    const voteRequest = {
      type: 'vote_request',
      term: this.raftState.currentTerm,
      candidateId: 'self',
      lastLogIndex: this.raftState.log.length - 1,
      lastLogTerm: this.raftState.log.length > 0 ? this.raftState.log[this.raftState.log.length - 1].term : 0
    };
    
    await this.redis.publish('nexus:consensus:vote_request', JSON.stringify(voteRequest));
    
    // Reset election timeout
    this.resetElectionTimeout();
  }

  private async applyLogEntry(logEntry: LogEntry): Promise<void> {
    // Apply the committed log entry
    this.raftState.lastApplied = logEntry.index;
    
    this.logger.debug(`Applied log entry ${logEntry.index}: ${logEntry.command.type}`);
    this.emit('logEntryApplied', logEntry);
  }

  async castVote(proposalId: string, agentId: string, vote: boolean, signature?: string): Promise<void> {
    const proposalState = this.activeProposals.get(proposalId);
    
    if (!proposalState) {
      throw new Error(`Proposal ${proposalId} not found`);
    }
    
    if (proposalState.status !== 'pending') {
      throw new Error(`Proposal ${proposalId} is no longer accepting votes`);
    }
    
    // Verify agent is eligible to vote
    if (proposalState.proposal.eligibleVoters && 
        !proposalState.proposal.eligibleVoters.includes(agentId)) {
      throw new Error(`Agent ${agentId} not eligible to vote on proposal ${proposalId}`);
    }
    
    // Verify signature if provided
    if (signature) {
      const isValidSignature = await this.cryptoUtils.verifySignature(
        JSON.stringify({ proposalId, vote }),
        signature,
        agentId
      );
      
      if (!isValidSignature) {
        throw new Error('Invalid vote signature');
      }
    }
    
    // Record vote
    proposalState.votes.set(agentId, vote);
    
    // Update agent reputation based on vote
    this.updateAgentReputation(agentId, vote);
    
    this.logger.debug(`Vote recorded: ${agentId} voted ${vote} on proposal ${proposalId}`);
    this.emit('voteReceived', { proposalId, agentId, vote });
  }

  private updateAgentReputation(agentId: string, vote: boolean): void {
    const currentReputation = this.agentReputation.get(agentId) || 50;
    // Reputation system can be more sophisticated
    const change = vote ? 1 : -0.5; // Positive votes increase reputation more
    
    const newReputation = Math.max(0, Math.min(100, currentReputation + change));
    this.agentReputation.set(agentId, newReputation);
  }

  private async loadAgentReputations(): Promise<void> {
    try {
      const reputations = await this.redis.hgetall('nexus:agent_reputations');
      
      for (const [agentId, reputation] of Object.entries(reputations)) {
        this.agentReputation.set(agentId, parseFloat(reputation));
      }
      
      this.logger.info(`Loaded ${this.agentReputation.size} agent reputations`);
    } catch (error) {
      this.logger.error('Failed to load agent reputations:', error);
    }
  }

  private async loadStakeInformation(): Promise<void> {
    // Load stake information for PoS consensus
    const stakes = await this.redis.hgetall('nexus:stakes');
    this.logger.info(`Loaded stake information for ${Object.keys(stakes).length} validators`);
  }

  private async loadDelegateInformation(): Promise<void> {
    // Load delegate information for DPoS consensus
    const delegates = await this.redis.smembers('nexus:consensus:active_delegates');
    this.logger.info(`Loaded ${delegates.length} active delegates`);
  }

  private handleRedisMessage(channel: string, message: any): void {
    switch (channel) {
      case 'nexus:consensus:proposal':
        this.handleProposalMessage(message);
        break;
      case 'nexus:consensus:vote':
        this.handleVoteMessage(message);
        break;
      case 'nexus:consensus:heartbeat':
        this.handleHeartbeat(message);
        break;
      case 'nexus:consensus:election':
        this.handleElectionMessage(message);
        break;
      default:
        this.logger.debug(`Received message on ${channel}:`, message);
    }
  }

  private async handleProposalMessage(message: any): Promise<void> {
    // Handle incoming proposal from other nodes
    this.logger.debug('Received consensus proposal:', message);
  }

  private async handleVoteMessage(message: any): Promise<void> {
    const { proposalId, agentId, vote, signature } = message;
    
    try {
      await this.castVote(proposalId, agentId, vote, signature);
    } catch (error) {
      this.logger.error('Failed to process vote message:', error);
    }
  }

  private handleHeartbeat(message: any): void {
    // Handle heartbeat for Raft consensus
    if (this.config.algorithm === 'raft') {
      const { term, leaderId } = message;
      
      if (term >= this.raftState.currentTerm) {
        this.raftState.role = 'follower';
        this.raftState.leaderId = leaderId;
        this.resetElectionTimeout();
      }
    }
  }

  private handleElectionMessage(message: any): void {
    // Handle Raft election messages
    if (message.type === 'vote_request') {
      this.handleVoteRequest(message);
    } else if (message.type === 'vote_response') {
      this.handleVoteResponse(message);
    }
  }

  private async handleVoteRequest(message: any): Promise<void> {
    const { term, candidateId, lastLogIndex, lastLogTerm } = message;
    
    let voteGranted = false;
    
    if (term > this.raftState.currentTerm) {
      this.raftState.currentTerm = term;
      this.raftState.votedFor = undefined;
      this.raftState.role = 'follower';
    }
    
    if (term === this.raftState.currentTerm && 
        (!this.raftState.votedFor || this.raftState.votedFor === candidateId)) {
      
      // Check if candidate's log is at least as up-to-date
      const ourLastLogIndex = this.raftState.log.length - 1;
      const ourLastLogTerm = this.raftState.log.length > 0 ? this.raftState.log[ourLastLogIndex].term : 0;
      
      if (lastLogTerm > ourLastLogTerm || 
          (lastLogTerm === ourLastLogTerm && lastLogIndex >= ourLastLogIndex)) {
        voteGranted = true;
        this.raftState.votedFor = candidateId;
        this.resetElectionTimeout();
      }
    }
    
    // Send vote response
    const voteResponse = {
      type: 'vote_response',
      term: this.raftState.currentTerm,
      voteGranted
    };
    
    await this.redis.publish('nexus:consensus:vote_response', JSON.stringify(voteResponse));
  }

  private handleVoteResponse(message: any): void {
    const { term, voteGranted } = message;
    
    if (this.raftState.role === 'candidate' && term === this.raftState.currentTerm && voteGranted) {
      // Count votes (simplified - in production would track individual votes)
      // If majority received, become leader
      this.becomeLeader();
    }
  }

  private async becomeLeader(): Promise<void> {
    this.raftState.role = 'leader';
    this.raftState.leaderId = 'self';
    
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }
    
    // Start sending heartbeats
    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
    }, 50); // 50ms heartbeat interval
    
    this.logger.info(`Became Raft leader for term ${this.raftState.currentTerm}`);
    this.emit('becameLeader', { term: this.raftState.currentTerm });
  }

  private async sendHeartbeat(): Promise<void> {
    const heartbeat = {
      type: 'heartbeat',
      term: this.raftState.currentTerm,
      leaderId: 'self',
      commitIndex: this.raftState.commitIndex
    };
    
    await this.redis.publish('nexus:consensus:heartbeat', JSON.stringify(heartbeat));
  }

  // Public API methods
  getConsensusStats(): {
    algorithm: string;
    activeProposals: number;
    votingHistory: number;
    agentReputations: Record<string, number>;
    raftState?: RaftState;
  } {
    return {
      algorithm: this.config.algorithm,
      activeProposals: this.activeProposals.size,
      votingHistory: this.votingHistory.length,
      agentReputations: Object.fromEntries(this.agentReputation),
      ...(this.config.algorithm === 'raft' && { raftState: this.raftState })
    };
  }

  getVotingHistory(limit: number = 10): VotingRecord[] {
    return this.votingHistory.slice(-limit);
  }

  getAgentReputation(agentId: string): number {
    return this.agentReputation.get(agentId) || 50;
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (this.electionTimeout) {
      clearTimeout(this.electionTimeout);
    }
    
    // Save agent reputations
    const reputations = Object.fromEntries(this.agentReputation);
    await this.redis.hmset('nexus:agent_reputations', reputations);
    
    // Unsubscribe from Redis
    await this.redis.unsubscribe();
    
    this.logger.info('Consensus Engine shut down');
  }
}

export default ConsensusEngine;