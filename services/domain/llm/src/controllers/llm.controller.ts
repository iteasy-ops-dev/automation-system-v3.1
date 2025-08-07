/**
 * LLM Controller - REST API 엔드포인트
 * 계약 준수: shared/contracts/v1.0/rest/domain/llm-service.yaml 100% 준수
 */

import { Request, Response } from 'express';
import { ServiceManager } from '../services';
import logger from '../utils/logger';
import { 
  ChatRequest, 
  ChatResponse, 
  TemplateCreate, 
  ErrorResponse 
} from '../types/contracts';

export class LLMController {
  constructor(private serviceManager: ServiceManager) {}

  /**
   * POST /llm/chat - 채팅 요청 처리
   */
  async chat(req: Request, res: Response): Promise<void> {
    try {
      const chatRequest: ChatRequest = req.body;
      
      // 기본 유효성 검증
      if (!chatRequest.messages || chatRequest.messages.length === 0) {
        res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Messages array is required and cannot be empty',
          timestamp: new Date().toISOString(),
        } as ErrorResponse);
        return;
      }

      const llmService = this.serviceManager.getLLMService();
      const response: ChatResponse = await llmService.chat(chatRequest);

      res.status(200).json(response);
    } catch (error) {
      logger.error('Chat request failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }

  /**
   * POST /llm/stream - 스트리밍 채팅 (임시 구현)
   */
  async streamChat(req: Request, res: Response): Promise<void> {
    try {
      // TODO: 실제 스트리밍 구현
      res.status(501).json({
        error: 'NOT_IMPLEMENTED',
        message: 'Streaming chat is not yet implemented',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    } catch (error) {
      logger.error('Stream chat request failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }

  /**
   * GET /llm/models - 사용 가능한 모델 목록 조회
   */
  async getModels(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.query.provider as string;
      
      const llmService = this.serviceManager.getLLMService();
      const models = await llmService.getModels(provider as any);

      res.status(200).json({
        models,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Get models failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }

  /**
   * GET /llm/usage - 사용량 조회
   */
  async getUsage(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        start: req.query.start as string,
        end: req.query.end as string,
        provider: req.query.provider as string,
        model: req.query.model as string,
        groupBy: (req.query.groupBy as 'provider' | 'model' | 'user' | 'hour' | 'day') || 'day',
      };

      const llmService = this.serviceManager.getLLMService();
      const usage = await llmService.getUsage(filters);

      res.status(200).json(usage);
    } catch (error) {
      logger.error('Get usage failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }

  /**
   * GET /llm/templates - 프롬프트 템플릿 목록 조회
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        category: req.query.category as string,
        search: req.query.search as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
      };

      const llmService = this.serviceManager.getLLMService();
      const templates = await llmService.getTemplates(filters);

      res.status(200).json(templates);
    } catch (error) {
      logger.error('Get templates failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }

  /**
   * POST /llm/templates - 프롬프트 템플릿 생성
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const templateData: TemplateCreate = req.body;
      
      // 기본 유효성 검증
      if (!templateData.name || !templateData.template) {
        res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Template name and content are required',
          timestamp: new Date().toISOString(),
        } as ErrorResponse);
        return;
      }

      const llmService = this.serviceManager.getLLMService();
      const template = await llmService.createTemplate(templateData);

      res.status(201).json(template);
    } catch (error) {
      logger.error('Create template failed:', error);
      
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      } as ErrorResponse);
    }
  }
}
