declare module 'tiny-csrf';

declare function csurf(secret: string, forbiddenMethods: Array<string>, excludedUrls: Array<string | RegExp>, excludedReferers: Array<string>): Promise<any>;