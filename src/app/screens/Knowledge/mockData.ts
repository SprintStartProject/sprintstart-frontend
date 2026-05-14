export interface KnowledgeItem {
  id: string;
  title: string;
  type: 'Documentation' | 'ADR' | 'Runbook' | 'Guide';
  owner: string;
  lastUpdated: string;
  freshness: 'current' | 'stale' | 'outdated';
  canonical: boolean;
  tags: string[];
  excerpt: string;
  aiSummary: string;
}

export const mockKnowledgeItems: KnowledgeItem[] = [
  {
    id: '1',
    title: 'API Authentication Guide',
    type: 'Documentation',
    owner: 'Sarah Chen',
    lastUpdated: '2026-04-15',
    freshness: 'current',
    canonical: true,
    tags: ['authentication', 'api', 'security'],
    excerpt: 'Complete guide to implementing authentication in our API using JWT tokens...',
    aiSummary:
      'This document details the transition to JWT-based authentication. Key requirements include token rotation and secure storage in HttpOnly cookies.',
  },
  {
    id: '2',
    title: 'Choosing React Over Vue',
    type: 'ADR',
    owner: 'Marcus Johnson',
    lastUpdated: '2026-03-22',
    freshness: 'current',
    canonical: true,
    tags: ['architecture', 'frontend', 'decision'],
    excerpt:
      'Architecture decision record for selecting React as our primary frontend framework...',
    aiSummary:
      'ADR-004: Standardizing on React for its robust ecosystem and component-driven architecture, enabling better code sharing across teams.',
  },
  {
    id: '3',
    title: 'Database Migration Runbook',
    type: 'Runbook',
    owner: 'Emma Wilson',
    lastUpdated: '2026-04-01',
    freshness: 'current',
    canonical: true,
    tags: ['database', 'operations', 'migration'],
    excerpt: 'Step-by-step process for safely executing database schema migrations...',
    aiSummary:
      'A critical operational guide for Zero-Downtime migrations. Includes rollback procedures and pre-migration health check scripts.',
  },
  {
    id: '4',
    title: 'CI/CD Pipeline Setup',
    type: 'Guide',
    owner: 'David Park',
    lastUpdated: '2026-02-10',
    freshness: 'stale',
    canonical: false,
    tags: ['ci-cd', 'deployment', 'automation'],
    excerpt: 'Guide for setting up continuous integration and deployment pipelines...',
    aiSummary:
      'Overview of the GitHub Actions workflow. Note: This document requires an update for the new staging environment cluster.',
  },
  {
    id: '5',
    title: 'Legacy Deployment Process',
    type: 'Documentation',
    owner: 'Alex Kim',
    lastUpdated: '2025-11-15',
    freshness: 'outdated',
    canonical: false,
    tags: ['deployment', 'legacy'],
    excerpt: 'Documentation for the old deployment process (deprecated)...',
    aiSummary:
      'DEPRECATED: Historic reference of the Jenkins-based deployment. Not for use in active projects.',
  },
  {
    id: '6',
    title: 'Error Handling Best Practices',
    type: 'Documentation',
    owner: 'Sarah Chen',
    lastUpdated: '2026-04-20',
    freshness: 'current',
    canonical: true,
    tags: ['error-handling', 'best-practices'],
    excerpt: 'Guidelines for implementing consistent error handling across services...',
    aiSummary:
      'Standards for global error types, logging severity levels, and client-side error boundaries for a consistent user experience.',
  },
];
