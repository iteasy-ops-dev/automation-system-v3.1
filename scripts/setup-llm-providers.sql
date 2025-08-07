-- LLM 프로바이더 등록 스크립트
-- OpenAI와 Anthropic 프로바이더 추가

-- OpenAI 프로바이더 등록
INSERT INTO llm_providers (
    name,
    provider_type,
    api_endpoint,
    api_key_hash,
    models,
    rate_limits,
    status
) VALUES (
    'OpenAI GPT-4',
    'openai',
    'https://api.openai.com/v1',
    'encrypted_key_placeholder', -- 실제로는 암호화된 키
    '[
        {"id": "gpt-4-turbo-preview", "name": "GPT-4 Turbo", "maxTokens": 128000},
        {"id": "gpt-4", "name": "GPT-4", "maxTokens": 8192},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "maxTokens": 16385}
    ]'::jsonb,
    '{"rpm": 10000, "tpm": 2000000}'::jsonb,
    'active'
) ON CONFLICT (name) DO NOTHING;

-- Anthropic 프로바이더 등록
INSERT INTO llm_providers (
    name,
    provider_type,
    api_endpoint,
    api_key_hash,
    models,
    rate_limits,
    status
) VALUES (
    'Anthropic Claude',
    'anthropic',
    'https://api.anthropic.com/v1',
    'encrypted_key_placeholder', -- 실제로는 암호화된 키
    '[
        {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "maxTokens": 200000},
        {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "maxTokens": 200000},
        {"id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku", "maxTokens": 200000}
    ]'::jsonb,
    '{"rpm": 5000, "tpm": 1000000}'::jsonb,
    'active'
) ON CONFLICT (