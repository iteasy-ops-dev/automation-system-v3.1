  // 배치 이벤트 발행
  async publishDeviceEventsBatch(events: Array<{
    eventType: DeviceEvent['eventType'];
    deviceId: string;
    payload: Record<string, any>;
    metadata?: any;
  }>): Promise<boolean> {
    try {
      await this.initializeProducer();

      const messages = events.map(event => {
        const deviceEvent: DeviceEvent = {
          eventId: uuidv4(),
          eventType: event.eventType,
          timestamp: new Date().toISOString(),
          deviceId: event.deviceId,
          payload: event.payload,
          metadata: {
            source: 'device-service',
            version: '1.0.0',
            ...event.metadata
          }
        };

        return {
          key: event.deviceId,
          value: JSON.stringify(deviceEvent),
          headers: {
            eventType: event.eventType,
            deviceId: event.deviceId,
            timestamp: deviceEvent.timestamp
          }
        };
      });

      await this.producer!.send({
        topic: 'device-events',
        messages
      });

      this.logger.info('Batch device events published', { count: events.length });
      return true;
    } catch (error) {
      this.logger.error('Publish device events batch failed', error, { count: events.length });
      return false;
    }
  }

  // Consumer 메시지 처리 (필요시 구독용)
  async subscribeToEvents(
    topics: string[],
    handler: (message: KafkaMessage, topic: string) => Promise<void>
  ): Promise<void> {
    try {
      await this.initializeConsumer();

      await this.consumer!.subscribe({ topics });

      await this.consumer!.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            await handler(message, topic);
          } catch (error) {
            this.logger.error('Event handler failed', error, { 
              topic, 
              partition, 
              offset: message.offset 
            });
          }
        }
      });

      this.logger.info('Subscribed to events', { topics });
    } catch (error) {
      this.logger.error('Subscribe to events failed', error, { topics });
      throw error;
    }
  }

  // 연결 관리
  async disconnect(): Promise<void> {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.producer = null;
        this.logger.info('Kafka producer disconnected');
      }

      if (this.consumer) {
        await this.consumer.disconnect();
        this.consumer = null;
        this.logger.info('Kafka consumer disconnected');
      }
    } catch (error) {
      this.logger.error('Kafka disconnect failed', error);
    }
  }

  // 헬스체크
  async ping(): Promise<boolean> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      return true;
    } catch (error) {
      this.logger.error('Kafka ping failed', error);
      return false;
    }
  }
}
