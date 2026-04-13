// Contrato de respuesta universal — mismo shape que devuelven los microservicios
export interface ApiResponse<T = unknown> {
  statusCode: number;
  intOpCode:  string;  // Formato: "SxUS200", "SxGW403", etc.
  data:       T[];
}

// Códigos de operación del Gateway (prefijo GW)
export const OP_CODES = {
  OK:             'SxGW200',
  CREATED:        'SxGW201',
  BAD_REQUEST:    'SxGW400',
  UNAUTHORIZED:   'SxGW401',
  FORBIDDEN:      'SxGW403',
  NOT_FOUND:      'SxGW404',
  CONFLICT:       'SxGW409',
  RATE_LIMITED:   'SxGW429',
  INTERNAL_ERROR: 'SxGW500',
} as const;

// Payload que vive dentro del JWT firmado por el Gateway
export interface JwtPayload {
  sub:                string;    // userId
  email:              string;
  globalPermissions:  string[];
  permissionsByGroup: Record<string, string[]>;
  iat?:               number;
  exp?:               number;
}

