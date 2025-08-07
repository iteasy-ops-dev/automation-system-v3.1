// 추가 LLM Service 타입 정의

export interface UsageBreakdown {
  provider: string;
  model: string;
  requests: number;
  tokens: {
    input: number;
    output: number;
  };
  cost: number;
  avgResponseTime?: number;
}

export interface UsageResponse {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    avgResponseTime?: number;
  };
  breakdown: UsageBreakdown[];
}

export interface Template {
  id: string;
  name: string;
  category: string;
  template: string;
  variables?: string[];
  description?: string;
  model?: string;
  parameters?: Record<string, any>;
  examples?: Record<string, any>[];
  createdAt: string;
  updatedAt?: string;
}

export interface TemplateCreate {
  name: string;
  category: string;
  template: string;
  description?: string;
  model?: string;
  parameters?: Record<string, any>;
  examples?: Record<string, any>[];
}

export interface TemplatesResponse {
  items: Template[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}
