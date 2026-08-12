export type SearchResultCategory = 
  | 'EQUITY'
  | 'STRATEGY'
  | 'ORDER'
  | 'PORTFOLIO'
  | 'JOURNAL'
  | 'BROKER'
  | 'NAVIGATION'
  | 'ACTION'
  | 'ALERT';

export type SearchResultAction = 'NAVIGATE' | 'OPEN_ORDER' | 'OPEN_SIGNAL' | 'OPEN_DETAILS';

export interface SearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle?: string;
  description?: string;
  symbol?: string;
  route?: string;
  action: SearchResultAction;
  metadata?: Record<string, any>;
}
