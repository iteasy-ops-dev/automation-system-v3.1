/**
 * Controllers Factory - API 컨트롤러 생성 및 관리
 */

import { ServiceManager } from '../services';
import { LLMController } from './llm.controller';
import { HealthController } from './health.controller';
import { ProviderController } from './provider.controller';

export class ControllerFactory {
  private llmController: LLMController;
  private healthController: HealthController;
  private providerController: ProviderController;

  constructor(serviceManager: ServiceManager) {
    this.llmController = new LLMController(serviceManager);
    this.healthController = new HealthController(serviceManager);
    this.providerController = new ProviderController(serviceManager);
  }

  getLLMController(): LLMController {
    return this.llmController;
  }

  getHealthController(): HealthController {
    return this.healthController;
  }

  getProviderController(): ProviderController {
    return this.providerController;
  }
}

// 개별 컨트롤러 export
export { LLMController } from './llm.controller';
export { HealthController } from './health.controller';
export { ProviderController } from './provider.controller';
