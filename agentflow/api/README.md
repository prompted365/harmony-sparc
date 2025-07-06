# AgentFlow API

High-performance Express.js REST API for the AgentFlow platform, built with TypeScript and optimized for >1000 TPS.

## Features

- **High Performance**: Optimized for >1000 TPS with <100ms health check response times
- **TypeScript**: Full type safety and excellent developer experience
- **Security**: Helmet, CORS, rate limiting, and input validation
- **Monitoring**: Comprehensive logging, metrics, and health checks
- **Testing**: Jest with >90% code coverage target
- **Production Ready**: Error handling, graceful shutdown, and clustering support

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev

# Run tests
npm test
```

## Architecture

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
├── routes/          # API route handlers
├── utils/           # Utility functions
├── types/           # TypeScript type definitions
└── server.ts        # Main server setup
```

## Performance Optimizations

1. **Compression**: Gzip compression for all responses
2. **Caching**: In-memory caching for static data
3. **Connection Pooling**: Database connection pooling
4. **Clustering**: Multi-process clustering for CPU utilization
5. **Rate Limiting**: Prevents abuse and ensures fair usage

## Monitoring

- **Health Checks**: `/health`, `/health/live`, `/health/ready`
- **Metrics**: Prometheus-compatible metrics on port 9090
- **Logging**: Structured JSON logging with Winston
- **Performance**: Response time tracking and alerting

## Security

- **Helmet**: Security headers and protection
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Request rate limiting per IP
- **Input Validation**: Express-validator for request validation
- **Error Handling**: Secure error responses without sensitive data

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Lint TypeScript code
- `npm run format` - Format code with Prettier

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- health.test.ts
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables

See `.env.example` for all configuration options.

### Health Checks

Kubernetes health check configuration:

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## API Documentation

See [API.md](./docs/API.md) for complete API documentation.

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Ensure >90% code coverage
4. Use conventional commit messages
5. Run linting and formatting before commits

## License

MIT License - see [LICENSE](../../LICENSE) file for details.