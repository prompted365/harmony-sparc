/**
 * Validation Middleware
 * Request validation using Zod schemas with detailed error reporting
 */

import { Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { ApiRequest, ApiResponse, ApiErrorCode } from '../types/index';

interface ValidationOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

interface ValidationErrorDetail {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}

function formatZodError(error: ZodError): ValidationErrorDetail[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: 'received' in err ? (err as any).received : undefined,
    expected: 'expected' in err ? (err as any).expected : undefined
  })) as ValidationErrorDetail[];
}

export function validateRequest(schemas: ValidationOptions) {
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const errors: ValidationErrorDetail[] = [];

    try {
      // Validate request body
      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error).map(err => ({ ...err, field: `body.${err.field}` })));
          }
        }
      }

      // Validate query parameters
      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error).map(err => ({ ...err, field: `query.${err.field}` })));
          }
        }
      }

      // Validate route parameters
      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error).map(err => ({ ...err, field: `params.${err.field}` })));
          }
        }
      }

      // Validate headers
      if (schemas.headers) {
        try {
          schemas.headers.parse(req.headers);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(...formatZodError(error).map(err => ({ ...err, field: `headers.${err.field}` })));
          }
        }
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: ApiErrorCode.INVALID_REQUEST,
            message: 'Validation failed',
            details: {
              errors,
              count: errors.length
            }
          },
          meta: {
            timestamp: Date.now(),
            version: '1.0.0',
            requestId: req.requestId!
          }
        } as ApiResponse);
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'Validation error',
          details: (error as Error).message
        }
      } as ApiResponse);
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).default('desc')
  }),

  // UUID parameter
  uuidParam: z.object({
    id: z.string().uuid()
  }),

  // Ethereum address
  ethereumAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),

  // API key
  apiKey: z.string().regex(/^ak_[a-zA-Z0-9]{32}$/, 'Invalid API key format'),

  // Timestamp
  timestamp: z.number().int().positive(),

  // Monetary amount
  amount: z.number().positive().multipleOf(0.000001), // 6 decimal places

  // Search query
  search: z.object({
    q: z.string().min(1).max(100),
    filters: z.record(z.any()).optional(),
    facets: z.array(z.string()).optional()
  }),

  // Date range
  dateRange: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) <= new Date(data.to);
    }
    return true;
  }, 'From date must be before to date'),

  // File upload
  fileUpload: z.object({
    filename: z.string().min(1).max(255),
    mimetype: z.string().regex(/^[a-zA-Z]+\/[a-zA-Z0-9\-\+\.]+$/),
    size: z.number().int().positive().max(10 * 1024 * 1024) // 10MB max
  })
};

// Validation helpers
export function validateId(paramName: string = 'id') {
  return validateRequest({
    params: z.object({
      [paramName]: z.string().min(1)
    })
  });
}

export function validateUUID(paramName: string = 'id') {
  return validateRequest({
    params: z.object({
      [paramName]: z.string().uuid()
    })
  });
}

export function validatePagination() {
  return validateRequest({
    query: commonSchemas.pagination
  });
}

export function validateEthereumAddress(paramName: string = 'address') {
  return validateRequest({
    params: z.object({
      [paramName]: commonSchemas.ethereumAddress
    })
  });
}

// Custom validation functions
export function validateEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}

export function validateStringArray(separator: string = ',') {
  return z.string().transform(str => str.split(separator).map(s => s.trim()).filter(Boolean));
}

export function validateNumberArray(separator: string = ',') {
  return z.string().transform(str => 
    str.split(separator).map(s => {
      const num = parseFloat(s.trim());
      if (isNaN(num)) throw new Error(`Invalid number: ${s}`);
      return num;
    })
  );
}

// Conditional validation
export function validateConditional<T>(
  condition: (data: any) => boolean,
  schema: ZodSchema<T>
): ZodSchema<T | undefined> {
  return z.any().optional().refine(data => {
    if (condition(data)) {
      return schema.safeParse(data).success;
    }
    return true;
  });
}

// Schema composition helpers
export function createWorkflowSchema() {
  return z.object({
    name: z.string().min(1).max(100),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format (x.y.z)'),
    description: z.string().max(1000).optional(),
    nodes: z.array(z.object({
      id: z.string().min(1),
      type: z.enum(['start', 'end', 'task', 'conditional', 'parallel', 'loop', 'subworkflow', 'agent', 'human']),
      name: z.string().min(1),
      config: z.record(z.any())
    })).min(1),
    edges: z.array(z.object({
      id: z.string().min(1),
      source: z.string().min(1),
      target: z.string().min(1),
      condition: z.object({
        type: z.enum(['expression', 'script', 'function']),
        value: z.string()
      }).optional()
    })),
    variables: z.record(z.any()).optional(),
    metadata: z.object({
      author: z.string().optional(),
      tags: z.array(z.string()).optional(),
      category: z.string().optional(),
      sensitivity: z.enum(['public', 'internal', 'confidential', 'secret']).optional()
    }).optional()
  });
}

export function createAgentSchema() {
  return z.object({
    type: z.enum(['researcher', 'coder', 'analyst', 'tester', 'coordinator', 'financial']),
    name: z.string().min(1).max(100),
    capabilities: z.array(z.string()).min(1),
    resources: z.object({
      cpu: z.number().positive(),
      memory: z.number().positive(),
      maxConcurrentTasks: z.number().int().positive()
    }).optional()
  });
}

export function createPaymentSchema() {
  return z.object({
    amount: commonSchemas.amount,
    token: z.string().min(1).max(10),
    recipient: commonSchemas.ethereumAddress,
    memo: z.string().max(200).optional(),
    urgency: z.enum(['normal', 'high']).optional()
  });
}

// Validation middleware with custom error handling
export function validateWithCustomErrors(
  _schemas: ValidationOptions,
  customErrorHandler?: (errors: ValidationErrorDetail[]) => ApiResponse
) {
  return (req: ApiRequest, res: Response, next: NextFunction): void => {
    const errors: ValidationErrorDetail[] = [];

    // Perform validation (same logic as validateRequest)
    // ... validation logic here ...
    // Note: This is a placeholder implementation

    if (errors.length > 0) {
      const response = customErrorHandler ? 
        customErrorHandler(errors) :
        {
          success: false,
          error: {
            code: ApiErrorCode.INVALID_REQUEST,
            message: 'Validation failed',
            details: { errors, count: errors.length }
          },
          meta: {
            timestamp: Date.now(),
            version: '1.0.0',
            requestId: req.requestId!
          }
        } as ApiResponse;

      res.status(400).json(response);
      return;
    }

    next();
  };
}

// Schema transformation helpers
export function transformStringToNumber() {
  return z.string().transform(val => {
    const num = parseFloat(val);
    if (isNaN(num)) throw new Error('Invalid number');
    return num;
  });
}

export function transformStringToBoolean() {
  return z.string().transform(val => {
    const lower = val.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    throw new Error('Invalid boolean value');
  });
}

export function transformStringToDate() {
  return z.string().transform(val => {
    const date = new Date(val);
    if (isNaN(date.getTime())) throw new Error('Invalid date');
    return date;
  });
}

// Export commonly used schemas for reuse
export const validationSchemas = {
  workflow: createWorkflowSchema(),
  agent: createAgentSchema(),
  payment: createPaymentSchema(),
  ...commonSchemas
};