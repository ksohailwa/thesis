import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SpellWise API',
      version: '1.0.0',
      description: 'API documentation for the SpellWise spelling education platform',
      contact: {
        name: 'SpellWise Team',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            username: { type: 'string' },
            role: { type: 'string', enum: ['teacher', 'student'] },
            consentAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Experiment: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            owner: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            classCode: { type: 'string' },
            cefr: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            targetWords: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: ['draft', 'live', 'closed'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Story: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            experiment: { type: 'string' },
            label: { type: 'string', enum: ['A', 'B'] },
            paragraphs: { type: 'array', items: { type: 'string' } },
            ttsAudioUrl: { type: 'string', nullable: true },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Attempt: {
          type: 'object',
          properties: {
            experimentId: { type: 'string' },
            word: { type: 'string' },
            attempt: { type: 'string' },
            correct: { type: 'boolean' },
            story: { type: 'string', enum: ['A', 'B'] },
            occurrenceIndex: { type: 'integer' },
          },
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Experiments', description: 'Teacher experiment management' },
      { name: 'Student', description: 'Student exercise endpoints' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'Health', description: 'Health check endpoint' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/swagger-docs/*.yaml'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express): void {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SpellWise API Docs',
  }));

  // Serve raw OpenAPI spec
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
}

export default specs;
