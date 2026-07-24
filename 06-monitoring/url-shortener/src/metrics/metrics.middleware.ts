import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { Counter, Histogram } from 'prom-client'

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  labelNames: ['method', 'route', 'status'],
  help: 'Total HTTP requests'
})

const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  help: 'HTTP request duration in seconds'
})

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000
      const route = req.route?.path || req.path
      httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, route }, duration);
    })

    next()
  }
}


