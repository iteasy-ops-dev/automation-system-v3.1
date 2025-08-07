  // 장비 상태 이력 조회
  async queryDeviceStatusHistory(
    deviceId: string,
    start?: Date,
    end?: Date
  ): Promise<Array<{ timestamp: string; status: number; responseTime?: number }>> {
    try {
      const startTime = start || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = end || new Date();

      const fluxQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
          |> filter(fn: (r) => r._measurement == "device_status")
          |> filter(fn: (r) => r.device_id == "${deviceId}")
          |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
          |> yield()
      `;

      const result: Array<{ timestamp: string; status: number; responseTime?: number }> = [];
      
      return new Promise((resolve, reject) => {
        this.queryApi.queryRows(fluxQuery, {
          next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            if (o.status_code !== undefined && o._time) {
              result.push({
                timestamp: new Date(o._time).toISOString(),
                status: parseInt(o.status_code),
                responseTime: o.response_time ? parseFloat(o.response_time) : undefined
              });
            }
          },
          error: (error) => {
            this.logger.error('Query device status history failed', error, { deviceId });
            reject(error);
          },
          complete: () => {
            resolve(result.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
          }
        });
      });
    } catch (error) {
      this.logger.error('Query device status history failed', error, { deviceId });
      return [];
    }
  }

  // 메트릭 요약 통계
  async getMetricSummary(
    deviceId: string,
    metric: string,
    start?: Date,
    end?: Date
  ): Promise<{ min: number; max: number; avg: number; count: number } | null> {
    try {
      const startTime = start || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = end || new Date();

      const fieldMap: Record<string, string> = {
        'cpu': 'cpu_usage',
        'memory': 'memory_usage',
        'disk': 'disk_usage',
        'temperature': 'temperature',
        'power': 'power_consumption'
      };
      const field = fieldMap[metric] || metric;

      const fluxQuery = `
        data = from(bucket: "${this.bucket}")
          |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
          |> filter(fn: (r) => r._measurement == "device_metrics")
          |> filter(fn: (r) => r.device_id == "${deviceId}")
          |> filter(fn: (r) => r._field == "${field}")

        min = data |> min()
        max = data |> max()
        mean = data |> mean()
        count = data |> count()

        union(tables: [min, max, mean, count])
          |> yield()
      `;

      let summary = { min: 0, max: 0, avg: 0, count: 0 };
      
      return new Promise((resolve, reject) => {
        this.queryApi.queryRows(fluxQuery, {
          next: (row, tableMeta) => {
            const o = tableMeta.toObject(row);
            if (o._value !== undefined) {
              const value = parseFloat(o._value);
              switch (o._field) {
                case 'min':
                  summary.min = value;
                  break;
                case 'max':
                  summary.max = value;
                  break;
                case 'mean':
                  summary.avg = value;
                  break;
                case 'count':
                  summary.count = value;
                  break;
              }
            }
          },
          error: (error) => {
            this.logger.error('Get metric summary failed', error, { deviceId, metric });
            reject(error);
          },
          complete: () => {
            resolve(summary.count > 0 ? summary : null);
          }
        });
      });
    } catch (error) {
      this.logger.error('Get metric summary failed', error, { deviceId, metric });
      return null;
    }
  }

  // 연결 정리
  async close(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.info('InfluxDB connection closed');
    } catch (error) {
      this.logger.error('InfluxDB close failed', error);
    }
  }

  // 헬스체크
  async ping(): Promise<boolean> {
    try {
      await this.influxDB.ping();
      return true;
    } catch (error) {
      this.logger.error('InfluxDB ping failed', error);
      return false;
    }
  }
}
