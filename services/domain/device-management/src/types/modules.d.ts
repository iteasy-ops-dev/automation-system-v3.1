/**
 * Type declarations for modules without TypeScript definitions
 */

declare module 'net-snmp' {
  export const Version2c: any;
  export function createSession(host: string, community: string, options?: any): any;
}

declare module 'ping' {
  export const promise: {
    probe(host: string, options?: any): Promise<any>;
  };
}
